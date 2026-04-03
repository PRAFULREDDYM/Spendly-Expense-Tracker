import puppeteer from 'puppeteer';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'spendly-assets');

const mobileSources = [
  ['public/screenshots/mobile-dashboard.png', 'screen-dashboard.png'],
  ['public/screenshots/mobile-history.png', 'screen-history.png'],
  ['public/screenshots/mobile-add.png', 'screen-quickadd.png'],
  ['public/screenshots/mobile-analysis.png', 'screen-analysis.png'],
  ['public/screenshots/mobile-profile.png', 'screen-profile.png'],
];

async function ensureSourceExists(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing screenshot source: ${relativePath}`);
  }
  return absolutePath;
}

function toDataUri(buffer, type = 'image/png') {
  return `data:${type};base64,${buffer.toString('base64')}`;
}

async function readDataUri(relativePath) {
  const absolutePath = await ensureSourceExists(relativePath);
  const buffer = await readFile(absolutePath);
  return toDataUri(buffer);
}

function boardMarkup({ title, caption, imageDataUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f1117;
        --bg-card: #181c25;
        --border: rgba(255, 255, 255, 0.08);
        --text-1: #e8eaf0;
        --text-2: #7c8196;
        --accent: #2b7fff;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--text-1);
        background:
          radial-gradient(circle at top left, rgba(43, 127, 255, 0.18), transparent 24%),
          linear-gradient(145deg, #141824 0%, #0f1117 60%, #10141c 100%);
      }

      .frame {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
        gap: 40px;
        width: 100%;
        height: 100vh;
        padding: 64px;
        align-items: center;
      }

      .copy {
        display: grid;
        gap: 16px;
        align-content: center;
      }

      .eyebrow {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: var(--accent);
      }

      h1 {
        margin: 0;
        font-size: 68px;
        line-height: 0.95;
        letter-spacing: -0.05em;
      }

      p {
        margin: 0;
        max-width: 560px;
        font-size: 20px;
        line-height: 1.7;
        color: var(--text-2);
      }

      .meta {
        display: flex;
        gap: 28px;
        margin-top: 16px;
      }

      .meta-card {
        min-width: 124px;
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(24, 28, 37, 0.72);
        border: 1px solid var(--border);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
      }

      .meta-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--text-2);
      }

      .meta-value {
        margin-top: 8px;
        font-size: 18px;
        font-weight: 700;
      }

      .device-wrap {
        display: flex;
        justify-content: center;
      }

      .device {
        position: relative;
        width: 425px;
        padding: 16px;
        border-radius: 44px;
        background: linear-gradient(180deg, rgba(31, 36, 49, 0.95), rgba(15, 17, 23, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow:
          0 30px 80px rgba(0, 0, 0, 0.44),
          0 0 0 10px rgba(43, 127, 255, 0.08);
      }

      .device::before {
        content: '';
        position: absolute;
        top: 14px;
        left: 50%;
        width: 148px;
        height: 18px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: rgba(12, 14, 20, 0.88);
      }

      .shot {
        display: block;
        width: 100%;
        border-radius: 30px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .caption {
        position: absolute;
        left: 64px;
        bottom: 40px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(232, 234, 240, 0.68);
      }
    </style>
  </head>
  <body>
    <main class="frame">
      <section class="copy">
        <span class="eyebrow">Spendly Case Study</span>
        <h1>${title}</h1>
        <p>Offline-first expense tracking with cloud sync, shared budgets, recurring reminders, and a design system tuned for everyday mobile use.</p>
        <div class="meta">
          <div class="meta-card">
            <div class="meta-label">Platform</div>
            <div class="meta-value">iOS + Android</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">Stack</div>
            <div class="meta-value">React + Capacitor</div>
          </div>
          <div class="meta-card">
            <div class="meta-label">Sync</div>
            <div class="meta-value">Supabase + Dexie</div>
          </div>
        </div>
      </section>
      <section class="device-wrap">
        <div class="device">
          <img class="shot" src="${imageDataUrl}" alt="${title}" />
        </div>
      </section>
      <div class="caption">${caption}</div>
    </main>
  </body>
</html>`;
}

async function copyMobileShots() {
  for (const [source, target] of mobileSources) {
    const sourcePath = await ensureSourceExists(source);
    const targetPath = path.join(outputDir, target);
    await copyFile(sourcePath, targetPath);
    console.log(`✓ ${target}`);
  }
}

async function renderDesktopBoards(browser) {
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    const boards = [
      {
        source: 'public/screenshots/mobile-dashboard.png',
        target: 'desktop-dashboard.png',
        title: 'Live spend overview.',
        caption: 'FIG 1.0  DASHBOARD — LIVE SPEND OVERVIEW',
      },
      {
        source: 'public/screenshots/mobile-history.png',
        target: 'desktop-history.png',
        title: 'Searchable transaction history.',
        caption: 'FIG 2.0  TRANSACTION HISTORY — SEARCH, FILTER, EXPORT',
      },
    ];

    for (const board of boards) {
      const imageDataUrl = await readDataUri(board.source);
      await page.setContent(boardMarkup({ title: board.title, caption: board.caption, imageDataUrl }), {
        waitUntil: 'load',
      });
      await page.screenshot({
        path: path.join(outputDir, board.target),
        type: 'png',
      });
      console.log(`✓ ${board.target}`);
    }
  } finally {
    await page.close();
  }
}

await mkdir(outputDir, { recursive: true });
await copyMobileShots();

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  await renderDesktopBoards(browser);
} finally {
  await browser.close();
}

console.log('\nAll Spendly screenshots saved to spendly-assets/');
