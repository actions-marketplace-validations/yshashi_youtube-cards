const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.text();
}

async function fetchBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    const buf = await res.arrayBuffer();
    return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
}

async function getThumb(id) {
    try { return await fetchBase64(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`); }
    catch { return await fetchBase64(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`); }
}

// ─── Parsers & Utils ─────────────────────────────────────────────────────────

function parseVideos(xml, max) {
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
        .slice(0, max)
        .map(m => {
            const e = m[1];
            return {
                id: e.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] ?? '',
                title: e.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/&amp;/g, '&') ?? 'Untitled',
            };
        });
}

function esc(s) {
    return s
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapText(text, maxLen = 40) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (test.length > maxLen && cur) {
            lines.push(cur);
            cur = w;
            if (lines.length >= 2) { lines[1] = lines[1].slice(0, maxLen - 1) + '…'; break; }
        } else { cur = test; }
    }
    if (cur && lines.length < 2) lines.push(cur);
    return lines;
}

// ─── Themes ──────────────────────────────────────────────────────────────────

const THEMES = {
    dark: {
        bg: '#161b22', stroke: '#30363d', text: '#c9d1d9',
        subtext: '#58a6ff', shadow: 'rgba(0,0,0,0.5)',
        overlay: 'rgba(22,27,34,0.80)', play: 'rgba(0,0,0,0.60)',
    },
    light: {
        bg: '#ffffff', stroke: '#d0d7de', text: '#1f2328',
        subtext: '#0969da', shadow: 'rgba(31,35,40,0.10)',
        overlay: 'rgba(255,255,255,0.75)', play: 'rgba(0,0,0,0.50)',
    },
};

// ─── Single Card SVG Builder ─────────────────────────────────────────────────

async function buildCardSVG(video, thumbData, theme) {
    const t = THEMES[theme] ?? THEMES.dark;
    const W = 460;
    const THUMB = 259;   // 16:9
    const FOOT = 80;
    const H = THUMB + FOOT;
    const lines = wrapText(esc(video.title), 36);
    const ytUrl = `https://www.youtube.com/watch?v=${video.id}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="cp">
      <rect width="${W}" height="${THUMB}" rx="10"/>
    </clipPath>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%" stop-color="transparent"/>
      <stop offset="100%" stop-color="${t.overlay}"/>
    </linearGradient>
  </defs>

  <a href="${ytUrl}" target="_blank" rel="noopener noreferrer">
  <!-- Shadow -->
  <rect x="3" y="3" width="${W}" height="${H}" rx="10" fill="${t.shadow}"/>
  <!-- Card -->
  <rect width="${W}" height="${H}" rx="10" fill="${t.bg}" stroke="${t.stroke}" stroke-width="1.5"/>
  <!-- Thumbnail -->
  <image href="${thumbData}" x="0" y="0" width="${W}" height="${THUMB}"
    clip-path="url(#cp)" preserveAspectRatio="xMidYMid slice"/>
  <!-- Gradient overlay -->
  <rect width="${W}" height="${THUMB}" clip-path="url(#cp)" fill="url(#fade)"/>

  <!-- Play button -->
  <circle cx="${W / 2}" cy="${THUMB / 2}" r="30" fill="${t.play}"/>
  <polygon points="${W / 2 - 11},${THUMB / 2 - 15} ${W / 2 + 19},${THUMB / 2} ${W / 2 - 11},${THUMB / 2 + 15}" fill="white"/>

  <!-- YouTube badge -->
  <rect x="${W - 48}" y="${THUMB - 28}" width="32" height="20" rx="5" fill="#FF0000"/>
  <polygon points="${W - 41},${THUMB - 25} ${W - 41},${THUMB - 12} ${W - 25},${THUMB - 18}" fill="white"/>

  <!-- Title -->
  ${lines.map((line, i) =>
        `<text x="14" y="${THUMB + 26 + i * 22}"
      font-family="Segoe UI,Inter,system-ui,Arial,sans-serif"
      font-size="15" font-weight="600" fill="${t.text}">${line}</text>`
    ).join('\n  ')}

  <!-- Watch button -->
  <rect x="14" y="${THUMB + 54}" width="162" height="22" rx="11" fill="#FF0000"/>
  <text x="95" y="${THUMB + 69}"
    text-anchor="middle"
    font-family="Segoe UI,Inter,system-ui,Arial,sans-serif"
    font-size="11.5" font-weight="700" fill="white">▶  Watch on YouTube</text>
  </a>
</svg>`;
}

