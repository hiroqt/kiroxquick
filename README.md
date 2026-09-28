# BahaRoute

Metro Manila (NCR) flood-aware navigation and travel decision-support prototype. BahaRoute frames the National Capital Region, presents modeled flood susceptibility and demo flood conditions as clearly labeled map layers, and helps people reason about travel through flood-prone areas — without ever claiming a route is "safe."

> **Prototype status.** BahaRoute is an early, demo-data prototype. Every flood layer in this repository is fixture/modeled data, not live conditions. Nothing here should be relied on for real-world flood or evacuation decisions.

## Overview

BahaRoute is a React + TypeScript single-page web app built on Mapbox GL JS. It opens framed on Metro Manila, renders a quiet basemap, and overlays flood context (modeled susceptibility, per-city susceptibility summary, and demo flood reports) as translucent, color-coded layers whose meaning is explicit and whose freshness is always shown. The product's guiding constraint is honest decision support: it surfaces what is known, marks what is unknown as unknown, and never fabricates certainty or safety.

The codebase is built through a spec-driven workflow (Kiro specs under `.kiro/specs/`), with requirements, design, and task plans tracked as living documents.

## Problem

Flooding is a recurring, high-impact disruption to travel across Metro Manila. Existing consumer maps optimize for speed and distance and treat flooding as an afterthought, if at all. People routinely need to decide whether a trip is advisable, which areas are historically flood-prone, and where recent conditions have been reported — but that context is scattered, unlabeled, or presented with misleading confidence. BahaRoute focuses on making flood context legible for the NCR specifically, so travel decisions can account for it.

## Scope

BahaRoute is scoped to the **17 jurisdictions of the National Capital Region (NCR / Metro Manila)** only. It is not a nationwide product and does not claim nationwide coverage.

The 17 NCR local government units (LGUs):

1. Caloocan
2. Las Piñas
3. Makati
4. Malabon
5. Mandaluyong
6. Manila
7. Marikina
8. Muntinlupa
9. Navotas
10. Parañaque
11. Pasay
12. Pasig
13. Pateros
14. Quezon City
15. San Juan
16. Taguig
17. Valenzuela

## Current Product Flow

1. The app loads and reads the Mapbox access token from the environment. If no token is configured, the shell still renders with a config-incomplete message and no tiles load.
2. The map initializes framed on the Metro Manila extent (NCR centered and dominant; surrounding provinces appear only at the viewport edges).
3. On wide desktop viewports, a tuned product framing (center + zoom ~11) keeps the NCR large and recognizable. On narrower/portrait viewports, a `fitBounds` framing keeps all 17 cities in view.
4. If location permission is granted, a current-location marker is placed — but the camera does **not** auto-zoom to the user's street; the NCR overview is preserved.
5. Flood layers render over the quiet basemap: the per-city susceptibility summary (lowest), hazard-shaped susceptibility polygons, and demo flood reports/markers. Each is clearly labeled demo data.
6. Users can toggle layers, recenter, zoom, and open popups that show each item's source, last-updated time, verification status, and a disclaimer.

## Current Milestone Status

Two specs drive the project.

**`baharoute-metro-manila-map-foundation` (Milestone 1) — complete.**
React + TypeScript + Vite foundation, flood data model + types, fixtures, layer system with fixed z-ordering, map controls (zoom/recenter/location), overlays (disclaimer, demo badge, config-incomplete, error, loading, popups), responsive layout, and accessibility. Later migrated from MapLibre + MapTiler to Mapbox GL JS, and the city fill moved from placeholder rectangles to real NCR administrative boundaries.

**`baharoute-navigation-experience` — Milestone A complete; Milestones B–L not started.**
- **Milestone A (done):** Metro Manila default-framing correction — tuned NCR overview framing constant, additive `MapManager` camera methods, startup framing that does not auto-zoom to the user.
- **Milestones B–L (planned, not started):** full-screen navigation shell, consumer layer control, App state machine + camera modes, search experience, route preview with flood context, turn-by-turn navigation framing, and related work. See `.kiro/specs/baharoute-navigation-experience/tasks.md`.

**Verified quality gate (this build):** `typecheck` ✓, `lint` ✓, `test` = **317 passed across 32 test files** ✓, `build` ✓ (only a pre-existing bundle chunk-size advisory for the Mapbox GL JS vendor chunk).

## Map Architecture

