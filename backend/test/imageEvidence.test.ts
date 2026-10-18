import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { imageSignature, samePhoto } from "../src/imageEvidence";
import { geminiFailure } from "../src/service";
test("same photo tolerates JPEG recompression but excludes unrelated and uniform images", async () => {
  const pixels = Buffer.alloc(128 * 128 * 3);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 3;
      pixels[i] = x * 2;
      pixels[i + 1] = y * 2;
      pixels[i + 2] = (x + y) % 256;
    }
  const original = await sharp(pixels, {
    raw: { width: 128, height: 128, channels: 3 },
  })
    .png()
    .toBuffer();
  const compressed = await sharp(original).jpeg({ quality: 70 }).toBuffer();
  const changed = await sharp(original).flip().toBuffer();
  const solid = await sharp({
    create: { width: 128, height: 128, channels: 3, background: "yellow" },
  })
    .png()
    .toBuffer();
  const a = await imageSignature(original);
  assert.equal(samePhoto(a, await imageSignature(compressed)), true);
  assert.equal(samePhoto(a, await imageSignature(changed)), false);
  assert.equal(
    samePhoto(await imageSignature(solid), await imageSignature(solid)),
    false,
  );
  assert.equal(samePhoto("invalid", a), false);
});
test("Gemini errors expose actionable categories without provider payloads or secrets", () => {
  assert.match(geminiFailure({ status: 429, message: "secret" }), /quota/);
  assert.match(geminiFailure({ status: 403, message: "secret" }), /key/);
  assert.match(geminiFailure({ status: 404 }), /model/);
  assert.doesNotMatch(geminiFailure({ message: "secret" }), /secret/);
});
