/**
 * Crop a base64 JPEG by a normalized region (0-1). Returns base64 JPEG (no data: prefix).
 */
export function cropImageByRegion(
  imageBase64: string,
  region: { x: number; y: number; width: number; height: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.width
      const h = img.height
      const x = Math.floor(region.x * w)
      const y = Math.floor(region.y * h)
      const cw = Math.max(1, Math.floor(region.width * w))
      const ch = Math.max(1, Math.floor(region.height * h))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, x, y, cw, ch, 0, 0, cw, ch)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      resolve(dataUrl.split(',')[1] ?? '')
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = `data:image/jpeg;base64,${imageBase64}`
  })
}
