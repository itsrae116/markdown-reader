<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { PropType, VNode } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { renderMarkdownDocument } from '@/services/localDocumentService'
import { copyCodeFromButton, renderMermaidBlocks } from '@/services/renderEnhancementService'
import {
  appendCommentToThread as appendStoredCommentToThread,
  getCommentThreads,
  getHistory,
  getMarks,
  removeCommentThread as removeStoredCommentThread,
  removeMark as removeStoredMark,
  updateHistoryItem,
  upsertCommentThread,
  upsertMark
} from '@/services/localStorageService'
import type { CommentThread, DocumentItem, HistoryItem, LibraryNode, Mark, MarkType, TextAnchor } from '@/types/document'

const store = useAppStore()
const readerScroll = ref<HTMLElement | null>(null)
const tocScroll = ref<HTMLElement | null>(null)
const selectedText = ref('')
const selectionToolbarVisible = ref(false)
const selectionToolbarPosition = reactive({ top: 0, left: 0 })
const leftSidebarTab = ref<'toc' | 'library'>('toc')
const activeHeadingId = ref('')
const isCommenting = ref(false)
const newCommentContent = ref('')
const replyDrafts = reactive<Record<string, string>>({})
const renderedContent = computed(() => store.currentDocument ? renderMarkdownDocument(store.currentDocument) : '')
const annotatedContent = computed(() => applyDocumentAnnotations(renderedContent.value))
const currentTitle = computed(() => store.currentDocument?.name ?? '未打开文档')
const readerWidth = computed(() => `${store.preferences.reading_width}px`)
const activeCommentThreads = computed(() => (
  store.commentThreads.filter((item) => item.document_id === store.currentDocument?.id)
))
const hasSelectedHighlight = computed(() => hasSelectedMark('highlight'))
const hasSelectedUnderline = computed(() => hasSelectedMark('underline'))

const LibraryTreeNode = defineComponent({
  name: 'LibraryTreeNode',
  props: {
    node: {
      type: Object as PropType<LibraryNode>,
      required: true
    }
  },
  setup(props) {
    return () => renderLibraryNode(props.node)
  }
})

onMounted(() => {
  loadDocumentAnnotations()
  restoreReadingPosition()
  nextTick(updateActiveHeading)
  renderEnhancedBlocks()
})

watch(annotatedContent, () => {
  renderEnhancedBlocks()
  nextTick(updateActiveHeading)
})

function switchDocument(document: DocumentItem) {
  const historyItem = getHistory().find((item) => item.document_id === document.id)
  store.setCurrentDocument(document, historyItem?.scroll_position ?? 0)
  loadDocumentAnnotations()
  restoreReadingPosition()
  nextTick(updateActiveHeading)
}

function scrollToHeading(headingId: string) {
  const target = readerScroll.value?.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`)
  const scrollRoot = readerScroll.value
  if (target && scrollRoot) {
    const rootTop = scrollRoot.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + targetTop - rootTop - 24,
      behavior: 'smooth'
    })
  }
  activeHeadingId.value = headingId
  keepActiveHeadingVisible()
}

function saveReadingPosition() {
  if (!store.currentDocument || !readerScroll.value) return

  const scroll_position = Math.round(readerScroll.value.scrollTop)
  store.setCurrentScrollPosition(scroll_position)
  const nextHistory = updateHistoryItem(createHistoryItem(store.currentDocument, scroll_position))
  store.setHistory(nextHistory)
  updateActiveHeading()
}

function restoreReadingPosition() {
  nextTick(() => {
    if (!readerScroll.value) return
    readerScroll.value.scrollTop = store.currentScrollPosition
    updateActiveHeading()
  })
}

function toggleLeftSidebar() {
  store.updatePreferences({ show_left_sidebar: !store.preferences.show_left_sidebar })
}

function toggleRightPanel() {
  store.updatePreferences({ show_right_panel: !store.preferences.show_right_panel })
}

function showRightPanelTab(tab: 'toc' | 'comments') {
  store.updatePreferences({ show_right_panel: true, right_panel_tab: tab })
}

function updateActiveHeading() {
  const scrollRoot = readerScroll.value
  if (!scrollRoot || !store.currentDocument?.headings.length) {
    activeHeadingId.value = ''
    return
  }

  const rootTop = scrollRoot.getBoundingClientRect().top
  let currentHeadingId = store.currentDocument.headings[0].id

  for (const heading of store.currentDocument.headings) {
    const target = scrollRoot.querySelector<HTMLElement>(`#${CSS.escape(heading.id)}`)
    if (!target) continue

    const distance = target.getBoundingClientRect().top - rootTop
    if (distance <= 96) {
      currentHeadingId = heading.id
    } else {
      break
    }
  }

  if (activeHeadingId.value !== currentHeadingId) {
    activeHeadingId.value = currentHeadingId
    keepActiveHeadingVisible()
  }
}

