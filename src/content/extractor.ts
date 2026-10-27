import type { ImageItem, ImageKind } from '../shared/types'
import {
  absolutize,
  cleanForDownload,
  dedupeKey,
  dedupeStrings,
  isProbablyImageUrl,
  parseSrcset
} from '../shared/image-url'
import type { SiteAdapter } from './adapters/types'

interface RawEntry {
  url: string
  kind: ImageKind
  width: number
  height: number
  alt: string
}

const JUNK_WORD_RE = /(icon|logo|sprite|avatar|emoji|favicon|spacer|blank|placeholder|pixel)/i
const JUNK_FILE_RE = /(?:spacer|blank|pixel|transparent|loading)\.(?:gif|png|jpe?g|webp)$/i

export interface ExtractionOutcome {
  images: ImageItem[]
  ignoredCount: number
  failedCount: number
}

export function extractImages(doc: Document, adapter: SiteAdapter): ExtractionOutcome {
  const base = doc.baseURI || doc.URL || location.href
  const entries: RawEntry[] = []
  let failedCount = 0

  const push = (raw: string, kind: ImageKind, width = 0, height = 0, alt = ''): void => {
    const url = absolutize(raw, base)
    if (!url || !isProbablyImageUrl(url)) return
    entries.push({ url, kind, width, height, alt })
  }

  for (const img of Array.from(doc.images)) {
    const el = img as HTMLImageElement
    const width = el.naturalWidth || Number(el.getAttribute('width') || 0) || 0
    const height = el.naturalHeight || Number(el.getAttribute('height') || 0) || 0
    const alt = el.getAttribute('alt') || el.getAttribute('title') || ''
    const before = entries.length

    const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset')
    if (srcset) {
      for (const item of parseSrcset(srcset, base)) {
        push(item.url, 'img', item.width || width, height, alt)
      }
    }

    for (const attr of ['data-src', 'data-lazy-src', 'data-original', 'data-ks-lazyload', 'data-actualsrc', 'data-hi-res-src', 'data-zoom-image']) {
      const value = el.getAttribute(attr)
      if (value) push(value, 'img', width, height, alt)
    }

    if (el.currentSrc) push(el.currentSrc, 'img', width, height, alt)
    if (el.src) push(el.src, 'img', width, height, alt)

    const hadSource = Boolean(
      el.getAttribute('src') ||
        el.getAttribute('srcset') ||
        el.getAttribute('data-src') ||
        el.getAttribute('data-original') ||
        el.currentSrc
    )
    if (hadSource && entries.length === before) failedCount++
  }

  for (const source of Array.from(doc.querySelectorAll('picture source'))) {
    const srcset = source.getAttribute('srcset')
    if (srcset) {
      for (const item of parseSrcset(srcset, base)) {
        push(item.url, 'img', item.width, 0)
      }
    }
  }

  for (const video of Array.from(doc.querySelectorAll('video[poster]'))) {
    const poster = video.getAttribute('poster')
    if (poster) push(poster, 'poster', 0, 0)
  }

  for (const meta of Array.from(doc.querySelectorAll('meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"]'))) {
    const content = meta.getAttribute('content')
    if (content) push(content, 'meta', 0, 0)
  }

  for (const link of Array.from(doc.querySelectorAll('link[rel="image_src"]'))) {
    const href = link.getAttribute('href')
    if (href) push(href, 'meta', 0, 0)
  }

  // 只对可能带背景图的元素计算样式，避免全量 getComputedStyle 拖慢页面
  const bgNodes = new Set<HTMLElement>()
  const bgSelectors = [
    '[style*="background"]',
    '[class*="bg"]',
    '[class*="Bg"]',
    '[class*="background"]',
    '[class*="Background"]',
    '[class*="banner"]',
    '[class*="Banner"]',
    '[class*="pic"]',
    '[class*="Pic"]',
    '[class*="img"]',
    '[class*="Img"]'
  ]
  for (const selector of bgSelectors) {
    doc.querySelectorAll(selector).forEach((node) => bgNodes.add(node as HTMLElement))
  }
  for (const node of bgNodes) {
    const style = getComputedStyle(node)
    const background = style.backgroundImage
    if (!background || background === 'none') continue
    for (const match of background.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
      if (match[2]) push(match[2], 'background', node.clientWidth || 0, node.clientHeight || 0)
    }
  }

  const seen = new Set<string>()
  const images: ImageItem[] = []
  let ignoredCount = 0
  let index = 0

  for (const entry of entries) {
    const key = dedupeKey(entry.url, adapter.id)
    if (seen.has(key)) continue
    seen.add(key)

    if (isJunk(entry)) {
      ignoredCount++
      continue
    }

    const cleaned = cleanForDownload(entry.url, adapter.id)
    images.push({
      id: `img-${index++}`,
      url: entry.url,
      candidates: dedupeStrings([cleaned, entry.url]),
      width: entry.width,
      height: entry.height,
      kind: entry.kind,
      alt: entry.alt
    })
  }

  return { images, ignoredCount, failedCount }
}

function isJunk(entry: RawEntry): boolean {
  if (entry.width === 1 && entry.height === 1) return true
  if (entry.width > 0 && entry.height > 0 && entry.width <= 40 && entry.height <= 40) {
    if (JUNK_WORD_RE.test(entry.url)) return true
  }
  if (JUNK_WORD_RE.test(entry.url) || JUNK_FILE_RE.test(entry.url)) return true
  return false
}
