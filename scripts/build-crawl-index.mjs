import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'crawl');
const output = resolve(process.argv[3] || join(root, 'processed'));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (path.startsWith(output)) return [];
    return entry.isDirectory() ? walk(path) : entry.name.endsWith('.json') ? [path] : [];
  });
}

function csv(value) {
  const string = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function identity(listing) {
  if (listing.sellerListingId) return { key: `seller:${listing.sellerListingId}`, level: 'seller_listing' };
  if (listing.catalogProductId) return { key: `catalog:${listing.catalogProductId}`, level: 'catalog_product' };
  return { key: `url:${listing.url}`, level: 'url' };
}

function batchKey(file, snapshot) {
  const url = new URL(snapshot.sourcePage);
  const shippingOrigin = url.pathname.match(/SHIPPING\*ORIGIN_(\d+)/i)?.[1] || 'any';
  const range = snapshot.search.priceRange;
  const rangeLabel = range ? `${range.minCents / 100}-${range.maxCents / 100}` : 'any';
  return `${basename(dirname(file))}__price-${rangeLabel}__shipping-origin-${shippingOrigin}`;
}

const files = walk(root).sort();
if (!files.length) throw new Error(`No JSON crawl files found under ${root}`);

const errors = [];
const batches = new Map();
const products = new Map();
let rawRows = 0;
let latestCapture = '';

for (const file of files) {
  let snapshot;
  try { snapshot = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { errors.push({ file: relative(root, file), error: error.message }); continue; }
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.listings) || !snapshot.search) {
    errors.push({ file: relative(root, file), error: 'Unsupported or malformed snapshot' });
    continue;
  }
  latestCapture = latestCapture > snapshot.capturedAt ? latestCapture : snapshot.capturedAt;
  const id = batchKey(file, snapshot);
  if (!batches.has(id)) batches.set(id, {
    id,
    directory: relative(root, dirname(file)),
    priceRange: snapshot.search.priceRange,
    sort: snapshot.search.sort,
    sourceExample: snapshot.sourcePage,
    pages: new Map(),
    rawRows: 0
  });
  const batch = batches.get(id);
  const pageFiles = batch.pages.get(snapshot.search.page) || [];
  pageFiles.push(relative(root, file));
  batch.pages.set(snapshot.search.page, pageFiles);
  batch.rawRows += snapshot.listings.length;

  snapshot.listings.forEach(listing => {
    rawRows++;
    const idInfo = identity(listing);
    const sighting = {
      capturedAt: snapshot.capturedAt,
      batchId: id,
      page: snapshot.search.page,
      position: listing.position,
      priceCents: listing.priceCents,
      sourceFile: relative(root, file),
      sourcePage: snapshot.sourcePage
    };
    if (!products.has(idInfo.key)) products.set(idInfo.key, {
      identityKey: idInfo.key,
      identityLevel: idInfo.level,
      sellerListingId: listing.sellerListingId,
      catalogProductId: listing.catalogProductId,
      title: listing.title,
      platform: listing.platform,
      condition: listing.condition,
      seller: listing.seller,
      currency: listing.currency,
      shipping: listing.shipping,
      url: listing.url,
      _valuesCapturedAt: '',
      sightings: []
    });
    const product = products.get(idInfo.key);
    product.sightings.push(sighting);
    if (sighting.capturedAt >= product._valuesCapturedAt) {
      for (const field of ['title', 'platform', 'condition', 'seller', 'currency', 'shipping', 'url']) {
        if (listing[field] !== null && listing[field] !== undefined) product[field] = listing[field];
      }
      product._valuesCapturedAt = sighting.capturedAt;
    }
  });
}

const listings = [...products.values()].map(product => {
  product.sightings.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.sourceFile.localeCompare(b.sourceFile));
  const prices = product.sightings.map(item => item.priceCents);
  const { _valuesCapturedAt, ...publicProduct } = product;
  return {
    ...publicProduct,
    priceCents: prices.at(-1),
    minObservedPriceCents: Math.min(...prices),
    maxObservedPriceCents: Math.max(...prices),
    firstCapturedAt: product.sightings[0].capturedAt,
    lastCapturedAt: product.sightings.at(-1).capturedAt,
    sightingCount: product.sightings.length
  };
}).sort((a, b) => a.priceCents - b.priceCents || (a.platform || '').localeCompare(b.platform || '') || a.title.localeCompare(b.title, 'pt-BR'));

