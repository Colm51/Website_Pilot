# Travel map technical guide


## Purpose

The travel map turns the workbook at `Travels/Travels.xlsx` into an interactive record of trips. It is published by the Eleventy site at `/travel-map/`.

The page shows destination markers, permanent collision-managed labels, visit popups, directional routes, a year filter, and a destination list. Geographic coordinates are prepared ahead of time and stored in the repository; visitors do not send place names to a geocoder.

## Source data

`Travels/Travels.xlsx` is the source of truth for trips. The generator requires a worksheet named exactly `Sheet1`. Its first row must contain exactly these five columns, in this order and with this capitalization:

| Column | Meaning and validation |
| --- | --- |
| `year` | Calendar year of the trip. It must parse as an integer. |
| `month` | English month name, January through December. Surrounding whitespace and capitalization are normalized for validation. A blank month is allowed and is displayed as “Month not recorded.” |
| `destination` | Place visited. This field is required. It becomes the destination end of the route and is grouped through the canonical place-name lookup. |
| `Country` | Country of the destination. It is used to disambiguate and geocode the destination. A missing value can be inferred only when another row establishes one unambiguous country for the same canonical destination. |
| `origin` | Place from which travel began. It becomes the start of the route. It may be blank, but a blank origin means that row cannot draw a route. |

Blank spreadsheet rows are ignored. Every nonblank row becomes one trip record. Given a row such as `2017 / October / Oaxaca / Mexico / CDMX`, the generator creates a trip from the canonical location for Mexico City to Oaxaca, dated October 2017. The browser draws the route when both places have coordinates and creates or updates the Oaxaca destination marker. Origin-only places can be route endpoints without becoming destination markers.

Trips are sorted by year, month number, and original spreadsheet row. Missing months sort before named months within their year.

## Data-generation workflow

Three files form the data pipeline:

- `Travels/Travels.xlsx` is the human-edited source of truth for trips. Do not add latitude or longitude columns to it.
- `scripts/sync-travels.js` reads and validates the workbook, resolves canonical place names and countries, reuses or obtains coordinates, and writes the JSON consumed by the site.
- `Travels/places.json` is the committed geographic cache. Each place has a country, latitude, and longitude. An `aliases` array records workbook spellings that normalize to that canonical place. Although the script rewrites this file in sorted place order, it is a durable cache that should be reviewed and committed.
- `Travels/travel-data.json` is generated browser data. It contains the available years, a place object keyed by slug-like IDs, and the chronologically sorted trip records used by `travel-map.js`. Do not maintain it by hand.

The normal generation command is:

```sh
npm run sync-travels
```

That npm script runs `node scripts/sync-travels.js --geocode`. The `--geocode` flag permits lookup of places that do not yet exist in `Travels/places.json`. Without the flag, the script regenerates browser data only from coordinates already in the cache and fails if a place is missing.

## Geographic lookup and geocoding

### Identifying places

The generator collects both `origin` and `destination` from every trip, trims their whitespace, converts configured aliases to names, removes blanks, deduplicates the result, and sorts the place names alphabetically. This means every place needed for either end of a route must have one cached coordinate.

Browser IDs are derived from names by Unicode normalization, removing combining marks, lowercasing, replacing non-alphanumeric runs with hyphens, and trimming leading or trailing hyphens. For example, `Mexico City` becomes `mexico-city`.

### Place-name and country normalization

The current `aliases` map in `scripts/sync-travels.js` contains:

| Workbook value | Canonical place |
| --- | --- |
| `CDMX` | `Mexico City` |
| `Cannnon Beach` | `Cannon Beach` |
| `Hague` | `The Hague` |
| `Maarrssen` | `Maarssen` |
| `Quetzaltanango` | `Quetzaltenango` |

The original noncanonical spelling is retained in the cache's `aliases` array, while map labels and list entries use the canonical `displayName`.

Country names are also normalized: `USA` becomes `United States`, `England` becomes `England, UK`, and `Scotland` becomes `Scotland, UK`. `knownCountries` supplies countries for origins that cannot be learned from destination rows; it currently identifies Toronto and Vancouver as Canadian.

