import { detectAdapter } from './adapters'
import { cleanTitle } from './adapters/common'
import { extractImages } from './extractor'
import type { ExtractionResult, RuntimeResponse } from '../shared/types'

const HOST_ID = 'ecom-image-grabber-host'
const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .wrap {
    position: fixed;
    right: 16px;
    bottom: 96px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 11px 18px;
    border: none;
    border-radius: 24px;
    background: linear-gradient(135deg, #4f7cff, #5a5ff0);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(65, 95, 230, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
  }
  button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 9px 24px rgba(65, 95, 230, 0.45); }
  button:active:not(:disabled) { transform: translateY(0); }
  button:disabled { opacity: 0.7; cursor: default; }
  svg { width: 16px; height: 16px; fill: currentColor; flex: none; }
  .toast {
    position: fixed;
    right: 16px;
    bottom: 152px;
    z-index: 2147483647;
    max-width: 280px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(30, 30, 30, 0.94);
    color: #fff;
    font-size: 13px;
    line-height: 1.5;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.error { background: rgba(198, 40, 40, 0.95); }
`

const ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3a1 1 0 0 1 1 1v9.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V4a1 1 0 0 1 1-1z"/>
    <path d="M5 17a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a1 1 0 0 1 1-1z"/>
  </svg>
`

function main(): void {
  let host: HTMLDivElement | null = null
  let button: HTMLButtonElement | null = null
  let label: HTMLSpanElement | null = null
  let toast: HTMLDivElement | null = null
  let running = false
  let toastTimer: number | undefined

  const showToast = (text: string, isError = false): void => {
    const toastEl = toast
    if (!toastEl) return
    toastEl.textContent = text
    toastEl.classList.toggle('error', isError)
    toastEl.classList.add('show')
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 3200)
  }

  const ensureButton = (): void => {
    if (host && document.getElementById(HOST_ID)) return
    host = document.createElement('div')
    host.id = HOST_ID
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="wrap">
        <button type="button">${ICON}<span class="label">获取图片</span></button>
      </div>
      <div class="toast" role="status"></div>
    `
    ;(document.body || document.documentElement).appendChild(host)

    button = shadow.querySelector('button') as HTMLButtonElement
    label = shadow.querySelector('.label') as HTMLSpanElement
    toast = shadow.querySelector('.toast') as HTMLDivElement

    button.addEventListener('click', async () => {
      const url = new URL(location.href)
      const adapter = detectAdapter(url.hostname)
      if (!adapter || running || !button || !label) return
      running = true
      button.disabled = true
      label.textContent = '正在获取…'
      showToast('正在扫描并收集商品图片…')
      try {
        await scrollScan()
        const outcome = extractImages(document, adapter)
        const productTitle = cleanTitle(adapter.getProductTitle(document, url))
        const result: ExtractionResult = {
          version: 1,
          sourceUrl: location.href,
          siteId: adapter.id,
          siteLabel: adapter.label,
          pageTitle: document.title,
          productTitle: productTitle || cleanTitle(document.title),
          extractedAt: Date.now(),
          images: outcome.images,
          ignoredCount: outcome.ignoredCount,
          failedCount: outcome.failedCount
        }
        const response = (await chrome.runtime.sendMessage({
          type: 'SAVE_AND_OPEN_GALLERY',
          result
        })) as RuntimeResponse | undefined
        if (response && response.ok === false) {
          throw new Error(response.error || '无法打开预览页')
        }
        showToast(`已找到 ${outcome.images.length} 张图片，正在打开预览页`)
      } catch (err) {
        showToast('获取失败：' + errorMessage(err), true)
      } finally {
        running = false
        if (button) button.disabled = false
        if (label) label.textContent = '获取图片'
      }
    })
  }

  const sync = (): void => {
    const url = new URL(location.href)
    const adapter = detectAdapter(url.hostname)
    const isProductPage = Boolean(adapter && adapter.isProductPage(document, url))
    if (!isProductPage) {
      if (host) host.style.display = 'none'
      return
    }
    ensureButton()
    if (host) host.style.display = ''
  }

  sync()
  window.setInterval(sync, 1500)
}

function scrollScan(): Promise<void> {
  const maxDuration = 7000
  const stepDelay = 180
  const maxSteps = 80
  const start = Date.now()
  const startY = window.scrollY
  const step = Math.max(200, Math.floor(window.innerHeight * 0.8))

  return (async () => {
    for (let i = 0; i < maxSteps; i++) {
      if (Date.now() - start > maxDuration) break
      window.scrollTo(0, step * (i + 1))
      await sleep(stepDelay)
      const bottom = document.documentElement.scrollHeight
      if (window.scrollY + window.innerHeight >= bottom - 4) break
    }
    await sleep(300)
    window.scrollTo(0, startY)
  })()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

main()
