name: 📺 Generate YouTube Cards

on:
schedule: - cron: "0 _/6 _ \* \*"
workflow_dispatch:

jobs:
update:
runs-on: ubuntu-latest
steps: - uses: actions/checkout@v4

      - name: Generate YouTube Cards
        uses: yshashi/youtube-cards@v2
        with:
          channel_id: 'UCW4PLi-ObJt3m6YTSEQY3gw'
          output_dir: 'assets'        # ← was output_path (invalid input)
          max_videos: '4'
          theme: 'dark'
          readme_path: 'README.md'   # ← explicit, so you know what gets updated

      - name: Commit & push
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
        run: |
          git config --global user.name  'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git add assets/ README.md   # ← stage all SVGs + the updated README
          git diff --staged --quiet || git commit -m "chore: update YouTube cards [skip ci]"
          git push# YouTube Cards Action — Project Guidelines

## Overview

This is a **GitHub Action** (`node20`) that fetches the latest videos from a YouTube channel's RSS feed, renders each as a self-contained SVG card with an embedded base64 thumbnail, and injects a Markdown table of linked cards into a README between `<!-- YOUTUBE-CARDS:START -->` and `<!-- YOUTUBE-CARDS:END -->` markers.

## Architecture

All logic lives in a single file — `src/index.js` — and is bundled with `@vercel/ncc` into `dist/index.js` (the file `action.yml` actually runs). There is no framework, no TypeScript, no test suite.

```
src/index.js       # Source — HTTP helpers, SVG builder, README updater, main runner
dist/index.js      # Compiled bundle — committed to the repo, required at runtime
action.yml         # Action metadata — inputs, outputs, runtime declaration
examples/usage.yml # Reference workflow for action consumers
```

## Build & Distribution

```bash
pnpm install          # Install dependencies
pnpm run build        # ncc build → dist/index.js (must be committed)
```

> **Critical**: `dist/` must be committed alongside source changes. The action runs `dist/index.js` directly — source edits without a rebuild have no effect at runtime.

## Conventions

- **Single-file source**: Keep all logic in `src/index.js`. Do not split into modules unless complexity demands it.
- **Themes**: Add new themes to the `THEMES` object in `src/index.js`. Each theme requires `bg`, `stroke`, `text`, `subtext`, `shadow`, `overlay`, and `play` colour values.
- **Card dimensions**: 460 × 323 px (259 px thumbnail + 64 px footer). Adjust `W`, `THUMB`, and `FOOT` constants together.
- **Max videos cap**: Hard-capped at 4 in the action inputs and in `run()` (`Math.min(..., 4)`). Update both if raising the limit.
- **README markers**: Injection relies on exact strings `<!-- YOUTUBE-CARDS:START -->` / `<!-- YOUTUBE-CARDS:END -->`. Do not rename them.
- **Commit convention**: Automated commits use `[skip ci]` to prevent CI loops (see `examples/usage.yml`).

## Key Inputs (`action.yml`)

| Input         | Default     | Notes                        |
| ------------- | ----------- | ---------------------------- |
| `channel_id`  | —           | Required. YouTube channel ID |
| `output_dir`  | `assets`    | Where SVGs are saved         |
| `max_videos`  | `4`         | Capped at 4                  |
| `theme`       | `dark`      | `dark` or `light`            |
| `readme_path` | `README.md` | Target file for injection    |

## Dependency Notes

- **`@actions/core`**: Only dependency — used for inputs, outputs, logging, and failure signalling.
- **`@vercel/ncc`**: Dev-only bundler. No Webpack, Rollup, or esbuild.
- Native `fetch` (Node 20 built-in) replaces any HTTP library — do not add `node-fetch` or `axios`.
