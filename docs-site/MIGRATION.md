# Migration disposition — opennoodl-docs's 431 authored files

**Generated once, 2026-08-07, against `opennoodl-docs` @ `7489e81` (2025-12-06), not hand-maintained.** ALPHA-006 §4's deliverable: every authored `.md`/`.mdx` file in the old docs repo, assigned one fate. This is a disposition record of a decision, not a generator — if the old repo changes before the strip actually happens, re-derive this rather than trust it stale. See `dev-docs/tasks/phase-33-alpha-launch/ALPHA-006-DOCS-PLATFORM.md` §4 for the rules this follows, and `HUMAN-GATED-ITEMS.md` B5 for why the strip itself hasn't happened yet.

## Summary

| Fate | Files | What happens to them |
|---|---|---|
| Generated (superseded) | 112 | Not migrated. Superseded wholesale by §3's generator — the old prose is a cross-check source, not a copy source. |
| Port near-verbatim | 24 | Migrated into `docs-site/`, checked against current source before landing, not copied blind. |
| Salvage concept | 33 | The concept survives into `docs-site/`; the walkthrough steps and every screenshot do not. |
| Stays (payload-coupled) | 193 | Not migrated, not deleted. Stays in the (renamed) content-host repo — coupled to a payload (library/lessons/templates) that also stays there. |
| Delete | 69 | Deleted outright — describes a product surface, backend, or feature NodeGX does not ship, or is superseded with nothing worth salvaging. |
| **Total** | **431** | |

## Generated (superseded)

| Where | Files | Why |
|---|---|---|
| `nodes/** (106 subfolders)` | 112 | Superseded wholesale by §3's generator, reading node-catalog-enriched.json instead. |

## Port near-verbatim

| Where | Files | Why |
|---|---|---|
| `javascript/** (18 subfolders)` | 23 | Check against noodl-viewer-react/src/noodl-js-api.ts before porting; spec found 13/14 namespaces covered, missing Config and Env. |
| `docs/guides/editor/keybindings.md` | 1 | Verify against packages/noodl-editor/src/editor/src/constants/Keybindings.ts before porting. |

## Salvage concept

| Where | Files | Why |
|---|---|---|
| `docs/guides/business-logic/, docs/guides/data/, docs/guides/navigation/, docs/guides/user-interfaces/` | 29 | Concept survives, screenshots/steps do not. navigation/encoding-parameters-in-urls.mdx overlaps SUB-013 — reconcile, don't copy. |
| `docs/guides/visualizing-data/filter-table-data.md, docs/guides/visualizing-data/styling-table.md, docs/guides/visualizing-data/table-pagination.md, docs/guides/visualizing-data/table-to-visualize-data.md` | 4 | Same pattern as data/navigation/user-interfaces: table concepts likely survive, the walkthrough screenshots (pre-refresh UI) do not. |

## Stays (payload-coupled)

| Where | Files | Why |
|---|---|---|
| `library/** (115 subfolders)` | 179 | Prefab/module prose, content-coupled to the library payload (the zips), not to the editor. Phase 21's territory, not ALPHA-006's — see relationship note in the spec. |
| `static/library/modules/gsheets/release-notes.md, static/library/modules/mapbox/guides/screen-coordinates/README.md, static/library/modules/mapbox/release-notes.md, static/library/modules/webcamera/webcamera-guide.md` | 4 | Same as library/ — a prefab/module's own guide or release notes, payload-coupled. |
| `.github/ISSUE_TEMPLATE/1.Bug_report.md, .github/ISSUE_TEMPLATE/2.Improve_docs.md, .github/PULL_REQUEST_TEMPLATE.md` | 3 | Repo infrastructure (issue/PR templates), not documentation content. Needs editing once the repo is repurposed (a generic "improve docs" issue template stops making sense on a content-only repo) but is not deleted or migrated. |
| `CODE_OF_CONDUCT.md, LICENSE.md, README.md` | 3 | Repo meta describing the repo itself — needs rewriting once renamed/repurposed, not deleted or migrated into this monorepo. |
| `_prefab-docs-boilerplate/docs-starter/markdown/README.md, _prefab-docs-boilerplate/docs-starter/markdown/components/my-prefab-request/README.md, _prefab-docs-boilerplate/docs-starter/markdown/components/setup-my-prefab/README.md` | 3 | Authoring template for a prefab's own README — community-authoring tooling, belongs beside the payload it documents, not the editor. |
| `project-templates/overview.mdx` | 1 | Index page for the project-templates payload folder itself. |

