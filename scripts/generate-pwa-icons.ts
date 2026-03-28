import sharp from 'sharp';
import { existsSync } from 'fs';
import { join } from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const publicDir = join(process.cwd(), 'public');
// Use the brand symbol SVG — square, high-res, perfect for icons
const inputImage = join(publicDir, 'Dietai_logo_symbol.svg');

async function generateIcons() {
  if (!existsSync(inputImage)) {
    console.error('Source image not found:', inputImage);
    process.exit(1);
  }

  console.log('Generating PWA icons from:', inputImage);

  for (const size of sizes) {
    const outputPath = join(publicDir, `icon-${size}x${size}.png`);
    const padding = Math.round(size * 0.1);
    const innerSize = size - padding * 2;

    const resized = await sharp(inputImage, { density: 300 })
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
    })
      .composite([{ input: resized, top: padding, left: padding }])
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${size}x${size} icon`);
  }

  // apple-touch-icon (180x180)
  const applePadding = 18;
  const appleInner = 180 - applePadding * 2;
  const appleResized = await sharp(inputImage, { density: 300 })
    .resize(appleInner, appleInner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 180, height: 180, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
  })
    .composite([{ input: appleResized, top: applePadding, left: applePadding }])
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon.png');

  // favicon (32x32)
  const faviconResized = await sharp(inputImage, { density: 300 })
    .resize(24, 24, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
  })
    .composite([{ input: faviconResized, top: 4, left: 4 }])
    .png()
    .toFile(join(publicDir, 'favicon.ico'));
  console.log('✓ Generated favicon.ico');

  console.log('\nAll PWA icons generated successfully!');
}

generateIcons().catch(console.error);
