/**
 * QA — upload compression, old settings vs new (docs/fix.txt, FIX 2).
 *
 * WHAT THIS ANSWERS
 *   "Raise the compression so full-bleed images stop looking pixelated, but
 *   still be meaningfully smaller than the camera file." That is a trade, so
 *   this measures both sides of it on the project's own photography instead of
 *   asserting a preference:
 *
 *     - BYTES  what each pipeline costs, against the same camera original.
 *     - SSIM   structural similarity of each pipeline's output against the
 *              original, both rendered at the width the slide is actually
 *              displayed at. This is the question that matters — "when this is
 *              on a 2560px screen, how different is it from the photograph?" —
 *              and unlike a sharpness score it cannot be inflated by noise, so
 *              it cannot flatter the lossy side of the trade. Roughly: >=0.98
 *              is not visibly different, 0.95-0.98 is close, below 0.95 is a
 *              difference you can see on a photograph.
 *
 * WHY THE INPUT IS BUILT, NOT DOWNLOADED
 *   Every image already in Supabase Storage went through the pipeline this task
 *   is changing, so none of them is a pre-compression original any more (they
 *   are all <=1920px). Each sample is therefore first turned into a stand-in
 *   camera original at phone resolution (4032px longest side, JPEG q94,
 *   4:4:4 chroma) so both pipelines are handed identical, realistic input. The
 *   samples themselves are real project photography pulled from the public
 *   bucket, so the high-frequency content being measured — embroidery weave,
 *   fabric weave, foliage — is the content that actually goes pixelated.
 *
 * WHAT IT DOES NOT DO
 *   It does not run Next's own image optimiser, which is what finally serves
 *   these files. The delivery leg here re-encodes the pipeline output at the
 *   display width, which is the same work minus the optimiser's format
 *   negotiation and cache.
 *
 * Usage:
 *   node tests/qa/image-compression-compare.mjs [dir]
 *
 * Defaults to a directory of real photographs; writes every intermediate to the
 * temp directory and prints the paths so they can be opened side by side.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

/** The two pipelines under comparison, exactly as they were configured. */
const PIPELINES = [
  { name: "before (1920 cap, q80)", max: 1920, quality: 80 },
  { name: "after (3200 cap, q90)", max: 3200, quality: 90 },
];

/**
 * What the BROWSER was handed for a full-bleed slide, before and after.
 *
 * This is a separate leg on purpose. The upload pipeline only decides what is
 * stored; the pixelation the storefront actually showed was mostly created
 * afterwards, when `next/image` re-encoded that stored file down to quality 55
 * at a candidate width that topped out at 1920 — so a 2560px viewport, and any
 * viewport at 2x DPR, was upscaling the result. Measuring only the upload
 * pipeline would have "fixed" a cause that was not the main one, so both legs
 * are measured and reported, at a phone's candidate width and at a 27-inch
 * display's.
 *
 * `source` indexes PIPELINES: 0 is the old stored file, 1 the new one.
 */
const DELIVERIES = [
  { when: "before", where: "phone   w=828 ", width: 828, quality: 55, source: 0 },
  { when: "after ", where: "phone   w=828 ", width: 828, quality: 90, source: 1 },
  { when: "before", where: "desktop w=2560", width: 2560, quality: 55, source: 0 },
  { when: "after ", where: "desktop w=2560", width: 2560, quality: 90, source: 1 },
];

/** Phone camera geometry the stand-in originals are built at. */
const CAMERA_LONG_SIDE = 4032;
const CAMERA_QUALITY = 94;

/**
 * The widths the slide is actually shown at, so the comparison is made where
 * the regression was seen: 1440 is a laptop, 1920 a 1080p desktop, 2560 the
 * 27-inch full-bleed case. 828 is a phone at 1.75 DPR, included to show what a
 * shopper on a phone actually pays for the change.
 */
const DISPLAY_WIDTHS = [828, 1440, 1920, 2560];

/** SSIM sliding window. 8x8 is the standard non-filtered form. */
const WIN = 8;

/**
 * Mean SSIM over 8x8 windows, on greyscale buffers of identical size.
 *
 * Uniform windows rather than a Gaussian: it is the textbook variant, and it is
 * slightly stricter than the filtered form, which is the right direction for a
 * check whose job is to catch a regression.
 */
