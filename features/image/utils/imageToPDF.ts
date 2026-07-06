import { PDFDocument } from 'pdf-lib'

/**
 * Convert a list of image files into a single PDF document.
 * Each image becomes one page. Non-JPEG/PNG formats are auto-converted via Canvas.
 *
 * @returns The PDF as a Uint8Array ready for download.
 */
export async function convertImagesToPDF(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length)
    const file = files[i]
    const imageBytes = await file.arrayBuffer()

    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      const image = await pdfDoc.embedJpg(imageBytes)
      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    } else if (file.type === 'image/png') {
      const image = await pdfDoc.embedPng(imageBytes)
      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    } else {
      // WebP, GIF, SVG, BMP → convert to PNG via Canvas
      const { pngBytes, width, height } = await fileToPngData(file)
      const image = await pdfDoc.embedPng(pngBytes)
      const page = pdfDoc.addPage([width, height])
      page.drawImage(image, { x: 0, y: 0, width, height })
    }
  }

  return await pdfDoc.save()
}

/** Render any image format onto a Canvas and extract PNG bytes + dimensions. */
async function fileToPngData(file: File): Promise<{ pngBytes: Uint8Array; width: number; height: number }> {
  const img = new Image()
  const url = URL.createObjectURL(file)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!

  // Fill white for formats that may have transparency
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)

  URL.revokeObjectURL(url)

  const pngDataUrl = canvas.toDataURL('image/png')
  const base64 = pngDataUrl.split(',')[1]
  const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

  return { pngBytes, width: canvas.width, height: canvas.height }
}
