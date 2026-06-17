/**
 * Read an image File and return a downscaled JPEG data URL, capping the largest
 * dimension. Keeps vision uploads small (faster + cheaper). Falls back to the
 * original data URL if the browser can't draw to a canvas.
 */
export async function fileToDownscaledDataUrl(file: File, maxDim = 1024): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not decode the image."));
    element.src = original;
  });

  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  if (scale >= 1) return original;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
