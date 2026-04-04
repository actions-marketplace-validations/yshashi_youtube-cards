# 📺 YouTube Cards — GitHub Action

Automatically fetch your latest YouTube videos and render them as beautiful SVG cards in your GitHub profile README — updated on a schedule, zero config.

![dark theme preview](https://github.com/yshashi/yshashi/raw/main/assets/yt-card-0.svg)

---

## How It Works

1. Fetches your channel's RSS feed (no API key needed)
2. Downloads each video thumbnail and embeds it as base64 inside the SVG
3. Generates individual `yt-card-N.svg` files in your chosen output directory
4. Injects a 2-column linked card table into your README between marker comments

---

## Quick Start

### 1 — Add markers to your README

Place these two comments wherever you want the cards to appear:

```html
<!-- YOUTUBE-CARDS:START -->
<!-- YOUTUBE-CARDS:END -->
```

### 2 — Create the workflow

Create `.github/workflows/youtube-cards.yml` in your profile repo:

```yaml
name: 📺 Update YouTube Cards

on:
  schedule:
    - cron: "0 0 * * *"   # daily at midnight UTC
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate YouTube Cards
        uses: yshashi/youtube-cards@v2
        with:
          channel_id: 'YOUR_CHANNEL_ID'   # required
          output_dir: 'assets'
          max_videos: '4'
          theme: 'dark'
          readme_path: 'README.md'

      - name: Commit & push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git config --global user.name  'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git add assets/ README.md
          git diff --staged --quiet || git commit -m "chore: update YouTube cards [skip ci]"
          git push
```

### 3 — Find your Channel ID

Your Channel ID looks like `UCxxxxxxxxxxxxxxxxxxxxxxxxx`. Find it at:  
`youtube.com` → Your channel → **About** → **Share channel** → **Copy channel ID**

---

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `channel_id` | ✅ | — | Your YouTube Channel ID |
| `output_dir` | | `assets` | Folder where SVG cards are saved |
| `max_videos` | | `4` | Number of cards to generate (max 4) |
| `theme` | | `dark` | Card theme: `dark` or `light` |
| `readme_path` | | `README.md` | Path to the README to inject cards into |

## Outputs

| Output | Description |
|---|---|
| `output_dir` | The folder path where SVG cards were written |

---

## Themes

| `dark` | `light` |
|---|---|
| Background `#161b22`, GitHub-style dark | Background `#ffffff`, clean white |

---

## Card Features

- 460 × 339 px per card
- Thumbnail embedded as base64 — no external image requests at render time
- 16:9 thumbnail with gradient overlay
- Play button overlay
- YouTube badge
- Bold title (up to 2 lines)
- Red "▶ Watch on YouTube" pill button
- Entire card is clickable (links to the video)

---

## Example Output

The cards are rendered as a 2-column table in your README:

```html
<!-- YOUTUBE-CARDS:START -->
<table>
  <tr>
    <td width="50%">
      <a href="https://www.youtube.com/watch?v=VIDEO_ID">
        <img src="./assets/yt-card-0.svg" width="100%" />
      </a>
    </td>
    <td width="50%">
      <a href="https://www.youtube.com/watch?v=VIDEO_ID">
        <img src="./assets/yt-card-1.svg" width="100%" />
      </a>
    </td>
  </tr>
</table>
<!-- YOUTUBE-CARDS:END -->
```

---

## No API Key Required

This action uses YouTube's public RSS feed (`youtube.com/feeds/videos.xml?channel_id=...`) — no YouTube Data API quota, no credentials needed.

---

## License

MIT © [Sashikumar Yadav](https://sashikumar.dev)
