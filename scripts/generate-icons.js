const fs = require('fs');
const path = require('path');

const size = 1024;
const radius = Math.round(size * (120 / 512));

// Path bounding box (with stroke): x=76..384, y=128..384 → 308x256, center at (230, 256)
const pathW = 308, pathH = 256, pathCx = 230, pathCy = 256;

// Full icon SVG (for iOS icon.png)
// Content fills ~55% of icon, centered
const iconScale = (size * 0.55) / pathW;
const iconTx = (size / 2) - (pathCx * iconScale);
const iconTy = (size / 2) - (pathCy * iconScale);
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#007AFF"/>
      <stop offset="100%" stop-color="#0055D4"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#bg)"/>
  <g transform="translate(${iconTx}, ${iconTy}) scale(${iconScale})">
    <path
      d="M360 152H200M360 152V312M360 152L152 360L100 308L240 168"
      stroke="white"
      stroke-width="48"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`;

// Adaptive icon foreground (for Android adaptive-icon.png)
// Content fills ~40% centered (Android masks ~30% on each side)
const adaptScale = (size * 0.4) / pathW;
const adaptTx = (size / 2) - (pathCx * adaptScale);
const adaptTy = (size / 2) - (pathCy * adaptScale);
const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${adaptTx}, ${adaptTy}) scale(${adaptScale})">
    <path
      d="M360 152H200M360 152V312M360 152L152 360L100 308L240 168"
      stroke="white"
      stroke-width="48"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`;

const assetsDir = path.join(__dirname, '..', 'assets');

fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), adaptiveSvg);

console.log('SVG files written to assets/');

// Try to convert with sharp if available
try {
  const sharp = require('sharp');

  async function convert() {
    await sharp(Buffer.from(iconSvg))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('icon.png created (1024x1024)');

    await sharp(Buffer.from(adaptiveSvg))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(assetsDir, 'adaptive-icon.png'));
    console.log('adaptive-icon.png created (1024x1024)');

    // Splash icon - same as main icon
    await sharp(Buffer.from(iconSvg))
      .resize(512, 512)
      .png()
      .toFile(path.join(assetsDir, 'splash-icon.png'));
    console.log('splash-icon.png created (512x512)');

    // Favicon
    await sharp(Buffer.from(iconSvg))
      .resize(48, 48)
      .png()
      .toFile(path.join(assetsDir, 'favicon.png'));
    console.log('favicon.png created (48x48)');
  }

  convert().catch(console.error);
} catch (e) {
  console.log('\nsharp not installed. Install it and re-run:');
  console.log('  npm install sharp --save-dev');
  console.log('  node scripts/generate-icons.js');
  console.log('\nOr convert the SVGs manually at https://svgtopng.com');
}
