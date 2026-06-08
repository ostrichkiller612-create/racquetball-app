import * as pdfjsLib from 'pdfjs-dist'
// Vite-native worker URL. Bundled into the output.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Reads a PDF file and returns one string per page (concatenated text content).
 * pdfjs-dist returns text items in document order; we join with spaces.
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