For destinations, the generator collects countries from the `Country` column by canonical place. If a place has more than one country, it is ambiguous and generation stops. If a place has no inferred or configured country, generation also stops and asks for an explicit `knownCountries` entry. It does not silently choose a country.

### Reusing and obtaining coordinates

Before geocoding, the script loads `Travels/places.json` into a map keyed by `place`. An existing entry is reused only if:

- its cached country matches the country inferred from the workbook;
- latitude and longitude are finite numbers; and
- latitude is within ±90 and longitude is within ±180.

Country disagreement or invalid coordinates stops generation for review.

Geocoding occurs only when all of the following are true:

1. a canonical place is required by the current workbook;
2. it is absent from `Travels/places.json`; and
3. the script was run with `--geocode`, normally through `npm run sync-travels`.

The build-time geocoder is OpenStreetMap Nominatim. It requests one English-language result, identifies the application with a user-agent, processes places sequentially, and waits 1.1 seconds after each newly geocoded place. Several places have explicit `geocodingQueries` overrides so the query selects the intended city rather than a similarly named administrative area. Current overrides include Campeche, Copán, Guanajuato, Oaxaca, Pisa, Puebla, and Puno.

The published browser reads only `Travels/travel-data.json`; it contains no Nominatim request. This keeps page loads predictable, protects the geocoder from repeated visitor traffic, and makes coordinate choices reviewable in version control. The browser still requests normal raster basemap tiles from OpenStreetMap.

After geocoding a new place, inspect the new `Travels/places.json` entry and preview it on the map. Confirm the country and coordinates correspond to the intended locality rather than a state, province, or similarly named settlement. If a result is wrong, add or refine a targeted entry in `geocodingQueries`, remove or correct the bad cached entry, and rerun synchronization.

## Map implementation

### Page and assets

`Text/TravelMap.njk` defines the `/travel-map/` page. It supplies the year selector, live destination/route summary, destination-list container, map container, and path-prefix-aware URL for `Travels/travel-data.json`.

The shared layout `_includes/layouts/base.njk` conditionally loads Leaflet CSS, Leaflet JavaScript, `leaflet.polylineDecorator.js`, and `travel-map.js` only when `isTravelMap` is true. `eleventy.config.js` copies those local package assets, `travel-map.js`, and the generated JSON into `_site`.

`style.css` contains the map toolbar, desktop/sidebar grid, map dimensions, destination list, permanent label, popup, and mobile rules. These rules reuse the site's paper, ink, muted, rule, and typography conventions.

### Leaflet and OpenStreetMap

`travel-map.js` creates a Leaflet map initially centered at `[30, -15]` at zoom 2. Scroll-wheel zoom is disabled, and `worldCopyJump` is enabled. It adds OpenStreetMap tiles from:

```text
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

The tile layer permits zoom levels through 19 and includes the required OpenStreetMap attribution. No Mapbox, Google, ArcGIS, or API-key service is involved.

### Filtering, markers, popups, and bounds

On load, the browser fetches `travel-data.json`, creates one option for every generated year, and renders `all`. Changing the selector reruns the same render function with trips filtered to the selected year.

Each render clears the route and marker layers, removes old labels, and rebuilds its marker index. Trips are grouped in a `Map` by `destinationId`, so repeat visits share one marker. Each destination is a Leaflet circle marker with a radius of 5 pixels. Its popup contains the canonical destination name, country, and every included visit as `month year`; a missing month reads “Month not recorded.” Filtering therefore changes both markers and popup visits.

Only destinations produce markers. Origins still have coordinates and participate in routes, but an origin that never appears as a destination does not receive its own destination marker.

The summary reports the number of grouped destinations and the number of filtered trip rows with a nonblank origin. Destination coordinates are collected into bounds after rendering. Leaflet fits those bounds with 24-pixel padding, a maximum automatic zoom of 7, and animation disabled.

## Routes and arrows

For each filtered trip with a resolved origin, `travel-map.js` looks up the origin and destination coordinates and constructs a directed key:

```text
originId->destinationId
```

A `Set` named `renderedRoutes` prevents the same directed route from being drawn more than once in the current view. Direction matters: A→B and B→A have different keys. The summary remains row-based, so its route count can be larger than the number of visually distinct polylines. A row with a blank origin has `originId: null`, contributes no route, and is excluded from that count.

Routes are Leaflet polylines using red `#b3261e`, weight `1.5`, opacity `0.68`, and no pointer interaction. Red distinguishes travel direction from the brown destination markers while the low weight and partial opacity keep overlapping geography restrained.

