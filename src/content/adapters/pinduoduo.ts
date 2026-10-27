import type { SiteAdapter } from './types'
import { cleanTitle } from './common'

export const pinduoduoAdapter: SiteAdapter = {
  id: 'pinduoduo',
  label: '拼多多商家版',
  matches(host) {
    return (
      host === 'pinduoduo.com' ||
      host.endsWith('.pinduoduo.com') ||
      host === 'yangkeduo.com' ||
      host.endsWith('.yangkeduo.com')
    )
  },
  isProductPage(_doc, url) {
    if (/\/goods(?:\.html)?/i.test(url.pathname)) return true
    if (url.hostname === 'mms.pinduoduo.com') {
      return /goods|product|spu|sku|detail/i.test(url.pathname)
    }
    return false
  },
  getProductTitle(doc) {
    const selectors = ['.goods-name', '[class*="goods-name"]', '[class*="goodsName"]', '[class*="goods-title"]', 'h1']
    for (const selector of selectors) {
      const el = doc.querySelector(selector)
      const text = el?.textContent?.trim()
      if (text) return cleanTitle(text)
    }
    return cleanTitle(doc.title)
  }
}
