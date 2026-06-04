<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { PropType, VNode } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAppStore } from '@/stores/appStore'
import { renderMarkdownDocument } from '@/services/localDocumentService'
import { copyCodeFromButton, renderMermaidBlocks } from '@/services/renderEnhancementService'
import { buildCommentMarkdown, createExportFileName, downloadTextFile } from '@/services/exportService'
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
import type { CommentThread, DocumentItem, Heading, HistoryItem, LibraryNode, Mark, MarkType, TextAnchor } from '@/types/document'

const store = useAppStore()
const readerScroll = ref<HTMLElement | null>(null)
const tocScroll = ref<HTMLElement | null>(null)
const panelScroll = ref<HTMLElement | null>(null)
const commentLane = ref<HTMLElement | null>(null)
const selectedText = ref('')
const selectionToolbarVisible = ref(false)
const selectionToolbarPosition = reactive({ top: 0, left: 0 })
const leftSidebarTab = ref<'toc' | 'library'>('toc')
const activeHeadingId = ref('')
const activeCommentThreadId = ref('')
const openCommentMenuId = ref('')
const isCommenting = ref(false)
const pendingCommentText = ref('')
const newCommentContent = ref('')
const includePdfComments = ref(true)
const isPrintingAnnotatedPdf = ref(false)
const expandedHeadingIds = ref<Set<string>>(new Set())
const expandedFolderIds = ref<Set<string>>(new Set())
const replyDrafts = reactive<Record<string, string>>({})
const commentPanelPositions = reactive<Record<string, number>>({})
const visibleCommentThreadIds = reactive<Record<string, boolean>>({})
const renderedContent = computed(() => store.currentDocument ? renderMarkdownDocument(store.currentDocument) : '')
const annotatedContent = computed(() => applyDocumentAnnotations(renderedContent.value))
const currentTitle = computed(() => store.currentDocument?.name ?? '阅读工作台')
const readerWidth = computed(() => `${store.preferences.reading_width}px`)
const visibleHeadings = computed(() => (
  store.currentDocument?.headings.filter((heading) => isHeadingVisible(heading)) ?? []
))
const activeCommentThreads = computed(() => (
  [...store.commentThreads]
    .filter((item) => item.document_id === store.currentDocument?.id)
    .sort((left, right) => left.anchor.start_offset - right.anchor.start_offset)
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
  initializeHeadingExpansion()
  initializeLibraryExpansion()
  loadDocumentAnnotations()
  restoreReadingPosition()
  nextTick(updateActiveHeading)
  renderEnhancedBlocks()
  nextTick(syncCommentPanelWithReader)
  window.addEventListener('resize', syncCommentPanelWithReader)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncCommentPanelWithReader)
})

watch(annotatedContent, () => {
  renderEnhancedBlocks()
  nextTick(updateActiveHeading)
  nextTick(syncCommentPanelWithReader)
})

watch(() => store.currentDocument?.id, () => {
  initializeHeadingExpansion()
  initializeLibraryExpansion()
})

watch(() => store.libraryTree, () => {
  initializeLibraryExpansion()
}, { deep: true })

