<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import { searchCurrentDocument, searchDocuments } from '@/services/searchService'
import type { DocumentItem, SearchResult, SearchScope } from '@/types/document'

interface ResultGroup {
  document_id: string
  document_name: string
  path: string
  items: SearchResult[]
}

const router = useRouter()
const store = useAppStore()
const keyword = ref('')
const searchScope = ref<SearchScope>('current_document')

const searchResults = computed(() => {
  if (!keyword.value.trim()) return []
  if (searchScope.value === 'current_document') {
    return store.currentDocument ? searchCurrentDocument(store.currentDocument, keyword.value) : []
  }
  return searchDocuments(store.documents, keyword.value)
})

const groupedResults = computed<ResultGroup[]>(() => {
  const groups = new Map<string, ResultGroup>()
  for (const result of searchResults.value) {
    if (!groups.has(result.document_id)) {
      groups.set(result.document_id, {
        document_id: result.document_id,
        document_name: result.document_name,
        path: result.path,
        items: []
      })
    }
    groups.get(result.document_id)?.items.push(result)
  }
  return Array.from(groups.values())
})

const hasSearched = computed(() => keyword.value.trim().length > 0)

async function handleResultClick(result: SearchResult) {
  const document = store.documents.find((item) => item.id === result.document_id)
  if (document) {
    store.setCurrentDocument(document as DocumentItem)
  }
  store.setCurrentSearchPosition(result.position)
  await router.push('/workspace')
}
</script>

<template>
  <main class="search-page">
    <nav class="app-rail" aria-label="主导航">
      <RouterLink class="rail-logo rail-link" to="/" aria-label="返回启动页">M</RouterLink>
      <RouterLink class="rail-link" to="/workspace" title="阅读工作台">▤</RouterLink>
      <RouterLink class="rail-link router-link-active" to="/search" title="搜索">⌕</RouterLink>
      <button class="rail-button" type="button" title="历史">↺</button>
      <RouterLink class="rail-link rail-bottom" to="/settings" title="设置">⚙</RouterLink>
    </nav>
    <RouterLink class="search-close" to="/workspace" aria-label="关闭搜索">×</RouterLink>
    <section class="search-drawer" aria-label="搜索结果视图">
      <header>
        <p>不离开阅读工作台</p>
        <h1>搜索文档</h1>
      </header>

      <div class="search-controls">
        <input v-model="keyword" aria-label="搜索关键词" placeholder="搜索当前文档或文档库" />
        <div class="scope-control" aria-label="搜索范围">
          <button
            type="button"
            :class="{ active: searchScope === 'current_document' }"
            @click="searchScope = 'current_document'"
          >
            当前文档
          </button>
          <button
            type="button"
            :class="{ active: searchScope === 'library' }"
            @click="searchScope = 'library'"
          >
            文档库
          </button>
        </div>
      </div>

      <section v-for="group in groupedResults" :key="group.document_id" class="result-group">
        <h2>{{ group.document_name }}</h2>
        <p>{{ group.path }}</p>
        <button
          v-for="result in group.items"
          :key="`${result.document_id}-${result.position}`"
          type="button"
          class="result-item"
          @click="handleResultClick(result)"
        >
          <span>命中片段</span>
          <strong v-html="result.snippet"></strong>
          <small>位置 {{ result.position }}</small>
        </button>
      </section>

      <section v-if="hasSearched && groupedResults.length === 0" class="empty-state">
        <h2>无匹配结果</h2>
        <p>换个关键词，或切换当前文档 / 文档库范围。</p>
      </section>

      <section class="library-hint">
        <h2>文档库目录</h2>
        <p>搜索会遍历当前已授权的 Markdown 文档，不访问未授权目录。</p>
      </section>
    </section>
    <div class="workspace-dim" aria-hidden="true"></div>
  </main>
</template>

<style scoped>
.search-page {
  min-height: 100vh;
  padding-left: var(--rail-width);
  background: var(--color-background);
  overflow: hidden;
}

.search-drawer {
  position: relative;
  z-index: 3;
  width: min(400px, calc(100vw - var(--rail-width)));
  min-height: 100vh;
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 28px 28px 96px;
  background: var(--color-surface-panel);
  border-right: 1px solid var(--color-outline);
  box-shadow: 22px 0 48px color-mix(in srgb, #18181b 10%, transparent);
}

.workspace-dim {
  position: fixed;
  inset: 0 0 0 calc(var(--rail-width) + min(400px, calc(100vw - var(--rail-width))));
  background:
    linear-gradient(color-mix(in srgb, var(--color-background) 76%, #18181b 24%), color-mix(in srgb, var(--color-background) 76%, #18181b 24%)),
    var(--color-background);
}

.search-close {
  position: fixed;
  z-index: 4;
  top: 24px;
  left: calc(var(--rail-width) + 340px);
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: var(--color-text);
  text-decoration: none;
  font-size: 30px;
  border-radius: 8px;
}

.search-close:hover {
  background: var(--color-surface-muted);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0;
}

header p {
  margin: 0 0 6px;
  color: var(--color-text-soft);
  font-size: 13px;
}

.search-controls {
  display: grid;
  gap: 12px;
}

input {
  width: 100%;
  min-height: 48px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: var(--color-surface-muted);
}

.scope-control {
  display: flex;
  gap: 0;
  margin-inline: -28px;
  padding: 0 28px;
  border-bottom: 1px solid var(--color-outline);
}

button {
  border-radius: 8px;
}

.scope-control button {
  min-height: 56px;
  padding: 0 14px;
  color: var(--color-text);
  background: transparent;
  border-bottom: 3px solid transparent;
  border-radius: 0;
  font-weight: 700;
}

.scope-control button.active {
  color: var(--color-primary);
  background: transparent;
  border-bottom-color: var(--color-primary-strong);
}

.result-group {
  display: grid;
  gap: 8px;
  padding-top: 12px;
}

.result-group h2,
.empty-state h2 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0;
}

.result-group p,
.empty-state p {
  margin: 0;
  color: var(--color-text-soft);
}

.result-item {
  display: grid;
  gap: 6px;
  padding: 12px;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  border: 0;
  border-radius: 8px;
}

.result-item:hover {
  background: var(--color-surface-muted);
}

.result-item span,
.result-item small {
  color: var(--color-text-soft);
}

.result-item :deep(mark) {
  background: var(--color-highlight);
}

.empty-state {
  padding: 24px;
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
}

.library-hint {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--color-outline);
}

.library-hint p {
  margin: 8px 0 0;
  color: var(--color-text-soft);
}
</style>
