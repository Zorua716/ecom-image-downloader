<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ExtractionResult, ImageKind, RuntimeResponse } from '../shared/types'
import { EXTRACTION_STORAGE_KEY } from '../shared/storage'

const result = ref<ExtractionResult | null>(null)
const loading = ref(true)
const selected = ref<Set<string>>(new Set())
const downloading = ref(false)
const progress = reactive({ done: 0, total: 0 })
const errors = ref<string[]>([])
const notice = ref('')
const previewIndex = ref<number | null>(null)

const images = computed(() => result.value?.images ?? [])
const selectedCount = computed(() => selected.value.size)
const currentImage = computed(() => {
  if (previewIndex.value === null) return null
  return images.value[previewIndex.value] ?? null
})

onMounted(async () => {
  try {
    const data = await chrome.storage.session.get(EXTRACTION_STORAGE_KEY)
    const value = data?.[EXTRACTION_STORAGE_KEY]
    if (value && value.version === 1 && Array.isArray(value.images)) {
      result.value = value as ExtractionResult
    }
  } catch (err) {
    errors.value = ['读取提取结果失败：' + errorMessage(err)]
  } finally {
    loading.value = false
  }
})

function toggle(id: string): void {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function selectAll(): void {
  selected.value = new Set(images.value.map((item) => item.id))
}

function clearSelection(): void {
  selected.value = new Set()
}

function openPreview(index: number): void {
  previewIndex.value = index
}

function closePreview(): void {
  previewIndex.value = null
}

function stepPreview(delta: number): void {
  if (previewIndex.value === null || images.value.length === 0) return
  const length = images.value.length
  previewIndex.value = (((previewIndex.value + delta) % length) + length) % length
}

function onImgError(event: Event): void {
  const el = event.currentTarget as HTMLImageElement
  el.style.opacity = '0.22'
  el.alt = '图片加载失败'
}

function kindLabel(kind: ImageKind): string {
  switch (kind) {
    case 'background':
      return '背景图'
    case 'poster':
      return '视频封面'
    case 'meta':
      return '页面图'
    default:
      return '图片'
  }
}

function sanitize(name: string): string {
  const clean = (name || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim()
  return clean.slice(0, 80) || '商品图片'
}

async function downloadSelected(): Promise<void> {
  if (downloading.value || !result.value) return
  const chosen = images.value.filter((item) => selected.value.has(item.id))
  if (chosen.length === 0) return

  downloading.value = true
  errors.value = []
  notice.value = ''
  progress.done = 0
  progress.total = chosen.length
  const title = sanitize(result.value.productTitle || result.value.pageTitle || '商品图片')

  let success = 0
  let failed = 0
  for (let i = 0; i < chosen.length; i++) {
    const item = chosen[i]
    const filename = `${title}_${String(i + 1).padStart(3, '0')}.png`
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_PNG',
        url: item.url,
        candidates: item.candidates ?? [item.url],
        filename,
        referrer: result.value.sourceUrl
      })) as RuntimeResponse | undefined
      if (response && response.ok) {
        success++
      } else {
        failed++
        errors.value.push(`${filename}：${response?.error || '下载失败'}`)
      }
    } catch (err) {
      failed++
      errors.value.push(`${filename}：${errorMessage(err)}`)
    }
    progress.done = i + 1
  }

  downloading.value = false
  notice.value = `下载完成：成功 ${success} 张${failed ? `，失败 ${failed} 张` : ''}`
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span class="mark">⬇</span>
        <div class="brand-text">
          <h1>电商图片提取下载助手</h1>
          <p v-if="result">{{ result.siteLabel }} · {{ result.pageTitle }} · 共 {{ images.length }} 张</p>
          <p v-else>预览并下载商品图片</p>
        </div>
      </div>
      <div class="actions">
        <a v-if="result" class="btn ghost" :href="result.sourceUrl" target="_blank" rel="noreferrer">打开来源页</a>
        <button class="btn ghost" :disabled="!images.length || downloading" @click="selectAll">全选</button>
        <button class="btn ghost" :disabled="!selectedCount || downloading" @click="clearSelection">取消全选</button>
        <button class="btn primary" :disabled="!selectedCount || downloading" @click="downloadSelected">
          {{ downloading ? `下载中 ${progress.done}/${progress.total}` : `下载所选 (${selectedCount})` }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="state">正在读取提取结果…</div>

    <div v-else-if="!result || !images.length" class="state">
      <div class="state-icon">🖼️</div>
      <p>暂无图片数据</p>
      <p class="muted">请到淘宝、京东或拼多多商家版的商品详情页，点击右下角的“获取图片”按钮。</p>
    </div>

    <template v-else>
      <div v-if="notice" class="notice">{{ notice }}</div>

      <div v-if="errors.length" class="errors">
        <div class="errors-title">有 {{ errors.length }} 张图片处理失败</div>
        <ul>
          <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
        </ul>
      </div>

      <main class="grid">
        <div
          v-for="(img, index) in images"
          :key="img.id"
          class="card"
          :class="{ selected: selected.has(img.id) }"
        >
          <label class="check">
            <input type="checkbox" :checked="selected.has(img.id)" @change="toggle(img.id)" />
          </label>
          <button class="thumb" type="button" @click="openPreview(index)">
            <img :src="img.url" :alt="img.alt" loading="lazy" @error="onImgError" />
          </button>
          <div class="meta">
            <span class="size">{{ img.width && img.height ? `${img.width} × ${img.height}` : '尺寸未知' }}</span>
            <span class="kind">{{ kindLabel(img.kind) }}</span>
          </div>
        </div>
      </main>
    </template>

    <div v-if="currentImage" class="lightbox" @click.self="closePreview">
      <button class="nav prev" type="button" @click="stepPreview(-1)" aria-label="上一张">‹</button>
      <figure>
        <img :src="currentImage.url" :alt="currentImage.alt" />
        <figcaption>{{ (previewIndex ?? 0) + 1 }} / {{ images.length }}</figcaption>
      </figure>
      <button class="nav next" type="button" @click="stepPreview(1)" aria-label="下一张">›</button>
      <button class="close" type="button" @click="closePreview" aria-label="关闭">×</button>
    </div>
  </div>
</template>