function switchDocument(document: DocumentItem) {
  const historyItem = getHistory().find((item) => item.document_id === document.id)
  store.setCurrentDocument(document, historyItem?.scroll_position ?? 0)
  initializeHeadingExpansion()
  initializeLibraryExpansion()
  loadDocumentAnnotations()
  restoreReadingPosition()
  nextTick(updateActiveHeading)
  nextTick(syncCommentPanelWithReader)
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
  syncCommentPanelWithReader()
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

function initializeHeadingExpansion() {
  const headings = store.currentDocument?.headings ?? []
  const nextExpandedIds = new Set<string>()

  for (const heading of headings) {
    if (heading.level <= 2) {
      nextExpandedIds.add(heading.id)
    }
  }

  for (const ancestorId of getHeadingAncestorIds(activeHeadingId.value || headings[0]?.id || '')) {
    nextExpandedIds.add(ancestorId)
  }

  expandedHeadingIds.value = nextExpandedIds
}

function toggleHeading(headingId: string) {
  const nextExpandedIds = new Set(expandedHeadingIds.value)
  if (nextExpandedIds.has(headingId)) {
    nextExpandedIds.delete(headingId)
  } else {
    nextExpandedIds.add(headingId)
  }
  expandedHeadingIds.value = nextExpandedIds
}

function isHeadingExpanded(headingId: string): boolean {
  return expandedHeadingIds.value.has(headingId)
}

function isHeadingVisible(heading: Heading): boolean {
  return getHeadingAncestorIds(heading.id).every((ancestorId) => expandedHeadingIds.value.has(ancestorId))
}

function hasHeadingChildren(heading: Heading): boolean {
  const headings = store.currentDocument?.headings ?? []
  const currentIndex = headings.findIndex((item) => item.id === heading.id)
  if (currentIndex === -1) return false

  for (const nextHeading of headings.slice(currentIndex + 1)) {
    if (nextHeading.level <= heading.level) return false
    if (nextHeading.level > heading.level) return true
  }

  return false
}

function isHeadingRowActive(heading: Heading): boolean {
  if (activeHeadingId.value === heading.id) return true
  return !isHeadingExpanded(heading.id) && getHeadingAncestorIds(activeHeadingId.value).includes(heading.id)
}

function getHeadingAncestorIds(headingId: string): string[] {
  const headings = store.currentDocument?.headings ?? []
  const ancestors: Heading[] = []

  for (const heading of headings) {
    if (heading.id === headingId) {
      return ancestors.map((ancestor) => ancestor.id)
    }

    while (ancestors.length && ancestors[ancestors.length - 1].level >= heading.level) {
      ancestors.pop()
    }
    ancestors.push(heading)
  }

  return []
}

function getTreeItemStyle(level: number) {
  return {
    '--tree-depth': String(Math.min(Math.max(level - 1, 0), 5))
  }
}

function initializeLibraryExpansion() {
  const nextExpandedIds = new Set<string>()
  collectVisibleFolderIds(store.libraryTree, store.currentDocument?.path ?? '', nextExpandedIds, 1)
  expandedFolderIds.value = nextExpandedIds
}

function collectVisibleFolderIds(nodes: LibraryNode[], activeDocumentPath: string, nextExpandedIds: Set<string>, level: number): boolean {
  let containsActiveDocument = false

  for (const node of nodes) {
    if (node.kind !== 'folder') {
      containsActiveDocument = containsActiveDocument || node.path === activeDocumentPath
      continue
    }

    const childContainsActiveDocument = collectVisibleFolderIds(node.children, activeDocumentPath, nextExpandedIds, level + 1)
    if (level === 1 || childContainsActiveDocument) {
      nextExpandedIds.add(node.id)
    }
    containsActiveDocument = containsActiveDocument || childContainsActiveDocument
  }

  return containsActiveDocument
}

function toggleFolder(folderId: string) {
  const nextExpandedIds = new Set(expandedFolderIds.value)
  if (nextExpandedIds.has(folderId)) {
    nextExpandedIds.delete(folderId)
  } else {
    nextExpandedIds.add(folderId)
  }
  expandedFolderIds.value = nextExpandedIds
}

function isFolderExpanded(folderId: string): boolean {
  return expandedFolderIds.value.has(folderId)
}

function countLibraryDocuments(node: LibraryNode): number {
  if (node.kind === 'document') return 1
  return node.children.reduce((total, child) => total + countLibraryDocuments(child), 0)
}

function handleReaderSelection() {
  requestAnimationFrame(updateSelectionToolbar)
}

function handleReaderClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const commentAnchor = target?.closest<HTMLElement>('.comment-anchor[data-thread-id]')
  if (commentAnchor?.dataset.threadId) {
    focusCommentThreadById(commentAnchor.dataset.threadId)
    return
  }

  const button = target?.closest<HTMLButtonElement>('[data-copy-code]')
  clearActiveCommentThread()
  if (button) {
    copyCodeFromButton(button)
  }
}

function handlePanelClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const isInsideCommentControl = Boolean(target?.closest('.comment-thread, .comment-composer-panel, button, textarea'))
  if (!isInsideCommentControl) {
    clearActiveCommentThread()
  }
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
  pendingCommentText.value = selectedText.value
  isCommenting.value = true
  selectionToolbarVisible.value = false
  showRightPanelTab('comments')
}

function cancelComment() {
  newCommentContent.value = ''
  pendingCommentText.value = ''
  clearSelectionState()
}