function keepActiveHeadingVisible() {
  nextTick(() => {
    if (!tocScroll.value || !activeHeadingId.value) return
    const activeItem = tocScroll.value.querySelector<HTMLElement>(`[data-heading-id="${CSS.escape(activeHeadingId.value)}"]`)
    activeItem?.scrollIntoView({ block: 'nearest' })
  })
}

function handleReaderSelection() {
  requestAnimationFrame(updateSelectionToolbar)
}

function handleReaderClick(event: MouseEvent) {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-copy-code]')
  if (!button) return
  copyCodeFromButton(button)
}

function renderEnhancedBlocks() {
  nextTick(() => {
    void renderMermaidBlocks(readerScroll.value)
  })
}

function updateSelectionToolbar() {
  const selection = window.getSelection()
  const text = selection?.toString().trim() ?? ''
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const isInsideReader = Boolean(range && readerScroll.value?.contains(range.commonAncestorContainer))
  const toolbarElement = document.querySelector('.selection-toolbar')
  const isInsideToolbar = Boolean(range && toolbarElement?.contains(range.commonAncestorContainer))

  if (isInsideToolbar) return

  selectedText.value = text
  selectionToolbarVisible.value = Boolean(text && store.currentDocument && isInsideReader)
  if (!selectionToolbarVisible.value && !isCommenting.value) {
    selectedText.value = ''
  }

  if (!selectionToolbarVisible.value || !range) return

  const rect = range.getBoundingClientRect()
  selectionToolbarPosition.left = Math.max(12, Math.min(rect.left + rect.width / 2 - 90, window.innerWidth - 210))
  selectionToolbarPosition.top = Math.max(72, rect.top - 58)
}

function createHighlight() {
  toggleMark('highlight')
}

function createUnderline() {
  toggleMark('underline')
}

function toggleMark(type: MarkType) {
  const existingMark = findSelectedMark(type)
  if (existingMark) {
    removeMarkById(existingMark.id)
    clearSelectionState()
    return
  }
  createMark(type)
}

function createMark(type: MarkType) {
  if (!store.currentDocument || !selectedText.value) return

  const mark: Mark = {
    id: `mark_${type}_${Date.now()}`,
    document_id: store.currentDocument.id,
    type,
    selected_text: selectedText.value,
    anchor: createAnchor(selectedText.value),
    created_at: new Date().toISOString()
  }
  store.addMark(mark)
  store.setMarks(upsertMark(mark))
  clearSelectionState()
}

function startComment() {
  if (!selectedText.value) return
  isCommenting.value = true
  selectionToolbarVisible.value = false
  showRightPanelTab('comments')
}

function cancelComment() {
  newCommentContent.value = ''
  clearSelectionState()
}

