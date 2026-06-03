import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const startPage = readFileSync(join(root, 'src/pages/StartPage.vue'), 'utf8')
const workspacePage = readFileSync(join(root, 'src/pages/WorkspacePage.vue'), 'utf8')
const store = readFileSync(join(root, 'src/stores/appStore.ts'), 'utf8')

for (const token of [
  '@dragover.prevent',
  '@drop.prevent',
  'handleDrop',
  'handleFileSelect',
  'handleFolderSelect',
  'fileInput',
  'folderInput',
  'webkitdirectory',
  'accept=".md,.markdown"',
  'recentRecords',
  'openRecent',
  'router.push',
  '仅支持 .md 或 .markdown 文件',
  '未找到 Markdown 文档',
  '内容仅在本机浏览器读取和保存'
]) {
  assert.match(startPage, new RegExp(escapeRegExp(token)), `StartPage should contain ${token}`)
}

assert.match(startPage, /readMarkdownFile/, 'StartPage should use local file reader service')
assert.match(startPage, /readMarkdownFolder/, 'StartPage should use local folder reader service')
assert.match(startPage, /saveHistory/, 'StartPage should persist recent records locally')
assert.doesNotMatch(startPage, /fetch\(|axios|XMLHttpRequest/i, 'StartPage should not upload local files')

for (const token of [
  'documents:',
  'libraryTree:',
  'history:',
  'setLibrary',
  'setHistory',
  'setCurrentDocument'
]) {
  assert.match(store, new RegExp(escapeRegExp(token)), `store should contain ${token}`)
}

for (const token of [
  'currentDocument',
  'renderMarkdown',
  'v-html',
  'libraryTree',
  'headings',
  'Markdown 正文将在这里渲染'
]) {
  assert.match(workspacePage, new RegExp(escapeRegExp(token)), `WorkspacePage should contain ${token}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
