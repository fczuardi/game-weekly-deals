import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../userscripts/mercado-livre-search-export.user.js', import.meta.url), 'utf8');
const context = {
  location: { href: 'https://lista.mercadolivre.com.br/games', origin: 'https://lista.mercadolivre.com.br', pathname: '/games', search: '' },
  URL,
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(source, context);
const exporter = context.__GWD_ML_EXPORTER__;

function element({ value = '', selectors = {} } = {}) {
  return {
    textContent: value,
    querySelector(selector) { return selectors[selector] || null; }
  };
}

const amount = element({ selectors: {
  '[data-andes-money-amount-fraction]': element({ value: '33' }),
  '[data-andes-money-amount-cents]': element({ value: '99' })
} });
const href = 'https://www.mercadolivre.com.br/gran-turismo-5-ps3-midia-fisica/up/MLBU5340684247?pdp_filters=x&wid=MLB5326886083#tracking';
const titleLink = { href, textContent: 'Gran Turismo 5 Ps3 Mídia Física' };
const card = element({ selectors: {
  'a.poly-component__title': titleLink,
  '.poly-price__current .andes-money-amount, .poly-price__amount': amount,
  '.poly-component__shipping-v2': element({ value: 'Frete grátis' }),
  '.poly-component__item-condition': element({ value: 'Usado' }),
  '.poly-component__seller': element({ value: 'LOJA EXEMPLO' })
} });

assert.equal(exporter.parsePrice(card), 3399);
assert.deepEqual(
  JSON.parse(JSON.stringify(exporter.listingIds(href))),
  { sellerListingId: 'MLB5326886083', catalogProductId: 'MLBU5340684247' }
);
assert.equal(exporter.canonicalUrl(href), 'https://www.mercadolivre.com.br/gran-turismo-5-ps3-midia-fisica/up/MLBU5340684247?wid=MLB5326886083');
assert.equal(exporter.inferPlatform('Jogo PlayStation 4 mídia física'), 'PS4');
assert.equal(exporter.inferPlatform('Jogo sem plataforma no título'), null);
assert.deepEqual(
  JSON.parse(JSON.stringify(exporter.priceRange('/games/PriceRange_0BRL-25BRL_NoIndex_True'))),
  { minCents: 0, maxCents: 2500 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(exporter.priceRange('/games/midia-fisica_Desde_337_OrderId_PRICE*DESC_PriceRange_31-50_NoIndex_True'))),
  { minCents: 3100, maxCents: 5000 }
);
assert.equal(exporter.priceRange('/games/sem-filtro-de-preco'), null);
assert.equal(
  exporter.safeNextUrl('/games/_Desde_49', 'https://lista.mercadolivre.com.br/games'),
  'https://lista.mercadolivre.com.br/games/_Desde_49'
);
assert.equal(exporter.safeNextUrl('', 'https://lista.mercadolivre.com.br/games'), null);
assert.equal(exporter.safeNextUrl('https://example.com/page-2', 'https://lista.mercadolivre.com.br/games'), null);
assert.equal(exporter.safeNextUrl('/games', 'https://lista.mercadolivre.com.br/games'), null);

const parsed = exporter.parseCard(card, 0);
assert.equal(parsed.position, 1);
assert.equal(parsed.priceCents, 3399);
assert.equal(parsed.shipping.free, true);
assert.equal(parsed.shipping.priceCents, 0);
assert.equal(parsed.condition, 'Usado');
assert.equal(parsed.platform, 'PS3');
assert.equal(parsed.sellerListingId, 'MLB5326886083');

console.log('Mercado Livre exporter parsing and URL normalization passed.');
