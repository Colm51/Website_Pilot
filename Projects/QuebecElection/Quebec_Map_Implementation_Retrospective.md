# Quebec Map Implementation Retrospective

Date: 2026-10-30  
Scope: standalone Quebec election map, Eleventy integration, shared click-to-select interaction, and Safari validation

## Evidence conventions

This retrospective distinguishes evidence types as follows:

- **Confirmed** means directly supported by the current source tree, Git output, build or test output, or recorded session output.
- **Inference** means a reasoned interpretation of confirmed evidence where no direct measurement or contemporaneous decision record exists.
- **Limitation** identifies evidence that is missing, incomplete, or unsuitable for precise attribution.

The principal evidence reviewed was:

- the authoritative standalone source at `/Users/aidancarter/Desktop/CodexSandbox/Quebec/InteractiveMap`;
- the Eleventy integration at `/Users/aidancarter/Desktop/CodexSandbox/Website`;
- current diffs and status from both Git repositories;
- website commits `889195b`, `183e3f9`, and `a094181`;
- standalone commit `16008c1`;
- `Projects/QuebecElection/Codex_Workflow_Retrospective.md`, which contains two previously captured token snapshots and a record of the earlier integration workflow;
- the current implementation session, including build results and the sequence of Safari WebDriver acceptance runs.

## 1. Executive summary

The implementation ultimately achieved the requested architecture and behavior with a small production-code change: one authoritative Leaflet application now uses one unconditional click-selection path for the embedded website map, the website's full-page route, and the standalone application. The former query-parameter split between embedded selection and full-page hover behavior was removed. The results renderer, vote calculations, party colors, data assets, and geographic preprocessing were preserved.

**Confirmed:** The current `src/main.js` contains one `bindFeature` implementation that registers only a click handler and calls the shared `selectFeature` function. `selectFeature` renders the selected result, opens and resets the results panel, and applies the shared `SELECTION_STYLE`. `clearSelection` resets the active GeoJSON layer, hides the panel, and resets its scroll position. `activateLayer` calls `clearSelection` before changing datasets. These functions are concentrated in approximately lines 171–197 and 255–281 of the current standalone source.

**Confirmed:** The selected style remains `weight: 3`, `opacity: 1`, and `fillOpacity: 0.82`; non-selected polygons use `opacity: 0.42` and `fillOpacity: 0.38`. The normal political fill color is not overwritten by the selected style. The results renderer still calls `rankPositiveParties`, `votePercentage`, and `barWidthPercentage`, preserving positive-vote filtering, descending order, percentages, and colored bars.

**Confirmed:** The Eleventy iframe no longer adds `?interaction=select`. Commit `a094181` records the one-line removal from `Text/QuebecElection.md`, along with replacement of the generated application bundles. The website therefore embeds the same route that users open directly.

**Confirmed:** The implementation passed source syntax checking, four calculation unit tests, the standalone Vite production build, the integration Vite build, the Eleventy build, diff checks, byte-for-byte comparison of all four website data assets with the standalone assets, and a final real Safari WebDriver acceptance run across three surfaces. The passing Safari run reported:

| Surface | Polling result rows exercised | District result rows exercised |
| --- | ---: | ---: |
| Website full-page | 6 | 5 |
| Website embedded | 7 | 6 |
| Standalone full-page | 6 | 5 |

The final run exercised pointer selection, selection persistence after pointer movement, selection replacement, normal/selected/subdued renderer opacity states, results ordering and bars, panel scrolling and scroll reset, Close behavior, both geography layers, selection clearing on layer change, and camera preservation.

The main difficulty was not the production implementation. It was building a reliable temporary Safari test harness for a Leaflet canvas inside an iframe. The session record contains fourteen failed acceptance-script executions followed by the passing fifteenth run. The failures progressed through target sampling, asynchronous readiness, iframe coordinate conversion, style measurement, scrolling, and test sequencing. No corresponding sequence of production-code corrections occurred after the initial implementation patch.

**Inference:** The strongest overall conclusion is that the feature itself was conceptually simple because the embedded implementation already existed, but the absence of a reusable browser acceptance harness made verification disproportionately expensive. The work would likely have completed much faster if the earlier successful Safari harness had been retained as a maintained project test.

