import type { SiteAdapter } from './types'
import { cleanTitle } from './common'

export const taobaoAdapter: SiteAdapter = {
  id: 'taobao',
  label: '淘宝 / 天猫',
  matches(host) {
    return host === 'taobao.com' || host.endsWith('.taobao.com') || host === 'tmall.com' || host.endsWith('.tmall.com')
  },
  isProductPage(_doc, url) {
    return /\/item(?:\/|\.htm)/i.test(url.pathname)
  },
  getProductTitle(doc) {
    const selectors = [
      '[class*="ItemHeader"] h1',
      '.tb-main-title',
      '[class*="mainTitle"]',
      '[class*="itemTitle"]',
      'h1'
    ]
    for (const selector of selectors) {
      const el = doc.querySelector(selector)
      const text = el?.textContent?.trim()
      if (text) return cleanTitle(text)
    }
    return cleanTitle(doc.title)
  }
}