function createCommentThread() {
  if (!store.currentDocument || !selectedText.value) return

  const content = newCommentContent.value.trim() || '新批注'
  const now = new Date().toISOString()
  const commentThread: CommentThread = {
    id: `thread_${Date.now()}`,
    document_id: store.currentDocument.id,
    selected_text: selectedText.value,
    anchor: createAnchor(selectedText.value),
    comments: [
      {
        id: `comment_${Date.now()}`,
        content,
        created_at: now,
        updated_at: now
      }
    ],
    created_at: now
  }
  store.addCommentThread(commentThread)
  store.setCommentThreads(upsertCommentThread(commentThread))
  newCommentContent.value = ''
  showRightPanelTab('comments')
  clearSelectionState()
}

function deleteCommentThread(threadId: string) {
  if (!store.currentDocument) return
  store.removeCommentThread(threadId)
  store.setCommentThreads(removeStoredCommentThread(threadId, store.currentDocument.id))
}

function removeMarkById(markId: string) {
  if (!store.currentDocument) return
  store.removeMark(markId)
  store.setMarks(removeStoredMark(markId, store.currentDocument.id))
}

function appendThreadComment(threadId: string) {
  const content = replyDrafts[threadId]?.trim()
  if (!content) return

  const comment = appendStoredCommentToThread(threadId, content)
  if (!comment) return

  store.appendCommentToThread(threadId, comment)
  replyDrafts[threadId] = ''
}

function focusCommentThread(thread: CommentThread) {
  showRightPanelTab('comments')
  scrollToHeading(thread.anchor.heading_id)
}

function loadDocumentAnnotations() {
  if (!store.currentDocument) return
  store.setMarks(getMarks(store.currentDocument.id))
  store.setCommentThreads(getCommentThreads(store.currentDocument.id))
}

function applyDocumentAnnotations(html: string): string {
  let nextHtml = html
  for (const mark of store.marks.filter((item) => item.document_id === store.currentDocument?.id)) {
    const className = mark.type === 'highlight' ? 'annotation-highlight' : 'annotation-underline'
    nextHtml = replaceFirstText(nextHtml, mark.selected_text, `<span class="${className}">${escapeHtml(mark.selected_text)}</span>`)
  }
  for (const thread of store.commentThreads.filter((item) => item.document_id === store.currentDocument?.id)) {
    nextHtml = replaceFirstText(nextHtml, thread.selected_text, `<span class="comment-anchor" data-thread-id="${thread.id}">${escapeHtml(thread.selected_text)}</span>`)
  }
  return nextHtml
}

function createAnchor(text: string): TextAnchor {
  const position = store.currentDocument?.content.indexOf(text) ?? 0
  return {
    heading_id: store.currentDocument?.headings[0]?.id ?? 'document',
    start_offset: Math.max(0, position),
    end_offset: Math.max(0, position + text.length)
  }
}

function hasSelectedMark(type: MarkType): boolean {
  return Boolean(findSelectedMark(type))
}

function findSelectedMark(type: MarkType): Mark | undefined {
  if (!store.currentDocument || !selectedText.value) return undefined
  return store.marks.find((item) => (
    item.document_id === store.currentDocument?.id &&
    item.type === type &&
    item.selected_text === selectedText.value
  ))
}