`leaflet-polylinedecorator` adds one polygon arrowhead to each distinct directed line. The arrowhead:

- is placed at `74%` of the route, measured from origin toward destination;
- does not repeat;
- has a 7-pixel symbol size;
- uses the same red for stroke and fill; and
- uses opacity/fill opacity `0.82` with a 1-pixel outline.

Placing the arrowhead at 74% keeps it visibly directional without putting it directly beneath the destination marker. If the plugin is unavailable, the guarded `typeof L.polylineDecorator` check leaves the red route line in place but cannot add its arrowhead.

## Destination labels

Permanent destination labels are plain `div` elements placed in a custom Leaflet pane named `travelLabels`. The pane has z-index 625 and ignores pointer events, leaving marker clicks and map interaction available. Each label contains only the canonical destination `displayName`.

The collision system in `travel-map.js` uses actual screen-space dimensions rather than hard-coded city offsets:

1. It converts the current map viewport and every destination coordinate into Leaflet layer points.
2. It models each marker as a 14-by-14-pixel rectangle extending 7 pixels from its point.
3. It temporarily reveals labels with hidden visibility so their `offsetWidth` and `offsetHeight` can be measured.
4. For each label, it tries eight positions with a 9-pixel gap from its marker, in this order:
   1. right, vertically centered;
   2. left, vertically centered;
   3. above, horizontally centered;
   4. below, horizontally centered;
   5. upper right;
   6. upper left;
   7. lower right;
   8. lower left.
5. A candidate must remain completely inside the current viewport.
6. A candidate is rejected if it intersects another destination marker. The label's own marker is exempt because the 9-pixel gap already separates them. Marker collision uses a 1-pixel spacing allowance.
7. A candidate is rejected if it intersects an already placed label. Label collision uses a 2-pixel spacing allowance.
8. The first valid candidate is used. If all eight fail, the label receives `hidden` and is not displayed.

Priority is established before collision placement. Destinations with more included visits are processed first; ties are sorted alphabetically by display name. Because accepted rectangles become occupied space, lower-priority labels yield to repeat destinations and then to alphabetically earlier peers. Hidden labels do not affect the marker, popup, destination list, or route.

Placement is scheduled through `requestAnimationFrame` to collapse redundant work. It runs after each complete render and after Leaflet's `moveend`, `zoomend`, and `resize` events. Clicking a destination-list item also schedules placement after focusing the marker. Thus labels are recalculated after filtering, completed pans, zooms, map resizing, and list-driven navigation.

## Destination list

The destination list is built from the same filtered `visitsByPlace` grouping as the markers. There is one button per canonical `destinationId`, regardless of how many matching trip rows exist. Each button displays the canonical destination and country plus compact visit dates.

Because generated trips are chronological and JavaScript `Map` preserves insertion order, list destinations appear in the order of their first included visit. Within an individual-year filter, duplicate month names are removed and the remaining months appear chronologically. Under All years, visits are grouped by year and rendered in a compact form such as `2014: September; 2017: October`. Repeated identical months in the same year are shown once. Missing months appear as “Month not recorded.”

Changing the year filter replaces the list immediately and changes its heading between “Destinations — all years” and “Destinations in YEAR.”

Each list button looks up its destination in `markerByPlace`. Clicking it sets the map view to the marker at the current zoom or zoom 6, whichever is greater, with animation disabled. It then opens the marker's existing popup and reschedules label placement.

On desktop, `.travel-map-layout` is a two-column grid: a left sidebar between 14 and 17 rem wide and a flexible map column. The sidebar and map use the same responsive height, and the sidebar scrolls independently. At 700 pixels or narrower, CSS changes the grid to one column with the map first and destination list below. The map remains at least 26 rem high, while the list has a maximum height of 28 rem.

## Updating the travel map

Use this procedure when adding trips:

