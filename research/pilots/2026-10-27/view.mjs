import { captureFiles, money, flatten, uniqueListings, selectRows, safeListingUrl } from './model.mjs';
const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const humanSource = source => source === 'enjoei' ? 'Enjoei' : 'OLX';
function card(row) {
  const article = el('article', undefined, 'card');
  const top = el('div', undefined, 'topline');
  const price = el('div', money(row.priceCents), 'price');
  price.append(el('small', 'ITEM PRICE ONLY'));
  top.append(el('span', humanSource(row.source), 'badge'), price);
  article.append(top, el('h2', row.title));
  const facts = el('div', undefined, 'facts');
  facts.append(el('p', `Seller as displayed: ${row.sellerRaw || 'Not shown'}`));
  facts.append(el('p', `Condition: ${row.conditionRaw || 'Used search filter; exact condition unchecked'}`));
  if (row.locationRaw) facts.append(el('p', `Listing location: ${row.locationRaw}`));
  if (row.occurrences > 1) facts.append(el('p', `${row.occurrences} captured occurrences of this listing ID`));
  const highlighted = row.sightings.some(s => s.placement.includes('highlight'));
  if (highlighted) facts.append(el('p', 'Includes seller-highlighted placement'));
  if (row.source === 'olx') facts.append(el('p', 'Promotion status not established'));
  article.append(facts);
  const shipping = row.shipping?.evidenceRaw;
  article.append(el('p', shipping ? `Shipping label: “${shipping}”. Destination cost and delivered total are unverified.` : 'Shipping and delivered total: unknown.', 'shipping'));
  const href = safeListingUrl(row.url);
  if (href) {
    const a = el('a', 'Open original listing ↗', 'open');
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    article.append(a);
  }
  const evidence = el('details', undefined, 'evidence');
  evidence.append(el('summary', 'Capture details & displayed text'));
  evidence.append(el('p', `Listing ID: ${row.sourceListingId}`));
  evidence.append(el('p', `Captured: ${row.capturedAt}${row.approximateTime ? ' (approximate minute)' : ''}`));
  if (row.paymentRaw) evidence.append(el('p', `Payment text: ${row.paymentRaw}`));
  const sightings = el('ul');
  row.sightings.forEach(s => sightings.append(el('li', `Page ${s.page}, position ${s.position} · ${s.placement.replaceAll('_', ' ')}`)));
  evidence.append(sightings, el('pre', row.publicCardText || 'No card text recorded.'));
  article.append(evidence);
  return article;
}
let allRows = [];
function render() {
  const options = { query: $('#query').value, source: $('#source').value, sort: $('#sort').value, unique: $('#unique').checked };
  const rows = selectRows(allRows, options);
  $('#results').replaceChildren(...rows.map(card));
  if (!rows.length) $('#results').append(el('p', 'No captured listings match these filters. Try a shorter title or reset the filters.', 'empty'));
  $('#status').textContent = `Showing ${rows.length} ${options.unique ? 'distinct listings' : 'captured cards'} · ${allRows.length} observations in this frozen snapshot · no delivered totals verified`;
}
function reset() {
  $('#query').value = ''; $('#source').value = ''; $('#sort').value = 'price-asc'; $('#unique').checked = true;
  render();
}
$('#filters').addEventListener('submit', event => event.preventDefault());
$('#query').addEventListener('input', render);
for (const selector of ['#source', '#sort', '#unique']) $(selector).addEventListener('change', render);
$('#reset').addEventListener('click', reset);
try {
  const pages = await Promise.all(captureFiles.map(async file => {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return response.json();
  }));
  allRows = flatten(pages);
  $('#unique-count').textContent = uniqueListings(allRows).length;
  $('#observation-count').textContent = allRows.length;
  render();
} catch (error) {
  console.error(error);
  $('#status').textContent = 'The capture files could not be loaded. Reload this page, or read the JSON files linked in the methodology on GitHub.';
  $('#status').className = 'error';
  $('#filters').querySelectorAll('input, select, button').forEach(control => control.disabled = true);
}