- **Rendering engine:** Mapbox GL JS (direct `mapbox-gl`, not a React wrapper), so the `MapManager` abstraction owns the map lifecycle, watchdog, resize handling, and zoom clamping.
- **`MapManager`** wraps a minimal, structurally-typed map interface (`MinimalMap`) so logic is unit-testable without WebGL. A fake map is injected in tests; the real `mapboxgl.Map` satisfies the same shape.
- **Basemap:** stock Mapbox style `mapbox://styles/mapbox/light-v11` — a clean, low-clutter light style chosen so the saturated flood overlays stay dominant.
- **`LayerRegistry`** owns the fixed top→bottom render order of app-managed layers and inserts them at known positions relative to the basemap.
- **Camera framing** is described by pure, side-effect-free modules (`overviewFraming.ts`) so framing decisions are testable without a real camera.

## Metro Manila Default Camera

The NCR framing box (`METRO_MANILA_BOUNDS`) is approximately:

- West `120.9`, South `14.4`, East `121.15`, North `14.78` (WGS84 degrees).

These are intentionally approximate **framing** bounds, not authoritative administrative boundaries. Framing behavior:

- **Narrow / portrait / mobile:** `fitBounds` on the NCR overview bounds with modest padding — all 17 cities framed.
- **Wide desktop:** a tuned `centerZoom` product framing at center `[120.9842, 14.5995]`, zoom `11`, so the NCR reads large and dominant. Full-extent visibility is intentionally relaxed on desktop in favor of product framing; the basemap is never hard-clipped, so users can still pan freely.

## NCR City Boundary Data

Real NCR administrative boundaries are stored locally at:

- `src/data/geojson/metroManilaCityBoundaries.geojson` — a GeoJSON `FeatureCollection` of **17 features** (15 `Polygon`, 2 `MultiPolygon`), one per NCR LGU.
- `src/data/geojson/metroManilaCityBoundaries.ts` — loads the GeoJSON asset and exposes typed features.
- `src/data/geojson/cityNameNormalization.ts` — an explicit `city_norm → { id, name }` mapping for all 17 LGUs, handling source variants deliberately (`QUEZON → Quezon City`, `LAS PINAS → Las Piñas`, `PARANAQUE → Parañaque`).

The loader fails loudly if a feature's `city_norm` is missing or unmapped, so no city is ever silently dropped.

## Flood Information Model

Flood context is modeled with explicit, closed types (`src/types/flood.ts`):

- **`FloodState`** — exactly five values: `RED`, `ORANGE`, `YELLOW`, `GREEN`, `GRAY`. `GRAY` means **Unknown** — never "safe," "clear," or "no risk."
- **`SusceptibilityLevel`** — `HIGH`, `MODERATE`, `LOW`. Susceptibility is historical/modeled exposure, distinct from current reported conditions.
- **`FloodItemMetadata`** — every flood item carries `location`, `source`, `dataType`, `updatedAt` (epoch seconds), and `verificationStatus` (`VERIFIED` | `UNCONFIRMED`), plus optional `severity`, `depth`, `description`, `sourceUrl`.
- **`FloodDataType`** — `SUSCEPTIBILITY`, `REPORT`, `COMMUNITY_REPORT`. Community reports are treated as `UNCONFIRMED` unless verified.

Two distinct susceptibility surfaces exist and must not be conflated:

- **Hazard-shaped susceptibility polygons** — waterway/low-lying hazard geometry (the authoritative hazard footprint in this model).
- **Per-city susceptibility summary** — a labeled, modeled per-city summary value drawn on the real administrative silhouette. The administrative geometry itself does **not** represent flood conditions; only the labeled summary value does.

## Safety / Decision Language

BahaRoute deliberately avoids false certainty. Across UI and data:

- Never claims "Safest Route," "Guaranteed Safe," "100% Safe," or "No Risk," and never assigns an arbitrary numeric safety score.
- `GRAY` / Unknown is never rendered or described as safe, clear, or passable. Absence of a flood fill is not evidence of safety.
- Historical/modeled susceptibility is kept distinct from current conditions.
- Community reports are marked UNCONFIRMED unless verified.
- Administrative city boundaries are labeled as boundaries, not as flood-risk geometry.

## Layer Hierarchy

App-managed canvas layers render in a fixed top→bottom order (top renders last / on top), above the basemap:

```
UI markers (DOM overlays — always topmost)
flood reports (symbols)
route highlights (route lines)
road flood-condition segments
flood susceptibility polygons (hazard-shaped)
city flood summary (per-city administrative fill — lowest app layer)
── basemap below (Mapbox light-v11): boundaries, labels, roads, buildings, parks, water, background ──
```

The per-city summary sits lowest so hazard polygons and current-condition reports always read on top of it. `NO GREEN` appears on any susceptibility layer — green is reserved for a current-condition ("recently reported passable") state.

## Project Structure

