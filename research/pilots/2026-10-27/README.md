# Public marketplace capture pilot — 2026-10-27

One bounded, read-only browser capture: two consecutive Enjoei result pages and OLX page 1. This is a capture/integration test, not a recommendation or complete weekly market survey.

| File | Captured cards | Scope |
| --- | ---: | --- |
| enjoei-page-1.json | 35 | 30 regular + 5 seller-highlighted |
| enjoei-page-2.json | 35 | 30 regular + 5 seller-highlighted |
| olx-page-1.json | 50 | First 50 of 4,884 displayed results; promotion status unknown |

## Search scope

- Enjoei: query **playstation ps4**, category **Eletrônicos > Videogames > Jogos**, **usado**, sticker price **até R$70**, sort **mais relevantes**. The default nearby-region setting was explicitly changed to **todo o Brasil** using the UI. Page 2 was reached through **próxima**; tracking/search IDs and the opaque pagination cursor were removed from saved URLs. Its URL alone therefore does not reproduce page 2.
- OLX: query **jogos ps4**, category **Jogos de Vídeo Game**, maximum sticker price **R$70**, condition checkboxes **Usado - Excelente** and **Usado - Bom**, **Todo o Brasil**, sort **Mais Relevantes**. Only page 1 was visited.
- All loaded product cards were retained, including highlights, multi-title/catalogue offers and ambiguous entries. Search filters do not prove physical format, originality, used condition or that the displayed price applies to every pictured title.

## Data and limits

Schema version 1 stores page-level filters, capture time, coverage and an array of cards. Source-scoped IDs support later deduplication. Enjoei times have minute precision and are explicitly approximate. OLX public loaded card DOM text was captured, including cards outside the viewport; no hidden application state was accessed. Enjoei cards use rendered card text. No product-detail pages, checkout or seller contact were used.

Prices are current displayed sticker amounts in BRL centavos, not installment totals. Public card text preserves evidence, including any struck-through comparison amounts. Seller text is the displayed public card string; OLX may concatenate the seller name and rating. Seller names, condition and dates are not enriched.

Shipping evidence is preserved verbatim. **Frete grátis** is only a badge, not a verified quote for the user's destination. Shipping, mandatory fees and delivered totals remain **null** for every card, and checkout verification is **false**. No account information, cookies, raw HTML, search/session IDs or destination postal code are included.

There are 120 card observations / 119 unique source-scoped IDs in this snapshot. Enjoei listing `153342133` appears twice; both observations are retained with their placement and position. All 120 have titles, URLs and displayed prices at or below R$70. This establishes only sticker-price scope, not eligibility under a R$70 delivered budget. Live listings, ranking, pricing and availability can change.

These files intentionally live outside `crawl/`: the existing Mercado Livre importer scans JSON below that tree. They are **not yet wired into the shortlist HTML view**, and existing ML data/importers are unchanged.


## Browse this pilot

Open `index.html` through an HTTP server or GitHub Pages for title search, source filtering, price sorting and optional deduplication. The default shows 119 distinct listing IDs; switching off deduplication shows all 120 captured cards. Each card links to the original listing and preserves its shipping uncertainty and capture evidence. This is a standalone pilot view, not a merge into the Mercado Livre ranking pipeline.

Local checks (Node.js):

```sh
node test-view.mjs
node test-render.mjs
node --check view.mjs
```

These cover data transformations and rendering behavior, not browser layout.
