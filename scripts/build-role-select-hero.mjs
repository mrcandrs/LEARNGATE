/**
 * Crops the green header (mascot + LearnGate + curve) from the UI mockup reference.
 * Run: node scripts/build-role-select-hero.mjs
 */
import sharp from "sharp";

const REF = "assets/role-select-mockup-reference.png";
const OUT = "assets/role-select-hero.png";
/** Skip mockup status bar; include green header through curved edge. */
const CROP_TOP = 28;
const CROP_BOTTOM = 478;
const OUT_W = 1080;

const meta = await sharp(REF).metadata();
const cropH = Math.min(CROP_BOTTOM - CROP_TOP, meta.height - CROP_TOP);

await sharp(REF)
  .extract({ left: 0, top: CROP_TOP, width: meta.width, height: cropH })
  .resize(OUT_W, Math.round((cropH / meta.width) * OUT_W))
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const outMeta = await sharp(OUT).metadata();
console.log(`Wrote ${OUT} (${outMeta.width}x${outMeta.height}) from reference header`);
