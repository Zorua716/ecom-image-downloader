import type { SiteAdapter } from './types'
import { taobaoAdapter } from './taobao'
import { jdAdapter } from './jd'
import { pinduoduoAdapter } from './pinduoduo'

const adapters: SiteAdapter[] = [taobaoAdapter, jdAdapter, pinduoduoAdapter]

export function detectAdapter(host: string): SiteAdapter | null {
  return adapters.find((adapter) => adapter.matches(host)) ?? null
}
