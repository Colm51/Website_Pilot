# Quebec Election Map: Codex Workflow Retrospective

## 1. Project overview

The original project was a standalone Vite and Leaflet application for exploring the 2026 Quebec provincial election. It supports two geographic levels—127 electoral districts and 16,707 ordinary polling divisions—and displays winner classifications, ranked positive party votes, percentages, and vote-share bars. Its browser-ready geography and result files were already validated outputs derived from authoritative GeoPackage sources.

The integration kept that application authoritative rather than rebuilding it inside Eleventy. A deployment-specific Vite configuration builds the same source into `Projects/QuebecElection/map/`, uses a relative base, converts four root-relative data requests into base-aware requests, and ensures the generated stylesheet is loaded before the module script. Eleventy then passes the generated directory through to `/projects/quebec-election/map/`. The project page embeds that route in an iframe and also links to it directly.

The final application has two interaction modes from one codebase:

- The embedded map uses `?interaction=select`. Clicking a geography opens persistent results, emphasizes the selection, subdues other polygons, supports panel-only scrolling, and provides a close button.
- The direct full-screen map has no interaction parameter and retains the original hover and mouseout behavior.

The initial camera now emphasizes southern Quebec, Montréal, the St. Lawrence corridor, nearby Ontario, and the northeastern United States. Layer changes preserve the camera. Election results, geographic data, party colors, calculations, and special-case classifications were not changed. The final result met the requested website, interaction, data-integrity, build, and Safari-validation requirements.

## 2. Token usage

The following figures are actual usage statistics captured from two Codex session snapshots. They are observed values, not estimates.

| Session | Input tokens | Cached input tokens | Output tokens | Reasoning tokens | Reported total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Session 1: Original Quebec interactive map | 55,913 | 4,446,720 | 40,801 | 10,337 | 96,714 |
| Session 2: Eleventy website integration | 99,348 | 6,326,912 | 32,926 | 13,881 | 132,274 |
| **Combined observed snapshots** | **155,261** | **10,773,632** | **73,727** | **24,218** | **228,988** |

The reported totals equal input plus output tokens for these snapshots. Reasoning tokens are already included within output tokens, and cached input tokens are reported separately; neither category should be added again to the reported totals. The combined reported total is therefore 228,988 tokens, not a sum that also includes 10,773,632 cached input tokens or 24,218 reasoning tokens.

### Limitations of the observed statistics

- These figures are session snapshots and may not be the final cumulative totals for either session.
- The Eleventy website-integration session continued after its snapshot was recorded, so its displayed figures understate that session's eventual usage.
- The combined row covers only the two supplied snapshots. It is not a complete accounting of all Codex activity on October 29.
- No reliable per-stage counters are available. Token use must not be assigned numerically to individual workflow stages.
- Context-window occupancy is different from cumulative session consumption. Compaction or summarization may change what the model can currently see without reversing tokens already processed.

These observations still support bounded comparisons. At the recorded snapshots, the integration session had 43,435 more input tokens and 35,560 more reported total tokens than the original-map session, despite producing 7,875 fewer output tokens. Its cached-input count was also 1,880,192 higher. This pattern is consistent with a longer, context-heavy integration workflow involving repeated instructions, tool results, builds, and browser-validation state. That explanation is an analytical conclusion from the workflow record, not a measured allocation of tokens to those activities. Because Session 2 continued after capture, even these between-session differences are provisional.

## 3. Workflow stages

