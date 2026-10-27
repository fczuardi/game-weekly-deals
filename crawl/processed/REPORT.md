# Mercado Livre crawl audit

Built from captures through 2026-10-27T17:01:10.346Z.

- Files parsed: 61/61
- Raw rows: 2806
- Unique identity keys: 2506
- Repeated rows: 300
- Exact seller-listing identities: 0
- Catalog-product identities: 2502
- URL-only identities: 4

> Important: catalog-product deduplication does not prove two rows are the same physical used copy or seller offer.

## Batch coverage

| Batch | Pages | Rows | Duplicate pages | Missing pages | Likely complete |
|---|---:|---:|---:|---:|---|
| 0-15__price-0-15__shipping-origin-10215068 | 1 | 22 | — | — | yes |
| 15-30__price-15-30__shipping-origin-10215068 | 9 | 433 | 1 | — | yes |
| 31-40__price-31-40__shipping-origin-10215068 | 16 | 765 | — | — | yes |
| 41-50__price-41-50__shipping-origin-10215068 | 20 | 960 | — | — | no/unknown |
| 41-50b__price-41-50__shipping-origin-any | 7 | 305 | — | — | yes |
| 51-60__price-51-60__shipping-origin-any | 7 | 321 | — | — | yes |

A batch is only marked likely complete when pages are contiguous and its final captured page contains fewer than 48 results.

## Unique keys by inferred platform

- PS3: 2149
- PS4: 257
- PS2: 46
- unknown: 26
- PSP: 14
- PS5: 8
- PS1: 5
- PS Vita: 1
