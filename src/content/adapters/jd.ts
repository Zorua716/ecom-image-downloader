import type { SiteAdapter } from './types'
import { cleanTitle } from './common'

export const jdAdapter: SiteAdapter = {
  id: 'jd',
  label: '京东',
  matches(host) {
    return host === 'jd.com' || host.endsWith('.jd.com')
  },
  isProductPage(_doc, url) {
    if (url.hostname === 'item.jd.com' || url.hostname === 'item.m.jd.com') return true
    return /\/\d{5,}\.html/i.test(url.pathname)
  },
  getProductTitle(doc) {
    const selectors = ['#name h1', '.sku-name', '[class*="sku-name"]', '[class*="itemInfo"] h1', 'h1']
    for (const selector of selectors) {
      const el = doc.querySelector(selector)
      const text = el?.textContent?.trim()
      if (text) return cleanTitle(text)
    }
    return cleanTitle(doc.title)
  }
}
