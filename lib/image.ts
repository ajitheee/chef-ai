/**
 * Shrink a photo in the browser before it is sent to the engine.
 *
 * A phone photo is 3–8 MB; as base64 inside JSON that is over the request
 * limit (4.5 MB), so the upload used to fail with a bare 413. A recipe card
 * is perfectly readable at 1600 px on the long side as a JPEG (~200–400 KB).
 * PNG transparency is flattened onto white; EXIF orientation is honored by
 * the browser when the image is decoded.
 */
export async function downscaleImage(
  file: File,
  maxSide = 1600,
  quality = 0.8
): Promise<{ dataBase64: string; mediaType: "image/jpeg"; bytes: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("This photo couldn't be read — try a JPEG or PNG."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't resize photos — try a smaller image.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const dataBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return { dataBase64, mediaType: "image/jpeg", bytes: Math.round((dataBase64.length * 3) / 4), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
