import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDir = new URL('../public/', import.meta.url);
const iconsDir = new URL('../public/icons/', import.meta.url);

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const splashSizes = [
  { width: 640, height: 1136, name: 'splash-640x1136.png' },
  { width: 750, height: 1334, name: 'splash-750x1334.png' },
  { width: 1170, height: 2532, name: 'splash-1170x2532.png' },
  { width: 1290, height: 2796, name: 'splash-1290x2796.png' },
];
const appIconSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="120" fill="#0D0F18"/>
  <circle cx="256" cy="256" r="156" fill="rgba(79,107,255,0.14)"/>
  <circle cx="256" cy="188" r="24" fill="#4F6BFF"/>
  <path d="M160 176C160 153.909 177.909 136 200 136H312C334.091 136 352 153.909 352 176V216H160V176Z" fill="#4F6BFF"/>
  <path d="M144 216H368V320C368 353.137 341.137 380 308 380H204C170.863 380 144 353.137 144 320V216Z" fill="#4F6BFF"/>
  <rect x="196" y="252" width="120" height="20" rx="10" fill="#0D0F18" fill-opacity="0.9"/>
  <circle cx="326" cy="262" r="16" fill="#0D0F18" fill-opacity="0.9"/>
</svg>
`;

function ensureDir(url) {
  return fs.mkdir(url, { recursive: true });
}

function centeredWalletComposite(width, height) {
  const iconSide = Math.round(Math.min(width, height) * 0.34);
  return {
    input: Buffer.from(appIconSvg),
    gravity: 'center',
    blend: 'over',
    top: Math.round((height - iconSide) / 2),
    left: Math.round((width - iconSide) / 2),
  };
}

async function createSplash(width, height, name) {
  const radialOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="20%" r="70%">
          <stop offset="0%" stop-color="rgba(79,107,255,0.26)" />
          <stop offset="100%" stop-color="rgba(79,107,255,0)" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#0D0F18" />
      <rect width="${width}" height="${height}" fill="url(#g)" />
      <text x="50%" y="72%" fill="#EEEFFE" font-size="${Math.round(width * 0.045)}" font-family="Inter, system-ui, sans-serif" text-anchor="middle">Expense Tracker</text>
      <text x="50%" y="77%" fill="#8B8FA8" font-size="${Math.round(width * 0.022)}" font-family="Inter, system-ui, sans-serif" text-anchor="middle">Track income, expenses and savings locally</text>
    </svg>
  `);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#0D0F18',
    },
  })
    .composite([
      { input: radialOverlay },
      {
        input: await sharp(Buffer.from(appIconSvg))
          .resize(Math.round(width * 0.26), Math.round(width * 0.26))
          .png()
          .toBuffer(),
        gravity: 'center',
      },
    ])
    .png()
    .toFile(fileURLToPath(new URL(name, iconsDir)));
}

await ensureDir(publicDir);
await ensureDir(iconsDir);

await fs.writeFile(new URL('icon.svg', iconsDir), appIconSvg);

const svgBuffer = Buffer.from(appIconSvg);
for (const size of iconSizes) {
  await sharp(svgBuffer).resize(size, size).png().toFile(fileURLToPath(new URL(`icon-${size}.png`, iconsDir)));
}

await sharp(svgBuffer)
  .resize(410, 410)
  .extend({
    top: 51,
    bottom: 51,
    left: 51,
    right: 51,
    background: '#0D0F18',
  })
  .resize(512, 512)
  .png()
  .toFile(fileURLToPath(new URL('icon-512-maskable.png', iconsDir)));

for (const splash of splashSizes) {
  await createSplash(splash.width, splash.height, splash.name);
}

console.log('Icons and splash screens generated. Play Store screenshots are captured separately via the screenshot capture script.');