## 2. Technical causes of the difficulty

### 2.1 Leaflet canvas hit testing is not DOM-element testing

**Confirmed:** The map sets `preferCanvas: true` and uses one explicit `L.canvas({ padding: 0.5, tolerance: 4 })` renderer. Polling divisions and districts are therefore painted into a canvas rather than represented by individually addressable SVG or DOM elements.

That choice is appropriate for 16,707 polling polygons, but it complicates automation. A browser test cannot locate a polling division with a CSS selector and call an element click. It must click a coordinate that Leaflet's canvas hit testing associates with a feature.

**Confirmed:** The temporary acceptance harness initially timed out waiting for the first full-page selection. Later attempts sampled nontransparent canvas pixels, but early samples could belong to a no-result area or to the same very large polygon. The harness had to change from a short list of early pixels to whole-visible-canvas grid sampling.

**Inference:** The map's performance-oriented rendering strategy transferred complexity from runtime rendering to acceptance testing. This was a reasonable application tradeoff, but the test strategy should have acknowledged it from the start.

### 2.2 Iframe coordinates have multiple coordinate spaces

The embedded route introduced at least four relevant coordinate spaces: outer-page viewport coordinates, iframe border-box coordinates, iframe content-viewport coordinates, and canvas backing-store coordinates. The iframe also needed to be scrolled into the visible outer viewport before real pointer actions could reach it.

**Confirmed:** One failed run reported that no sampled embedded polygon produced result rows. Scrolling the iframe into view allowed selection to proceed. Subsequent runs still found that the canvas pixel believed to be selected changed from alpha 173 to alpha 97, which meant the measurement point was rendered as a non-selected polygon after the click. The harness tested iframe border offsets, but direct correspondence between a sampled backing pixel and Leaflet's selected feature remained unreliable for small polling polygons.

**Inference:** A small coordinate offset could move a real Safari pointer into an adjacent polling polygon even when the sampled canvas pixel was well inside a painted area. This is consistent with the recorded alpha transition, but the exact feature IDs clicked were not logged, so the cause cannot be proven at feature level.

### 2.3 Visual state is composited, not exposed as individual style nodes

In an SVG map, a test can usually inspect the selected path's stroke width and every other path's opacity. In this canvas map, those styles become raster output.

**Confirmed:** The production code clearly establishes the intended style states in `SELECTION_STYLE` and applies them through `activeLayer.eachLayer`. The Safari harness nevertheless produced repeated false negatives when it compared alpha at a single presumed selected pixel. It was eventually changed to verify the expected renderer-level normal, selected, and subdued opacity values across the canvas rather than assuming that one sampled point was the selected feature's interior.

**Inference:** The final histogram check verifies that the three opacity states were rendered, while the source inspection verifies which style belongs to the selected layer. Neither method alone is as strong as inspecting per-feature DOM styles, but together they are appropriate evidence for a canvas renderer.

### 2.4 Asynchronous layer replacement required explicit readiness conditions

**Confirmed:** `activateLayer` loads geometry and result JSON asynchronously, removes the prior layer, constructs a new `L.geoJSON` layer, updates buttons and the legend, and only then hides the loading status. The earlier retrospective records a Safari test that accepted the old canvas before the district layer completed loading. The corrected strategy waited for both the requested layer button's active state and the hidden loading indicator.

**Inference:** Waiting only for a canvas element is insufficient because the same renderer or an old rendered frame may still satisfy that condition. Readiness needs to be expressed in terms of application state, not merely element existence.

### 2.5 The integration has authoritative and generated halves

**Confirmed:** `scripts/vite.quebec-election.config.js` points its Vite `root` at the standalone application and writes generated output into `Projects/QuebecElection/map/`. It also rewrites four application-authored `/data/...` paths to use `import.meta.env.BASE_URL` and enforces stylesheet-before-module ordering. Eleventy then publishes the generated map directory.

This architecture is sound, but it requires validation at two levels:

1. the standalone source and its tests/build;
2. the generated deployment copy and containing Eleventy build.