function ssim(a, b) {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const count = WIN * WIN;
  let total = 0;
  let windows = 0;

  for (let y = 0; y + WIN <= a.height; y += WIN) {
    for (let x = 0; x + WIN <= a.width; x += WIN) {
      let sumA = 0;
      let sumB = 0;
      let sqA = 0;
      let sqB = 0;
      let product = 0;

      for (let j = 0; j < WIN; j++) {
        for (let i = 0; i < WIN; i++) {
          const p = (y + j) * a.width + (x + i);
          const va = a.data[p];
          const vb = b.data[p];
          sumA += va;
          sumB += vb;
          sqA += va * va;
          sqB += vb * vb;
          product += va * vb;
        }
      }

      const meanA = sumA / count;
      const meanB = sumB / count;
      const varA = sqA / count - meanA * meanA;
      const varB = sqB / count - meanB * meanB;
      const covariance = product / count - meanA * meanB;

      total +=
        ((2 * meanA * meanB + C1) * (2 * covariance + C2)) /
        ((meanA * meanA + meanB * meanB + C1) * (varA + varB + C2));
      windows++;
    }
  }

  return total / windows;
}

/** Greyscale raw pixels of `input` rendered at `width` px wide. */
async function render(input, width) {
  const buffer = await sharp(input)
    .greyscale()
    .resize({ width, fit: "inside", withoutEnlargement: false })
    .toBuffer();
  const meta = await sharp(buffer).metadata();
  return {
    data: await sharp(buffer).raw().toBuffer(),
    width: meta.width,
    height: meta.height,
  };
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

const samplesDir =
  process.argv[2] || path.join(process.cwd(), "tests/qa/fixtures/compression-samples");
const outDir = path.join(os.tmpdir(), "image-compression-compare");
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(samplesDir) || fs.readdirSync(samplesDir).length === 0) {
  console.error(`No sample images in ${samplesDir}`);
  console.error("Pass a directory of real photographs as the only argument.");
  process.exit(2);
}

const samples = fs
  .readdirSync(samplesDir)
  .filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f));

console.log(`SSIM against the camera original, rendered at each display width\n`);

for (const sample of samples) {
  const src = path.join(samplesDir, sample);
  const base = path.parse(sample).name;

  const originalPath = path.join(outDir, `${base}--original.jpg`);
  await sharp(src)
    .resize(CAMERA_LONG_SIDE, CAMERA_LONG_SIDE, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .jpeg({ quality: CAMERA_QUALITY, chromaSubsampling: "4:4:4" })
    .toFile(originalPath);

  const originalBytes = fs.statSync(originalPath).size;
  const originalMeta = await sharp(originalPath).metadata();
  const references = new Map(
    await Promise.all(
      DISPLAY_WIDTHS.map(async (w) => [w, await render(originalPath, w)]),
    ),
  );
  const pipelineOutputs = [];

  console.log(`${sample}`);
  console.log(
    `  camera original ${originalMeta.width}x${originalMeta.height}  ${kb(originalBytes)}`,
  );

  for (const pipeline of PIPELINES) {
    const out = path.join(outDir, `${base}--${pipeline.max}-q${pipeline.quality}.webp`);
    await sharp(originalPath)
      .resize(pipeline.max, pipeline.max, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: pipeline.quality })
      .toFile(out);
    pipelineOutputs.push(out);

    const bytes = fs.statSync(out).size;
    const meta = await sharp(out).metadata();
    const saved = (1 - bytes / originalBytes) * 100;

    const row = [];
    for (const width of DISPLAY_WIDTHS) {
      row.push(`${width}px ${ssim(references.get(width), await render(out, width)).toFixed(3)}`);
    }

    console.log(
      `  ${pipeline.name.padEnd(24)} ${String(meta.width).padStart(4)}px long  ` +
        `${kb(bytes).padStart(8)} (-${saved.toFixed(0)}%)   ${row.join("  ")}`,
    );
    console.log(`      ${out}`);
  }

  // The delivery leg: pipeline output re-encoded at the width and quality the
  // site actually asks `next/image` for, then measured as the shopper sees it.
  console.log(`  delivered to the browser (bytes on the wire, and SSIM vs original):`);

  for (const delivery of DELIVERIES) {
    const out = path.join(
      outDir,
      `${base}--${delivery.when.trim()}-${delivery.width}-q${delivery.quality}.webp`,
    );
    await sharp(pipelineOutputs[delivery.source])
      .resize(delivery.width, delivery.width, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: delivery.quality })
      .toFile(out);

    const bytes = fs.statSync(out).size;
    console.log(
      `    ${delivery.when}  ${delivery.where}  ${kb(bytes).padStart(8)}   ` +
        `SSIM ${ssim(references.get(delivery.width), await render(out, delivery.width)).toFixed(3)}`,
    );
  }

  console.log(`      original: ${originalPath}\n`);
}

console.log(`Wrote every intermediate to ${outDir}`);