import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const workspacePage = readFileSync(join(root, 'src/pages/WorkspacePage.vue'), 'utf8')
const store = readFileSync(join(root, 'src/stores/appStore.ts'), 'utf8')
const storageService = readFileSync(join(root, 'src/services/localStorageService.ts'), 'utf8')

for (const token of [
  'selection-toolbar',
  '@mouseup="handleReaderSelection"',
  'selectedText',
  'hasSelectedHighlight',
  'hasSelectedUnderline',
  'createHighlight',
  'createUnderline',
  'startComment',
  'createCommentThread',
  'deleteCommentThread',
  'appendThreadComment',
  'activeCommentThreadId',
  'openCommentMenuId',
  'pendingCommentText',
  'panelScroll',
  'commentLane',
  'commentPanelPositions',
  'visibleCommentThreadIds',
  'focusCommentThreadById',
  'focusAdjacentCommentThread',
  'toggleCommentMenu',
  'isActiveCommentThread',
  'isCommentThreadVisible',
  'getCommentThreadStyle',
  'clearActiveCommentThread',
  'syncCommentPanelWithReader',
  'scrollToCommentAnchor',
  'removeMarkById',
  'comment-anchor',
  'comment-anchor-active',
  'annotation-highlight',
  'annotation-underline',
  'comment-composer-panel',
  'comment-summary',
  'comment-lane',
  'comment-thread-toolbar',
  'comment-menu',
  'comment-replies',
  'export-panel',
  '导出标记 PDF',
  '导出批注 Markdown',
  '批注记录',
  '追加批注',
  '添加批注',
  '高亮',
  '划线',
  '批注',
  'applyDocumentAnnotations',
  'replaceFirstVisibleText',
  'document.createTreeWalker',
  'NodeFilter.SHOW_TEXT',
  'range.insertNode',
  'upsertMark',
  'removeStoredMark',
  'upsertCommentThread',
  'removeStoredCommentThread',
  'getMarks',
  'getCommentThreads'
]) {
  assert.match(workspacePage, new RegExp(escapeRegExp(token)), `WorkspacePage should contain ${token}`)
}

assert.match(workspacePage, /--color-highlight/, 'highlight should use highlight token')
assert.match(workspacePage, /--color-underline/, 'underline should use underline token')
assert.match(workspacePage, /store\.marks\.filter/, 'marks should be rendered from mark state')
assert.match(workspacePage, /\[\.\.\.store\.commentThreads\][\s\S]*?\.filter/, 'comment threads should be rendered from thread state')
assert.match(workspacePage, /pendingCommentText\.value = selectedText\.value/, 'Starting a comment should preserve the original selected text')
assert.match(workspacePage, /const commentTargetText = pendingCommentText\.value \|\| selectedText\.value/, 'Creating a comment should not depend on the live browser selection')
assert.match(workspacePage, /\.sort\(\(left, right\) => left\.anchor\.start_offset - right\.anchor\.start_offset\)/, 'Comment threads should render by document anchor order')
assert.match(workspacePage, /@click="handlePanelClick"/, 'Clicking outside comment cards should clear active comment state')
assert.match(workspacePage, /:data-thread-id="thread\.id"/, 'Comment cards should be addressable for panel scroll sync')
assert.match(workspacePage, /ref="commentLane"/, 'Comment cards should render in a fixed annotation lane')
assert.match(workspacePage, /v-show="isCommentThreadVisible\(thread\)"/, 'Comment lane should only show comments near the reading viewport or active comment')
assert.match(workspacePage, /:style="getCommentThreadStyle\(thread\)"/, 'Comment card position should be driven by anchor layout state')
assert.match(workspacePage, /comment-anchor\[data-thread-id=/, 'Comment lane should locate cards from text anchors')
assert.match(workspacePage, /CSS\.escape\(thread\.id\)/, 'Comment anchor lookup should escape thread ids')
assert.match(workspacePage, /replaceFirstVisibleText\(nextHtml/, 'Annotations should be applied only to visible text nodes')
assert.doesNotMatch(workspacePage, /<span>{{ selectedText }}<\/span>/, 'Selection toolbar should not echo selected text')
assert.doesNotMatch(workspacePage, /html\.replace\(new RegExp\(escapeRegExp\(escapeHtml\(text\)\)\)/, 'Annotations should not replace raw HTML strings because text may appear in attributes')
assert.doesNotMatch(workspacePage, /mark-panel|高亮和划线会显示在这里/, 'Right panel should not expose highlight or underline management')
assert.doesNotMatch(workspacePage, /<div v-if="isCommenting" class="comment-composer">/, 'Selection toolbar should not contain the comment input')
assert.doesNotMatch(workspacePage, /@他人/, 'Personal annotations should not mention @ others')
assert.doesNotMatch(workspacePage, /<textarea v-model="replyDrafts\[thread\.id\]" rows="2" placeholder="添加批注"><\/textarea>\s*<div class="thread-actions">[\s\S]*?<\/div>\s*<\/article>/, 'Reply composer should only render for active comment threads')

for (const token of [
  'marks: [] as Mark[]',
  'commentThreads: [] as CommentThread[]',
  'setMarks',
  'setCommentThreads',
  'addMark',
  'removeMark',
  'addCommentThread',
  'removeCommentThread',
  'appendCommentToThread'
]) {
  assert.match(store, new RegExp(escapeRegExp(token)), `store should contain ${token}`)
}

for (const token of [
  'upsertMark',
  'removeMark',
  'upsertCommentThread',
  'removeCommentThread',
  'appendCommentToThread',
  'selected_text',
  'comments'
]) {
  assert.match(storageService, new RegExp(escapeRegExp(token)), `storage service should contain ${token}`)
}

assert.doesNotMatch(workspacePage, /fetch\(|axios|XMLHttpRequest/i, 'annotation workflow should stay local-only')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