**Confirmed:** Git history reflects that split. Standalone Git history has one relevant committed baseline, `16008c1` at 2026-10-29 21:49:39-04:00, while the website history has three successive integration commits: `889195b` at 22:14:46, `183e3f9` at 22:46:56, and `a094181` at 2026-10-30 08:27:36. The current standalone selection changes remain a working-tree diff: 3 additions/3 deletions in `README.md`, 1/1 in `index.html`, 61/31 in `src/main.js`, and 26/1 in `src/styles.css`.

**Limitation:** Git cannot provide a committed before/after history for the final standalone selection implementation because those source changes have not been committed. The website's generated bundle commit proves what was built, but minified generated JavaScript is weaker review evidence than a source commit.

### 2.6 The earlier interaction-mode decision created later cleanup

**Confirmed:** The earlier retrospective describes an intentional split: embedded maps used `?interaction=select`, while direct maps retained hover behavior. The current request reversed that design decision and required both versions to use the selection interaction. Commit `a094181` removes the iframe parameter, and current source contains no interaction-mode check or mouseover/mouseout binding.

**Inference:** The split was a reasonable response to the earlier requirement, not an implementation defect. However, once click-selection proved better in the constrained iframe, an earlier product decision to standardize the interaction could have avoided the later unification task.

## 3. Avoidable inefficiencies and mistakes

### 3.1 Broad searches included generated/minified bundles

**Confirmed:** The initial source search returned tens of thousands of tokens and included a large minified Leaflet/Vite bundle before output truncation. The same happened again during the final status/diff inspection when an `rg` search matched the generated JavaScript bundle.

This was avoidable. The architectural question—whether interaction was gated and where selection functions lived—could be answered entirely from `src/main.js`, `src/styles.css`, `index.html`, and `Text/QuebecElection.md`.

Recommended correction: default mapping-project searches should exclude `dist`, generated `map/assets`, `_site`, `node_modules`, and large data files unless the purpose is specifically to verify a generated string.

### 3.2 The browser test was reconstructed instead of reused

**Confirmed:** The earlier retrospective says real Safari pointer, wheel, Close, selection-change, and layer-switch tests had already succeeded and records several hard-won details: element-relative iframe coordinates, nontransparent canvas sampling, and explicit asynchronous readiness. No reusable test file was present in the project when the new task began, so a new temporary WebDriver client was written under `/tmp`.

**Confirmed:** The visible current-session record contains fourteen failed executions of that temporary acceptance script before the fifteenth passed. Representative failures were:

1. first selection timed out;
2. a district assertion used brittle panel-copy matching;
3. embedded sampling found no result-bearing polygon;
4. second-polygon selection timed out or remained on the same polygon;
5. selected-pixel alpha assertions were based on an unreliable coordinate assumption;
6. Close was clicked while its absolutely positioned button had scrolled out of view;
7. a redundant attempt to reopen polling selection before layer switching failed.

The failed runs did produce new information, but many repeated the expensive full three-surface setup before reaching the current failing branch.

Recommended correction: keep a reusable Safari acceptance test once the interaction model stabilizes. During development, allow a route or test-name filter so the harness can rerun only the failing surface and step. Run the full three-surface matrix only after the focused branch passes.

### 3.3 Some assertions tested incidental copy or coordinates rather than behavior

**Confirmed:** One run failed because the test expected the exact string `Electoral district results`. The assertion was replaced with the active-layer state and absence of polling-division markup, which more directly represented the requirement.

**Confirmed:** Several runs tried to prove selected emphasis using the alpha value at the click coordinate. The more robust final approach combined source-level style verification with renderer-level opacity-state verification.

Recommended correction: browser acceptance tests should assert stable semantic state—active layer, panel visibility, selected result identity, result-row properties, scroll position, and map center/zoom—rather than prose or a presumed raster coordinate whenever a better state signal exists.

### 3.4 Test sequencing created unnecessary reacquisition work

**Confirmed:** The harness first tested Close, then tried to reopen a polling selection solely so that it could test layer-switch clearing. That reacquisition failed repeatedly in the iframe. The final passing sequence tested Close on the polling selection, selected a district after switching layers, and then switched back to polling to verify that an active district selection was cleared.

Recommended correction: design an acceptance flow as a state machine before coding it. Each required transition should ideally reuse the state produced by the previous step instead of recreating a hard-to-hit canvas target.

### 3.5 Repeated full runs obscured the distinction between app defects and harness defects