// ─── README Updater ───────────────────────────────────────────────────────────

function updateReadme(readmePath, videos, outputDir) {
    if (!fs.existsSync(readmePath)) {
        core.warning(`README not found at ${readmePath} — skipping update`);
        return;
    }

    const START = '<!-- YOUTUBE-CARDS:START -->';
    const END = '<!-- YOUTUBE-CARDS:END -->';

    // Build 2-column table with per-video links
    const rows = [];
    for (let i = 0; i < videos.length; i += 2) {
        const left = videos[i];
        const right = videos[i + 1];
        const leftCell = `<a href="https://www.youtube.com/watch?v=${left.id}" target="_blank">
      <img src="./${outputDir}/yt-card-${i}.svg" width="100%" alt="${esc(left.title)}"/>
    </a>`;
        const rightCell = right
            ? `<a href="https://www.youtube.com/watch?v=${right.id}" target="_blank">
      <img src="./${outputDir}/yt-card-${i + 1}.svg" width="100%" alt="${esc(right.title)}"/>
    </a>`
            : '';
        rows.push(`  <tr>\n    <td width="50%">\n    ${leftCell}\n    </td>\n    <td width="50%">\n    ${rightCell}\n    </td>\n  </tr>`);
    }

    const table = `<table>\n${rows.join('\n')}\n</table>`;
    const block = `${START}\n${table}\n${END}`;

    let readme = fs.readFileSync(readmePath, 'utf8');
    const startIdx = readme.indexOf(START);
    const endIdx = readme.indexOf(END);

    if (startIdx === -1 || endIdx === -1) {
        core.warning('Markers <!-- YOUTUBE-CARDS:START --> and <!-- YOUTUBE-CARDS:END --> not found in README. Skipping inject.');
        return;
    }

    readme = readme.slice(0, startIdx) + block + readme.slice(endIdx + END.length);
    fs.writeFileSync(readmePath, readme, 'utf8');
    core.info('README.md updated with dynamic video links!');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    try {
        const channelId = core.getInput('channel_id', { required: true });
        const outputDir = core.getInput('output_dir') || 'assets';
        const maxVideos = Math.min(parseInt(core.getInput('max_videos') || '4', 10), 4);
        const theme = core.getInput('theme') || 'dark';
        const readmePath = core.getInput('readme_path') || 'README.md';

        core.info(`Fetching RSS for channel: ${channelId}`);
        const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
        const videos = parseVideos(xml, maxVideos);

        if (!videos.length) { core.setFailed('No videos found. Check your channel_id.'); return; }
        core.info(`Found ${videos.length} videos`);

        core.info('Downloading thumbnails…');
        const thumbs = await Promise.all(videos.map(v => getThumb(v.id)));

        core.info('Generating individual card SVGs…');
        fs.mkdirSync(outputDir, { recursive: true });

        for (let i = 0; i < videos.length; i++) {
            const svg = await buildCardSVG(videos[i], thumbs[i], theme);
            const filePath = path.join(outputDir, `yt-card-${i}.svg`);
            fs.writeFileSync(filePath, svg, 'utf8');
            core.info(`  ✓ ${filePath} (${(svg.length / 1024).toFixed(1)} KB)`);
        }

        core.info('Injecting dynamic links into README…');
        updateReadme(readmePath, videos, outputDir);

        core.setOutput('output_dir', outputDir);
        core.info('All done!');

    } catch (err) {
        core.setFailed(err.message);
    }
}

run();