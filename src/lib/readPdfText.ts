import * as pdfjsLib from 'pdfjs-dist'
// Vite-native worker import: gives us a constructor for a real Web Worker.
// This is more reliable on Vercel than `?url` because it avoids cross-origin
// module-script issues.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

/**
 * Reads a PDF file and returns one string per page (concatenated text content).
 */
export async function readPdfText(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }
  return pages
}
