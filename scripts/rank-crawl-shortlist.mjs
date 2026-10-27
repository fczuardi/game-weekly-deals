import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const input = resolve(process.argv[2] || 'crawl/processed/mercadolivre-index.json');
const outputDir = dirname(input);
const index = JSON.parse(readFileSync(input, 'utf8'));
const budgetCents = 7000;

const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function gameKey(title, platform) {
  let value = fold(title)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(playstation|ps)\s*[1-5]\b/g, ' ')
    .replace(/\bps\s*vita\b|\bpsp\b/g, ' ')
    .replace(/\bmidia\s+fisica\b|\bfisico\b|\boriginal\b|\busado\b|\bseminovo\b/g, ' ')
    .replace(/\bedicao\s+padrao\b|\bstandard\s+edition\b/g, ' ')
    .replace(/\b(jogo|game)\b|\bpara\b|\bsony\b/g, ' ')
    .replace(/\b[am]\s*\d+\b$/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  return `${platform || 'unknown'}:${value || fold(title).replace(/\s+/g, '-')}`;
}

const rules = [
  ['digital_or_account', /\b(midia digital|conta (primaria|secundaria)|codigo digital|ativacao)\b/],
  ['reproduction_or_unofficial', /\b(reproducao|repro|alternativ[ao]|gravado|patch|desbloquead[ao])\b/],
  ['online_only', /\b(so joga online|apenas online|online only)\b/],
  ['accessory_or_hardware', /\b(controle|joystick|console|carregador|charging|cabo|adaptador|fonte|headset|camera|suporte|memory card|cartao de memoria|capa de console|skin)\b/],
  ['bundle_or_lot', /\b(lote|kit|combo)\b/]
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
  gameKey: gameKey(listing.title, listing.platform),
  review: classify(listing.title)
}));

const eligible = reviewed.filter(listing =>
  listing.priceCents <= budgetCents &&
  listing.condition && fold(listing.condition).includes('usado') &&
  listing.review.exclusions.length === 0
);

const groups = Map.groupBy(eligible, listing => listing.gameKey);
const ranked = [];
for (const [key, offers] of groups) {
  if (offers.length < 2) continue;
  const sorted = [...offers].sort((a, b) => a.priceCents - b.priceCents || a.title.localeCompare(b.title, 'pt-BR'));
  const pick = sorted[0];
  const medianPriceCents = median(offers.map(offer => offer.priceCents));
  const savingsCents = Math.max(0, medianPriceCents - pick.priceCents);
  const discountPercent = medianPriceCents ? savingsCents / medianPriceCents * 100 : 0;
  const warningPenalty = pick.review.warnings.length * 12;
  const shippingKnownFree = pick.shipping?.free === true;
  const shippingUncertaintyPenalty = shippingKnownFree ? 0 : 6;
  const score = Math.round((discountPercent * 1.4 + Math.log2(offers.length) * 8 + Math.min(20, savingsCents / 100) + (pick.review.completenessClaimed ? 4 : 0) - warningPenalty - shippingUncertaintyPenalty) * 10) / 10;
  ranked.push({
    rank: 0,
    score,
    gameKey: key,
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
    comparablePricesCents: sorted.map(offer => offer.priceCents)
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
  '- Sports titles and common games are not automatically excluded; personal taste and collection fit are not present in the crawl.',
  '- Similar-title grouping is heuristic and may occasionally merge editions or split spelling variants.',
  ''
].join('\n');
writeFileSync(resolve(outputDir, 'SHORTLIST.md'), report);

console.log(`Ranked ${ranked.length} comparable game group(s) from ${eligible.length} eligible listing(s).`);
console.log(`Wrote crawl shortlist JSON, CSV and Markdown report beside the crawl index.`);