function replaceFirstText(html: string, text: string, replacement: string): string {
  if (!text) return html
  return html.replace(new RegExp(escapeRegExp(escapeHtml(text))), replacement)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clearSelectionState() {
  selectedText.value = ''
  selectionToolbarVisible.value = false
  isCommenting.value = false
  window.getSelection()?.removeAllRanges()
}

function createHistoryItem(document: DocumentItem, scroll_position: number): HistoryItem {
  return {
    id: `history_${document.id}`,
    document_id: document.id,
    name: document.name,
    path: document.path,
    source_type: document.type,
    last_opened_at: new Date().toISOString(),
    scroll_position
  }
}

function renderLibraryNode(node: LibraryNode): VNode {
  if (node.kind === 'document') {
    const document = store.documents.find((item) => item.id === node.id)
    return h(
      'button',
      {
        type: 'button',
        class: ['document-row', { active: store.currentDocument?.id === node.id }],
        onClick: () => document && switchDocument(document)
      },
      formatDocumentName(node.name)
    )
  }

  return h('div', { class: 'folder-node' }, [
    h('span', { class: 'folder-label' }, node.name),
    h('div', { class: 'folder-children' }, node.children.map((child) => renderLibraryNode(child)))
  ])
}

function formatDocumentName(name: string): string {
  return name.replace(/\.(md|markdown)$/i, '')
}
</script>

<template>
  <main
    class="workspace-page"
    :class="{
      'is-left-hidden': !store.preferences.show_left_sidebar,
      'is-right-hidden': !store.preferences.show_right_panel
    }"
  >
    <nav class="app-rail" aria-label="主导航">
      <RouterLink class="rail-logo rail-link" to="/" aria-label="返回启动页">M</RouterLink>
      <button class="rail-button active" type="button" title="文档库" @click="toggleLeftSidebar">▤</button>
      <RouterLink class="rail-link" to="/search" title="搜索">⌕</RouterLink>
      <button class="rail-button" type="button" title="历史">↺</button>
      <RouterLink class="rail-link rail-bottom" to="/settings" title="设置">⚙</RouterLink>
    </nav>

    <header class="workspace-toolbar">
      <div class="current-title">
        <strong>{{ currentTitle }}</strong>
        <span>{{ store.currentDocument ? 'Markdown 阅读器 V1' : '拖入或选择 Markdown 文档开始' }}</span>
      </div>
      <nav aria-label="工作台工具">
        <RouterLink class="icon-button" to="/search" title="搜索">⌕</RouterLink>
        <button class="icon-button" type="button" aria-label="切换批注栏" @click="toggleRightPanel">▣</button>
        <RouterLink class="icon-button" to="/settings" title="设置">⚙</RouterLink>
      </nav>
    </header>

    <aside v-if="store.preferences.show_left_sidebar" class="sidebar" aria-label="目录和文档库">
      <header class="sidebar-tabs" aria-label="左侧内容切换">
        <button
          type="button"
          :class="{ active: leftSidebarTab === 'toc' }"
          @click="leftSidebarTab = 'toc'"
        >
          目录
        </button>
        <button
          type="button"
          :class="{ active: leftSidebarTab === 'library' }"
          @click="leftSidebarTab = 'library'"
        >
          文档库
        </button>
      </header>
      <nav
        v-if="leftSidebarTab === 'toc' && store.currentDocument?.headings.length"
        ref="tocScroll"
        class="sidebar-toc"
        aria-label="当前文档目录"
      >
        <button
          v-for="heading in store.currentDocument.headings"
          :key="`left-${heading.id}`"
          type="button"
          class="toc-row"
          :class="[`heading-level-${heading.level}`, { active: activeHeadingId === heading.id }]"
          :data-heading-id="heading.id"
          @click="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </button>
      </nav>
      <p v-if="leftSidebarTab === 'toc' && !store.currentDocument?.headings.length" class="muted">文档标题会显示在这里</p>
      <div v-if="leftSidebarTab === 'library'" class="library-panel">
        <LibraryTreeNode
          v-for="node in store.libraryTree"
          :key="node.id"
          :node="node"
        />
        <button
          v-for="document in store.libraryTree.length ? [] : store.documents"
          :key="document.id"
          type="button"
          class="document-row"
          :class="{ active: store.currentDocument?.id === document.id }"
          @click="switchDocument(document)"
        >
          {{ formatDocumentName(document.name) }}
        </button>
        <p v-if="store.libraryTree.length === 0" class="muted">打开文件夹后显示层级</p>
      </div>
    </aside>

    <article
      ref="readerScroll"
      class="reader-scroll"
      @scroll.passive="saveReadingPosition"
      @click="handleReaderClick"
      @mouseup="handleReaderSelection"
      @pointerup="handleReaderSelection"
      @keyup="handleReaderSelection"
    >
      <div class="reader" :style="{ '--reader-width': readerWidth, '--reader-font-size': `${store.preferences.font_size}px` }">
      <template v-if="store.currentDocument">
        <p class="path">▯ 本地文档 · {{ store.currentDocument.path }}</p>
        <div
          v-if="selectionToolbarVisible"
          class="selection-toolbar"
          :style="{ top: `${selectionToolbarPosition.top}px`, left: `${selectionToolbarPosition.left}px` }"
          aria-label="选区操作"
        >
          <button
            type="button"
            class="format-button"
            :class="{ active: hasSelectedHighlight }"
            :title="hasSelectedHighlight ? '取消高亮' : '高亮'"
            @click="createHighlight"
          >
            <span class="marker-icon" aria-hidden="true">▰</span>
          </button>
          <button
            type="button"
            class="format-button underline-button"
            :class="{ active: hasSelectedUnderline }"
            :title="hasSelectedUnderline ? '取消划线' : '划线'"
            @click="createUnderline"
          >
            <span aria-hidden="true">U</span>
          </button>
          <span class="toolbar-divider" aria-hidden="true"></span>
          <button type="button" class="format-button comment-tool-button" title="批注" @click="startComment">
            <span aria-hidden="true">☰</span>
          </button>
        </div>
        <div class="markdown-body" v-html="annotatedContent"></div>
      </template>
      <template v-else>
        <h1>阅读工作台</h1>
        <p>打开本地 Markdown 文件或文件夹后，Markdown 正文将在这里渲染，并以纸张式阅读卡呈现。</p>
      </template>
      </div>
    </article>

    <aside v-if="store.preferences.show_right_panel" class="panel" aria-label="批注栏">
      <header class="panel-title">
        <h2>批注</h2>
      </header>
      <section class="comment-thread-panel panel-section" aria-label="批注线程">
        <h3>批注线程</h3>
        <article v-if="isCommenting" class="comment-composer-panel">
          <p class="comment-selection">{{ selectedText }}</p>
          <textarea v-model="newCommentContent" rows="4" placeholder="写下批注"></textarea>
          <div class="thread-actions">
            <button type="button" @click="createCommentThread">创建批注</button>
            <button type="button" class="ghost-button" @click="cancelComment">取消</button>
          </div>
        </article>
        <article
          v-for="thread in activeCommentThreads"
          :key="thread.id"
          class="comment-thread"
        >
          <button type="button" class="comment-anchor-button" @click="focusCommentThread(thread)">
            {{ thread.selected_text }}
          </button>
          <p v-for="comment in thread.comments" :key="comment.id">{{ comment.content }}</p>
          <textarea v-model="replyDrafts[thread.id]" rows="2" placeholder="追加批注"></textarea>
          <div class="thread-actions">
            <button type="button" @click="appendThreadComment(thread.id)">追加批注</button>
            <button type="button" class="delete-button" @click="deleteCommentThread(thread.id)">删除</button>
          </div>
        </article>
        <p v-if="activeCommentThreads.length === 0" class="muted">正文批注会显示在这里</p>
      </section>
    </aside>
  </main>