1. Edit `Travels/Travels.xlsx`.
2. Keep the worksheet named `Sheet1` and preserve the exact five columns and their order: `year`, `month`, `destination`, `Country`, `origin`.
3. Save and close the workbook so the generator reads the latest complete file.
4. From the repository root, run:

   ```sh
   npm run sync-travels
   ```

5. If new places were geocoded, inspect their country, latitude, and longitude in `Travels/places.json` and preview their positions. Resolve any reported ambiguity rather than guessing.
6. Build the site:

   ```sh
   npm run build
   ```

7. Preview the map locally:

   ```sh
   npm start
   ```

   Then open the local Eleventy URL and visit `/travel-map/`. Test All years and the affected year.
8. Commit `Travels/Travels.xlsx`, `Travels/places.json`, and `Travels/travel-data.json` together. Also commit source-code changes if adding an alias, known country, or geocoding-query override was necessary. The generated `_site` directory is build output, not the source data pipeline.

If a new row uses only places already in the cache, `npm run build` or `npm start` can regenerate `travel-data.json` without a separate geocoding command. Running `npm run sync-travels` remains the safest standard procedure after workbook edits because it also handles genuinely new places.

## Automatic build behavior

The relevant npm lifecycle scripts are:

```json
{
  "prestart": "node scripts/sync-travels.js",
  "start": "eleventy --serve",
  "prebuild": "node scripts/sync-travels.js",
  "build": "eleventy",
  "sync-travels": "node scripts/sync-travels.js --geocode"
}
```

Running `npm start` automatically runs `prestart` first. Running `npm run build` automatically runs `prebuild` first. Both lifecycle steps regenerate `Travels/places.json` and `Travels/travel-data.json`, but they intentionally omit `--geocode`. They are therefore network-independent when every required place already exists in the cache.

Manual `npm run sync-travels` is required when a workbook edit introduces a canonical place that is not yet cached. Without it, `prestart` or `prebuild` stops with an error naming the missing place and tells the maintainer to run the sync command. Manual sync may also be appropriate after changing aliases, country rules, or a geocoding-query override.

## Dependencies

The feature-specific dependencies currently declared in `package.json` are:

| Dependency/service | Current version | Role |
| --- | --- | --- |
| Leaflet (`leaflet`) | `^1.9.4` (locked at 1.9.4) | Browser map, tile layer, layers, polylines, circle markers, popups, map bounds, and navigation. Its distribution files are copied locally during the Eleventy build. |
| `leaflet-polylinedecorator` | `^1.6.0` (locked at 1.6.0) | Adds the directional polygon arrowhead to each distinct rendered route. |
| `read-excel-file` | `^9.3.10` (locked at 9.3.10) | Node-side XLSX parser used by `scripts/sync-travels.js` to read all worksheets and select `Sheet1`. |
| Eleventy (`@11ty/eleventy`) | `^3.1.6` | Builds the page and copies the map's JavaScript, generated JSON, and local Leaflet assets into `_site`. |
| OpenStreetMap raster tiles | Web service; no npm version | Supplies the normal basemap in the browser. Tile use is live and attributed. |
| OpenStreetMap Nominatim | Web service; no npm version | Geocodes only uncached places during an explicitly geocoding-enabled local sync. It is not called by visitors. |

**ExcelJS note:** ExcelJS is not installed and is not used by the current repository. The workbook reader was changed to `read-excel-file`, so there is no current ExcelJS version to list. Do not add ExcelJS merely to follow older notes; use the dependency actually imported by `scripts/sync-travels.js` unless the implementation is deliberately migrated.

## Files involved

| File | Role |
| --- | --- |
| `Travels/Travels.xlsx` | Human-maintained trip source of truth. |
| `scripts/sync-travels.js` | Workbook validation, normalization, country resolution, coordinate caching/geocoding, and JSON generation. |
| `Travels/places.json` | Committed canonical place/country/coordinate cache, including known workbook aliases. |
| `Travels/travel-data.json` | Generated, browser-ready years, places, and trips. |
| `travel-map.js` | Leaflet initialization, filtering, routes/arrows, destination grouping, markers, popups, labels, collision handling, bounds, and list interactions. |
| `Text/TravelMap.njk` | Page markup and path-prefix-aware generated-data URL. |
| `style.css` | Map, toolbar, sidebar, list, label, popup, and responsive styling. |
| `_includes/layouts/base.njk` | Navigation entry and conditional loading of Leaflet and map scripts. |
| `eleventy.config.js` | Passthrough copying for travel data and local Leaflet/plugin assets; watches workbook/cache inputs. |
| `index.njk` | Travel-map link on the site's trip listing. |
| `package.json` and `package-lock.json` | Commands and exact dependency resolution. |

