# Game Weekly Deals

A small, public research log for original physical PlayStation games in Brazil. One worthwhile pick each Friday, or **skip this week**. The ceiling is **R$70 including shipping and mandatory fees**, using São Carlos/SP as the public shipping reference.

## Run locally

No build, dependencies or framework:

```sh
python3 -m http.server 8000
# Open http://localhost:8000
node scripts/validate.mjs
node scripts/test-render.mjs
node scripts/test-mercado-livre-exporter.mjs
node scripts/build-crawl-index.mjs
node scripts/rank-crawl-shortlist.mjs
node scripts/test-rank-crawl-shortlist.mjs
```

Serve over HTTP; opening `index.html` as a local file can block JSON loading. The files are compatible with GitHub Pages, but this version does not enable Pages or deploy anything.

## Structure

- `index.html`, `style.css`, `app.js`: current research, Friday archive and price observations.
- `data/observations.json`: append-only dated listing observations. Currency values are integer centavos.
- `data/weeks.json`: weekly progress and decisions, referencing observation IDs.
- `scripts/validate.mjs`: data, references, amounts, URL, winner and basic privacy checks.
- `scripts/test-render.mjs`: dependency-free DOM smoke test, including one observation reused across multiple weeks. This is not a visual or browser test.
- `userscripts/mercado-livre-search-export.user.js`: manually exports the Mercado Livre search results visible in your browser as normalized JSON.
- `scripts/test-mercado-livre-exporter.mjs`: dependency-free tests for Mercado Livre price, ID, platform and URL extraction.
- `scripts/build-crawl-index.mjs`: audits all JSON snapshots under `crawl/`, merges repeated identity keys, and writes a sorted JSON index, CSV and coverage report to `crawl/processed/`.
- `scripts/rank-crawl-shortlist.mjs`: filters and groups the generated index, compares prices within likely game/platform groups, and writes a heuristic shortlist beside the index.

## Export Mercado Livre search results

Install `userscripts/mercado-livre-search-export.user.js` in ScriptCat, Tampermonkey or another userscript manager. Open a Mercado Livre search page normally and wait for its results to load. Click **Exportar resultados (JSON)** to stay on the page, or **Exportar + próxima página** to download the current snapshot and then follow Mercado Livre's normal next-page link. The latter remains a human-initiated action for every page; it does not crawl a batch in the background. The script reads the rendered page only, and does not make requests, bypass challenges or interact with your account.

The downloaded filename includes the price range encoded in the search path and the detected results-page number, for example `mercadolivre-2026-10-27-price-0-25-page-2-48-listings.json`. Searches without that path filter use `price-any`. The snapshot includes the parsed range, search URL and time plus each regular result's title, price in integer centavos, condition, seller when displayed, shipping label, inferred PlayStation platform, catalog product ID and exact seller-listing ID. Sponsored carousel cards are deliberately excluded. Review the JSON before committing or uploading it because search URLs and rendered text can vary by account and location.

After placing snapshots anywhere below `crawl/`, run `node scripts/build-crawl-index.mjs`. The generated CSV is sorted by price, platform and title for quick inspection. The JSON retains every source sighting and is the better input for an agent. The audit report identifies duplicate pages, missing pages and batches that may be incomplete. When an export lacks an exact `MLB…` seller-listing ID, the builder labels its identity as `catalog_product`; this is useful for grouping but must not be interpreted as proof that two used-game offers are the same physical copy.

Run `node scripts/rank-crawl-shortlist.mjs` after rebuilding the index. It requires a used condition, an item price within the R$70 ceiling and at least two comparable normalized titles. Listings without confirmed free shipping remain eligible and state the maximum shipping charge that would keep the purchase within budget. Obvious accessories, digital/account products, reproductions, lots and online-only titles are mechanically excluded. The ranking is only triage: it does not establish authenticity, exact-copy condition, checkout total, seller quality, edition equivalence, rarity, review quality or whether a game suits the collection.

Human offer choices live in `data/mercadolivre-picks.json`. Add the normalized `gameKey`, chosen `preferredIdentityKey`, declaration date and a factual reason, then rerun the ranking script. A manual choice becomes the displayed representative without discarding the automatic cheapest offer or other comparisons. The script fails clearly if a declared identity is no longer present in that game group.

Title grouping first removes common marketplace wording and then conservatively compares titles on the same platform. Exact normalized titles are preferred; containment and high token similarity can join variants such as `Uncharted 3` and `Uncharted 3 Drake's Deception`. Numeric tokens are protected so sequels and yearly sports releases are not merged. Groups record their match methods and minimum confidence. Persistent corrections can be added to `data/mercadolivre-title-aliases.json`; aliases take precedence over automatic matching.

The processed shortlist also has an interactive preview at `crawl/processed/index.html`. Serve the repository with `python3 -m http.server 8000`, then open `http://localhost:8000/crawl/processed/`. It supports title, platform and shipping filters plus several useful sort orders. Each game card can expand all grouped offers with their individual URLs, prices and shipping-budget limits; a displayed free-shipping alternative is highlighted.

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
