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
  'removeMarkById',
  'comment-anchor',
  'annotation-highlight',
  'annotation-underline',
  'comment-composer-panel',
  '批注线程',
  '追加批注',
  '创建批注',
  '高亮',
  '划线',
  '批注',
  'applyDocumentAnnotations',
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
assert.match(workspacePage, /store\.commentThreads\.filter/, 'comment threads should be rendered from thread state')
assert.doesNotMatch(workspacePage, /<span>{{ selectedText }}<\/span>/, 'Selection toolbar should not echo selected text')
assert.doesNotMatch(workspacePage, /mark-panel|高亮和划线会显示在这里/, 'Right panel should not expose highlight or underline management')
assert.doesNotMatch(workspacePage, /<div v-if="isCommenting" class="comment-composer">/, 'Selection toolbar should not contain the comment input')

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
