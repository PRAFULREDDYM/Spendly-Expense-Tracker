import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

mkdirSync('assets', { recursive: true });

const iconSvg = Buffer.from(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0F1117"/>
  <circle cx="512" cy="512" r="248" fill="rgba(43,127,255,0.14)"/>
  <circle cx="512" cy="392" r="40" fill="#2B7FFF"/>
  <path d="M332 370C332 333.549 361.549 304 398 304H626C662.451 304 692 333.549 692 370V438H332V370Z" fill="#2B7FFF"/>
  <path d="M298 438H726V646C726 700.124 682.124 744 628 744H396C341.876 744 298 700.124 298 646V438Z" fill="#2B7FFF"/>
  <rect x="388" y="512" width="220" height="38" rx="19" fill="#0F1117" fill-opacity="0.92"/>
  <circle cx="624" cy="531" r="28" fill="#0F1117" fill-opacity="0.92"/>
</svg>
`);

const foregroundSvg = Buffer.from(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="512" cy="512" r="200" fill="rgba(43,127,255,0.14)"/>
  <circle cx="512" cy="416" r="34" fill="#2B7FFF"/>
  <path d="M366 398C366 366.52 391.52 341 423 341H601C632.48 341 658 366.52 658 398V457H366V398Z" fill="#2B7FFF"/>
  <path d="M338 457H686V637C686 683.392 648.392 721 602 721H422C375.608 721 338 683.392 338 637V457Z" fill="#2B7FFF"/>
  <rect x="410" y="521" width="196" height="34" rx="17" fill="#0F1117" fill-opacity="0.92"/>
  <circle cx="620" cy="538" r="24" fill="#0F1117" fill-opacity="0.92"/>
</svg>
`);

await sharp(iconSvg).resize(1024, 1024).png().toFile('assets/icon.png');
await sharp(foregroundSvg).resize(1024, 1024).png().toFile('assets/icon-foreground.png');

const centeredIcon = await sharp(iconSvg).resize(400, 400).png().toBuffer();

await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: { r: 15, g: 17, b: 23, alpha: 1 },
  },
})
  .composite([{ input: centeredIcon, gravity: 'centre' }])
  .png()
  .toFile('assets/splash.png');

console.log('Native assets generated.');
