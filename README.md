# Kopa Studio

This repository currently hosts the public Kopa Studio website, its legacy hidden studio console, and a parking-escape prototype. The new, independent internal ASO migration application lives in [`apps/tools`](apps/tools).

See [MIGRATION_STATUS.md](MIGRATION_STATUS.md) for the current ASO migration handover, and [DEPLOYMENT.md](DEPLOYMENT.md) for the separate `tools.kopa.studio` deployment procedure.

## Parking escape prototype

A small mobile-first parking escape puzzle prototype. It is dependency-free and runs in the browser, with gameplay split into level data, movement rules, rendering, and UI.

## Run Locally

```sh
npm run start
```

Then open:

```txt
http://localhost:5173
```

## Check Level Data

```sh
npm run check
```

## Project Structure

```txt
index.html              App shell
src/levels.js           Handmade level data
src/gameLogic.js        Grid movement, collision, win rules, stars
src/renderer.js         Canvas board and car drawing
src/ui.js               Move counter, win panel, buttons
src/main.js             Input wiring and game loop
scripts/check-levels.js Level sanity checks
```

## Current MVP

- Drag cars along their orientation.
- Cars block each other and cannot move through barriers or board edges.
- The red target car can leave through the right-side exit.
- Moves are counted per successful drag action.
- Win panel shows 1-3 stars, restart, and next-level flow.
- Ten handmade level objects are included, with level one verified as the first playable slice.
