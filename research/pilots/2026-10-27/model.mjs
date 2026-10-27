export const captureFiles = ['enjoei-page-1.json', 'enjoei-page-2.json', 'olx-page-1.json'];
export const money = cents => Number.isFinite(cents)
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
  : 'Unknown';
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function flatten(pages) {
  return pages.flatMap(page => {
    if (!['enjoei', 'olx'].includes(page.source) || !Array.isArray(page.cards)) throw new Error('Invalid capture');
    return page.cards.map(card => ({ ...card, source: page.source, page: page.pageOrdinal,
      capturedAt: page.capturedAt ?? page.capturedAtApprox,
      approximateTime: Boolean(page.capturedAtApprox), occurrences: 1,
      sightings: [{ page: page.pageOrdinal, position: card.position, placement: card.placement }] }));
  });
}
export function uniqueListings(rows) {
  const byId = new Map();
  for (const row of rows) {
    const key = `${row.source}:${row.sourceListingId}`;
    if (!byId.has(key)) byId.set(key, { ...row, sightings: [...row.sightings] });
    else {
      const existing = byId.get(key);
      existing.occurrences += 1;
      existing.sightings.push(...row.sightings);
      // Keep the first captured card; do not turn a changed price into an invented offer.
    }
  }
  return [...byId.values()];
}
export function selectRows(rows, { query = '', source = '', sort = 'price-asc', unique = true } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const selected = (unique ? uniqueListings(rows) : rows).filter(row =>
    (!source || row.source === source) && terms.every(term => normalize(row.title).includes(term)));
  return selected.sort((a, b) => {
    if (sort === 'price-desc') return b.priceCents - a.priceCents || a.title.localeCompare(b.title);
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'capture') return a.source.localeCompare(b.source) || a.page - b.page || a.position - b.position;
    return a.priceCents - b.priceCents || a.title.localeCompare(b.title);
  });
}
export function safeListingUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const allowed = ['enjoei.com.br', 'olx.com.br'];
    return allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}