**Confirmed:** After the initial production patch, the subsequent edits were almost entirely to `/tmp/quebec-safari-acceptance.mjs`; the application source was not repeatedly changed in response to each browser failure. This restraint was good, but the session still spent many iterations diagnosing failures that were clearly moving among harness assertions.

**Inference:** An explicit checkpoint after the second or third harness-only failure—“application source is stable; all remaining work is test-harness calibration”—would have reduced the risk of unnecessary application edits and made the debugging strategy clearer.

### 3.6 The final source change remains uncommitted in the authoritative repository

**Confirmed:** Website commit `a094181` includes the generated shared-interaction bundle and iframe URL change, but the standalone repository still reports `README.md`, `index.html`, `src/main.js`, and `src/styles.css` as modified against its sole relevant commit.

This was consistent with the instruction not to commit during implementation. It is not a process violation.

**Limitation:** Until the user commits the standalone source, the generated website artifact is ahead of the authoritative repository's committed history. Future reconstruction from Git alone would be confusing if the working tree were lost.

## 4. Token usage analysis

### Confirmed token snapshots

The earlier retrospective records these actual Codex usage snapshots:

| Session | Input tokens | Cached input tokens | Output tokens | Reasoning tokens | Reported total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original Quebec interactive map | 55,913 | 4,446,720 | 40,801 | 10,337 | 96,714 |
| Eleventy website integration | 99,348 | 6,326,912 | 32,926 | 13,881 | 132,274 |
| **Combined observed snapshots** | **155,261** | **10,773,632** | **73,727** | **24,218** | **228,988** |

The reported totals equal input plus output tokens. Reasoning is already included within output, and cached input is a separate statistic; neither should be added again to 228,988.

At those snapshots, the integration session had 43,435 more input tokens and 35,560 more reported total tokens than the original-map session, while producing 7,875 fewer output tokens. Its cached-input count was 1,880,192 higher.

### Interpretation

**Inference:** The higher integration input and cached-input figures are consistent with accumulated context, repeated tool output, long instruction rereads, multiple builds, and browser-automation state. They do not prove a causal allocation because no per-stage counters exist.

The current interaction-unification session shows the same qualitative pressure points:

- two complete skill files were read;
- one broad initial search and one final generated-bundle search produced truncated high-volume output;
- the Safari acceptance harness ran fifteen times;
- each browser run reprocessed application state, harness source, and prior failure context;
- the production edit itself was comparatively small.

**Inference:** Browser-harness iteration, not application code generation, was probably the dominant avoidable token cost in the current session. This cannot be quantified from the available evidence.

### Token evidence limitations

- No reliable token counter is available for the current implementation or retrospective turn.
- The two historical figures are snapshots, not guaranteed final session totals.
- The website integration session continued after its recorded snapshot, so 132,274 understates its eventual total.
- Cached input is not cumulative billable output and must not be added to the reported total.
- No evidence supports assigning a numeric token total to searching, coding, building, Safari testing, or any individual failure.
- The visible number of WebDriver runs is a workflow count, not a token count.

## 5. Assessment of the development and testing workflow

### What worked well

#### Scope and data integrity

The task was correctly classified as a focused interaction change rather than a geographic-data task.

**Confirmed:** No election results, geographic files, party colors, vote formulas, or preprocessing scripts were edited. The four generated website data files were confirmed byte-for-byte identical to the standalone `public/data` files. This was an appropriate, cheap integrity check for unchanged data.

#### Single-source architecture

**Confirmed:** The standalone Vite application remained authoritative. The Eleventy project continued to build it through the dedicated Vite configuration instead of creating a second interaction implementation. Removing the URL parameter eliminated the behavioral fork without broad refactoring.

This was the smallest maintainable architectural change. The selection functions already shared rendering and calculations; the final source simply made the click path unconditional and removed hover handlers.

#### Production implementation quality

The final state transitions are cohesive:

- `selectFeature` owns selection activation;
- `applySelectionStyles` owns selected-versus-other styling;
- `clearSelection` owns Close and layer-reset behavior;
- `activateLayer` clears selection before loading the new geography;
- `renderPanel` consistently adds the existing Close control;
- the panel's scroll position resets on selection and clear.

