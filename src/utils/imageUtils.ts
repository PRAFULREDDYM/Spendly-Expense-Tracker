const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

async function readFileBrand(file: File): Promise<string | null | 'unknown'> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const marker = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (marker !== 'ftyp') {
      return null;
    }

    return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
  } catch {
    return 'unknown';
  }
}

/**
 * Detects if a file is HEIC regardless of file extension or MIME type.
 * iOS sometimes sends HEIC files with type "image/heic", "image/heif",
 * or even blank type, so we also inspect the container header.
 */
async function isHeicFile(file: File): Promise<boolean> {
  const lowerName = file.name.toLowerCase();
  const mimeSuggestsHeic = file.type === 'image/heic' || file.type === 'image/heif';
  const extensionSuggestsHeic = lowerName.endsWith('.heic') || lowerName.endsWith('.heif');
  const brand = await readFileBrand(file);

  if (brand && brand !== 'unknown' && HEIC_BRANDS.has(brand)) {
    return true;
  }

  if (mimeSuggestsHeic || extensionSuggestsHeic) {
    return brand === 'unknown';
  }

  return false;
}

/**
 * Resizes an image to fit within maxDimension × maxDimension
 * using a canvas element. Returns a new JPEG File.
 */
async function resizeImage(file: File, maxDimension: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Image resize failed.'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }

          const nextName = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], nextName, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

export async function normalizeImageFile(file: File): Promise<File> {
  const isHeic = await isHeicFile(file);

  if (isHeic) {
    try {
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      }) as Blob | Blob[];
      const blob = Array.isArray(converted) ? converted[0] : converted;
      const jpegFile = new File(
        [blob],
        file.name.replace(/\.(heic|heif)$/i, '.jpg'),
        { type: 'image/jpeg', lastModified: Date.now() },
      );

      return resizeImage(jpegFile, 1200, 0.85);
    } catch (conversionError) {
      console.error('HEIC conversion failed:', {
        conversionError,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      throw new Error('Could not convert this HEIC image. Please try another photo or export it as JPEG.');
    }
  }

  if (file.size > 2 * 1024 * 1024) {
    return resizeImage(file, 1200, 0.85);
  }

  return file;
}
