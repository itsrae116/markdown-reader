<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import { getHistory, saveHistory } from '@/services/localStorageService'
import { isMarkdownFile, readMarkdownFile, readMarkdownFolder } from '@/services/localDocumentService'
import { mockHistory } from '@/mocks/documents'
import type { DocumentItem, HistoryItem } from '@/types/document'

const router = useRouter()
const store = useAppStore()
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const errorMessage = ref('')
const isDragging = ref(false)
const recentRecords = computed(() => (store.history.length > 0 ? store.history : mockHistory).slice(0, 5))

onMounted(() => {
  store.setHistory(getHistory())
})

async function handleDrop(event: DragEvent) {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  const markdownFile = files.find((file) => isMarkdownFile(file.name))

  if (!markdownFile) {
    errorMessage.value = '仅支持 .md 或 .markdown 文件'
    return
  }

  await openDocument(await readMarkdownFile(markdownFile))
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file || !isMarkdownFile(file.name)) {
    errorMessage.value = '仅支持 .md 或 .markdown 文件'
    input.value = ''
    return
  }

  const document = await readMarkdownFile(file)
  input.value = ''
  await openDocument(document)
}

async function handleFolderSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])

  if (!files || files.length === 0) return

  const library = await readMarkdownFolder(files)
  input.value = ''
  if (library.documents.length === 0) {
    errorMessage.value = '未找到 Markdown 文档'
    return
  }

  store.setLibrary(library.documents, library.tree)
  await openDocument(library.documents[0])
}

async function openRecent(record: HistoryItem) {
  const document = store.documents.find((item) => item.id === record.document_id)

  if (document) {
    await openDocument(document)
    return
  }

  errorMessage.value = '最近记录需要重新授权本地文件后打开'
}

async function openDocument(document: DocumentItem) {
  errorMessage.value = ''
  store.setCurrentDocument(document)
  const nextHistory = [
    createHistoryItem(document),
    ...store.history.filter((item) => item.document_id !== document.id)
  ].slice(0, 5)
  store.setHistory(nextHistory)
  saveHistory(nextHistory)
  await router.push('/workspace')
}

function createHistoryItem(document: DocumentItem): HistoryItem {
  return {
    id: `history_${document.id}`,
    document_id: document.id,
    name: document.name,
    path: document.path,
    source_type: document.type,
    last_opened_at: new Date().toISOString(),
    scroll_position: 0
  }
}
</script>

<template>
  <main class="start-page">
    <section
      class="drop-zone"
      :class="{ 'is-dragging': isDragging }"
      aria-label="打开 Markdown 文档"
      @dragenter.prevent="isDragging = true"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <header class="start-header">
        <h1>Markdown Reader</h1>
        <p>打开文件夹，开始阅读整个知识库</p>
      </header>
      <div class="drop-icon" aria-hidden="true">⇧</div>
      <p class="drop-label">拖入 Markdown 文档</p>
      <div class="actions">
        <button type="button" @click="folderInput?.click()">打开知识文件夹</button>
        <button type="button" class="secondary" @click="fileInput?.click()">选择 Markdown 文档</button>
      </div>
      <input
        ref="folderInput"
        class="sr-only"
        type="file"
        webkitdirectory
        multiple
        @change="handleFolderSelect"
      />
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".md,.markdown"
        @change="handleFileSelect"
      />
      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    </section>

    <section class="recent" aria-label="最近记录">
      <div class="recent-header">
        <h2>最近记录</h2>
        <span>最多显示 5 条</span>
      </div>
      <button
        v-for="record in recentRecords"
        :key="record.id"
        type="button"
        class="recent-item"
        @click="openRecent(record)"
      >
        <span>{{ record.name }}</span>
        <small>{{ record.path }}</small>
      </button>
    </section>
    <p class="privacy">内容只在本机读取。阅读位置、高亮、划线和批注会留在当前浏览器，原始文件不会被修改。</p>
  </main>
</template>

<style scoped>
.start-page {
  min-height: 100vh;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 28px;
  padding: 44px 24px 28px;
  background: #f6f3ee;
}

.drop-zone {
  width: min(920px, 100%);
  min-height: 560px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 22px;
  padding: 38px 56px 56px;
  text-align: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.drop-zone.is-dragging {
  background: color-mix(in srgb, var(--color-primary-strong) 5%, transparent);
}

.start-header {
  display: grid;
  gap: 8px;
  margin-bottom: 18px;
}

.start-header p,
.privacy,
.drop-label {
  margin: 0;
  color: var(--color-text-soft);
}

.start-header p {
  font-size: 20px;
}

.error {
  margin: 0;
  color: #b42318;
  font-weight: 600;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(44px, 7vw, 76px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: 0;
  color: var(--color-ink);
}

.drop-icon {
  width: 48px;
  height: 56px;
  display: grid;
  place-items: center;
  margin-top: 28px;
  color: #737686;
  font-size: 34px;
  font-weight: 700;
  border: 4px solid #737686;
  border-radius: 6px;
}

.drop-label {
  width: min(920px, 100%);
  min-height: 300px;
  display: grid;
  place-items: center;
  margin-top: -86px;
  padding-top: 86px;
  color: #434655;
  font-weight: 600;
  border: 2px dashed #c3c6d7;
  border-radius: 8px;
  background: color-mix(in srgb, #fbf8fc 74%, transparent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 0;
}

button {
  min-height: 44px;
  padding: 0 28px;
  border-radius: 8px;
  color: #fff;
  background: var(--color-ink);
  font-weight: 700;
}

.secondary {
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-outline);
}

.recent {
  width: min(580px, 100%);
  display: grid;
  gap: 4px;
  padding-top: 28px;
  border-top: 1px solid color-mix(in srgb, var(--color-outline) 70%, transparent);
}

.recent-header {
  display: grid;
  justify-items: center;
  color: var(--color-text-soft);
}

.recent h2 {
  margin: 0 0 14px;
  font-size: 14px;
  letter-spacing: 0;
  color: var(--color-text-soft);
}

.recent-header span {
  display: none;
}

.recent-item {
  width: 100%;
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  border-radius: 8px;
}

.recent-item:hover {
  background: color-mix(in srgb, var(--color-surface-muted) 70%, transparent);
}

.recent-item small {
  color: var(--color-text-soft);
}

.privacy {
  max-width: 760px;
  text-align: center;
  font-size: 13px;
  opacity: 0.72;
}
</style>