**Confirmed:** Camera preservation follows from the removal of the prior `fitBounds` branch and the absence of camera movement in `activateLayer`. Safari testing also compared map-transform state across layer switches.

#### Layered validation

The final validation stack was strong:

1. syntax check;
2. calculation unit tests;
3. standalone build;
4. integration build;
5. Eleventy build;
6. generated-data byte comparison;
7. diff checks;
8. real Safari interaction testing for all three surfaces and both layers.

This appropriately separated source correctness, deployment correctness, data integrity, and real user interaction.

#### Cleanup and restraint

**Confirmed:** Temporary browser scripts were kept in `/tmp` and removed after the passing run. Only server and browser processes started for the task were stopped. No commit or deployment was performed during the implementation turn.

### What should improve

#### Browser-test planning

The acceptance criteria were known before the harness was written, but the test was developed incrementally without first defining a stable state-transition sequence and coordinate strategy. This produced repeated full runs and brittle assertions.

An improved sequence would be:

1. load one surface and wait for application-level readiness;
2. locate a confirmed result-bearing polygon;
3. record selection identity and map camera;
4. verify move-without-click persistence;
5. scroll, then click a confirmed different feature and verify scroll reset;
6. test Close;
7. switch layers from an active selection and verify clear/camera preservation;
8. repeat the already-proven flow for the other surfaces;
9. run the complete matrix once.

#### Reusable acceptance coverage

The earlier workflow had already discovered the difficult parts of Safari/Leaflet testing, yet those discoveries survived only as prose. A maintained acceptance test would turn those lessons into executable safeguards.

The project now has a stable enough interaction model to justify a small reusable suite. It should avoid embedding data-specific feature IDs unless those IDs are guaranteed stable, but it can expose stable state through semantic DOM attributes or a development-only test interface.

#### Git checkpoints

The instruction not to commit was correctly followed during implementation, but the source/generated split creates a handoff risk. A future user-controlled commit should include the authoritative standalone source before or together with the generated website artifact, or clearly reference the corresponding source revision.

#### Evidence capture

The passing test returned only surface labels and row counts. A reusable harness should also emit a concise structured record of:

- selected feature IDs before and after replacement;
- center and zoom before and after layer changes;
- panel scroll positions;
- active layer names;
- console errors;
- whether wheel scrolling used a real wheel action or a fallback.

That would strengthen the evidence without dumping screenshots or minified output.

## 6. Recommendations for improving the two existing skills

### 6.1 `token-efficient-codex-workflow`

#### Add explicit generated-file exclusion defaults

For source searches in built web projects, instruct agents to exclude common generated locations by default: `dist`, `_site`, `build`, `coverage`, `node_modules`, and hashed asset directories. Permit targeted generated-output searches only when verifying an exact deployment string or artifact reference.

This recommendation is directly supported by two truncated searches that unnecessarily included minified bundles.

#### Add a browser-harness retry budget and checkpoint

After two browser-test failures caused by targeting or automation rather than application behavior, require a short checkpoint:

- What changed in the hypothesis?
- Is the failure in application code, environment, or harness?
- Can the failing surface or step be isolated?
- Should the harness be retained as a reusable test?

The current “retry only when the hypothesis changes” guidance is sound but too general. A concrete browser-specific checkpoint would have interrupted the fourteen-failure sequence earlier.

#### Distinguish focused test reruns from final matrix runs

Recommend running only the failing route and interaction during harness development, followed by one full acceptance matrix at handoff. This would reduce repeated loading of the 16 MB polling geometry and repeated Safari setup.

#### Make session evidence capture operational

The skill already requests token reporting when reliable counters exist. It should also recommend capturing a small final workflow record when counters are unavailable:

- number of build/test commands;
- number of browser acceptance attempts;
- final passing command;
- files changed;
- whether current token counters were unavailable.

This does not replace token counters but makes later retrospective analysis less dependent on reading an entire transcript.

#### Clarify when a reusable test outweighs the “one focused test” preference

The skill cautions against constructing custom lifecycle simulations, which is useful for small changes. It should explicitly carve out canvas maps and target-browser requirements: when coordinate-sensitive real-browser behavior is a recurring acceptance requirement, preserving a compact WebDriver suite is more efficient than repeatedly improvising a one-off check.