function createCommentThread() {
  const commentTargetText = pendingCommentText.value || selectedText.value
  if (!store.currentDocument || !commentTargetText) return

  const content = newCommentContent.value.trim() || '新批注'
  const now = new Date().toISOString()
  const commentThread: CommentThread = {
    id: `thread_${Date.now()}`,
    document_id: store.currentDocument.id,
    selected_text: commentTargetText,
    anchor: createAnchor(commentTargetText),
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
  pendingCommentText.value = ''
  activeCommentThreadId.value = ''
  openCommentMenuId.value = ''
  showRightPanelTab('comments')
  clearSelectionState()
  nextTick(syncCommentPanelWithReader)
}

function deleteCommentThread(threadId: string) {
  if (!store.currentDocument) return
  store.removeCommentThread(threadId)
  store.setCommentThreads(removeStoredCommentThread(threadId, store.currentDocument.id))
  delete replyDrafts[threadId]
  if (activeCommentThreadId.value === threadId) {
    activeCommentThreadId.value = ''
  }
  if (openCommentMenuId.value === threadId) {
    openCommentMenuId.value = ''
  }
  nextTick(syncCommentPanelWithReader)
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
  activeCommentThreadId.value = threadId
  nextTick(syncCommentPanelWithReader)
}

function exportAnnotatedPdf() {
  if (!store.currentDocument) return

  isPrintingAnnotatedPdf.value = true
  const previousTitle = document.title
  document.title = createExportFileName(store.currentDocument, '标记版', 'pdf').replace(/\.pdf$/, '')

  const cleanup = () => {
    isPrintingAnnotatedPdf.value = false
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  nextTick(() => {
    window.print()
    window.setTimeout(cleanup, 1800)
  })
}

function exportCommentMarkdown() {
  if (!store.currentDocument || !activeCommentThreads.value.length) return

  const markdown = buildCommentMarkdown(store.currentDocument, activeCommentThreads.value)
  downloadTextFile(createExportFileName(store.currentDocument, '批注汇总', 'md'), markdown)
}

function focusCommentThread(thread: CommentThread) {
  activeCommentThreadId.value = thread.id
  openCommentMenuId.value = ''
  showRightPanelTab('comments')
  nextTick(() => {
    scrollToCommentAnchor(thread)
    syncCommentPanelWithReader()
  })
}

function focusCommentThreadById(threadId: string) {
  const thread = activeCommentThreads.value.find((item) => item.id === threadId)
  if (thread) {
    focusCommentThread(thread)
  }
}

function focusAdjacentCommentThread(direction: 'previous' | 'next') {
  if (!activeCommentThreads.value.length) return
  const currentIndex = activeCommentThreads.value.findIndex((thread) => thread.id === activeCommentThreadId.value)
  const fallbackIndex = direction === 'previous' ? activeCommentThreads.value.length - 1 : 0
  const nextIndex = currentIndex === -1
    ? fallbackIndex
    : (currentIndex + (direction === 'previous' ? -1 : 1) + activeCommentThreads.value.length) % activeCommentThreads.value.length
  focusCommentThread(activeCommentThreads.value[nextIndex])
}

function toggleCommentMenu(threadId: string) {
  openCommentMenuId.value = openCommentMenuId.value === threadId ? '' : threadId
}

function clearActiveCommentThread() {
  activeCommentThreadId.value = ''
  openCommentMenuId.value = ''
  nextTick(syncCommentPanelWithReader)
}

function isActiveCommentThread(thread: CommentThread): boolean {
  return activeCommentThreadId.value === thread.id
}

function isCommentThreadVisible(thread: CommentThread): boolean {
  return Boolean(visibleCommentThreadIds[thread.id] || isActiveCommentThread(thread))
}

function getCommentThreadStyle(thread: CommentThread) {
  return {
    transform: `translateY(${commentPanelPositions[thread.id] ?? 0}px)`
  }
}

function getPrimaryComment(thread: CommentThread) {
  return thread.comments[0]
}

function getReplyCount(thread: CommentThread): number {
  return Math.max(0, thread.comments.length - 1)
}

function formatCommentTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

function syncCommentPanelWithReader() {
  if (!readerScroll.value || !commentLane.value || !activeCommentThreads.value.length) return

  const scrollRoot = readerScroll.value
  const laneRoot = commentLane.value
  const rootRect = scrollRoot.getBoundingClientRect()
  const laneRect = laneRoot.getBoundingClientRect()
  const placements: Array<{ id: string, targetTop: number, active: boolean }> = []
  const nextVisibleIds: Record<string, boolean> = {}

  for (const thread of activeCommentThreads.value) {
    const anchor = scrollRoot.querySelector<HTMLElement>(`.comment-anchor[data-thread-id="${CSS.escape(thread.id)}"]`)
    if (!anchor) continue

    const rect = anchor.getBoundingClientRect()
    const isInReaderViewport = rect.bottom >= rootRect.top + 8 && rect.top <= rootRect.bottom - 8
    const isActive = thread.id === activeCommentThreadId.value
    nextVisibleIds[thread.id] = isInReaderViewport || isActive
    if (!nextVisibleIds[thread.id]) continue

    placements.push({
      id: thread.id,
      active: isActive,
      targetTop: Math.max(0, rect.top - laneRect.top - 10)
    })
  }

  for (const thread of activeCommentThreads.value) {
    visibleCommentThreadIds[thread.id] = Boolean(nextVisibleIds[thread.id])
  }

  placements.sort((left, right) => left.targetTop - right.targetTop)

  let previousBottom = 0
  const laneHeight = laneRoot.clientHeight
  for (const placement of placements) {
    const card = laneRoot.querySelector<HTMLElement>(`.comment-thread[data-thread-id="${CSS.escape(placement.id)}"]`)
    const cardHeight = card?.offsetHeight || (placement.active ? 236 : 96)
    const maxTop = Math.max(0, laneHeight - cardHeight)
    const top = Math.min(Math.max(placement.targetTop, previousBottom), maxTop)
    commentPanelPositions[placement.id] = top
    previousBottom = top + cardHeight + 10
  }
}

function scrollToCommentAnchor(thread: CommentThread) {
  const scrollRoot = readerScroll.value
  const target = scrollRoot?.querySelector<HTMLElement>(`.comment-anchor[data-thread-id="${CSS.escape(thread.id)}"]`)
  if (target && scrollRoot) {
    const rootTop = scrollRoot.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + targetTop - rootTop - 92,
      behavior: 'smooth'
    })
    return
  }

  scrollToHeading(thread.anchor.heading_id)
}

