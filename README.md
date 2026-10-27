# Game Weekly Deals

A small, public research log for original physical PlayStation games in Brazil. One worthwhile pick each Friday, or **skip this week**. The ceiling is **R$70 including shipping and mandatory fees**, using São Carlos/SP as the public shipping reference.

## Run locally

No build, dependencies or framework:

```sh
python3 -m http.server 8000
# Open http://localhost:8000
node scripts/validate.mjs
node scripts/test-render.mjs
```

Serve over HTTP; opening `index.html` as a local file can block JSON loading. The files are compatible with GitHub Pages, but this version does not enable Pages or deploy anything.

## Structure

- `index.html`, `style.css`, `app.js`: current research, Friday archive and price observations.
- `data/observations.json`: append-only dated listing observations. Currency values are integer centavos.
- `data/weeks.json`: weekly progress and decisions, referencing observation IDs.
- `scripts/validate.mjs`: data, references, amounts, URL, winner and basic privacy checks.
- `scripts/test-render.mjs`: dependency-free DOM smoke test, including one observation reused across multiple weeks. This is not a visual or browser test.

## Update a research observation

Append a new observation with a unique ID; never replace an old price to hide a change. Keep the `listingId` stable when revisiting the same seller's exact listing. Give a different listing a different ID even when it is the same game. Group history by `gameId`, platform and edition; when region/pressing is unknown, explicitly say so. Record discovery/observation date, not the date embedded in a listing URL. Use a source URL for every included listing.

Separate the game price, quoted shipping, payment method, mandatory fees and verification status. `mandatoryFeesCents: null` means not verified, **not zero**. `quotedTotalCents` is the sum of known components; the UI calls it a quote and not a final total. Record checkout verification only when actually observed, with fees established. Availability and delivery estimates are snapshots, not promises.

Disc-only original copies are acceptable; a missing case or manual must be labelled, not automatically disqualified. Keep explicit condition, case/manual, seller, download/online dependence, exact-edition firmware/emulator compatibility and preservation uncertainties. Research primarily Mercado Livre, OLX, Shopee and reputable Brazilian stores. Never treat digital-account offers or reproduction discs as original physical copies. Review scores are context, not automatic winners; seller claims do not establish rarity. No buying, seller messaging or account changes are part of this site.

## Friday decisions

Each week is `researching`, `selected` or `skipped`. Until research is complete, keep `winnerObservationId: null`. A winner must reference a checkout-verified observation within the ceiling; validation rejects an unverified winner. Review condition, authenticity, compatibility and preservation caveats before selecting one. Link every week's candidates through `observationIds`.

This first entry is **in progress**, with no winner. Everybody's Golf was quoted at R$58.14 delivered on 27 October 2026. Exact-copy condition, checkout total and unpatched disc completeness remain unverified.

## Price history is not a market index

A repeated observation of the same listing may show a price change. Different used copies, sellers, regions, editions, conditions or shipping services are comparisons, not an interchangeable time series. A single sample establishes no trend. There are no invented historical prices, scarcity labels or discounts.

## Public-data boundaries

Publish only “São Carlos/SP,” never an exact postal code, street address, personal console configuration, owned library, payment information or purchase history. Do not copy private conversations or internal notes into this repository. Store direct public source links and concise factual summaries, not scraped page dumps or other people's copyrighted images.

## Publishing and future automation

GitHub Pages can serve these static files from the root once publication is approved. This repository currently has no CI, deployment workflow or scheduled data writer. The separately scheduled weekly research is **not yet connected to repository updates**. Its output must be reviewed and appended using this schema; providing a public site does not itself establish an automated write pipeline.
