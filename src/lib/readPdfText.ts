import * as pdfjsLib from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

/**
 * Reads a PDF file and returns one string per page.
 *
 * Reconstructs visual lines from pdfjs's positional output so that
 * downstream parsers (roster + schedule) can rely on `\n` separating
 * actual rows. Without this, table cells from different rows get
 * concatenated in document order and the parsers see e.g.
 * "Pat Smith 480-3577 14-May 21-May 28-May ..." as one mess.
 */
export async function readPdfText(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(reconstructLines(content.items))
  }
  return pages
}

type Item = { transform: number[]; str: string }

// Group text items by Y coordinate, sort each group by X, join with spaces.
// Lines themselves are emitted top-to-bottom.
function reconstructLines(items: unknown[]): string {
  const lines = new Map<number, Array<{ x: number; str: string }>>()
  for (const raw of items) {
    if (!isItem(raw)) continue
    if (!raw.str) continue
    const x = raw.transform[4]
    // PDF y-coords increase upward; round to merge slightly-off items on
    // the same visual row.
    const y = Math.round(raw.transform[5])
    let bucket = lines.get(y)
    if (!bucket) {
      bucket = []
      lines.set(y, bucket)
    }
    bucket.push({ x, str: raw.str })
  }
  return Array.from(lines.entries())
    .sort((a, b) => b[0] - a[0]) // descending Y = top to bottom
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
}

function isItem(x: unknown): x is Item {
  if (!x || typeof x !== 'object') return false
  const obj = x as Record<string, unknown>
  return Array.isArray(obj.transform) && typeof obj.str === 'string'
}