</template>

<style scoped>
.workspace-page {
  --left-panel-width: 280px;
  --right-panel-width: 320px;
  /* Layout still keeps the documented left panel width token: grid-template-columns: var(--left-panel-width) */
  height: 100vh;
  display: grid;
  grid-template-rows: var(--toolbar-height) minmax(0, 1fr);
  grid-template-columns: var(--rail-width) var(--left-panel-width) minmax(0, 1fr) var(--right-panel-width);
  gap: 0;
  overflow: hidden;
  background: var(--color-background);
}

.workspace-page.is-left-hidden {
  grid-template-columns: var(--rail-width) minmax(0, 1fr) var(--right-panel-width);
}

.workspace-page.is-right-hidden {
  grid-template-columns: var(--rail-width) var(--left-panel-width) minmax(0, 1fr);
}

.workspace-page.is-left-hidden.is-right-hidden {
  grid-template-columns: var(--rail-width) minmax(0, 1fr);
}

.app-rail {
  position: sticky;
  grid-row: 1 / -1;
  grid-column: 1;
  height: 100vh;
}

.rail-button.active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
}

.workspace-toolbar {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  min-height: var(--toolbar-height);
  padding: 0 24px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-outline);
}

.workspace-toolbar button,
.workspace-toolbar a {
  min-height: 56px;
}

