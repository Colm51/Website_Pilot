# Quebec election map integration

## Locations

- Authoritative Vite application: `/Users/aidancarter/Desktop/CodexSandbox/Quebec/InteractiveMap`
- Website integration: `/Users/aidancarter/Desktop/CodexSandbox/Website/Projects/QuebecElection`
- Generated browser application: `Projects/QuebecElection/map/`

The election app remains a standalone Vite/Leaflet application. Eleventy copies its generated `map/` directory to `projects/quebec-election/map/`; `Text/QuebecElection.md` supplies the website project page and iframe. The deployment-only Vite configuration sets a relative base and converts the app's four root-relative data requests to base-aware URLs. It does not change source data or preprocessing.

## Rebuild after source changes

From the Website root, with the source application's dependencies installed:

```bash
npm run build:quebec-election
npm run build
```

Do not rerun geographic preprocessing unless the authoritative inputs or preprocessing logic changed. If it is required, follow the source application's `README.md` and validation steps first. The generated geographic and result files in `map/data/` should remain byte-for-byte copies of `InteractiveMap/public/data/`.

## Test locally

```bash
npm start
```

- Project page: <http://localhost:8080/projects/quebec-election/>
- Standalone map: <http://localhost:8080/projects/quebec-election/map/>

The committed production output is passed through by Eleventy and GitHub Pages. Relative JavaScript, CSS, and data URLs keep the map working below either the local site root or a repository path prefix. OpenStreetMap tiles still require network access.
