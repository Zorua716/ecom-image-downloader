export type SiteId = 'taobao' | 'jd' | 'pinduoduo'

export type ImageKind = 'img' | 'background' | 'poster' | 'meta'

export interface ImageItem {
  id: string
  url: string
  candidates: string[]
  width: number
  height: number
  kind: ImageKind
  alt: string
}

export interface ExtractionResult {
  version: 1
  sourceUrl: string
  siteId: SiteId
  siteLabel: string
  pageTitle: string
  productTitle: string
  extractedAt: number
  images: ImageItem[]
  ignoredCount: number
  failedCount: number
}

export type RuntimeMessage =
  | { type: 'OPEN_GALLERY' }
  | { type: 'SAVE_AND_OPEN_GALLERY'; result: ExtractionResult }
  | { type: 'DOWNLOAD_PNG'; url: string; candidates: string[]; filename: string; referrer: string }

export interface RuntimeResponse {
  ok: boolean
  error?: string
  downloadId?: number
}