.workspace-toolbar button:hover,
.workspace-toolbar a:hover {
  background: var(--color-surface-muted);
}

.current-title {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.current-title strong,
.current-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-title strong {
  font-size: 18px;
  line-height: 1.2;
}

.current-title span {
  color: var(--color-text-soft);
  font-size: 13px;
  line-height: 1.25;
}

.workspace-toolbar nav {
  display: flex;
  gap: 6px;
  align-items: center;
}

.sidebar,
.panel {
  min-width: 0;
  padding: 16px 14px;
  color: var(--color-text-soft);
  background: var(--color-surface-panel);
  border-color: var(--color-outline);
}

.sidebar {
  grid-column: 2;
  grid-row: 2;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
}

.panel {
  grid-column: 4;
  grid-row: 2;
  overflow: auto;
  border-left: 1px solid var(--color-border);
}

.workspace-page.is-left-hidden .panel {
  grid-column: 3;
}

.reader-scroll {
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--color-background);
}

.workspace-page.is-left-hidden .reader-scroll {
  grid-column: 2;
}

.workspace-page.is-right-hidden .reader-scroll {
  grid-column: 3;
}

.workspace-page.is-left-hidden.is-right-hidden .reader-scroll {
  grid-column: 2;
}

.reader {
  max-width: min(var(--reader-width), calc(100% - 48px));
  width: 100%;
  min-height: calc(100vh - 128px);
  margin: 28px auto;
  padding: 32px 42px 46px;
  line-height: 1.42;
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.reader h1 {
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.16;
}

h2 {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0;
  color: var(--color-text);
}

.sidebar-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 12px;
  padding: 4px;
  background: var(--color-surface-muted);
  border-radius: 8px;
}

.sidebar-tabs button {
  min-height: 38px;
  color: var(--color-text-soft);
  text-align: left;
  background: transparent;
  border-radius: 6px;
}

.sidebar-tabs button.active {
  color: var(--color-ink);
  background: var(--color-surface);
}

.library-panel {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 6px;
  overflow: auto;
}

.sidebar-toc {
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.panel-title {
  margin-bottom: 12px;
  color: var(--color-text);
}

.document-row,
.toc-row {
  width: 100%;
  display: block;
  margin-bottom: 4px;
  min-height: 38px;
  padding: 8px 10px;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.25;
}

.library-panel .document-row {
  min-height: 34px;
  margin-bottom: 2px;
  padding: 7px 8px;
  overflow-wrap: anywhere;
  white-space: normal;
}

.document-row.active,
.document-row:hover,
.toc-row:hover,
.toc-row.active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
}

.folder-label {
  display: block;
  margin: 12px 0 6px;
  padding: 0 2px;
  color: var(--color-text);
  overflow-wrap: anywhere;
  font-weight: 600;
  line-height: 1.25;
}

.folder-children {
  display: grid;
  gap: 2px;
  padding-left: 14px;
  border-left: 1px solid var(--color-border);
}

.heading-level-2 {
  padding-left: 18px;
}

.heading-level-3,
.heading-level-4,
.heading-level-5,
.heading-level-6 {
  padding-left: 28px;
}

.path,
.muted {
  color: var(--color-text-soft);
}

.path {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.25;
}

.selection-toolbar {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  align-items: center;
  width: auto;
  margin-bottom: 0;
  padding: 5px 6px;
  color: var(--color-text);
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--color-outline) 68%, transparent);
  border-radius: 8px;
  box-shadow: 0 12px 28px color-mix(in srgb, #18181b 14%, transparent);
}

.comment-thread button {
  min-height: 42px;
  padding: 0 14px;
  color: inherit;
  background: color-mix(in srgb, currentColor 8%, transparent);
  border-radius: 8px;
}