```
.
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json / tsconfig.node.json
├── .env.example                 # template; copy to .env.local (gitignored)
├── .kiro/specs/                 # Kiro spec documents (requirements/design/tasks)
├── docs/                        # extended documentation
└── src/
    ├── App.tsx / main.tsx
    ├── camera/                  # overviewFraming (pure framing logic)
    ├── components/              # MapView, controls/, markers/, overlays/
    ├── data/
    │   ├── fixtures/            # demo flood/route/city data
    │   └── geojson/             # real NCR boundaries + normalization
    ├── layers/                  # LayerRegistry, susceptibility & city-summary layers,
    │                            #   flood classification, visual mapping, zoom opacity
    ├── map/                     # MapManager, metroManilaExtent, basemap/
    ├── services/                # env, geolocation, FixtureDataSource
    ├── styles/                  # layout.css
    ├── types/                   # flood, route, report, evacuation, layer, config
    └── test/                    # test setup
```

## Local Development

Prerequisites: Node.js (project developed on Node 24) and npm.

```bash
npm install
cp .env.example .env.local        # then set a real Mapbox token in .env.local
npm run dev                       # Vite dev server on http://localhost:5173
```

Without a token the app shell still renders with a config-incomplete message; no map tiles load until a valid token is present.

## Environment Files

- **`.env.example`** — committed template. Contains a placeholder: `VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here`.
- **`.env.local`** — your real token; **gitignored and never committed**. `.env`, `.env.local`, and `.env.*.local` are all ignored.

The token is read at runtime via `import.meta.env.VITE_MAPBOX_ACCESS_TOKEN` (see `src/services/env.ts`) and applied to the Mapbox map at construction — never hardcoded in source.

## Quality Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npm run test          # vitest --run  (unit + property + component tests)
npm run build         # tsc project checks + vite build
npm run format        # prettier --write .
```

Testing stack: Vitest + React Testing Library + fast-check (property-based tests, tagged and run at ≥100 iterations). Current verified result: **317 tests passing across 32 files.**

## Documentation / Kiro Specs

Extended docs live in `docs/`:

- `docs/ARCHITECTURE.md` — rendering engine, MapManager, layer system, camera framing.
- `docs/DATA_MODEL.md` — flood types, metadata, fixtures, NCR boundary data.
- `docs/FLOOD_SEMANTICS.md` — flood states, susceptibility vs. conditions, safety-language rules.
- `docs/SETUP.md` — local setup, environment, and troubleshooting.
- `docs/PROJECT_STATUS.md` — milestone status and roadmap detail.

Spec documents (requirements, design, tasks) live under:

- `.kiro/specs/baharoute-metro-manila-map-foundation/`
- `.kiro/specs/baharoute-navigation-experience/`

## Data Provenance

- **NCR city boundaries:** adapted from the `rolex-esto/roberto` repository (`data/city_boundaries.geojson`), stored locally as `src/data/geojson/metroManilaCityBoundaries.geojson`. Administrative boundaries only — not flood-risk geometry.
- **Flood susceptibility, flood reports, community reports, routes, evacuation centers:** all demo/fixture data in `src/data/fixtures/`, clearly labeled non-authoritative. Modeled/illustrative values, not live or verified conditions.

## Known Limitations

- All flood, route, and susceptibility data is demo/fixture data — not live, not authoritative, not for real decisions.
- Geocoding, routing, and live-flood sources are stubbed behind interfaces (planned milestones), not connected to real providers.
- Scope is NCR-only; there is no nationwide coverage.
- Desktop overview intentionally does not guarantee 100% NCR-extent visibility (product framing tradeoff).
- The production bundle emits a chunk-size advisory driven by the Mapbox GL JS vendor chunk; not addressed yet.
- Mapbox GL JS is proprietary and its usage is subject to Mapbox pricing/billing and terms.

## Roadmap

Planned via `baharoute-navigation-experience` Milestones B–L:

- Full-screen navigation shell and restrained product chrome.
- Consumer-friendly on-demand layer control.
- App state machine (Overview / Search / Route Preview / Navigation) with a single camera controller.
- Destination search with NCR-first ranking and honest out-of-NCR messaging.
- Route preview with flood context (high-susceptibility sections, recent-report counts, unknown proportion) — never a "safe route" claim.
- Turn-by-turn navigation framing with tilt fallback.
- Real provider integration behind the existing interfaces.

## License / Attribution

- No open-source license is currently declared for this repository. All rights reserved by the project owner unless a `LICENSE` file is added.
- **Mapbox GL JS** and Mapbox styles/tiles are proprietary and subject to Mapbox's terms and pricing. A valid Mapbox access token is required.
- **NCR boundary data** adapted from `rolex-esto/roberto`; refer to that source for its terms.
- Built with React, TypeScript, Vite, Vitest, and fast-check.
