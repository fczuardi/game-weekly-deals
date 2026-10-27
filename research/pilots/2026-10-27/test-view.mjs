import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { captureFiles, flatten, uniqueListings, selectRows, safeListingUrl, normalize } from './model.mjs';
const pages = await Promise.all(captureFiles.map(file => readFile(new URL(file, import.meta.url), 'utf8').then(JSON.parse)));
const rows = flatten(pages);
assert.equal(rows.length, 120);
const unique = uniqueListings(rows);
assert.equal(unique.length, 119);
assert.equal(unique.filter(row => row.source === 'enjoei').length, 69);
assert.equal(unique.filter(row => row.source === 'olx').length, 50);
assert.equal(unique.find(row => row.sourceListingId === '153342133').occurrences, 2);
assert.equal(selectRows(rows, { source: 'olx' }).length, 50);
assert.equal(selectRows(rows, { source: 'enjoei', unique: false }).length, 70);
assert.equal(selectRows(rows, { query: 'definitely-not-a-title-1234' }).length, 0);
assert(selectRows(rows, { query: 'Ratchet' }).every(row => normalize(row.title).includes('ratchet')));
for (const sort of ['price-asc', 'price-desc']) {
  const result = selectRows(rows, { sort });
  for (let i=1;i<result.length;i++) assert(sort === 'price-asc' ? result[i-1].priceCents <= result[i].priceCents : result[i-1].priceCents >= result[i].priceCents);
}
for (const row of rows) {
  assert(safeListingUrl(row.url));
  assert.equal(row.deliveredTotalCents, null);
  assert.equal(row.shipping.priceCents, null);
  assert.equal(row.checkoutVerified, false);
}
assert.equal(safeListingUrl('javascript:alert(1)'), null);
assert.equal(safeListingUrl('https://olx.com.br.attacker.example/'), null);
assert.equal(safeListingUrl('https://attacker.example/'), null);
assert.equal(normalize('São'), 'sao');
console.log('PASS: 120 observations /119 unique; source filters, search, sorting, duplicates, shipping caveats and URL allowlist.');
