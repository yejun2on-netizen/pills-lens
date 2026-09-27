/**
 * 휴대폰 사진(수 MB)을 긴 변 1280px JPEG로 줄인다. 업로드와 판독이 빨라진다.
 * 브라우저가 줄이지 못하면(예: 지원하지 않는 형식) 원본을 그대로 돌려준다.
 */
export async function shrinkImage(file: File, maxSide = 1280): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.88),
    );
  } catch {
    return file;
  }
}
