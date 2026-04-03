import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const HOST = process.env.SCREENSHOT_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.SCREENSHOT_PORT || '3002', 10);
const BASE_URL = process.env.SCREENSHOT_BASE_URL || `http://${HOST}:${PORT}`;
const OUT_DIR = path.join(projectRoot, 'public', 'screenshots');

const viewport = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const shots = [
  {
    name: 'mobile-dashboard',
    route: '/dashboard',
    screen: 'dashboard',
    ready: () =>
      document.documentElement.dataset.screenshotMode === 'screenshots' &&
      window.location.pathname === '/dashboard' &&
      document.body.innerText.includes('Total spent') &&
      Boolean(document.querySelector('.hero-card')),
  },
  {
    name: 'mobile-history',
    route: '/history',
    screen: 'history',
    ready: () =>
      document.documentElement.dataset.screenshotMode === 'screenshots' &&
      window.location.pathname === '/history' &&
      document.body.innerText.includes('History') &&
      document.body.innerText.includes('Transactions'),
  },
  {
    name: 'mobile-add',
    route: '/quick-add',
    screen: 'add',
    query: 'description=Morning%20coffee',
    ready: () =>
      document.documentElement.dataset.screenshotMode === 'screenshots' &&
      window.location.pathname === '/quick-add' &&
      Boolean(document.querySelector('.quick-add-panel')) &&
      document.body.innerText.includes('How much?'),
  },
  {
    name: 'mobile-analysis',
    route: '/analysis',
    screen: 'analysis',
    ready: () =>
      document.documentElement.dataset.screenshotMode === 'screenshots' &&
      window.location.pathname === '/analysis' &&
      document.body.innerText.includes('Analysis'),
  },
  {
    name: 'mobile-profile',
    route: '/profile',
    screen: 'profile',
    ready: () =>
      document.documentElement.dataset.screenshotMode === 'screenshots' &&
      window.location.pathname === '/profile' &&
      document.body.innerText.includes('Profile') &&
      document.body.innerText.includes('Budgets'),
  },
];

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isServerReady() {
  try {
    const response = await fetch(BASE_URL, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerReady()) {
      return;
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

function startDevServer() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[vite] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[vite] ${chunk}`);
  });

  return child;
}

async function ensureServer() {
  if (await isServerReady()) {
    return null;
  }

  const server = startDevServer();
  await waitForServer();
  return server;
}

function buildUrl(shot) {
  const params = new URLSearchParams({
    demo: 'screenshots',
    screen: shot.screen,
  });

  if (shot.query) {
    const query = new URLSearchParams(shot.query);
    query.forEach((value, key) => {
      params.set(key, value);
    });
  }

  return `${BASE_URL}${shot.route}?${params.toString()}`;
}

async function captureShot(browser, shot) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await page.goto(buildUrl(shot), { waitUntil: 'networkidle2', timeout: 60_000 });
    await page.waitForFunction(shot.ready, { timeout: 60_000 });
    await delay(700);

    const outputPath = path.join(OUT_DIR, `${shot.name}.png`);
    await page.screenshot({
      path: outputPath,
      type: 'png',
    });
    console.log(`Captured ${path.relative(projectRoot, outputPath)}`);
  } finally {
    await page.close();
    await context.close();
  }
}

await mkdir(OUT_DIR, { recursive: true });

let devServer = null;
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: viewport,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  devServer = await ensureServer();

  for (const shot of shots) {
    await captureShot(browser, shot);
  }

  console.log('All screenshots captured.');
} finally {
  await browser.close();

  if (devServer) {
    devServer.kill('SIGTERM');
    await delay(500);
    if (!devServer.killed) {
      devServer.kill('SIGKILL');
    }
  }
}
