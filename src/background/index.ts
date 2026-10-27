import { EXTRACTION_STORAGE_KEY } from '../shared/storage'
import type { ExtractionResult, RuntimeMessage, RuntimeResponse } from '../shared/types'

const pendingBlobUrls = new Map<number, string>()

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'OPEN_GALLERY') {
    openGallery()
      .then(() => sendResponse({ ok: true } satisfies RuntimeResponse))
      .catch((err) => sendResponse({ ok: false, error: errorMessage(err) } satisfies RuntimeResponse))
    return true
  }

  if (message?.type === 'SAVE_AND_OPEN_GALLERY') {
    saveAndOpenGallery(message.result)
      .then(() => sendResponse({ ok: true } satisfies RuntimeResponse))
      .catch((err) => sendResponse({ ok: false, error: errorMessage(err) } satisfies RuntimeResponse))
    return true
  }

  if (message?.type === 'DOWNLOAD_PNG') {
    downloadPng(message.url, message.candidates ?? [message.url], message.filename, message.referrer)
      .then((response) => sendResponse(response))
      .catch((err) => sendResponse({ ok: false, error: errorMessage(err) } satisfies RuntimeResponse))
    return true
  }

  return false
})

async function saveAndOpenGallery(result: ExtractionResult): Promise<void> {
  await chrome.storage.session.set({ [EXTRACTION_STORAGE_KEY]: result })
  await openGallery()
}

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state) return
  if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
    const url = pendingBlobUrls.get(delta.id)
    if (url) {
      URL.revokeObjectURL(url)
      pendingBlobUrls.delete(delta.id)
    }
  }
})

async function openGallery(): Promise<void> {
  const galleryUrl = chrome.runtime.getURL('gallery.html')
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => tab.id != null && tab.url && tab.url.startsWith(galleryUrl))
  if (existing && existing.id != null) {
    await chrome.tabs.update(existing.id, { active: true })
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true })
    }
  } else {
    await chrome.tabs.create({ url: galleryUrl })
  }
}

async function downloadPng(url: string, candidates: string[], filename: string, referrer: string): Promise<RuntimeResponse> {
  const urls = Array.from(new Set([url, ...candidates].filter(Boolean)))
  let lastError = '没有可用的图片地址'

  for (const candidate of urls) {
    try {
      const response = await fetch(candidate, {
        credentials: 'omit',
        cache: 'no-store',
        headers: referrer ? { Referer: referrer } : undefined
      })
      if (!response.ok) {
        lastError = `HTTP ${response.status}`
        continue
      }
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) {
        lastError = '响应不是图片'
        continue
      }

      const pngBlob = await toPng(blob)
      const blobUrl = URL.createObjectURL(pngBlob)
      try {
        const downloadId = await chrome.downloads.download({
          url: blobUrl,
          filename: sanitizeFilename(filename),
          conflictAction: 'uniquify',
          saveAs: false
        })
        scheduleRevoke(blobUrl, downloadId)
        return { ok: true, downloadId }
      } catch (err) {
        URL.revokeObjectURL(blobUrl)
        lastError = errorMessage(err)
      }
    } catch (err) {
      lastError = errorMessage(err)
    }
  }

  return { ok: false, error: lastError }
}

async function toPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布上下文')
    context.drawImage(bitmap, 0, 0)
    return await canvas.convertToBlob({ type: 'image/png' })
  } finally {
    bitmap.close()
  }
}

function scheduleRevoke(url: string, downloadId: number): void {
  pendingBlobUrls.set(downloadId, url)
  setTimeout(() => {
    if (pendingBlobUrls.has(downloadId)) {
      URL.revokeObjectURL(url)
      pendingBlobUrls.delete(downloadId)
    }
  }, 120000)
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 120)
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
