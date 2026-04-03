export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Could not read the selected file.'));
    };

    reader.onerror = () => {
      reject(new Error('Could not read the selected file.'));
    };

    reader.readAsDataURL(file);
  });
}