| Stage | Work and outcome |
| --- | --- |
| Existing website inspection | Identified the Eleventy directory structure, passthrough-copy conventions, project-page pattern, global iframe sizing, package scripts, dirty worktree, and deployment path behavior. |
| Integration planning and checkpoint | Established that the Vite application would remain authoritative, the website would contain generated output, and geographic preprocessing would remain outside the integration workflow. The checkpoint separated source ownership, deployment output, and validation responsibilities. |
| Vite and Eleventy integration | Added a website build command using a dedicated Vite configuration, emitted the app into `Projects/QuebecElection/map/`, added Eleventy passthrough copying, and embedded the resulting route in the project page. |
| Geographic asset handling | Reused the existing browser assets without regeneration. The four website data files were repeatedly compared byte-for-byte with the source application's `public/data` files. |
| Browser testing | Progressed from nonvisual builds and asset checks to a local Eleventy server and real Safari WebDriver sessions. Both the embedded and direct routes were exercised. |
| Blank-map diagnosis | Distinguished deployment and rendering problems from geographic-data defects. The data validated successfully, focusing diagnosis on asset paths, generated HTML, CSS timing, and container sizing. |
| CSS and JavaScript loading order | Enforced stylesheet-before-module ordering in the website Vite build. The transform also fails explicitly if Vite's expected generated-HTML pattern changes, preventing silent regression. |
| Initial view adjustment | Replaced province-wide `fitBounds` with a fixed southern-Quebec center and zoom while ensuring layer changes no longer move the camera. |
| Embedded results-panel improvements | Corrected the mismatch between a short iframe and the map shell's 520-pixel minimum. The first solution made the existing panel internally scrollable and kept it inside the iframe. |
| Click-to-select interaction | Added an iframe-only selection mode through a URL parameter. It reuses the existing result renderer and data while adding persistent selection, configurable emphasis, panel event isolation, scrolling, close behavior, and layer-reset behavior. |
| Final validation | Ran source tests, standalone and integration Vite builds, the Eleventy build, browser-asset validation, data comparisons, diff checks, and real Safari pointer, wheel, close, selection-change, layer-switch, and hover tests. |

## 4. Efficiency analysis

### Necessary work

The following work directly reduced material integration risk:

- Inspecting the website's existing conventions before choosing output paths.
- Preserving one authoritative Vite application and using a deployment-only configuration.
- Testing local and subpath-safe asset URLs rather than assuming root deployment.
- Keeping geographic preprocessing out of a UI/integration task.
- Comparing generated website data with the source assets byte-for-byte.
- Running both the Vite build and the containing Eleventy build.
- Testing the iframe and direct route separately because they intentionally use different interaction modes.
- Using real Safari input for the final interaction requirements.

### Work that could have been avoided or reduced

- Long skill files were reread on several closely related turns because the skills were explicitly invoked each time. This ensured compliance but added repeated input and tool output. A short project checkpoint plus stable skill references would be more efficient when supported by the environment.
- Some searches included generated/minified JavaScript and returned far more text than needed. Source inspection or narrowly extracted strings would have answered the same questions with less context.
- Full source, integration, and website builds were run after multiple small refinements. Builds were justified before handoff, but intermediate changes could sometimes have been batched before the full Eleventy build.
- Temporary Safari automation was recreated and refined during successive tasks. A small reusable acceptance harness, added only after the interaction model stabilized, would reduce future setup and coordinate-debugging costs.
- The same data-integrity suite was run repeatedly even though no data changed. A cheaper checksum comparison followed by the full validator only at final handoff would have been sufficient on some UI-only turns.

### Failed approaches and technical rework

Several retries produced useful evidence but consumed time and context:

- The managed environment initially denied local port binding. The server then had to be restarted with explicit approval.
- Safari WebDriver could not be reached from the sandboxed client process; the local WebDriver client also required approved execution.
- Early Safari pointer actions used viewport coordinates that did not map correctly into the iframe. Element-relative coordinates fixed polling-area interaction.
- Hand-estimated coordinates did not reliably hit electoral districts. Sampling confirmed nontransparent vector-canvas pixels before issuing real Safari clicks removed that assumption.
- One district test accepted the old canvas before asynchronous layer loading completed. Waiting for the layer button's selected state and hidden load indicator corrected the race.
- The blank-map investigation required separating valid data from deployment-path and CSS-loading problems. Earlier verification of the built HTML order and all runtime URLs would have shortened that branch.

### Requirements and user-experience rework

The first embedded-panel correction was technically consistent with the request at that time: it constrained the map shell and verified that all rows were reachable through panel scrolling. It nevertheless left hover-driven results awkward in a short iframe. The later click-to-select requirement expressed the desired interaction more precisely.

This was not primarily a calculation or data error. It was a difference between technical accessibility of content and a satisfactory interaction. An earlier design checkpoint asking whether embedded results should remain hover-driven, become click-persistent, or open outside the map could have avoided one implementation cycle.

### Main contributors to token consumption