## Delete

| Where | Files | Why |
|---|---|---|
| `codebase/** (7 subfolders)` | 21 | Contributor docs, superseded by the 30 files in dev-docs/reference/; never belonged on a user-facing site. |
| `docs/guides/cloud-data/, docs/guides/cloud-logic/` | 15 | Built on creating a "Noodl Cloud Service" and inspecting it in the Dashboard — WF-007 deleted noodl-parse-dashboard, BCN-001..004 replaced the contract beneath it. Not one paragraph survives. |
| `docs/getting-started/ai-assisted-dev/, docs/getting-started/` | 8 | Superseded by ALPHA-004's freshly-authored getting-started.md. noodl-ai.md and the ai-assisted-dev/* trio describe "Noodl AI", a product NodeGX does not ship (ours is provider-agnostic BYO-key). |
| `docs/guides/deploy/deploying-to-ios-and-android.md, docs/guides/deploy/embedding.md, docs/guides/deploy/favicon.md, docs/guides/deploy/overview.md, docs/guides/deploy/project-structure.md, docs/guides/deploy/pwa.md` | 6 | Export/embedding/PWA/mobile topics — phase 18 (code export) and 26 (deployment) territory, both explicitly post-alpha. Unverified against current NodeGX; do not publish as current until those phases land and re-author it. |
| `docs/build-alongs/horizontal-list-with-snapping.md, docs/build-alongs/overview.md, docs/build-alongs/star-rating-component.md, docs/build-alongs/survey-app.md, docs/build-alongs/task-list-app.md` | 5 | Project walkthrough tutorials, screenshot-heavy, pre-refresh UI — same class as the explicit "re-recording video/screenshots is out of scope" exclusion. |
| `docs/guides/deploy/hosting-frontend.md, docs/guides/deploy/setting-up-backend-on-aws.md, docs/guides/deploy/setting-up-backend-on-gcp.md, docs/guides/deploy/using-an-external-backend.md` | 4 | Superseded by phase 19 (Docker Compose, one nginx origin) and phase 26. |
| `docs/guides/collaboration/migrating-from-noodl-hosted-git.mdx, docs/guides/collaboration/overview.md, docs/guides/collaboration/version-control.md` | 3 | migrating-from-noodl-hosted-git concerns a dead service; version-control claims "all versions are backed up in the cloud", false for NodeGX. |
| `docs/guides/user-management/creating-users-in-noodl.md, docs/guides/user-management/overview.mdx` | 2 | Describes the old Noodl backend's user/auth flow; NodeGX's is a different implementation entirely (nodegx-backend, device-flow OAuth, magic links). |
| `docs/guides/overview.md` | 1 | Guides-section index; no direct replacement built yet (docs-site only has concepts/getting-started/troubleshooting so far). |
| `docs/guides/user-interfaces/figma-plugin.md` | 1 | Advertises a Figma plugin; zero references to "figma" anywhere in packages/noodl-editor/src or packages/noodl-viewer-react/src. |
| `docs/learn.mdx` | 1 | Learn-section landing page; LEARN-002/phase 17 own any replacement, and this phase explicitly does not wait for or author into that scope. |
| `static/docs/guides/navigation/encoding-parameters-in-urls/README.md` | 1 | Byte-identical duplicate of docs/guides/navigation/encoding-parameters-in-urls.mdx (the old fetch protocol's raw-markdown source) — the docs/ copy is what gets salvaged, this static/ copy is not a second thing to migrate. |
| `whats-new/2024-09-24.md` | 1 | One stale dated post (2024, pre-fork). The whats-new/feed.json mechanism itself stays as payload (§5); this is just its one old entry. |

## Full file list, by fate

<details>
<summary>Every one of the 431 files, one line each — click to expand</summary>

### Generated (superseded)

- `nodes/basic-elements/circle/README.md`
- `nodes/basic-elements/columns/README.md`
- `nodes/basic-elements/group/README.md`
- `nodes/basic-elements/icon/README.md`
- `nodes/basic-elements/image/README.md`
- `nodes/basic-elements/text/README.md`
- `nodes/basic-elements/video/README.md`
- `nodes/cloud-functions/cloud-data/aggregate-records/README.md`
- `nodes/cloud-functions/request/README.md`
- `nodes/cloud-functions/response/README.md`
- `nodes/component-stack/component-stack-node/README.md`
- `nodes/component-stack/pop-component/README.md`
- `nodes/component-stack/push-component/README.md`
- `nodes/component-utilities/component-children/README.md`
- `nodes/component-utilities/component-inputs/README.md`
- `nodes/component-utilities/component-object/README.md`
- `nodes/component-utilities/component-outputs/README.md`
- `nodes/component-utilities/parent-component-object/README.md`
- `nodes/component-utilities/set-component-object-properties/README.md`
- `nodes/component-utilities/set-parent-component-object-properties/README.md`
- `nodes/data/array/array-filter/README.md`
- `nodes/data/array/array-map/README.md`
- `nodes/data/array/array-node/README.md`
- `nodes/data/array/clear-array/README.md`
- `nodes/data/array/create-new-array/README.md`
- `nodes/data/array/insert-into-array/README.md`
- `nodes/data/array/remove-from-array/README.md`
- `nodes/data/array/static-array/README.md`
- `nodes/data/boolean/README.md`
- `nodes/data/cloud-data/_acl.md`
- `nodes/data/cloud-data/_id-source.md`
- `nodes/data/cloud-data/add-record-relation/README.md`
- `nodes/data/cloud-data/cloud-file/README.md`
- `nodes/data/cloud-data/cloud-function/README.md`
- `nodes/data/cloud-data/config/README.md`
- `nodes/data/cloud-data/create-new-record/README.md`
- `nodes/data/cloud-data/delete-record/README.md`
- `nodes/data/cloud-data/filter-records/README.md`
- `nodes/data/cloud-data/query-records/README.md`
- `nodes/data/cloud-data/record/README.md`
- `nodes/data/cloud-data/remove-record-relation/README.md`
- `nodes/data/cloud-data/set-record-properties/README.md`
- `nodes/data/cloud-data/upload-file/README.md`
- `nodes/data/color/README.md`
- `nodes/data/number/README.md`
- `nodes/data/object/_properties.md`
- `nodes/data/object/create-new-object/README.md`
- `nodes/data/object/object-node/README.md`
- `nodes/data/object/set-object-properties/README.md`
- `nodes/data/rest/README.md`
- `nodes/data/run-tasks/README.md`
- `nodes/data/string/README.md`
- `nodes/data/user/log-in/README.md`
- `nodes/data/user/log-out/README.md`
- `nodes/data/user/set-user-properties/README.md`
- `nodes/data/user/sign-up/README.md`
- `nodes/data/user/user-node/README.md`
- `nodes/data/variable/set-variable/README.md`
- `nodes/data/variable/variable-node/README.md`
- `nodes/events/receive-event/README.md`
- `nodes/events/send-event/README.md`
- `nodes/javascript/function/README.md`
- `nodes/javascript/script/README.md`
- `nodes/logic/and/README.md`
- `nodes/logic/animate-to-value/README.md`
- `nodes/logic/inverter/README.md`
- `nodes/logic/or/README.md`
- `nodes/logic/switch/README.md`
- `nodes/logic/value-changed/README.md`
- `nodes/math/counter/README.md`
- `nodes/math/expression/README.md`
- `nodes/math/number-remapper/README.md`
- `nodes/navigation/_common-navigation.md`
- `nodes/navigation/external-link/README.md`
- `nodes/navigation/navigate-to-path/README.md`
- `nodes/navigation/navigate/README.md`
- `nodes/navigation/page-inputs/README.md`
- `nodes/navigation/page-router/README.md`
- `nodes/navigation/page/README.md`
- `nodes/overview.mdx`
- `nodes/popups/close-popup/README.md`
- `nodes/popups/show-popup/README.md`
- `nodes/shared-props/inputs/_enabled.md`
- `nodes/shared-props/inputs/_visual-input-properties.md`
- `nodes/shared-props/inputs/visual-input-properties.md`
- `nodes/shared-props/outputs/_control-events.md`
- `nodes/shared-props/outputs/_control-states.md`
- `nodes/shared-props/outputs/_visual-output-properties.md`
- `nodes/shared-props/outputs/visual-output-properties.md`
- `nodes/string-manipulation/string-format/README.md`
- `nodes/string-manipulation/string-mapper/README.md`
- `nodes/string-manipulation/substring/README.md`
- `nodes/ui-controls/button/README.md`
- `nodes/ui-controls/checkbox/README.md`
- `nodes/ui-controls/dropdown/README.md`
- `nodes/ui-controls/radio-button-group/README.md`
- `nodes/ui-controls/radio-button/README.md`
- `nodes/ui-controls/repeater-item/README.md`
- `nodes/ui-controls/repeater/README.md`
- `nodes/ui-controls/slider/README.md`
- `nodes/ui-controls/text-input/README.md`
- `nodes/utilities/boolean-to-string/README.md`
- `nodes/utilities/color-blend/README.md`
- `nodes/utilities/css-definition/README.md`
- `nodes/utilities/date-to-string/README.md`
- `nodes/utilities/delay/README.md`
- `nodes/utilities/drag/README.md`
- `nodes/utilities/logic/condition/README.md`
- `nodes/utilities/logic/states/README.md`
- `nodes/utilities/open-file-picker/README.md`
- `nodes/utilities/screen-resolution/README.md`
- `nodes/utilities/unique-id/README.md`

### Port near-verbatim

- `docs/guides/editor/keybindings.md`
- `javascript/extending/build-script/change-nodes-at-build-time.md`
- `javascript/extending/build-script/overview.md`
- `javascript/extending/build-script/sitemap-and-seo.md`
- `javascript/extending/create-lib.md`
- `javascript/extending/create-react-lib.md`
- `javascript/extending/module/manifest.md`
- `javascript/extending/overview.md`
- `javascript/overview.md`
- `javascript/reference/arrays/README.md`
- `javascript/reference/cloudfunctions/README.md`
- `javascript/reference/component/README.md`
- `javascript/reference/events/README.md`
- `javascript/reference/files/README.md`
- `javascript/reference/navigation/README.md`
- `javascript/reference/object/README.md`
- `javascript/reference/objects/README.md`
- `javascript/reference/overview/README.md`
- `javascript/reference/records/README.md`
- `javascript/reference/seo/README.md`
- `javascript/reference/users/README.md`
- `javascript/reference/variables/README.md`
- `javascript/samples/get-dom-element.mdx`
- `javascript/samples/pointer-position.md`

### Salvage concept

- `docs/guides/business-logic/client-side-biz-logic-js.mdx`
- `docs/guides/business-logic/client-side-biz-logic-nodes.mdx`
- `docs/guides/business-logic/custom-ui-components.md`
- `docs/guides/business-logic/events.md`
- `docs/guides/business-logic/javascript.mdx`
- `docs/guides/data/arrays.mdx`
- `docs/guides/data/external-data.md`
- `docs/guides/data/list-basics.mdx`
- `docs/guides/data/making-connections.md`
- `docs/guides/data/objects.mdx`
- `docs/guides/data/overview.md`
- `docs/guides/data/ui-controls-and-data.md`
- `docs/guides/data/variables.mdx`
- `docs/guides/navigation/basic-navigation.mdx`
- `docs/guides/navigation/component-stack.mdx`
- `docs/guides/navigation/encoding-parameters-in-urls.mdx`
- `docs/guides/navigation/multi-level-navigation.mdx`
- `docs/guides/navigation/overview.mdx`
- `docs/guides/navigation/popups.mdx`
- `docs/guides/user-interfaces/basics.md`
- `docs/guides/user-interfaces/components.md`
- `docs/guides/user-interfaces/layout.mdx`
- `docs/guides/user-interfaces/modules.md`
- `docs/guides/user-interfaces/overview.md`
- `docs/guides/user-interfaces/responsive-design.mdx`
- `docs/guides/user-interfaces/scrolling-content.mdx`
- `docs/guides/user-interfaces/states.mdx`
- `docs/guides/user-interfaces/style-variants.md`
- `docs/guides/user-interfaces/visual-states.md`
- `docs/guides/visualizing-data/filter-table-data.md`
- `docs/guides/visualizing-data/styling-table.md`
- `docs/guides/visualizing-data/table-pagination.md`
- `docs/guides/visualizing-data/table-to-visualize-data.md`

### Stays (payload-coupled)

- `.github/ISSUE_TEMPLATE/1.Bug_report.md`
- `.github/ISSUE_TEMPLATE/2.Improve_docs.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE.md`
- `README.md`
- `_prefab-docs-boilerplate/docs-starter/markdown/README.md`
- `_prefab-docs-boilerplate/docs-starter/markdown/components/my-prefab-request/README.md`
- `_prefab-docs-boilerplate/docs-starter/markdown/components/setup-my-prefab/README.md`
- `library/examples/conditional-form.mdx`
- `library/examples/crud-form.mdx`
- `library/examples/javascript-example.mdx`
- `library/examples/localization.mdx`
- `library/examples/mapbox.mdx`
- `library/examples/modal-wizard.mdx`
- `library/examples/navigation-url-encoding.mdx`
- `library/examples/overview.mdx`
- `library/examples/recipe-app.mdx`
- `library/examples/sign-up.mdx`
- `library/examples/star-rating-component.mdx`
- `library/examples/suatch.mdx`
- `library/examples/survey-app.mdx`
- `library/examples/task-list-app.mdx`
- `library/examples/travel-app.mdx`
- `library/examples/weavy-integration.mdx`
- `library/modules/avatar/README.md`
- `library/modules/carousel-scroll/README.md`
- `library/modules/chartjs/README.md`
- `library/modules/chartjs/charts/bar.md`
- `library/modules/chartjs/charts/bubble.md`
- `library/modules/chartjs/charts/doughnut.md`
- `library/modules/chartjs/charts/line.md`
- `library/modules/chartjs/charts/pie.md`
- `library/modules/chartjs/charts/polar-area.md`
- `library/modules/chartjs/charts/radar.md`
- `library/modules/chartjs/charts/scatter.md`
- `library/modules/chartjs/charts/stacked-line.md`
- `library/modules/chartjs/examples/custom-axis.md`
- `library/modules/chartjs/examples/custom-tooltip/README.md`
- `library/modules/chartjs/guides/interactions.md`
- `library/modules/chartjs/nodes/bar.md`
- `library/modules/chartjs/nodes/bubble.md`
- `library/modules/chartjs/nodes/doughnut.md`
- `library/modules/chartjs/nodes/line.md`
- `library/modules/chartjs/nodes/pie.md`
- `library/modules/chartjs/nodes/polar-area.md`
- `library/modules/chartjs/nodes/radar.md`
- `library/modules/chartjs/nodes/scatter.md`
- `library/modules/chartjs/nodes/shared/_inputs.md`
- `library/modules/chartjs/nodes/shared/_outputs.md`
- `library/modules/chartjs/release-notes.md`
- `library/modules/custom-html/README.md`
- `library/modules/data-context/README.md`
- `library/modules/font-awesome-brands/README.md`
- `library/modules/font-awesome-solid/README.md`
- `library/modules/geospatial-analysis/README.md`
- `library/modules/geospatial-analysis/nodes/v1/geospatial-api.md`
- `library/modules/geospatial-analysis/nodes/v1/geospatial-area.md`
- `library/modules/geospatial-analysis/nodes/v1/geospatial-center-of-mass.md`
- `library/modules/geospatial-analysis/nodes/v1/geospatial-center.md`
- `library/modules/geospatial-analysis/release-notes.md`
- `library/modules/google-analytics/README.md`
- `library/modules/google-analytics/guides/setting-up-google-analytics/README.md`
- `library/modules/google-analytics/guides/tracking-custom-events/README.md`
- `library/modules/google-analytics/nodes/google-analytics-root/README.md`
- `library/modules/google-analytics/nodes/send-google-analytics-data/README.md`
- `library/modules/google-analytics/release-notes.md`
- `library/modules/graphql/README.md`
- `library/modules/graphql/graphql-node.md`
- `library/modules/gsheets/README.md`
- `library/modules/gsheets/guides/filtering/README.mdx`
- `library/modules/gsheets/guides/park-details/README.mdx`
- `library/modules/gsheets/guides/setting-up/README.mdx`
- `library/modules/gsheets/node-docs/query-sheet-aggregate/README.md`
- `library/modules/gsheets/node-docs/query-sheet/README.md`
- `library/modules/gsheets/node-docs/sheet-row/README.md`
- `library/modules/gsheets/release-notes.md`
- `library/modules/i18next/README.md`
- `library/modules/i18next/i18next-node.md`
- `library/modules/i18next/language-bundle.md`
- `library/modules/i18next/translation.md`
- `library/modules/image-cropper/README.mdx`
- `library/modules/lottie/README.md`
- `library/modules/lottie/lottie-node.md`
- `library/modules/mapbox/README.md`
- `library/modules/mapbox/guides/3d-model.md`
- `library/modules/mapbox/guides/camera.md`
- `library/modules/mapbox/guides/directions-api/README.md`
- `library/modules/mapbox/guides/directions.md`
- `library/modules/mapbox/guides/geocoder.md`
- `library/modules/mapbox/guides/interacting/README.md`
- `library/modules/mapbox/guides/polygon.md`
- `library/modules/mapbox/guides/screen-coordinates/README.md`
- `library/modules/mapbox/guides/screenshot.md`
- `library/modules/mapbox/guides/setting-up/README.md`
- `library/modules/mapbox/guides/styles.md`
- `library/modules/mapbox/guides/using-markers/README.md`
- `library/modules/mapbox/nodes/v1/mapbox-map.md`
- `library/modules/mapbox/nodes/v2/mapbox-map.md`
- `library/modules/mapbox/nodes/v2/mapbox-marker.md`
- `library/modules/mapbox/nodes/v2/mapbox-polygon.md`
- `library/modules/mapbox/release-notes.md`
- `library/modules/markdown/README.md`
- `library/modules/markdown/markdown-node.md`
- `library/modules/marquee/README.md`
- `library/modules/marquee/nodes/v1/marquee.md`
- `library/modules/marquee/release-notes.md`
- `library/modules/material-icons/README.md`
- `library/modules/mqtt/README.mdx`
- `library/modules/mqtt/mqtt-guide.mdx`
- `library/modules/mqtt/receive-message.md`
- `library/modules/mqtt/send-message.md`
- `library/modules/overview.mdx`
- `library/modules/panning-and-zooming/README.mdx`
- `library/modules/parse-cloud-function/README.md`
- `library/modules/pdf-viewer/README.md`
- `library/modules/qr-scanner/README.md`
- `library/modules/qr-scanner/guides/camera-feed/README.md`
- `library/modules/qr-scanner/guides/image-upload/README.md`
- `library/modules/qr-scanner/nodes/camera-qr-scanner/README.md`
- `library/modules/qr-scanner/nodes/image-qr-scanner/README.md`
- `library/modules/qr-scanner/release-notes.md`
- `library/modules/shake-detector/README.md`
- `library/modules/simple-tooltips/README.md`
- `library/modules/simple-tooltips/nodes/show-tooltip.md`
- `library/modules/simple-tooltips/nodes/tooltip.md`
- `library/modules/simple-tooltips/release-notes.md`
- `library/modules/validation/README.md`
- `library/modules/validation/validate.md`
- `library/modules/webcamera/README.md`
- `library/modules/webcamera/webcamera-guide.md`
- `library/modules/webcamera/webcamera-node.md`
- `library/overview.mdx`
- `library/prefab-contributions.mdx`
- `library/prefabs/date-picker/README.md`
- `library/prefabs/email-verification/README.md`
- `library/prefabs/filters/README.md`
- `library/prefabs/form/README.md`
- `library/prefabs/list-with-icons/README.md`
- `library/prefabs/loading-spinner/README.md`
- `library/prefabs/mailgun/README.md`
- `library/prefabs/media-query/README.md`
- `library/prefabs/media-query/components/match-custom-media-query/README.md`
- `library/prefabs/media-query/components/match-media-query/README.md`
- `library/prefabs/media-query/components/media-query-debugger/README.md`
- `library/prefabs/media-query/components/media-query-setup/README.md`
- `library/prefabs/modal/README.md`
- `library/prefabs/multi-choice-with-pills/README.md`
- `library/prefabs/multi-choice/README.md`
- `library/prefabs/navigation-menu/README.md`
- `library/prefabs/oauth2/README.md`
- `library/prefabs/overview.mdx`
- `library/prefabs/pagesandrows/README.md`
- `library/prefabs/pagination/README.md`
- `library/prefabs/progress-circle/README.md`
- `library/prefabs/rating/README.md`
- `library/prefabs/selection-pills/README.md`
- `library/prefabs/sendgrid/README.md`
- `library/prefabs/stripe/README.md`
- `library/prefabs/supabase/README.md`
- `library/prefabs/supabase/components/setup-client/README.md`
- `library/prefabs/supabase/components/supabase-fetch-current-user-auth/README.md`
- `library/prefabs/supabase/components/supabase-fetch-current-user-profile-data/README.md`
- `library/prefabs/supabase/components/supabase-log-in/README.md`
- `library/prefabs/supabase/components/supabase-log-out/README.md`
- `library/prefabs/supabase/components/supabase-request-example/README.md`
- `library/prefabs/supabase/components/supabase-resend-confirmation/README.md`
- `library/prefabs/supabase/components/supabase-send-magic-link/README.md`
- `library/prefabs/supabase/components/supabase-send-password-reset/README.md`
- `library/prefabs/supabase/components/supabase-sign-up/README.md`
- `library/prefabs/supabase/components/supabase-update-current-user-auth/README.md`
- `library/prefabs/supabase/components/supabase-update-current-user-profile-data/README.md`
- `library/prefabs/tab-bar/README.md`
- `library/prefabs/table/README.md`
- `library/prefabs/tags/README.md`
- `library/prefabs/time-picker/README.md`
- `library/prefabs/toast/README.md`
- `library/prefabs/toggle/README.md`
- `library/prefabs/totp/README.md`
- `library/prefabs/xano/README.md`
- `library/prefabs/xano/components/setup-xanoclient/README.md`
- `library/prefabs/xano/components/xano-authtoken-refresh/README.md`
- `library/prefabs/xano/components/xano-current-user/README.md`
- `library/prefabs/xano/components/xano-log-in/README.md`
- `library/prefabs/xano/components/xano-log-out/README.md`
- `library/prefabs/xano/components/xano-request/README.md`
- `library/prefabs/xano/components/xano-sign-up/README.md`
- `library/prefabs/xano/components/xano-update-current-user/README.md`
- `project-templates/overview.mdx`
- `static/library/modules/gsheets/release-notes.md`
- `static/library/modules/mapbox/guides/screen-coordinates/README.md`
- `static/library/modules/mapbox/release-notes.md`
- `static/library/modules/webcamera/webcamera-guide.md`

### Delete

- `codebase/architecture.md`
- `codebase/architecture/core-concepts.md`
- `codebase/architecture/data-flow.md`
- `codebase/architecture/overview.md`
- `codebase/build-test.md`
- `codebase/contributing.md`
- `codebase/development-setup.md`
- `codebase/guides/adding-nodes.md`
- `codebase/nodes/context.md`
- `codebase/nodes/definition.md`
- `codebase/nodes/dynamic-ports.md`
- `codebase/nodes/frontend-nodes.md`
- `codebase/nodes/instance.md`
- `codebase/nodes/overview.md`
- `codebase/nodes/scope.md`
- `codebase/nodes/variants.md`
- `codebase/nodes/visual-states.md`
- `codebase/overview.md`
- `codebase/structure/folders.md`
- `docs/build-alongs/horizontal-list-with-snapping.md`
- `docs/build-alongs/overview.md`
- `docs/build-alongs/star-rating-component.md`
- `docs/build-alongs/survey-app.md`
- `docs/build-alongs/task-list-app.md`
- `docs/getting-started/ai-assisted-dev/chat-gpt.md`
- `docs/getting-started/ai-assisted-dev/overview.md`
- `docs/getting-started/ai-assisted-dev/rest.md`
- `docs/getting-started/editor-tour.md`
- `docs/getting-started/fundamentals.md`
- `docs/getting-started/noodl-ai.md`
- `docs/getting-started/overview.mdx`
- `docs/getting-started/workflow.md`
- `docs/guides/cloud-data/access-control.md`
- `docs/guides/cloud-data/creating-a-backend.md`
- `docs/guides/cloud-data/creating-a-class.md`
- `docs/guides/cloud-data/creating-new-database-records.md`
- `docs/guides/cloud-data/filtering-database-queries.md`
- `docs/guides/cloud-data/import-export-csv.md`
- `docs/guides/cloud-data/overview.mdx`
- `docs/guides/cloud-data/quering-records-from-database.md`
- `docs/guides/cloud-data/record-relations.md`
- `docs/guides/cloud-data/updating-records.md`
- `docs/guides/cloud-logic/email-verification.md`
- `docs/guides/cloud-logic/introduction.md`
- `docs/guides/cloud-logic/javascript.md`
- `docs/guides/cloud-logic/logging.md`
- `docs/guides/cloud-logic/scheduled-jobs.md`
- `docs/guides/collaboration/migrating-from-noodl-hosted-git.mdx`
- `docs/guides/collaboration/overview.md`
- `docs/guides/collaboration/version-control.md`
- `docs/guides/deploy/deploying-to-ios-and-android.md`
- `docs/guides/deploy/embedding.md`
- `docs/guides/deploy/favicon.md`
- `docs/guides/deploy/hosting-frontend.md`
- `docs/guides/deploy/overview.md`
- `docs/guides/deploy/project-structure.md`
- `docs/guides/deploy/pwa.md`
- `docs/guides/deploy/setting-up-backend-on-aws.md`
- `docs/guides/deploy/setting-up-backend-on-gcp.md`
- `docs/guides/deploy/using-an-external-backend.md`
- `docs/guides/overview.md`
- `docs/guides/user-interfaces/figma-plugin.md`
- `docs/guides/user-management/creating-users-in-noodl.md`
- `docs/guides/user-management/overview.mdx`
- `docs/learn.mdx`
- `sdk/overview.mdx`
- `sdk/references/port-types.md`
- `static/docs/guides/navigation/encoding-parameters-in-urls/README.md`
- `whats-new/2024-09-24.md`

</details>