const batchList = [...batches.values()].map(batch => {
  const pages = [...batch.pages.keys()].sort((a, b) => a - b);
  const missingPages = pages.length ? Array.from({ length: pages.at(-1) }, (_, i) => i + 1).filter(page => !batch.pages.has(page)) : [];
  const duplicatePages = [...batch.pages].filter(([, names]) => names.length > 1).map(([page, names]) => ({ page, files: names }));
  const lastPageFiles = batch.pages.get(pages.at(-1)) || [];
  const lastCounts = lastPageFiles.map(name => JSON.parse(readFileSync(join(root, name), 'utf8')).listingCount);
  return {
    ...batch,
    pages: pages,
    pageCount: pages.length,
    missingPages,
    duplicatePages,
    likelyComplete: missingPages.length === 0 && lastCounts.some(count => count < 48),
    lastPageListingCounts: lastCounts
  };
});

const index = {
  schemaVersion: 1,
  source: 'mercadolivre.com.br userscript snapshots',
  builtFromCaptureThrough: latestCapture,
  identityWarning: 'catalog_product keys are not guaranteed to identify an exact seller copy; exact MLB seller-listing IDs were unavailable in these exports',
  stats: {
    files: files.length,
    parsedFiles: files.length - errors.length,
    rawRows,
    uniqueIdentityKeys: listings.length,
    repeatedRows: rawRows - listings.length,
    exactSellerListingKeys: listings.filter(item => item.identityLevel === 'seller_listing').length,
    catalogProductKeys: listings.filter(item => item.identityLevel === 'catalog_product').length,
    urlKeys: listings.filter(item => item.identityLevel === 'url').length
  },
  errors,
  batches: batchList,
  listings
};

mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'mercadolivre-index.json'), `${JSON.stringify(index, null, 2)}\n`);

const columns = ['identityKey', 'identityLevel', 'catalogProductId', 'title', 'platform', 'condition', 'seller', 'priceCents', 'minObservedPriceCents', 'maxObservedPriceCents', 'freeShipping', 'sightingCount', 'url'];
const rows = listings.map(item => [
  item.identityKey, item.identityLevel, item.catalogProductId, item.title, item.platform,
  item.condition, item.seller, item.priceCents, item.minObservedPriceCents,
  item.maxObservedPriceCents, item.shipping?.free, item.sightingCount, item.url
]);
writeFileSync(join(output, 'mercadolivre-listings.csv'), `${columns.join(',')}\n${rows.map(row => row.map(csv).join(',')).join('\n')}\n`);

const platformCounts = Object.entries(listings.reduce((counts, item) => {
  const platform = item.platform || 'unknown';
  counts[platform] = (counts[platform] || 0) + 1;
  return counts;
}, {})).sort((a, b) => b[1] - a[1]);
const report = [
  '# Mercado Livre crawl audit',
  '',
  `Built from captures through ${latestCapture}.`,
  '',
  `- Files parsed: ${index.stats.parsedFiles}/${index.stats.files}`,
  `- Raw rows: ${rawRows}`,
  `- Unique identity keys: ${listings.length}`,
  `- Repeated rows: ${rawRows - listings.length}`,
  `- Exact seller-listing identities: ${index.stats.exactSellerListingKeys}`,
  `- Catalog-product identities: ${index.stats.catalogProductKeys}`,
  `- URL-only identities: ${index.stats.urlKeys}`,
  '',
  '> Important: catalog-product deduplication does not prove two rows are the same physical used copy or seller offer.',
  '',
  '## Batch coverage',
  '',
  '| Batch | Pages | Rows | Duplicate pages | Missing pages | Likely complete |',
  '|---|---:|---:|---:|---:|---|',
  ...batchList.map(batch => `| ${batch.id} | ${batch.pageCount} | ${batch.rawRows} | ${batch.duplicatePages.map(x => x.page).join(', ') || '—'} | ${batch.missingPages.join(', ') || '—'} | ${batch.likelyComplete ? 'yes' : 'no/unknown'} |`),
  '',
  'A batch is only marked likely complete when pages are contiguous and its final captured page contains fewer than 48 results.',
  '',
  '## Unique keys by inferred platform',
  '',
  ...platformCounts.map(([platform, count]) => `- ${platform}: ${count}`),
  '',
  ...(errors.length ? ['## Parse errors', '', ...errors.map(error => `- ${error.file}: ${error.error}`), ''] : [])
].join('\n');
writeFileSync(join(output, 'REPORT.md'), report);

console.log(`Processed ${files.length - errors.length} file(s), ${rawRows} row(s), ${listings.length} unique identity key(s).`);
console.log(`Wrote ${relative(process.cwd(), output)}/mercadolivre-index.json, mercadolivre-listings.csv and REPORT.md.`);