### 6.2 `interactive-web-mapping`

#### Add a Leaflet canvas acceptance-testing recipe

The skill should include a short, concrete pattern for canvas maps:

1. wait for an application-level layer-ready signal;
2. bring an iframe into the outer viewport;
3. account for iframe borders and canvas backing-store scaling;
4. sample rendered pixels across the whole visible canvas by grid cell rather than guessing coordinates;
5. confirm that a target produces a result before using it in later assertions;
6. prefer semantic state assertions over exact raster-point assertions;
7. capture selected feature identity when possible.

These steps directly encode the main technical lessons from the failed Safari runs.

#### Require a multi-surface test matrix when one app is embedded and direct

The skill should ask for an explicit matrix covering:

- authoritative standalone route;
- generated/deployed direct route;
- embedded iframe route;
- each geography layer;
- selection, replacement, clear, scroll, and camera behavior.

This project had three surfaces sharing one implementation. A matrix makes shared logic and deployment-specific failures visible without implying three implementations.

#### Recommend stable test seams for canvas state

For established applications, recommend optional non-production or read-only test observability such as data attributes for active layer, selected feature ID, center, and zoom. This is preferable to inferring all state from canvas pixels. The skill should caution against exposing mutable internals or creating a parallel selection implementation.

#### Separate rendered-style evidence from selection-state evidence

For canvas choropleths, recommend combining:

- source or application-state verification that the selected layer received the selected style;
- canvas-level verification that expected opacity/color states were rendered;
- real user input that caused the state transition.

This is more defensible than assuming the alpha value at the pointer coordinate uniquely identifies the selected feature.

#### Add test-state sequencing guidance

The skill should recommend expressing acceptance tests as a state-transition graph. Reuse active selections to test layer clearing; avoid closing and then reacquiring a difficult canvas target unless Close itself is the final transition under test.

#### Encourage converting successful exploratory diagnostics into permanent tests

The skill already recommends reusable acceptance tests, but the guidance should be stronger after a test required nontrivial Safari, iframe, or canvas calibration. A successful temporary harness with those characteristics should normally be promoted to a maintained test unless the user explicitly declines extra test files.

## 7. Three most important lessons learned

### 1. Preserve one interaction state machine, not one implementation plus route-specific behavior

The best production decision was to remove the interaction-mode gate and make the proven click-selection path universal. Shared rendering alone was not enough while hover and click still represented different state machines. The current `selectFeature`, `clearSelection`, and `activateLayer` flow gives all routes identical lifecycle behavior with minimal code.

**Confirmed:** The iframe parameter is gone, hover handlers are gone, and all feature binding goes through the same click callback.

### 2. For canvas maps, test semantics and transitions—not guessed pixels

Canvas pixel sampling is useful for finding targets and confirming rendered opacity classes, but it is a poor sole source of truth for feature identity. Tests should combine real pointer input, semantic application state, renderer evidence, and stable lifecycle assertions.

**Confirmed:** Single-pixel assumptions caused several false negatives; semantic active-layer assertions and state-aware test sequencing produced the final passing run.

### 3. Hard-won browser automation knowledge must become executable project infrastructure

The earlier session had already solved Safari, iframe, canvas targeting, scrolling, and readiness problems. Because that knowledge existed only in a retrospective, the next session rebuilt and debugged the harness again.

**Confirmed:** Fourteen temporary-harness failures preceded the passing run, despite the earlier retrospective documenting the same classes of problems.

**Inference:** A small maintained Safari acceptance suite would have delivered the largest efficiency improvement available in this project—more than further production refactoring, additional data validation, or broader unit-test coverage for this particular change.

## Evidence limitations

- The final standalone source changes are not committed, so Git history cannot show their authoritative source revision or exact evolution.
- The generated website bundle is committed, but minification limits code-review value.
- The historical token figures are incomplete snapshots; there is no reliable current-session token total or per-stage token accounting.
- The Safari harness was temporary and removed after the run. Its final result and failure sequence are available in the session record, but the executable test is not present in the repository.
- The final harness verified canvas opacity states and source styling together; it did not log exact selected feature IDs for every surface.
- No claim is made about browsers other than Safari in the final interaction-unification session.