No per-stage counts are available, so attribution cannot be quantified. The observed snapshots show that the integration session had substantially more input and cached-input activity than the original-map session, while generating less output at the moment of capture. This supports—but does not prove—the conclusion that accumulated context and repeated processing were more important efficiency pressures than response length alone. Qualitatively, likely contributors were repeated long instructions, broad tool output, multiple build logs, several Safari automation iterations, and revisiting closely related embedded-panel behavior across separate turns. The narrowly scoped source edits, byte comparisons, and configuration-based reuse of one application were comparatively efficient in workflow terms, but no token count can be assigned to them.

## 5. Skill effectiveness

### `token-efficient-codex-workflow`

This skill improved scope control and handoff discipline. It encouraged targeted searches, explicit preservation of unrelated dirty-worktree changes, focused diffs, bounded validation, separation of authoritative source tests from generated-copy checks, and careful distinction between observed token snapshots and complete cumulative accounting. Its strongest contribution was preventing UI requests from expanding into unnecessary geographic preprocessing or broad refactoring.

Its effectiveness was limited when long instructions had to be reread on every invocation and when browser requirements legitimately demanded several iterative checks. The skill identified these as warning signs, but it could not eliminate environment approvals, Safari driver behavior, or changing user-experience requirements.

### `interactive-mapping`

The mapping skill helped distinguish UI changes from geographic-data changes, preserve source datasets, keep identifier-linked results intact, and require browser interaction testing when available. It supported the initial integration checkpoint, explicit source/generated ownership, data-integrity checks, layer-state validation, camera preservation, and the rule that visual success cannot be inferred from a successful build.

It was particularly valuable in preventing regeneration of stable geographic assets and in requiring actual tests of panning, zooming, layer switching, selection, and scrolling. Its browser-testing guidance also supplied sensible stop conditions when failures were environmental rather than application defects.

Together, the skills reduced unnecessary changes and improved validation quality. They did not fully prevent repeated investigation because the final interaction requirements evolved and Safari automation exposed issues that static inspection could not.

## 6. Lessons learned

### Integrating Vite into Eleventy

Treat the Vite application as a separately built artifact with an explicit owner, build command, output directory, and Eleventy passthrough rule. Avoid copying source modules into the Eleventy project by hand. Document which files are authoritative and which are generated.

### Relative and root-relative paths

Vite's `base: "./"` fixes generated JavaScript and CSS references, but application-authored requests such as `/data/polling-results.json` remain root-relative unless changed. A subpath deployment needs base-aware data URLs as well as base-aware bundles. Validation should inspect the built HTML and all runtime data URLs.

### CSS before Leaflet initialization

Leaflet measures its container during initialization. If the application module runs before the generated stylesheet establishes map height, a map can be technically initialized yet appear blank or incorrectly sized. For this integration, the Vite HTML transform ensures the stylesheet link precedes the module script and fails loudly if the expected structure changes.

### Embedded map sizing

An iframe viewport is the application's viewport. A child map shell with a minimum height larger than the iframe, combined with hidden body overflow and bottom-positioned controls, can make content inaccessible. Use viewport-aware constraints and test the actual iframe dimensions—not only the direct route.

### Safari testing

Real Safari WebDriver testing was valuable because it exercised the target browser's iframe, canvas, wheel, and overflow behavior. It required an approved local server and browser-control process. Pointer actions inside iframes should be element-relative, asynchronous layer changes need explicit readiness conditions, and canvas maps may require rendered-pixel targeting rather than guessed coordinates.

### Limits of headless and static checks

Builds, DOM measurements, `overflow-y: auto`, and unit tests establish necessary facts but do not prove that a user can select a small canvas polygon, scroll a panel without zooming the map, or understand the interaction. Headless tools also do not substitute for Safari when the acceptance requirement is browser-specific.

### Test the user's actions

The final acceptance run used actual pointer clicks, pointer movement, wheel scrolling, close-button activation, and layer-button activation. It verified state after each action and checked that panel scrolling did not alter map tiles or map transforms. This was materially stronger than checking only event-handler source or CSS declarations.

### Technical correctness versus successful experience