.format-button {
  width: 34px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  color: var(--color-text-soft);
  background: transparent;
  border-radius: 6px;
  font-size: 15px;
  line-height: 1;
}

.format-button:hover,
.format-button.active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 9%, transparent);
}

.marker-icon {
  color: #d6a90e;
  font-size: 17px;
  text-decoration: underline;
  text-decoration-color: var(--color-highlight);
  text-decoration-thickness: 4px;
  text-underline-offset: 2px;
}

.underline-button span {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.comment-tool-button {
  font-size: 17px;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  margin: 0 3px;
  background: var(--color-border);
}

.comment-thread {
  display: grid;
  gap: 8px;
}

textarea {
  width: 100%;
  resize: vertical;
  padding: 8px;
  color: var(--color-text);
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.panel-section {
  display: grid;
  gap: 6px;
}

.panel-section h3 {
  margin: 0 0 4px;
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.2;
}

.comment-thread-panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-outline);
}

.comment-composer-panel {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-primary-strong);
  border-radius: 8px;
}

.comment-selection {
  max-height: 86px;
  margin: 0;
  overflow: auto;
  padding: 8px;
  color: var(--color-text-soft);
  background: color-mix(in srgb, var(--color-surface-muted) 44%, transparent);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.35;
}

.comment-thread {
  margin-bottom: 8px;
  padding: 10px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.comment-thread p {
  margin: 0;
  line-height: 1.35;
}

.comment-anchor-button {
  text-align: left;
  color: var(--color-primary);
}

.thread-actions {
  display: flex;
  gap: 6px;
}

.delete-button {
  color: #b42318;
}

.ghost-button {
  color: var(--color-text-soft);
}

.markdown-body :deep(.annotation-highlight) {
  background: var(--color-highlight);
}

.markdown-body :deep(.annotation-underline) {
  text-decoration: underline;
  text-decoration-color: var(--color-underline);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.markdown-body :deep(.comment-anchor) {
  padding: 0 2px;
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}

.markdown-body,
.markdown-body :deep(p),
.markdown-body :deep(li),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre) {
  text-align: left;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-family: var(--font-display);
  letter-spacing: 0;
  color: var(--color-text);
  line-height: 1.18;
}

.markdown-body :deep(h1) {
  margin: 0 0 16px;
}

.markdown-body :deep(h2) {
  margin: 24px 0 10px;
}

.markdown-body :deep(h3) {
  margin: 20px 0 8px;
}

.markdown-body :deep(p),
.markdown-body :deep(li) {
  color: var(--color-text);
  font-size: var(--reader-font-size, 16px);
  line-height: 1.42;
}

.markdown-body :deep(p) {
  margin: 0 0 8px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 10px;
  padding-left: 24px;
}

.markdown-body :deep(blockquote) {
  margin: 12px 0;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--color-surface-muted) 55%, transparent);
  border-left: 4px solid var(--color-primary-strong);
  border-radius: 8px;
}

.markdown-body :deep(pre) {
  margin: 10px 0;
  padding: 14px;
  overflow: auto;
  background: #dedde2;
  border-radius: 8px;
  white-space: pre;
  overflow-wrap: normal;
}

.markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.markdown-body :deep(.md-table-frame) {
  width: 100%;
  margin: 16px 0;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.markdown-body :deep(.md-table) {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 14px;
}

.markdown-body :deep(.md-table th),
.markdown-body :deep(.md-table td) {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--color-border);
}

.markdown-body :deep(.md-table th) {
  position: sticky;
  top: 0;
  z-index: 1;
  color: var(--color-text);
  background: var(--color-surface-muted);
}

.markdown-body :deep(.md-table tr:nth-child(even) td) {
  background: color-mix(in srgb, var(--color-surface-muted) 34%, transparent);
}

