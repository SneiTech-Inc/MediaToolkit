import html2canvas from 'html2canvas-pro'
import { PDFDocument } from 'pdf-lib'

export interface MarkdownToPDFOptions {
  pageSize: 'A4' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  theme: 'light' | 'dark' | 'sepia'
  fontSize: 'small' | 'medium' | 'large'
}

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89], Letter: [612, 792], Legal: [612, 1008],
}

const FONT_SIZE_MAP = { small: 14, medium: 16, large: 20 }

const THEME_CSS: Record<string, string> = {
  light: 'body{color:#1a1a2e;background:#fff}a{color:#2563eb}blockquote{border-left:3px solid #ddd;color:#666;padding-left:1em}',
  dark: 'body{color:#e0e0e0;background:#1a1a2e}a{color:#60a5fa}blockquote{border-left:3px solid #444;color:#999;padding-left:1em}',
  sepia: 'body{color:#5b4636;background:#f4ecd8}a{color:#8b4513}blockquote{border-left:3px solid #c4a882;color:#7a6a5a;padding-left:1em}',
}

export async function convertMarkdownToPDF(md: string, options: MarkdownToPDFOptions): Promise<Uint8Array> {
  const { marked } = await import('marked')
  const html = marked.parse(md) as string

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '800px'
  container.style.padding = '40px'
  container.style.background = options.theme === 'dark' ? '#1a1a2e' : options.theme === 'sepia' ? '#f4ecd8' : '#ffffff'
  container.style.fontFamily = 'system-ui, sans-serif'

  const fontSize = FONT_SIZE_MAP[options.fontSize]
  container.innerHTML = `<style>
    *{box-sizing:border-box;line-height:1.7;font-size:${fontSize}px}
    ${THEME_CSS[options.theme]}
    h1{font-size:${fontSize * 2}px;margin:0.67em 0;border-bottom:2px solid #ddd;padding-bottom:0.3em}
    h2{font-size:${fontSize * 1.5}px;margin:0.75em 0}
    h3{font-size:${fontSize * 1.17}px;margin:0.83em 0}
    pre{background:rgba(0,0,0,0.05);padding:16px;border-radius:6px;overflow-x:auto}
    code{font-family:monospace;background:rgba(0,0,0,0.05);padding:2px 4px;border-radius:3px}
    pre code{background:0;padding:0}
    table{border-collapse:collapse;width:100%;margin:1em 0}
    th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
    th{background:rgba(0,0,0,0.03);font-weight:600}
    img{max-width:100%}
    ul,ol{padding-left:2em}
    li{margin:0.25em 0}
    hr{border:0;border-top:1px solid #ddd;margin:2em 0}
    input[type=checkbox]{margin-right:0.5em}
  </style>${html}`

  document.body.appendChild(container)

  const canvas = await html2canvas(container, {
    scale: 2, useCORS: true, logging: false,
    backgroundColor: options.theme === 'dark' ? '#1a1a2e' : options.theme === 'sepia' ? '#f4ecd8' : '#ffffff',
    width: 800, height: container.scrollHeight,
  })
  container.remove()

  let [pw, ph] = PAGE_SIZES[options.pageSize]
  if (options.orientation === 'landscape') [pw, ph] = [ph, pw]

  const pdfDoc = await PDFDocument.create()
  const pageHpx = (ph / 72) * 96

  for (let i = 0; i < Math.ceil(canvas.height / pageHpx); i++) {
    const yOff = i * pageHpx
    const cropH = Math.min(pageHpx, canvas.height - yOff)
    const pc = document.createElement('canvas')
    pc.width = 1600; pc.height = cropH * 2
    pc.getContext('2d')!.drawImage(canvas, 0, yOff * 2, 1600, cropH * 2, 0, 0, 1600, cropH * 2)
    const imgBytes = await (await fetch(pc.toDataURL('image/jpeg', 0.92))).arrayBuffer()
    const img = await pdfDoc.embedJpg(imgBytes)
    const page = pdfDoc.addPage([pw, ph])
    page.drawImage(img, { x: 0, y: ph - cropH * (pw / 800), width: pw, height: cropH * (pw / 800) })
    pc.remove()
  }
  canvas.remove()
  return await pdfDoc.save()
}