The first scrolling panel made every row reachable, but the hover interaction remained unsatisfactory in a short embed. Passing a technical requirement does not guarantee a good experience. Interaction decisions should be validated at the intended size early, preferably at a checkpoint before polishing the implementation.

### Preserve the standalone application

A small configuration flag was preferable to maintaining separate embedded and full-screen copies. The iframe opts into selection mode; the parameter-free application keeps hover behavior. Shared rendering, calculations, colors, controls, and data minimize divergence.

## 7. Recommendations for a new `eleventy-project-integration` skill

The proposed skill should not be created as part of this retrospective, but it could make future integrations faster and more predictable.

### Reusable instructions

1. Identify the authoritative application, generated output, Eleventy input/output directories, deployment subpath, and files that may be modified.
2. Inspect existing Eleventy passthrough and project-page conventions before adding new ones.
3. Inventory every runtime URL: generated bundles, CSS, images, fonts, workers, fetch requests, tiles, and data files. Classify each as external, root-relative, document-relative, or base-aware.
4. Prefer a dedicated integration build configuration with an explicit `root`, relative `base`, deterministic `outDir`, and guarded transformations over edits that weaken the standalone application.
5. Keep source data and generated browser assets separate. Do not preprocess geographic or analytical data during an unrelated website integration.
6. For Leaflet or similar canvas maps, ensure container CSS is available before initialization and verify nonzero dimensions in the embedded route.
7. Decide explicitly whether embedded and direct routes share interaction behavior. If they differ, prefer a query parameter or small configuration object over duplicated applications.
8. Preserve dirty-worktree changes and report generated asset replacement separately from authored-source changes.
9. Use bounded browser troubleshooting: classify port, sandbox, driver, network, and application failures before retrying.
10. Record the local URLs and exact build sequence in an integration README.

### Suggested checkpoint

After discovery and before editing, present a short checkpoint containing:

- authoritative source and generated output paths;
- local, Eleventy, and deployed URL matrix;
- asset-path strategy, including application-authored fetches;
- CSS and JavaScript loading expectations;
- data-copy or passthrough strategy and integrity check;
- embedded versus direct interaction behavior;
- files expected to change;
- build, browser, and rollback plan.

Implementation should pause only if this checkpoint exposes a consequential choice, such as whether to alter the source application's path model, duplicate assets, or change interaction behavior.

### Suggested validation workflow

1. Run focused source tests and the standalone production build.
2. Run the integration-specific Vite build.
3. Inspect generated HTML for CSS/script order and relative bundle references.
4. Verify every local runtime asset and data URL below the deployment subpath.
5. Compare copied data with the authoritative browser assets using checksums or byte comparison.
6. Run the full Eleventy build and confirm passthrough output.
7. Start one approved local server and test both the project page and direct application route.
8. Use the target browser for representative real interactions, responsive dimensions, console errors, and network failures.
9. Run `git diff --check`, list authored and generated changes, and confirm that no source data or unrelated page changed.

## 8. Conclusions

The project was successful: a validated standalone election map now works as both an Eleventy embed and a direct full-screen application, with interaction appropriate to each context and without changing election or geographic data.

The main complexity came from deploying a Vite application below an Eleventy subpath, Leaflet's sensitivity to stylesheet and container timing, the restricted execution environment, and the need to validate canvas interactions in Safari. The most avoidable inefficiencies were broad generated-code output, repeated full builds and validators during small UI iterations, guessed browser coordinates, and delaying the interaction-model decision for the constrained iframe.

The most valuable practices were preserving a single authoritative application, using a guarded deployment-only configuration, keeping data byte-identical, separating source and integration validation, and testing real user actions in the target browser.

Recommendations for future projects:

1. Resolve asset-path, ownership, and embedded-interaction decisions at an early checkpoint.
2. Build a small reusable browser acceptance test after the interaction model stabilizes.
3. Batch minor UI changes before full-site builds while retaining a complete final validation run.
4. Use narrow source searches and concise diagnostics; avoid loading minified bundles except for exact string verification.
5. Treat successful builds and valid CSS as prerequisites, not proof of a successful embedded user experience.
6. Capture a final token snapshot at each session handoff using consistent categories; keep cached input separate, treat reasoning as part of output, and avoid stage-level attribution unless stage counters are actually recorded.
