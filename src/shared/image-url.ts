import type { SiteId } from './types'

const PROCESS_QUERY_KEYS = [
  'x-oss-process',
  'imagemogr2',
  'imageview2',
  'thumbnail',
  'resize',
  'zoom',
  'quality',
  'format',
  'interlace',
  'watermark',
  'crop',
  'gravity',
  'rotate'
]

const IMAGE_PATH_RE = /\.(jpe?g|png|webp|gif|bmp|avif|svg|dpg|ico)(?:[?#].*)?$/i
const CDN_HOST_RE = /(alicdn|taobaocdn|360buyimg|pddpic|pinduoduo|yangkeduo)/i

export function absolutize(raw: string, base?: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.startsWith('data:')) return null
  try {
    const url = base ? new URL(trimmed, base) : new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

export function isProbablyImageUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    if (IMAGE_PATH_RE.test(u.pathname)) return true
    return CDN_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

export function parseSrcset(srcset: string, base?: string): { url: string; width: number }[] {
  const out: { url: string; width: number }[] = []
  if (!srcset) return out
  for (const part of srcset.split(',')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const raw = tokens[0]
    let width = 0
    for (let i = 1; i < tokens.length; i++) {
      const m = /^(\d+(?:\.\d+)?)w$/.exec(tokens[i])
      if (m) width = Number(m[1])
    }
    const url = absolutize(raw, base)
    if (url) out.push({ url, width })
  }
  return out.sort((a, b) => b.width - a.width)
}

export function cleanForDownload(url: string, siteId: SiteId): string {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }

  const host = u.hostname.toLowerCase()
  let path = u.pathname

  if (host.includes('alicdn.com') || host.includes('taobaocdn.com')) {
    path = path.replace(/_.(?:webp|avif)$/i, '')
    path = path.replace(/_(?:\d{1,5})x(?:\d{1,5})(?:[a-zA-Z0-9_.-]*)?\.(?:jpe?g|png|webp|gif|bmp)$/i, '')
    u.search = ''
  } else if (host.includes('360buyimg.com') || host.includes('jd.com')) {
    path = path.replace(/!(?:q\d+|s\d+x\d+|w\d+|f\d+)(?:\.(?:jpe?g|png|webp|dpg|avif))?$/i, '')
    path = path.replace(/\.dpg$/i, '')
    u.search = ''
  } else {
    stripProcessingQuery(u)
  }

  u.pathname = path
  return u.toString()
}

function stripProcessingQuery(u: URL): void {
  if (!u.search) return
  const pairs: [string, string][] = []
  for (const [key, value] of u.searchParams) {
    const lower = key.toLowerCase()
    if (PROCESS_QUERY_KEYS.some((p) => lower.includes(p))) continue
    pairs.push([key, value])
  }
  u.search = pairs.length ? '?' + new URLSearchParams(pairs).toString() : ''
}

export function dedupeKey(url: string, siteId: SiteId): string {
  const cleaned = cleanForDownload(url, siteId)
  try {
    const u = new URL(cleaned)
    return u.hostname + u.pathname + u.search
  } catch {
    return cleaned
  }
}

export function dedupeStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}
