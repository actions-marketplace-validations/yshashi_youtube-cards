const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────────────────────

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
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function wrapText(text, maxLen = 44) {
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

// ─── Themes ─────────────────────────────────────────────────────────────────

const THEMES = {
    dark: {
        bg: '#0d1117',
        cardBg: '#161b22',
        cardStroke: '#21262d',
        text: '#c9d1d9',
        subtext: '#58a6ff',
        shadow: 'rgba(0,0,0,0.45)',
        overlay: 'rgba(22,27,34,0.85)',
        play: 'rgba(0,0,0,0.60)',
    },
    light: {
        bg: '#f6f8fa',
        cardBg: '#ffffff',
        cardStroke: '#d0d7de',
        text: '#1f2328',
        subtext: '#0969da',
        shadow: 'rgba(31,35,40,0.12)',
        overlay: 'rgba(246,248,250,0.80)',
        play: 'rgba(0,0,0,0.55)',
    },
};

// ─── SVG Builder ────────────────────────────────────────────────────────────

async function buildSVG(videos, thumbs, theme) {
    const t = THEMES[theme] ?? THEMES.dark;
    const GAP = 18;
    const CARD_W = 432;
    const THUMB_H = 243;  // 16:9
    const TITLE_H = 66;
    const CARD_H = THUMB_H + TITLE_H;
    const COLS = Math.min(videos.length, 2);
    const ROWS = Math.ceil(videos.length / 2);
    const SVG_W = GAP + COLS * CARD_W + (COLS - 1) * GAP + GAP;
    const SVG_H = GAP + ROWS * CARD_H + (ROWS - 1) * GAP + GAP;

    let defs = '';
    let cards = '';

    for (let i = 0; i < videos.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = GAP + col * (CARD_W + GAP);
        const cy = GAP + row * (CARD_H + GAP);
        const v = videos[i];
        const url = `https://www.youtube.com/watch?v=${v.id}`;
        const lines = wrapText(esc(v.title));

        // Clip path for thumbnail rounded corners
        defs += `
    <clipPath id="cp${i}">
      <rect x="${cx}" y="${cy}" width="${CARD_W}" height="${THUMB_H}" rx="12"/>
    </clipPath>
    <linearGradient id="fade${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%" stop-color="transparent"/>
      <stop offset="100%" stop-color="${t.overlay}"/>
    </linearGradient>`;

        // Drop shadow
        cards += `<rect x="${cx + 3}" y="${cy + 3}" width="${CARD_W}" height="${CARD_H}" rx="12" fill="${t.shadow}"/>`;
        // Card base
        cards += `<rect x="${cx}" y="${cy}" width="${CARD_W}" height="${CARD_H}" rx="12" fill="${t.cardBg}" stroke="${t.cardStroke}" stroke-width="1.5"/>`;
        // Thumbnail
        cards += `<image href="${thumbs[i]}" x="${cx}" y="${cy}" width="${CARD_W}" height="${THUMB_H}" clip-path="url(#cp${i})" preserveAspectRatio="xMidYMid slice"/>`;
        // Gradient overlay
        cards += `<rect x="${cx}" y="${cy}" width="${CARD_W}" height="${THUMB_H}" clip-path="url(#cp${i})" fill="url(#fade${i})"/>`;

        // Play button
        const pcx = cx + CARD_W / 2;
        const pcy = cy + THUMB_H / 2;
        cards += `<circle cx="${pcx}" cy="${pcy}" r="30" fill="${t.play}"/>`;
        cards += `<polygon points="${pcx - 11},${pcy - 15} ${pcx + 19},${pcy} ${pcx - 11},${pcy + 15}" fill="white"/>`;

        // YouTube badge (bottom-right of thumbnail)
        const bx = cx + CARD_W - 48;
        const by = cy + THUMB_H - 28;
        cards += `<rect x="${bx}" y="${by}" width="32" height="20" rx="5" fill="#FF0000"/>`;
        cards += `<polygon points="${bx + 7},${by + 4} ${bx + 7},${by + 16} ${bx + 24},${by + 10}" fill="white"/>`;

        // Title
        const ty = cy + THUMB_H;
        lines.forEach((line, li) => {
            cards += `<text x="${cx + 14}" y="${ty + 23 + li * 22}" font-family="Segoe UI,Inter,system-ui,Arial,sans-serif" font-size="13.5" font-weight="500" fill="${t.text}">${line}</text>`;
        });
        // Watch label
        cards += `<text x="${cx + 14}" y="${ty + TITLE_H - 10}" font-family="Segoe UI,Inter,system-ui,Arial,sans-serif" font-size="11.5" fill="${t.subtext}">▶ Watch on YouTube</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
  <defs>${defs}</defs>
  <rect width="${SVG_W}" height="${SVG_H}" rx="16" fill="${t.bg}"/>
  ${cards}
</svg>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    try {
        const channelId = core.getInput('channel_id', { required: true });
        const outputPath = core.getInput('output_path') || 'assets/youtube-cards.svg';
        const maxVideos = Math.min(parseInt(core.getInput('max_videos') || '4', 10), 4);
        const theme = core.getInput('theme') || 'dark';

        core.info(`Fetching RSS for channel: ${channelId}`);
        const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
        const videos = parseVideos(xml, maxVideos);

        if (videos.length === 0) {
            core.setFailed('No videos found. Check your channel_id.');
            return;
        }
        core.info(`Found ${videos.length} videos: ${videos.map(v => v.title).join(', ')}`);

        core.info('Downloading thumbnails…');
        const thumbs = await Promise.all(videos.map(v => getThumb(v.id)));

        core.info('Generating SVG…');
        const svg = await buildSVG(videos, thumbs, theme);

        const dir = path.dirname(outputPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outputPath, svg, 'utf8');

        core.setOutput('svg_path', outputPath);
        core.info(`Done! Saved to ${outputPath} (${(svg.length / 1024).toFixed(1)} KB)`);

    } catch (err) {
        core.setFailed(err.message);
    }
}

run();