## Troubleshooting

### A new place cannot be geocoded

Confirm the destination country is correct and sufficiently specific. Run `npm run sync-travels`, not only `npm run build`. If Nominatim returns no result or the wrong administrative area, add a specific string or structured query to `geocodingQueries`, remove/correct the bad cache entry if one was written, and rerun sync. Do not repeatedly geocode every build.

### An origin is ambiguous or has no country

Origins have no dedicated country column. The script learns a country's canonical place from destination rows or `knownCountries`. If it reports `country unknown` or `ambiguous`, verify workbook spelling and destination countries, add a place alias if two spellings mean the same location, or add a reviewed `knownCountries` entry. The safeguard is intentionally strict.

### A spreadsheet column is missing or renamed

The header check requires exactly `year`, `month`, `destination`, `Country`, `origin` in that order. Restore the names, case, and order. Also confirm the worksheet is named `Sheet1`.

### The workbook is still open

Save and close it, then rerun synchronization. An open editor may leave recent edits unsaved, hold a file lock, or expose an incomplete on-disk version. Ensure you edited `Travels/Travels.xlsx`, not `Travels1.xlsx` or the template file.

### A destination is missing from the map

Check that the row has an integer year and nonblank destination, that its month is blank or a recognized English month, and that sync/build completed successfully. If a year is selected, confirm the trip belongs to that year. Inspect `Travels/travel-data.json` for the trip and its `destinationId`. Remember that an origin-only place does not receive a destination marker.

### A route is missing because origin is blank

A blank `origin` generates `originId: null`. The destination and visit can still appear, but no origin-to-destination line can be drawn. Add the correct origin to the workbook, sync, and rebuild. Do not invent an origin in JSON.

### A permanent label is missing

The collision algorithm deliberately hides a lower-priority label when none of its eight candidate positions fits inside the viewport without colliding. Zoom in, pan, or use the destination list; the marker and popup remain available. Label visibility can legitimately change after the year filter, zoom, pan, or resize.

### The map works at `/` locally but fails under a path prefix

Do not hard-code root-relative asset or data URLs in the template. `Text/TravelMap.njk` uses `htmlBaseUrl` for `data-source`, and `_includes/layouts/base.njk` uses it for Leaflet and map assets. `eleventy.config.js` derives `pathPrefix` from `ELEVENTY_PATH_PREFIX` or a GitHub project repository name. Test a prefixed build with:

```sh
ELEVENTY_PATH_PREFIX=/example/ npm run build
```

Then confirm the generated `_site/travel-map/index.html` points to `/example/Travels/travel-data.json`, `/example/vendor/leaflet/...`, and `/example/travel-map.js`. Also confirm the deploy process publishes the passthrough-copied `Travels` and `vendor/leaflet` directories.

## Design decisions

- **Locally cached coordinates:** Places are geocoded once, reviewed, committed, and reused. This avoids page-load geocoding, protects Nominatim, supports deterministic builds, and makes corrections auditable.
- **Leaflet and OpenStreetMap:** They provide a small, open, API-key-free mapping stack that fits the existing static Eleventy site without a commercial account or a larger mapping framework.
- **Permanent labels with collision avoidance:** Names make the map legible without requiring exploratory clicks. General eight-position placement avoids city-specific offsets, while hiding labels in genuinely crowded views prevents unreadable piles of text.
- **Directional arrows:** A route line alone does not communicate travel direction. A restrained arrow at 74% shows origin-to-destination direction without disappearing beneath the destination marker.
- **Destination list:** The list provides a scannable, keyboard-accessible complement to the spatial view, preserves compact chronology, and offers a reliable way to find a destination whose map label is hidden by collision handling.
