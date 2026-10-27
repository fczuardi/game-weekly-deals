// ==UserScript==
// @name         Game Weekly Deals — Mercado Livre exporter
// @namespace    https://github.com/game-weekly-deals
// @version      0.2.2
// @description  Export the Mercado Livre search results you are viewing as normalized JSON.
// @match        https://lista.mercadolivre.com.br/*
// @match        https://www.mercadolivre.com.br/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CARD_SELECTOR = '.ui-search-layout__item';
  const BUTTON_ID = 'gwd-ml-export-button';
  const NEXT_BUTTON_ID = 'gwd-ml-export-next-button';

  const text = (root, selector) => root.querySelector(selector)?.textContent?.trim() || null;

  function parsePrice(card) {
    const amount = card.querySelector('.poly-price__current .andes-money-amount, .poly-price__amount');
    if (!amount) return null;
    const reais = text(amount, '[data-andes-money-amount-fraction]');
    const cents = text(amount, '[data-andes-money-amount-cents]') || '00';
    if (!reais || !/^\d[\d.]*$/.test(reais) || !/^\d{1,2}$/.test(cents)) return null;
    return Number(reais.replaceAll('.', '')) * 100 + Number(cents.padEnd(2, '0'));
  }

  function listingIds(rawUrl) {
    const url = new URL(rawUrl, location.href);
    const sellerListingId = url.searchParams.get('wid')?.toUpperCase() ||
      url.pathname.match(/\bMLB\d+\b/i)?.[0]?.toUpperCase() || null;
    const catalogProductId = url.pathname.match(/\bMLBU\d+\b/i)?.[0]?.toUpperCase() || null;
    return { sellerListingId, catalogProductId };
  }

  function canonicalUrl(rawUrl) {
    const url = new URL(rawUrl, location.href);
    const { sellerListingId } = listingIds(url.href);
    url.search = '';
    url.hash = '';
    if (sellerListingId) url.searchParams.set('wid', sellerListingId);
    return url.href;
  }

  function inferPlatform(title) {
    const normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const numbered = normalized.match(/\b(?:playstation|ps)\s*([1-5])\b/);
    if (numbered) return `PS${numbered[1]}`;
    if (/\bps\s*vita\b/.test(normalized)) return 'PS Vita';
    if (/\bpsp\b/.test(normalized)) return 'PSP';
    return null;
  }

  function priceRange(pathname = location.pathname) {
    const match = decodeURIComponent(pathname).match(/PriceRange_(\d+)(?:BRL)?-(\d+)(?:BRL)?/i);
    if (!match) return null;
    return { minCents: Number(match[1]) * 100, maxCents: Number(match[2]) * 100 };
  }

  function safeNextUrl(rawUrl, currentUrl = location.href) {
    if (!rawUrl) return null;
    const current = new URL(currentUrl);
    const next = new URL(rawUrl, current);
    if (!['http:', 'https:'].includes(next.protocol) || next.origin !== current.origin) return null;
    if (next.href === current.href) return null;
    return next.href;
  }

  function nextPageControl() {
    const link = document.querySelector(
      '.andes-pagination__button--next:not(.andes-pagination__button--disabled) a[data-andes-pagination-control="next"]'
    );
    if (!link || link.getAttribute('data-andes-state') === 'disabled') return null;
    return link;
  }

  function parseCard(card, index) {
    const titleLink = card.querySelector('a.poly-component__title');
    if (!titleLink?.href) return null;
    const title = titleLink.textContent.trim();
    const priceCents = parsePrice(card);
    if (!title || priceCents === null) return null;

    const shippingText = text(card, '.poly-component__shipping-v2');
    const seller = text(card, '.poly-component__seller');
    const ids = listingIds(titleLink.href);

    return {
      position: index + 1,
      sellerListingId: ids.sellerListingId,
      catalogProductId: ids.catalogProductId,
      title,
      platform: inferPlatform(title),
      condition: text(card, '.poly-component__item-condition'),
      seller,
      priceCents,
      currency: 'BRL',
      shipping: {
        text: shippingText,
        free: shippingText ? /gr[aá]tis/i.test(shippingText) : null,
        priceCents: shippingText && /gr[aá]tis/i.test(shippingText) ? 0 : null
      },
      url: canonicalUrl(titleLink.href)
    };
  }

  function collect() {
    const cards = [...document.querySelectorAll(CARD_SELECTOR)];
    const listings = cards.map(parseCard).filter(Boolean);
    const sort = text(document, '.ui-search-sort-filter__dropdown [data-andes-dropdown-value]');
    const currentPageText = document.querySelector('.andes-pagination__button--current a')?.textContent?.trim();
    const range = priceRange();

    return {
      schemaVersion: 1,
      source: 'mercadolivre.com.br',
      capturedAt: new Date().toISOString(),
      sourcePage: `${location.origin}${location.pathname}${location.search}`,
      search: {
        documentTitle: document.title,
        sort,
        page: currentPageText && /^\d+$/.test(currentPageText) ? Number(currentPageText) : 1,
        priceRange: range
      },
      listingCount: listings.length,
      listings
    };
  }

  function downloadExport() {
    const result = collect();
    if (!result.listings.length) {
      window.alert('No Mercado Livre search-result cards were found on this page.');
      return false;
    }
    const day = result.capturedAt.slice(0, 10);
    const range = result.search.priceRange;
    const rangeLabel = range
      ? `price-${range.minCents / 100}-${range.maxCents / 100}`
      : 'price-any';
    const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `mercadolivre-${day}-${rangeLabel}-page-${result.search.page}-${result.listingCount}-listings.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return true;
  }

  function exportAndNext() {
    const next = nextPageControl();
    if (!downloadExport()) return;
    if (!next) {
      window.alert('Export complete. This appears to be the last results page.');
      return;
    }
    // Mercado Livre currently leaves pagination hrefs empty and navigates via
    // its own click handler, so preserve and activate the live page control.
    setTimeout(() => next.click(), 600);
  }

  function styleButton(button, bottom) {
    Object.assign(button.style, {
      position: 'fixed', right: '18px', bottom, zIndex: '2147483647',
      padding: '12px 16px', border: '0', borderRadius: '8px', cursor: 'pointer',
      background: '#3483fa', color: '#fff', font: '600 14px Arial, sans-serif',
      boxShadow: '0 3px 12px rgba(0,0,0,.25)'
    });
  }

  function installButtons() {
    if (!document.getElementById(BUTTON_ID)) {
      const button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.textContent = 'Exportar resultados (JSON)';
      button.title = 'Export only the regular Mercado Livre search-result cards';
      styleButton(button, '18px');
      button.addEventListener('click', downloadExport);
      document.body.append(button);
    }
    if (!document.getElementById(NEXT_BUTTON_ID)) {
      const button = document.createElement('button');
      button.id = NEXT_BUTTON_ID;
      button.type = 'button';
      button.textContent = 'Exportar + próxima página';
      button.title = 'Export this page, then follow Mercado Livre’s normal next-page link';
      styleButton(button, '68px');
      button.addEventListener('click', exportAndNext);
      document.body.append(button);
    }
  }

  // Exposed only to support dependency-free fixture tests in this repository.
  globalThis.__GWD_ML_EXPORTER__ = { parsePrice, listingIds, canonicalUrl, inferPlatform, priceRange, safeNextUrl, parseCard, collect };

  if (typeof document !== 'undefined' && document.body) {
    installButtons();
    new MutationObserver(installButtons).observe(document.documentElement, { childList: true, subtree: true });
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Exportar resultados em JSON', downloadExport);
      GM_registerMenuCommand('Exportar e ir para a próxima página', exportAndNext);
    }
  }
})();
