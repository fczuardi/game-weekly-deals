import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const input = resolve(process.argv[2] || 'crawl/processed/mercadolivre-index.json');
const outputDir = dirname(input);
const index = JSON.parse(readFileSync(input, 'utf8'));
const budgetCents = 7000;
const picksPath = resolve('data/mercadolivre-picks.json');
const aliasesPath = resolve('data/mercadolivre-title-aliases.json');
const manualPicks = existsSync(picksPath) ? JSON.parse(readFileSync(picksPath, 'utf8')) : { schemaVersion: 1, picks: [] };
const titleAliases = existsSync(aliasesPath) ? JSON.parse(readFileSync(aliasesPath, 'utf8')) : { schemaVersion: 1, groups: [] };
if (manualPicks.schemaVersion !== 1 || !Array.isArray(manualPicks.picks)) throw new Error('Invalid Mercado Livre manual-picks file');
for (const pick of manualPicks.picks) {
  for (const field of ['gameKey', 'preferredIdentityKey', 'declaredOn', 'reason']) {
    if (typeof pick[field] !== 'string' || !pick[field]) throw new Error(`Invalid manual pick field: ${field}`);
  }
}
if (new Set(manualPicks.picks.map(pick => pick.gameKey)).size !== manualPicks.picks.length) throw new Error('Duplicate manual game pick');
const picksByGame = new Map(manualPicks.picks.map(pick => [pick.gameKey, pick]));
if (titleAliases.schemaVersion !== 1 || !Array.isArray(titleAliases.groups)) throw new Error('Invalid Mercado Livre title-aliases file');

