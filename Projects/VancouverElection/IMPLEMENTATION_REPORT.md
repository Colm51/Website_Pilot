# Vancouver Election Map website integration

## Files copied or modified

- Copied the standalone application's `index.html` to `map.html` and copied `map.js`, `style.css`, `data/`, `vendor/`, and `tests/test_map.js` into `Projects/VancouverElection/`.
- Added `Text/VancouverElection.md` for the Eleventy project page.
- Updated `Text/Projects.md` with the project listing.
- Updated `eleventy.config.js` to publish the application at `projects/vancouver-election/` and exclude this report and the vendored licence document from template rendering.

The source application was not modified. No application redesign, data preprocessing, dependency installation, deployment, or changes to the existing Vancouver Census Map were required.

## Website integration

The Eleventy page is generated at `/projects/vancouver-election/` and embeds the standalone application at `/projects/vancouver-election/map.html`. The application retains relative `data/` and `vendor/` URLs, so all local geographic data and libraries resolve beneath the project path. Existing OpenStreetMap attribution and election/Census source acknowledgements are preserved.

## Tests performed

- Authoritative source tests: JavaScript syntax passed, map utility tests passed, and all 8 election-data acceptance tests passed.
- Destination verification: copied runtime files matched their authoritative source files; JavaScript syntax and the copied map utility test passed in an isolated CommonJS test directory.
- Geographic assets: 88 election locations and 1,018 Census dissemination areas loaded; all seven local JSON/GeoJSON data files were present in the generated site.
- Eleventy: `npm run build` passed and generated the project page, standalone map, geographic data, styles, scripts, libraries, and Leaflet images.
- Headless Chrome: passed at desktop and 390 px mobile widths with no runtime or network failures. Verified Election, Census, and Compare modes; four candidate/display options including Winning Candidate; vote-count and vote-share legends; election and Census legend filtering; basemap fading on both comparison maps; Roads, SkyTrain, and RapidBus overlays; OpenStreetMap attribution; and stacked responsive comparison layout.
- Repository checks: `git diff --check` passed. The existing Vancouver Census Map had no changes, and the full Eleventy build continued to generate the other website projects.

## Outstanding issues

None identified. OpenStreetMap basemap tiles still require an internet connection, as in the standalone application; all thematic and overlay data is local.

## Local testing

From the website root, run `npm start`, then open:

- Project page: <http://localhost:8080/projects/vancouver-election/>
- Standalone map: <http://localhost:8080/projects/vancouver-election/map.html>
