import sharp from "sharp";
// Small RGB signature tolerates recompression of the same photo. This is not
// semantic object recognition; uniform/low-detail pictures are excluded.
export async function imageSignature(bytes: Buffer): Promise<string> {
  return (
    await sharp(bytes)
      .rotate()
      .resize(16, 16, { fit: "fill" })
      .flatten({ background: "white" })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer()
  ).toString("base64");
}
export function samePhoto(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a, "base64"),
    y = Buffer.from(b, "base64");
  if (x.length !== 768 || y.length !== 768) return false;
  const detailed = (v: Buffer) => {
    const mean = [...v].reduce((s, n) => s + n, 0) / v.length;
    // Spatial contrast, not just a difference between RGB channels.
    const lum = Array.from(
      { length: 256 },
      (_, i) => (v[3 * i] + v[3 * i + 1] + v[3 * i + 2]) / 3,
    );
    const avg = lum.reduce((s, n) => s + n, 0) / lum.length;
    return (
      Number.isFinite(mean) &&
      Math.sqrt(lum.reduce((s, n) => s + (n - avg) ** 2, 0) / lum.length) >= 12
    );
  };
  return (
    detailed(x) &&
    detailed(y) &&
    Math.sqrt([...x].reduce((s, n, i) => s + (n - y[i]) ** 2, 0) / x.length) <=
      5
  );
}
