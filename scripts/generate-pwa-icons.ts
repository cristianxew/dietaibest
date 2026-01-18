import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const publicDir = join(process.cwd(), 'public');
const inputImage = join(publicDir, 'mydietbook.png');

async function generateIcons() {
  if (!existsSync(inputImage)) {
    console.error('Source image not found:', inputImage);
    process.exit(1);
  }

  console.log('Generating PWA icons from:', inputImage);

  for (const size of sizes) {
    const outputPath = join(publicDir, `icon-${size}x${size}.png`);

    await sharp(inputImage)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${size}x${size} icon`);
  }

  // Generate apple-touch-icon
  const appleTouchIconPath = join(publicDir, 'apple-touch-icon.png');
  await sharp(inputImage)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(appleTouchIconPath);
  console.log('✓ Generated apple-touch-icon.png');

  // Generate favicon
  const faviconPath = join(publicDir, 'favicon.ico');
  await sharp(inputImage)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(faviconPath);
  console.log('✓ Generated favicon.ico');

  console.log('\nAll PWA icons generated successfully!');
}

generateIcons().catch(console.error);
