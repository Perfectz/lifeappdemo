// One-time/maintenance asset transform: the nav-icon PNGs were 512x512
// (~400KB each) but render at ~32px. Downscale to 96px (crisp through dpr3)
// so the shell stops shipping multiple MB of icon data.
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const dir = join(process.cwd(), "public", "assets", "sprites", "lifequest-nav-icons");
const TARGET = 96;

const pngs = readdirSync(dir).filter((file) => file.endsWith(".png"));

for (const file of pngs) {
  const path = join(dir, file);
  const buffer = await sharp(path)
    .resize(TARGET, TARGET, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(path, buffer);
  console.log(`resized ${file} -> ${TARGET}px (${(buffer.length / 1024).toFixed(1)} KB)`);
}
