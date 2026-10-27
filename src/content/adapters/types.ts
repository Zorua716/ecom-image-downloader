import type { SiteId } from '../../shared/types'

export interface SiteAdapter {
  id: SiteId
  label: string
  matches(host: string): boolean
  isProductPage(doc: Document, url: URL): boolean
  getProductTitle(doc: Document, url: URL): string
}