const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function normalizedGameTitle(title) {
  const folded = fold(title);
  const fifaInstallments = [...folded.matchAll(/\bfifa(?:\s+soccer)?\s+(\d{1,2})\b/g)];
  if (fifaInstallments.length) return `fifa ${Number(fifaInstallments.at(-1)[1])}`;
  const pesInstallment = folded.match(/\bpro\s+evolution\s+soccer\s+(\d{2,4})\b/) || folded.match(/\bpes\s*(\d{2,4})\b/);
  if (pesInstallment) {
    const number = Number(pesInstallment[1]);
    return `pes ${number >= 9 && number <= 30 ? 2000 + number : number}`;
  }
  return folded
    .replace(/[’']s\b/g, 's')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(playstation|ps)\s*[1-5]\b/g, ' ')
    .replace(/\bplay\s*[1-5]\b/g, ' ')
    .replace(/\bps\s*vita\b|\bpsp\b/g, ' ')
    .replace(/\bmidia\s+fisica\b|\bfisico\b|\boriginal\b|\busado\b|\bseminovo\b/g, ' ')
    .replace(/\b(edicao\s+padrao|standard\s+edition|day\s+one\s+edition)\b/g, ' ')
    .replace(/\bpara\s+(o|a)\b/g, ' ')
    .replace(/\b(jogo|game)\b|\bpara\b|\bsony\b|\bubisoft\b|\bactivision\b|\bnaughty\s+dog\b/g, ' ')
    .replace(/\b(dublado|legendado|portugues|brasil|brasileiro)\b/g, ' ')
    .replace(/\b(completo|com\s+manual|com\s+caixa)\b/g, ' ')
    .replace(/\b[adfmnpstu]\s*\d+\b$/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function gameKey(title, platform) {
  const value = normalizedGameTitle(title).replace(/\s+/g, '-');
  return `${platform || 'unknown'}:${value || fold(title).replace(/\s+/g, '-')}`;
}

const tokens = value => normalizedGameTitle(value).split(' ').filter(Boolean).map(token => {
  if (/^0\d+$/.test(token)) return String(Number(token));
  return token.length > 5 && token.endsWith('s') ? token.slice(0, -1) : token;
});
const numberTokens = value => new Set(tokens(value).filter(token => /^\d+$/.test(token)));
const sameSet = (left, right) => left.size === right.size && [...left].every(value => right.has(value));
const includesSequence = (whole, part) => {
  if (part.length > whole.length) return false;
  return whole.some((_, index) => part.every((token, offset) => whole[index + offset] === token));
};

export function titleMatch(leftTitle, rightTitle) {
  const left = tokens(leftTitle);
  const right = tokens(rightTitle);
  if (!left.length || !right.length) return { matches: false, method: null, confidence: 0 };
  const leftNumbers = numberTokens(leftTitle);
  const rightNumbers = numberTokens(rightTitle);
  if (!sameSet(leftNumbers, rightNumbers)) return { matches: false, method: 'number_conflict', confidence: 0 };
  if (left.join(' ') === right.join(' ')) return { matches: true, method: 'normalized_exact', confidence: 1 };
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  const shortNumericIdentity = [...leftNumbers].some(value => Number(value) < 1900);
  if (shorter.length >= 2 && includesSequence(longer, shorter) && (shorter.length >= 4 || shortNumericIdentity)) {
    return { matches: true, method: 'title_containment', confidence: Math.max(0.75, Math.round(shorter.length / longer.length * 100) / 100) };
  }
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter(token => rightSet.has(token)).length;
  const similarity = intersection / new Set([...leftSet, ...rightSet]).size;
  return { matches: similarity >= 0.82, method: similarity >= 0.82 ? 'token_similarity' : null, confidence: Math.round(similarity * 100) / 100 };
}

const aliasKeyByNormalizedTitle = new Map();
for (const group of titleAliases.groups) {
  if (typeof group.gameKey !== 'string' || !group.gameKey || !Array.isArray(group.aliases) || !group.aliases.length) throw new Error('Invalid Mercado Livre title alias group');
  for (const alias of group.aliases) {
    const key = `${group.platform || 'unknown'}:${normalizedGameTitle(alias)}`;
    if (aliasKeyByNormalizedTitle.has(key)) throw new Error(`Duplicate normalized title alias: ${key}`);
    aliasKeyByNormalizedTitle.set(key, group.gameKey);
  }
}

function groupListings(listings) {
  const byPlatform = Map.groupBy(listings, listing => listing.platform || 'unknown');
  const result = new Map();
  for (const [platform, platformListings] of byPlatform) {
    const clusters = [];
    const clustersByGameKey = new Map();
    const clustersByToken = new Map();
    const indexCluster = (cluster, title) => {
      for (const token of new Set(tokens(title))) {
        if (!clustersByToken.has(token)) clustersByToken.set(token, new Set());
        clustersByToken.get(token).add(cluster);
      }
    };
    for (const listing of platformListings) {
      const aliasKey = aliasKeyByNormalizedTitle.get(`${platform}:${normalizedGameTitle(listing.title)}`);
      if (aliasKey) {
        const existing = clustersByGameKey.get(aliasKey);
        if (existing) {
          existing.offers.push({ ...listing, titleMatch: { method: 'manual_alias', confidence: 1 } });
          existing.anchors.push(listing.title);
          indexCluster(existing, listing.title);
        } else {
          const cluster = { gameKey: aliasKey, lockedKey: true, anchors: [listing.title], offers: [{ ...listing, titleMatch: { method: 'manual_alias', confidence: 1 } }] };
          clusters.push(cluster);
          clustersByGameKey.set(aliasKey, cluster);
          indexCluster(cluster, listing.title);
        }
        continue;
      }
      let best = null;
      const candidates = new Set(tokens(listing.title).flatMap(token => [...(clustersByToken.get(token) || [])]));
      for (const cluster of candidates) {
        const matches = cluster.anchors.map(anchor => titleMatch(listing.title, anchor)).filter(match => match.matches);
        if (matches.length !== cluster.anchors.length) continue;
        const confidence = Math.min(...matches.map(match => match.confidence));
        if (!best || confidence > best.confidence) best = { cluster, confidence, method: matches.some(match => match.method === 'title_containment') ? 'title_containment' : matches[0].method };
      }
      if (best) {
        best.cluster.offers.push({ ...listing, titleMatch: { method: best.method, confidence: best.confidence } });
        best.cluster.anchors.push(listing.title);
        indexCluster(best.cluster, listing.title);
      } else {
        const key = gameKey(listing.title, platform);
        const cluster = { gameKey: key, lockedKey: false, anchors: [listing.title], offers: [{ ...listing, titleMatch: { method: 'normalized_exact', confidence: 1 } }] };
        clusters.push(cluster);
        clustersByGameKey.set(key, cluster);
        indexCluster(cluster, listing.title);
      }
    }
    const byTitleLength = (a, b) => tokens(a.title).length - tokens(b.title).length || a.title.localeCompare(b.title, 'pt-BR');
    const mergedClusters = [];
    const mergedByToken = new Map();
    for (const cluster of clusters) {
      cluster.representative = [...cluster.offers].sort(byTitleLength)[0];
      const candidates = new Set(tokens(cluster.representative.title).flatMap(token => [...(mergedByToken.get(token) || [])]));
      let destination = null;
      let destinationMatch = null;
      for (const candidate of candidates) {
        if (cluster.lockedKey && candidate.lockedKey && cluster.gameKey !== candidate.gameKey) continue;
        const match = titleMatch(cluster.representative.title, candidate.representative.title);
        if (match.matches && (!destinationMatch || match.confidence > destinationMatch.confidence)) {
          destination = candidate;
          destinationMatch = match;
        }
      }
      if (destination) {
        cluster.offers.forEach(offer => destination.offers.push({ ...offer, titleMatch: { method: destinationMatch.method, confidence: destinationMatch.confidence } }));
        destination.anchors.push(...cluster.anchors);
        if (cluster.lockedKey) {
          destination.gameKey = cluster.gameKey;
          destination.lockedKey = true;
        }
        destination.representative = [...destination.offers].sort(byTitleLength)[0];
        for (const token of new Set(tokens(destination.representative.title))) {
          if (!mergedByToken.has(token)) mergedByToken.set(token, new Set());
          mergedByToken.get(token).add(destination);
        }
      } else {
        mergedClusters.push(cluster);
        for (const token of new Set(tokens(cluster.representative.title))) {
          if (!mergedByToken.has(token)) mergedByToken.set(token, new Set());
          mergedByToken.get(token).add(cluster);
        }
      }
    }
    for (const cluster of mergedClusters) {
      const manualKey = cluster.offers.map(offer => aliasKeyByNormalizedTitle.get(`${platform}:${normalizedGameTitle(offer.title)}`)).find(Boolean);
      const shortest = [...cluster.offers].sort((a, b) => tokens(a.title).length - tokens(b.title).length || a.title.localeCompare(b.title, 'pt-BR'))[0];
      const key = manualKey || gameKey(shortest.title, platform);
      cluster.offers.forEach(offer => { offer.gameKey = key; });
      result.set(key, [...(result.get(key) || []), ...cluster.offers]);
    }
  }
  return result;
}

const rules = [
  ['digital_or_account', /\b(midia digital|conta (primaria|secundaria)|codigo digital|ativacao)\b/],
  ['reproduction_or_unofficial', /\b(reproducao|repro|alternativ[ao]|gravado|patch|desbloquead[ao])\b/],
  ['online_only', /\b(so joga online|apenas online|online only)\b/],
  ['accessory_or_hardware', /\b(controle|joystick|console|carregador|charging|cabo|adaptador|fonte|headset|camera|suporte|memory card|cartao de memoria|capa de console|skin)\b/],
  ['bundle_or_lot', /\b(lote|kit|combo)\b/],
  ['empty_case', /\b(sem (o )?jogo|so a caixa|somente a caixa)\b/]
];
const warningRules = [
  ['damaged', /\b(avaria|defeito|danificad[ao]|nao funciona)\b/],
  ['disc_only_or_incomplete', /\b(sem caixa|sem capa|somente (o )?disco|so (o )?disco|midia solta)\b/],
  ['online_mentioned', /\bonline\b/]
];

export function classify(title) {
  const normalized = fold(title);
  return {
    exclusions: rules.filter(([, pattern]) => pattern.test(normalized)).map(([name]) => name),
    warnings: warningRules.filter(([, pattern]) => pattern.test(normalized)).map(([name]) => name),
    completenessClaimed: /\b(completo|com manual|com caixa)\b/.test(normalized)
  };
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const reviewed = index.listings.map(listing => ({
  ...listing,
  review: classify(listing.title)
}));

const eligible = reviewed.filter(listing =>
  listing.priceCents <= budgetCents &&
  listing.condition && fold(listing.condition).includes('usado') &&
  listing.review.exclusions.length === 0
);

const groups = groupListings(eligible);
const ranked = [];
for (const [key, offers] of groups) {
  if (offers.length < 2) continue;
  const sorted = [...offers].sort((a, b) => a.priceCents - b.priceCents || a.title.localeCompare(b.title, 'pt-BR'));
  const automaticPick = sorted[0];
  const manualPick = picksByGame.get(key) || null;
  const pick = manualPick ? sorted.find(offer => offer.identityKey === manualPick.preferredIdentityKey) : automaticPick;
  if (manualPick && !pick) throw new Error(`Manual pick ${manualPick.preferredIdentityKey} was not found in group ${key}`);
  const medianPriceCents = median(offers.map(offer => offer.priceCents));
  const savingsCents = Math.max(0, medianPriceCents - pick.priceCents);
  const discountPercent = medianPriceCents ? savingsCents / medianPriceCents * 100 : 0;
  const warningPenalty = pick.review.warnings.length * 12;
  const shippingKnownFree = pick.shipping?.free === true;
  const shippingUncertaintyPenalty = shippingKnownFree ? 0 : 6;
  const comparableOffers = sorted.map(offer => ({
    title: offer.title,
    priceCents: offer.priceCents,
    shippingStatus: offer.shipping?.free === true ? 'free_shown' : 'unknown_requires_verification',
    maximumAffordableShippingCents: budgetCents - offer.priceCents,
    identityKey: offer.identityKey,
    identityLevel: offer.identityLevel,
    url: offer.url
  }));
  const freeShippingAlternative = comparableOffers.find(offer => offer.shippingStatus === 'free_shown');
  const score = Math.round((discountPercent * 1.4 + Math.log2(offers.length) * 8 + Math.min(20, savingsCents / 100) + (pick.review.completenessClaimed ? 4 : 0) - warningPenalty - shippingUncertaintyPenalty) * 10) / 10;
  ranked.push({
    rank: 0,
    score,
    gameKey: key,
    selectionMethod: manualPick ? 'manual_override' : 'automatic_cheapest',
    manualSelection: manualPick,
    automaticCheapestOffer: {
      identityKey: automaticPick.identityKey,
      title: automaticPick.title,
      priceCents: automaticPick.priceCents,
      shippingStatus: automaticPick.shipping?.free === true ? 'free_shown' : 'unknown_requires_verification',
      maximumAffordableShippingCents: budgetCents - automaticPick.priceCents,
      url: automaticPick.url
    },
    title: pick.title,
    platform: pick.platform,
    priceCents: pick.priceCents,
    budgetCents,
    shippingStatus: shippingKnownFree ? 'free_shown' : 'unknown_requires_verification',
    maximumAffordableShippingCents: budgetCents - pick.priceCents,
    medianComparablePriceCents: medianPriceCents,
    savingsVsMedianCents: savingsCents,
    discountVsMedianPercent: Math.round(discountPercent * 10) / 10,
    comparableOfferCount: offers.length,
    condition: pick.condition,
    seller: pick.seller,
    warnings: pick.review.warnings,
    completenessClaimedInTitle: pick.review.completenessClaimed,
    identityLevel: pick.identityLevel,
    url: pick.url,
    comparablePricesCents: sorted.map(offer => offer.priceCents),
    freeShippingAlternative: freeShippingAlternative || null,
    comparableOffers,
    titleMatching: {
      methods: [...new Set(offers.map(offer => offer.titleMatch.method))],
      minimumConfidence: Math.min(...offers.map(offer => offer.titleMatch.confidence))
    }
  });
}
ranked.sort((a, b) => b.score - a.score || a.priceCents - b.priceCents || a.title.localeCompare(b.title, 'pt-BR'));
ranked.forEach((item, index) => { item.rank = index + 1; });

const excludedCounts = reviewed.flatMap(item => item.review.exclusions).reduce((counts, reason) => {
  counts[reason] = (counts[reason] || 0) + 1;
  return counts;
}, {});
const shortlist = {
  schemaVersion: 1,
  sourceIndex: input,
  builtFromCaptureThrough: index.builtFromCaptureThrough,
  methodology: {
    budgetCents,
    requirements: ['used condition', 'item price at or below budget', 'at least two comparable normalized titles'],
    warning: 'Heuristic ranking only. Catalog-level identities, authenticity, exact-copy condition, checkout total, seller reputation, edition and game quality remain unverified.'
  },
  stats: {
    indexedListings: reviewed.length,
    eligibleListings: eligible.length,
    eligibleWithFreeShipping: eligible.filter(item => item.shipping?.free === true).length,
    eligibleWithShippingToVerify: eligible.filter(item => item.shipping?.free !== true).length,
    comparableGameGroups: ranked.length,
    singletonEligibleGroups: [...groups.values()].filter(group => group.length === 1).length,
    excludedByReason: excludedCounts
  },
  manualPicks: manualPicks.picks,
  titleAliases: titleAliases.groups,
  candidates: ranked
};
writeFileSync(resolve(outputDir, 'mercadolivre-shortlist.json'), `${JSON.stringify(shortlist, null, 2)}\n`);

const csv = value => {
  const string = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};
const columns = ['rank', 'score', 'title', 'platform', 'priceCents', 'shippingStatus', 'maximumAffordableShippingCents', 'medianComparablePriceCents', 'savingsVsMedianCents', 'discountVsMedianPercent', 'comparableOfferCount', 'warnings', 'url'];
const csvRows = ranked.map(item => [item.rank, item.score, item.title, item.platform, item.priceCents, item.shippingStatus, item.maximumAffordableShippingCents, item.medianComparablePriceCents, item.savingsVsMedianCents, item.discountVsMedianPercent, item.comparableOfferCount, item.warnings.join('|'), item.url]);
writeFileSync(resolve(outputDir, 'mercadolivre-shortlist.csv'), `${columns.join(',')}\n${csvRows.map(row => row.map(csv).join(',')).join('\n')}\n`);

const brl = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const report = [
  '# Mercado Livre heuristic shortlist',
  '',
  `Based on captures through ${index.builtFromCaptureThrough}.`,
  '',
  `- Indexed identity keys: ${reviewed.length}`,
  `- Eligible listings after mechanical filters: ${eligible.length}`,
  `- Eligible with free shipping shown: ${shortlist.stats.eligibleWithFreeShipping}`,
  `- Eligible with shipping still to verify: ${shortlist.stats.eligibleWithShippingToVerify}`,
  `- Comparable normalized game groups: ${ranked.length}`,
  `- Eligible singleton groups not ranked: ${shortlist.stats.singletonEligibleGroups}`,
  '',
  '> This is a triage list, not a purchase recommendation. Prices are compared only with similar titles in this crawl. Verify the exact seller offer, photos, authenticity, completeness, checkout total and whether the game still functions as desired.',
  '',
  '## Top 50',
  '',
  '| Rank | Candidate | Price | Shipping / budget test | Group median | Difference | Comparables | Flags |',
  '|---:|---|---:|---|---:|---:|---:|---|',
  ...ranked.slice(0, 50).map(item => `| ${item.rank} | [${item.title}](${item.url}) · ${item.platform || 'unknown'} | ${brl(item.priceCents)} | ${item.shippingStatus === 'free_shown' ? 'Free shown · within ceiling' : `Good if shipping ≤ ${brl(item.maximumAffordableShippingCents)}`} | ${brl(item.medianComparablePriceCents)} | −${brl(item.savingsVsMedianCents)} (${item.discountVsMedianPercent}%) | ${item.comparableOfferCount} | ${item.warnings.join(', ') || '—'} |`),
  '',
  '## Mechanical exclusions',
  '',
  ...Object.entries(excludedCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => `- ${reason}: ${count}`),
  '',
  '## Ranking notes',
  '',
  '- Only the cheapest observed listing per normalized game/platform group is ranked.',
  '- Scores reward discount versus the group median, absolute savings, number of comparables and explicit completeness claims.',
  '- Damage, incomplete-copy and online mentions reduce the score.',
  '- Unknown shipping remains eligible with a small score penalty and an explicit maximum affordable shipping amount.',
  '- Each candidate retains all grouped offer URLs; the HTML preview exposes them for direct comparison.',
  '- A tracked manual pick overrides the displayed representative while preserving the automatic cheapest offer for comparison.',
  '- Sports titles and common games are not automatically excluded; personal taste and collection fit are not present in the crawl.',
  '- Similar-title grouping is heuristic and may occasionally merge editions or split spelling variants.',
  ''
].join('\n');
writeFileSync(resolve(outputDir, 'SHORTLIST.md'), report);

console.log(`Ranked ${ranked.length} comparable game group(s) from ${eligible.length} eligible listing(s).`);
console.log(`Wrote crawl shortlist JSON, CSV and Markdown report beside the crawl index.`);