.markdown-body :deep(.md-code-block),
.markdown-body :deep(.md-mermaid-block),
.markdown-body :deep(.api-doc-block) {
  margin: 16px 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.markdown-body :deep(.md-code-header),
.markdown-body :deep(.md-mermaid-block figcaption),
.markdown-body :deep(.api-doc-block header) {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  color: var(--color-text-soft);
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
  line-height: 1.2;
}

.markdown-body :deep(.copy-code-button) {
  min-height: 32px;
  padding: 0 10px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
  border-radius: 6px;
}

.markdown-body :deep(.copy-code-button[data-copied="true"]) {
  color: var(--color-secondary);
}

.markdown-body :deep(.md-code-block pre),
.markdown-body :deep(.api-doc-block pre),
.markdown-body :deep(.md-mermaid-block pre) {
  margin: 0;
  padding: 14px;
  overflow: auto;
  color: var(--color-text);
  background: #f0edf1;
  border-radius: 0;
  white-space: pre;
}

.markdown-body :deep(.md-code-block code),
.markdown-body :deep(.api-doc-block pre),
.markdown-body :deep(.md-mermaid-block pre) {
  font-size: 13px;
  line-height: 1.55;
}

.markdown-body :deep(.md-mermaid-canvas) {
  display: grid;
  place-items: center;
  padding: 18px;
  overflow: auto;
}

.markdown-body :deep(.md-mermaid-canvas svg) {
  max-width: 100%;
  height: auto;
}

.markdown-body :deep(.md-outline-block) {
  margin: 16px 0;
  padding: 14px 16px;
  overflow: auto;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-muted) 68%, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", "Noto Sans Mono CJK SC", "Sarasa Mono SC", "Microsoft YaHei Mono", monospace;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre;
  overflow-wrap: normal;
  font-variant-ligatures: none;
  tab-size: 2;
}

.markdown-body :deep(.md-plain-block) {
  margin: 16px 0;
  padding: 14px 16px;
  overflow: auto;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-muted) 42%, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", "Noto Sans Mono CJK SC", "Sarasa Mono SC", "Microsoft YaHei Mono", monospace;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre;
  overflow-wrap: normal;
  font-variant-ligatures: none;
  tab-size: 2;
}

.markdown-body :deep(.md-mermaid-block.is-render-error figcaption)::after {
  content: "渲染失败，已保留原始代码";
  color: #b42318;
}

.markdown-body :deep(.api-doc-block header) {
  justify-content: flex-start;
}

.markdown-body :deep(.api-doc-block header code) {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-text);
  font-size: 14px;
}

.markdown-body :deep(.api-method) {
  flex: 0 0 auto;
  min-width: 56px;
  padding: 5px 8px;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  background: var(--color-text-soft);
  font-size: 12px;
  font-weight: 700;
}

.markdown-body :deep(.api-method-get) {
  background: var(--color-secondary);
}

.markdown-body :deep(.api-method-post),
.markdown-body :deep(.api-method-put),
.markdown-body :deep(.api-method-patch) {
  background: var(--color-primary);
}

.markdown-body :deep(.api-method-delete) {
  background: #b42318;
}

.markdown-body :deep(.api-doc-block section) {
  padding: 12px 14px;
  border-top: 1px solid var(--color-border);
}

.markdown-body :deep(.api-doc-block section:first-of-type) {
  border-top: 0;
}

.markdown-body :deep(.api-doc-block h4) {
  margin: 0 0 6px;
  color: var(--color-text);
  font-size: 13px;
}

.markdown-body :deep(.api-doc-block p) {
  margin: 0;
  font-size: 14px;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px auto;
  border-radius: 8px;
}

@media (max-width: 980px) {
  .workspace-page,
  .workspace-page.is-left-hidden,
  .workspace-page.is-right-hidden,
  .workspace-page.is-left-hidden.is-right-hidden {
    grid-template-columns: var(--rail-width) minmax(0, 1fr);
  }

  .sidebar,
  .panel {
    display: none;
  }

  .workspace-toolbar,
  .reader-scroll {
    grid-column: 2;
  }

  .reader {
    max-width: calc(100% - 24px);
    margin: 16px auto;
    padding: 22px 20px;
  }
}
</style>
