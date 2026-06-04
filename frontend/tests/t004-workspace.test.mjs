import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const workspacePage = readFileSync(join(root, 'src/pages/WorkspacePage.vue'), 'utf8')
const appIcon = readFileSync(join(root, 'src/components/AppIcon.vue'), 'utf8')
const themeCss = readFileSync(join(root, 'src/styles/theme.css'), 'utf8')
const documentService = readFileSync(join(root, 'src/services/localDocumentService.ts'), 'utf8')
const storageService = readFileSync(join(root, 'src/services/localStorageService.ts'), 'utf8')
const store = readFileSync(join(root, 'src/stores/appStore.ts'), 'utf8')

for (const token of [
  'workspace-toolbar',
  'AppIcon',
  '<AppIcon name="library" />',
  '<AppIcon name="comments" />',
  'current-title',
  '搜索',
  '设置',
  'toggleLeftSidebar',
  'toggleRightPanel',
  'readerScroll',
  '@scroll.passive',
  'restoreReadingPosition',
  'saveReadingPosition',
  'switchDocument',
  'scrollToHeading',
  'heading-level-',
  'renderLibraryNode',
  'renderLibraryNode(child, level + 1)',
  'expandedHeadingIds',
  'expandedFolderIds',
  'visibleHeadings',
  'initializeHeadingExpansion',
  'initializeLibraryExpansion',
  'toggleHeading',
  'toggleFolder',
  'isHeadingVisible',
  'isFolderExpanded',
  'collapse-toggle',
  'collapse-spacer',
  'row-count',
  'formatDocumentName',
  "replace(/\\.(md|markdown)$/i, '')",
  'folder-row',
  'library-level-',
  'row-label',
  'folder-children',
  '.tree-item',
  '.library-panel :deep(.document-row)',
  '.library-panel :deep(.row-label)',
  '.library-panel :deep(.folder-children)',
  '.library-panel :deep(.tree-item)',
  'aria-label="目录和文档库"',
  'aria-label="批注栏"',
  "leftSidebarTab === 'toc'",
  "leftSidebarTab === 'library'",
  'activeHeadingId',
  'updateActiveHeading',
  'keepActiveHeadingVisible',
  'scrollRoot.scrollTo',
  'isInsideToolbar',
  ':data-heading-id="heading.id"',
  'ref="tocScroll"',
  'max-width: min(var(--reader-width)',
  'grid-template-columns: var(--left-panel-width)',
  'height: 100vh',
  'overflow: hidden',
  '.reader-scroll',
  'grid-column: 3',
  '.workspace-page.is-left-hidden .reader-scroll',
  '.workspace-page.is-left-hidden .panel'
]) {
  assert.match(workspacePage, new RegExp(escapeRegExp(token)), `WorkspacePage should contain ${token}`)
}

assert.match(workspacePage, /v-html="annotatedContent"/, 'Workspace should render sanitized Markdown HTML with local annotations')
assert.match(workspacePage, /@click="scrollToHeading\(heading\.id\)"/, 'TOC headings should target rendered heading ids by click')
assert.match(workspacePage, /<button class="icon-button" type="button" aria-label="切换批注栏"/, 'Workspace top tools should keep the comments panel toggle')
assert.doesNotMatch(workspacePage, /<RouterLink class="icon-button" to="\/search"/, 'Workspace top tools should not duplicate search navigation')
assert.doesNotMatch(workspacePage, /<RouterLink class="icon-button" to="\/settings"/, 'Workspace top tools should not duplicate settings navigation')
assert.doesNotMatch(workspacePage, /title="历史"/, 'Workspace rail should not expose placeholder history action')
assert.doesNotMatch(workspacePage, /:id="heading\.id"/, 'TOC rows should not duplicate rendered heading ids')
assert.doesNotMatch(workspacePage, /重命名|移动|新建/, 'Workspace library should not expose file management actions')
assert.doesNotMatch(workspacePage, /mark-panel|高亮和划线会显示在这里|deleteMark/, 'Right panel should not list highlight or underline marks')
assert.doesNotMatch(workspacePage, /\.library-panel \.document-row\s*{/, 'Library rows should use the same row style as TOC rows')
assert.doesNotMatch(workspacePage, />[▤⌕↺⚙▣]</, 'Workspace navigation should use icon components instead of glyph text')

for (const token of [
  "name: 'home' | 'library' | 'search' | 'settings' | 'comments' | 'workspace'",
  'viewBox="0 0 24 24"',
  'class="app-icon"',
  '<circle cx="12" cy="12" r="7.5" />',
  '<circle cx="12" cy="12" r="2.4" />'
]) {
  assert.match(appIcon, new RegExp(escapeRegExp(token)), `AppIcon should contain ${token}`)
}

assert.doesNotMatch(appIcon, /name === 'history'/, 'AppIcon should not keep unused history icon')

for (const token of [
  '.rail-link .app-icon',
  '.rail-button .app-icon',
  '.icon-button .app-icon',
  'width: 44px',
  'height: 44px'
]) {
  assert.match(themeCss, new RegExp(escapeRegExp(token)), `theme.css should contain ${token}`)
}

for (const token of [
  'renderMarkdownDocument',
  'heading_open',
  'heading_close',
  'headingIndex',
  'level > 3',
  'repairMalformedFences(content).split',
  'insideFence',
  "attrSet('id', heading.id)"
]) {
  assert.match(documentService, new RegExp(escapeRegExp(token)), `document service should contain ${token}`)
}

for (const token of [
  'updateHistoryItem',
  'scroll_position',
  'last_opened_at'
]) {
  assert.match(storageService, new RegExp(escapeRegExp(token)), `storage service should contain ${token}`)
}

for (const token of [
  'setCurrentDocument(document: DocumentItem, scrollPosition = 0)',
  'currentScrollPosition',
  'setCurrentScrollPosition'
]) {
  assert.match(store, new RegExp(escapeRegExp(token)), `store should contain ${token}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
