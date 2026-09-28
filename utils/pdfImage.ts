/**
 * Минимальный PDF из одной JPEG-картинки на весь лист (без внешних библиотек):
 * JPEG встраивается как есть (/DCTDecode), страница — размер листа в пунктах.
 */

const MM_TO_PT = 72 / 25.4

function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

export function jpegToPdf(
  jpeg: Uint8Array,
  imageWidthPx: number,
  imageHeightPx: number,
  pageWidthMm: number,
  pageHeightMm: number,
): Uint8Array {
  const w = (pageWidthMm * MM_TO_PT).toFixed(2)
  const h = (pageHeightMm * MM_TO_PT).toFixed(2)
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (chunk: Uint8Array) => {
    parts.push(chunk)
    length += chunk.length
  }
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = length
    push(ascii(`${n} 0 obj\n${body}\n`))
    if (stream) {
      push(ascii('stream\n'))
      push(stream)
      push(ascii('\nendstream\n'))
    }
    push(ascii('endobj\n'))
  }

  push(ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'))
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
  )
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${imageWidthPx} /Height ${imageHeightPx} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg,
  )
  obj(5, `<< /Length ${content.length} >>`, ascii(content))
  obj(6, '<< /Producer (TGID web) >>')

  const xrefAt = length
  let xref = 'xref\n0 7\n0000000000 65535 f \n'
  for (let n = 1; n <= 6; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  push(ascii(xref))
  push(ascii(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`))

  const out = new Uint8Array(length)
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

/** dataURL (base64) → байты */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
