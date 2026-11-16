/** Firestore documents are limited to 1 MiB, so a stored receipt must leave room for its fields. */
export const MAX_STORED_RECEIPT_CHARS = 700_000;

const COMPRESSION_STEPS = [
  { maxSide: 1600, quality: 0.8 },
  { maxSide: 1280, quality: 0.7 },
  { maxSide: 1024, quality: 0.6 },
  { maxSide: 800, quality: 0.5 },
];

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gambar tidak bisa diproses'));
    image.src = dataUrl;
  });
}

/** Re-encodes an image as JPEG, shrinking it until it fits in a Firestore document. */
export async function compressReceiptImage(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Gambar tidak bisa diproses');
  }

  let compressed = dataUrl;
  for (const { maxSide, quality } of COMPRESSION_STEPS) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    compressed = canvas.toDataURL('image/jpeg', quality);
    if (compressed.length <= MAX_STORED_RECEIPT_CHARS) {
      break;
    }
  }

  return compressed;
}
