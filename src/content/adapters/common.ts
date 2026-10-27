const SHOP_KEYWORD_RE = /淘宝|天猫|京东|拼多多|商城|旗舰店|专卖店|网店|官方/

export function cleanTitle(raw: string): string {
  if (!raw) return ''
  const text = raw.replace(/\s+/g, ' ').trim()
  const parts = text.split(/\s+[-—–_|·]\s+/)
  let result = parts[0] || text
  for (let i = parts.length - 1; i >= 1; i--) {
    if (SHOP_KEYWORD_RE.test(parts[i])) {
      result = parts.slice(0, i).join(' ')
      break
    }
  }
  return result.trim() || text
}