function loadDocumentAnnotations() {
  if (!store.currentDocument) return
  store.setMarks(getMarks(store.currentDocument.id))
  store.setCommentThreads(getCommentThreads(store.currentDocument.id))
  if (!activeCommentThreads.value.some((thread) => thread.id === activeCommentThreadId.value)) {
    activeCommentThreadId.value = ''
    openCommentMenuId.value = ''
  }
  nextTick(syncCommentPanelWithReader)
}

function applyDocumentAnnotations(html: string): string {
  let nextHtml = html
  for (const mark of store.marks.filter((item) => item.document_id === store.currentDocument?.id)) {
    const className = mark.type === 'highlight' ? 'annotation-highlight' : 'annotation-underline'
    nextHtml = replaceFirstVisibleText(nextHtml, mark.selected_text, `<span class="${className}">${escapeHtml(mark.selected_text)}</span>`)
  }
  for (const thread of activeCommentThreads.value) {
    const className = thread.id === activeCommentThreadId.value ? 'comment-anchor comment-anchor-active' : 'comment-anchor'
    nextHtml = replaceFirstVisibleText(nextHtml, thread.selected_text, `<span class="${className}" data-thread-id="${thread.id}">${escapeHtml(thread.selected_text)}</span>`)
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

function replaceFirstVisibleText(html: string, text: string, replacement: string): string {
  if (!text) return html
  const template = document.createElement('template')
  template.innerHTML = html
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  let currentNode = walker.nextNode()

  while (currentNode) {
    const textNode = currentNode as Text
    const index = textNode.nodeValue?.indexOf(text) ?? -1
    if (index >= 0) {
      const range = document.createRange()
      range.setStart(textNode, index)
      range.setEnd(textNode, index + text.length)
      const replacementTemplate = document.createElement('template')
      replacementTemplate.innerHTML = replacement
      range.deleteContents()
      range.insertNode(replacementTemplate.content.cloneNode(true))
      return template.innerHTML
    }
    currentNode = walker.nextNode()
  }

  return html
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

function renderLibraryNode(node: LibraryNode, level = 1): VNode {
  const treeItemClass = ['tree-item', `library-level-${Math.min(level, 6)}`]
  const treeItemStyle = getTreeItemStyle(level)

  if (node.kind === 'document') {
    const document = store.documents.find((item) => item.id === node.id)
    return h(
      'div',
      {
        class: treeItemClass,
        style: treeItemStyle
      },
      [
        h('span', { class: 'collapse-spacer', 'aria-hidden': 'true' }),
        h(
          'button',
          {
            type: 'button',
            class: ['document-row', { active: store.currentDocument?.id === node.id }],
            onClick: () => document && switchDocument(document)
          },
          h('span', { class: 'row-label' }, formatDocumentName(node.name))
        )
      ]
    )
  }

  const expanded = isFolderExpanded(node.id)
  return h('div', { class: 'folder-node' }, [
    h('div', { class: treeItemClass, style: treeItemStyle }, [
      h(
        'button',
        {
          type: 'button',
          class: ['collapse-toggle', { expanded }],
          title: expanded ? '收起' : '展开',
          'aria-label': expanded ? `收起 ${node.name}` : `展开 ${node.name}`,
          onClick: () => toggleFolder(node.id)
        },
        expanded ? '⌄' : '›'
      ),
      h('button', { type: 'button', class: 'document-row folder-row', onClick: () => toggleFolder(node.id) }, [
        h('span', { class: 'row-label' }, node.name),
        h('small', { class: 'row-count' }, `${countLibraryDocuments(node)}`)
      ])
    ]),
    expanded ? h('div', { class: 'folder-children' }, node.children.map((child) => renderLibraryNode(child, level + 1))) : null
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
      <RouterLink class="rail-logo rail-link" to="/" aria-label="返回启动页"><AppIcon name="home" /></RouterLink>
      <button class="rail-button active" type="button" title="文档库" @click="toggleLeftSidebar"><AppIcon name="library" /></button>
      <RouterLink class="rail-link" to="/search" title="搜索"><AppIcon name="search" /></RouterLink>
      <RouterLink class="rail-link rail-bottom" to="/settings" title="设置"><AppIcon name="settings" /></RouterLink>
    </nav>

    <header class="workspace-toolbar">
      <div class="current-title">
        <strong>{{ currentTitle }}</strong>
        <span>{{ store.currentDocument ? '阅读工作台' : '打开文档或文件夹开始阅读' }}</span>
      </div>
      <nav aria-label="工作台工具">
        <button class="icon-button" type="button" aria-label="切换批注栏" title="批注栏" @click="toggleRightPanel"><AppIcon name="comments" /></button>
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
        <div
          v-for="heading in visibleHeadings"
          :key="`left-${heading.id}`"
          class="tree-item toc-item"
          :class="`heading-level-${heading.level}`"
          :data-heading-id="heading.id"
          :style="getTreeItemStyle(heading.level)"
        >
          <button
            v-if="hasHeadingChildren(heading)"
            type="button"
            class="collapse-toggle"
            :class="{ expanded: isHeadingExpanded(heading.id) }"
            :title="isHeadingExpanded(heading.id) ? '收起' : '展开'"
            :aria-label="isHeadingExpanded(heading.id) ? `收起 ${heading.text}` : `展开 ${heading.text}`"
            @click="toggleHeading(heading.id)"
          >
            {{ isHeadingExpanded(heading.id) ? '⌄' : '›' }}
          </button>
          <span v-else class="collapse-spacer" aria-hidden="true"></span>
          <button
            type="button"
            class="toc-row"
            :class="{ active: isHeadingRowActive(heading) }"
            @click="scrollToHeading(heading.id)"
          >
            {{ heading.text }}
          </button>
        </div>
      </nav>
      <p v-if="leftSidebarTab === 'toc' && !store.currentDocument?.headings.length" class="muted">打开文档后展示目录</p>
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
          class="document-row library-level-1"
          :class="{ active: store.currentDocument?.id === document.id }"
          @click="switchDocument(document)"
        >
          <span class="row-label">{{ formatDocumentName(document.name) }}</span>
        </button>
        <p v-if="store.libraryTree.length === 0" class="muted">打开知识文件夹后展示文档</p>
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
        <p class="path">当前阅读 · {{ store.currentDocument.path }}</p>
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
        <section
          v-if="activeCommentThreads.length"
          class="print-comment-appendix"
          :class="{ enabled: isPrintingAnnotatedPdf && includePdfComments }"
          aria-label="打印批注附录"
        >
          <h2>批注汇总</h2>
          <article v-for="thread in activeCommentThreads" :key="`print-${thread.id}`">
            <h3>命中文字</h3>
            <blockquote>{{ thread.selected_text }}</blockquote>
            <h3>批注内容</h3>
            <ol>
              <li v-for="comment in thread.comments" :key="`print-${comment.id}`">{{ comment.content }}</li>
            </ol>
          </article>
        </section>
      </template>
      <template v-else>
        <h1>阅读工作台</h1>
        <p>打开 Markdown 文档或知识文件夹，开始阅读、搜索和批注。</p>
      </template>
      </div>
    </article>

    <aside v-if="store.preferences.show_right_panel" ref="panelScroll" class="panel" aria-label="批注栏" @click="handlePanelClick">
      <header class="panel-title">
        <h2>批注</h2>
      </header>
      <section class="export-panel panel-section" aria-label="导出">
        <h3>导出</h3>
        <label class="export-option">
          <input v-model="includePdfComments" type="checkbox" />
          <span>PDF 包含批注内容</span>
        </label>
        <div class="export-actions">
          <button type="button" :disabled="!store.currentDocument" @click="exportAnnotatedPdf">导出标记 PDF</button>
          <button type="button" :disabled="!activeCommentThreads.length" @click="exportCommentMarkdown">导出批注 Markdown</button>
        </div>
      </section>
      <section class="comment-thread-panel panel-section" aria-label="批注线程">
        <h3>批注记录</h3>
        <article v-if="isCommenting" class="comment-composer-panel">
          <textarea v-model="newCommentContent" rows="3" placeholder="添加批注"></textarea>
          <div class="thread-actions">
            <button type="button" @click="createCommentThread">确定</button>
            <button type="button" class="ghost-button" @click="cancelComment">取消</button>
          </div>
        </article>
        <div ref="commentLane" class="comment-lane" aria-label="正文批注定位区">
          <article
            v-for="thread in activeCommentThreads"
            v-show="isCommentThreadVisible(thread)"
            :key="thread.id"
            class="comment-thread"
            :class="{ active: isActiveCommentThread(thread) }"
            :data-thread-id="thread.id"
            :style="getCommentThreadStyle(thread)"
          >
            <div v-if="isActiveCommentThread(thread)" class="comment-thread-toolbar">
              <div class="comment-nav-buttons" aria-label="批注切换">
                <button type="button" title="上一条批注" @click="focusAdjacentCommentThread('previous')">⌃</button>
                <button type="button" title="下一条批注" @click="focusAdjacentCommentThread('next')">⌄</button>
              </div>
              <div class="comment-menu-wrap">
                <button type="button" class="comment-menu-button" aria-label="批注操作" @click.stop="toggleCommentMenu(thread.id)">•••</button>
                <div v-if="openCommentMenuId === thread.id" class="comment-menu" role="menu">
                  <button type="button" role="menuitem" class="delete-button" @click="deleteCommentThread(thread.id)">删除</button>
                </div>
              </div>
            </div>
            <button type="button" class="comment-summary" @click="focusCommentThread(thread)">
              <span class="comment-avatar" aria-hidden="true">我</span>
              <span class="comment-card-body">
                <span class="comment-card-meta">
                  <strong>我的批注</strong>
                  <time>{{ formatCommentTime(getPrimaryComment(thread)?.created_at ?? thread.created_at) }}</time>
                </span>
                <span class="comment-card-content">{{ getPrimaryComment(thread)?.content }}</span>
                <small v-if="!isActiveCommentThread(thread) && getReplyCount(thread) > 0">{{ getReplyCount(thread) }} 条追加批注</small>
              </span>
            </button>
            <template v-if="isActiveCommentThread(thread)">
              <div v-if="thread.comments.length > 1" class="comment-replies">
                <p v-for="comment in thread.comments.slice(1)" :key="comment.id">
                  <span>{{ comment.content }}</span>
                  <time>{{ formatCommentTime(comment.created_at) }}</time>
                </p>
              </div>
              <textarea v-model="replyDrafts[thread.id]" rows="2" placeholder="添加批注"></textarea>
              <div class="thread-actions">
                <button type="button" @click="appendThreadComment(thread.id)">追加批注</button>
              </div>
            </template>
          </article>
        </div>
        <p v-if="activeCommentThreads.length === 0" class="muted">选中文字后添加批注</p>
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
  color: var(--color-action-active);
  background: var(--color-action-bg);
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
  min-height: 44px;
  color: var(--color-action);
}

.workspace-toolbar button:hover,
.workspace-toolbar a:hover {
  color: var(--color-action-active);
  background: var(--color-action-hover-bg);
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.reader:has(.md-table-frame) {
  max-width: min(1120px, calc(100% - 40px));
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
  gap: 4px;
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
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: 38px;
  padding: 8px 10px;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  appearance: none;
  border: 0;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.35;
  white-space: normal;
}

.tree-item {
  --tree-depth: 0;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: start;
  gap: 4px;
  padding-left: calc(var(--tree-depth) * 12px);
}

.collapse-toggle,
.collapse-spacer {
  width: 24px;
  height: 38px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 24px;
}

.collapse-toggle {
  color: var(--color-text-soft);
  background: transparent;
  border: 0;
  border-radius: 6px;
  font-size: 18px;
  line-height: 1;
}

.collapse-toggle:hover {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
}

.collapse-toggle.expanded {
  color: var(--color-primary);
}

.row-label {
  display: block;
  width: 100%;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: normal;
}

.document-row.active,
.document-row:hover,
.toc-row:hover,
.toc-row.active {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
}

.folder-node {
  display: grid;
  gap: 3px;
}

.folder-children {
  display: grid;
  gap: 3px;
}

.folder-row {
  cursor: pointer;
  font-weight: 600;
}

.folder-row:hover {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
}

.row-count {
  margin-left: auto;
  padding-left: 8px;
  color: var(--color-text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.library-panel :deep(.document-row),
.library-panel :deep(.folder-row) {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: 38px;
  padding: 8px 10px;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  appearance: none;
  border: 0;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.35;
  white-space: normal;
}

.library-panel :deep(.row-label) {
  display: block;
  width: 100%;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: normal;
}

.library-panel :deep(.document-row.active),
.library-panel :deep(.document-row:hover) {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
}

.library-panel :deep(.folder-node) {
  display: grid;
  gap: 3px;
}

.library-panel :deep(.folder-children) {
  display: grid;
  gap: 3px;
}

.library-panel :deep(.folder-row) {
  cursor: pointer;
  font-weight: 600;
}

.library-panel :deep(.folder-row:hover) {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 10%, transparent);
}

.library-panel :deep(.tree-item) {
  --tree-depth: 0;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: start;
  gap: 4px;
  padding-left: calc(var(--tree-depth) * 12px);
}

.library-panel :deep(.collapse-toggle),
.library-panel :deep(.collapse-spacer) {
  width: 24px;
  height: 38px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 24px;
}

.library-panel :deep(.collapse-toggle) {
  color: var(--color-text-soft);
  background: transparent;
  border: 0;
  border-radius: 6px;
  font-size: 18px;
  line-height: 1;
}

.library-panel :deep(.collapse-toggle:hover),
.library-panel :deep(.collapse-toggle.expanded) {
  color: var(--color-primary);
}

.library-panel :deep(.row-count) {
  margin-left: auto;
  padding-left: 8px;
  color: var(--color-text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.heading-level-2,
.heading-level-3,
.heading-level-4,
.heading-level-5,
.heading-level-6,
.library-level-2,
.library-level-3,
.library-level-4,
.library-level-5,
.library-level-6 {
  min-width: 0;
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

textarea {
  width: 100%;
  resize: vertical;
  padding: 10px 12px;
  color: var(--color-text);
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
}

.comment-thread > textarea {
  width: calc(100% - 24px);
  margin: 0 12px;
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

.export-panel {
  flex: 0 0 auto;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-outline);
}

.export-option {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.3;
}

.export-option input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.export-actions {
  display: grid;
  gap: 8px;
}

.export-actions button {
  min-height: 38px;
  justify-content: center;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-strong) 8%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary-strong) 18%, var(--color-border));
  border-radius: 8px;
  font-size: 13px;
  font-weight: 650;
}

.export-actions button:hover:not(:disabled) {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.export-actions button:disabled {
  cursor: not-allowed;
  color: var(--color-text-soft);
  background: var(--color-surface-muted);
  opacity: 0.58;
}

.comment-thread-panel {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-outline);
}

.comment-composer-panel {
  flex: 0 0 auto;
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
  padding: 12px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-primary-strong) 58%, transparent);
  border-radius: 8px;
  box-shadow: 0 12px 26px color-mix(in srgb, #18181b 8%, transparent);
}

.comment-lane {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  border-radius: 8px;
}

.comment-thread {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: grid;
  gap: 10px;
  padding: 0;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 10px 24px color-mix(in srgb, #18181b 6%, transparent);
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  will-change: transform;
}

.comment-thread::before {
  content: "";
  position: absolute;
  top: 18px;
  left: -7px;
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border: 2px solid var(--color-surface-panel);
  border-radius: 50%;
}

.comment-thread.active {
  border-color: color-mix(in srgb, var(--color-primary-strong) 42%, var(--color-border));
  box-shadow: 0 14px 30px color-mix(in srgb, #18181b 10%, transparent);
}

.comment-thread-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 10px;
  border-bottom: 1px solid var(--color-outline);
}

.comment-nav-buttons {
  display: flex;
  gap: 4px;
}

.comment-nav-buttons button,
.comment-menu-button {
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  color: var(--color-text-soft);
  background: transparent;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1;
}

.comment-nav-buttons button:hover,
.comment-menu-button:hover {
  color: var(--color-text);
  background: var(--color-surface-muted);
}

.comment-menu-wrap {
  position: relative;
}

.comment-menu {
  position: absolute;
  top: 34px;
  right: 0;
  z-index: 4;
  min-width: 104px;
  display: grid;
  padding: 6px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 16px 34px color-mix(in srgb, #18181b 16%, transparent);
}

.comment-menu button {
  min-height: 34px;
  padding: 0 10px;
  text-align: left;
  background: transparent;
  border-radius: 6px;
}

.comment-menu button:hover {
  background: var(--color-surface-muted);
}

.comment-summary {
  width: 100%;
  min-height: 74px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  text-align: left;
  color: inherit;
  background: transparent;
  border-radius: 8px;
}

.comment-summary:hover {
  background: color-mix(in srgb, var(--color-primary-strong) 6%, transparent);
}

.comment-avatar {
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  color: #fff;
  background: #667085;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.comment-card-body {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.comment-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  color: var(--color-text-soft);
  font-size: 12px;
  line-height: 1.25;
}

.comment-card-meta strong {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-card-content {
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.42;
  overflow-wrap: anywhere;
}

.comment-card-body small {
  color: var(--color-text-soft);
  font-size: 12px;
}

.comment-replies {
  display: grid;
  gap: 8px;
  padding: 0 12px;
}

.comment-replies p {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 8px 0 0 44px;
  color: var(--color-text);
  border-top: 1px solid var(--color-outline);
  font-size: 14px;
  line-height: 1.42;
}

.comment-replies time {
  color: var(--color-text-soft);
  font-size: 12px;
}

.thread-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  padding: 0 12px 12px;
}

.comment-composer-panel .thread-actions {
  padding: 0;
}

.thread-actions button {
  min-height: 36px;
  padding: 0 14px;
  color: #fff;
  background: var(--color-primary);
  border-radius: 8px;
}

.delete-button {
  color: #b42318;
}

.thread-actions .ghost-button {
  color: var(--color-text-soft);
  background: transparent;
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
  cursor: pointer;
}

.markdown-body :deep(.comment-anchor-active) {
  background: color-mix(in srgb, var(--color-primary-strong) 14%, transparent);
  border-bottom-color: var(--color-primary-strong);
}

.print-comment-appendix {
  display: none;
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
  overscroll-behavior-x: contain;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.markdown-body :deep(.md-table) {
  width: 100%;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  table-layout: auto;
}

.markdown-body :deep(.md-table th),
.markdown-body :deep(.md-table td) {
  min-width: 132px;
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  word-break: normal;
  overflow-wrap: break-word;
  border-bottom: 1px solid var(--color-border);
}

.markdown-body :deep(.md-table th:nth-child(1)),
.markdown-body :deep(.md-table td:nth-child(1)) {
  min-width: 96px;
  word-break: keep-all;
  overflow-wrap: normal;
}

.markdown-body :deep(.md-table th:nth-child(2)),
.markdown-body :deep(.md-table td:nth-child(2)) {
  min-width: 118px;
  word-break: keep-all;
  overflow-wrap: normal;
}

.markdown-body :deep(.md-table th:nth-child(3)),
.markdown-body :deep(.md-table td:nth-child(3)) {
  min-width: 180px;
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

.markdown-body :deep(.md-inline-list-marker) {
  display: inline-block;
  min-width: 1.15em;
  color: var(--color-text);
  font-weight: 700;
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

@media print {
  .workspace-page {
    display: block;
    height: auto;
    background: #fff;
  }

  .app-rail,
  .workspace-toolbar,
  .sidebar,
  .panel,
  .selection-toolbar {
    display: none !important;
  }

  .reader-scroll {
    display: block;
    min-height: auto;
    overflow: visible;
    background: #fff;
  }

  .reader,
  .reader:has(.md-table-frame) {
    max-width: none;
    min-height: auto;
    margin: 0;
    padding: 0;
    color: #111827;
    background: #fff;
    border: 0;
    border-radius: 0;
  }

  .path {
    color: #4b5563;
  }

  .markdown-body :deep(.annotation-highlight),
  .markdown-body :deep(.annotation-underline),
  .markdown-body :deep(.comment-anchor),
  .markdown-body :deep(.comment-anchor-active) {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .print-comment-appendix.enabled {
    display: block;
    break-before: page;
    margin-top: 28px;
    padding-top: 18px;
    border-top: 1px solid #d1d5db;
  }

  .print-comment-appendix h2 {
    margin: 0 0 18px;
    color: #111827;
    font-size: 24px;
  }

  .print-comment-appendix article {
    break-inside: avoid;
    margin-bottom: 18px;
    padding: 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
  }

  .print-comment-appendix h3 {
    margin: 0 0 8px;
    color: #374151;
    font-size: 14px;
  }

  .print-comment-appendix blockquote {
    margin: 0 0 12px;
    padding: 8px 10px;
    color: #111827;
    background: #f8fafc;
    border-left: 3px solid #2563eb;
  }

  .print-comment-appendix ol {
    margin: 0 0 0 20px;
    padding: 0;
  }
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
