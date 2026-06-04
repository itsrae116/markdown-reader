import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const workspacePage = readFileSync(join(root, 'src/pages/WorkspacePage.vue'), 'utf8')
const exportService = readFileSync(join(root, 'src/services/exportService.ts'), 'utf8')

for (const token of [
  'includePdfComments',
  'isPrintingAnnotatedPdf',
  'exportAnnotatedPdf',
  'exportCommentMarkdown',
  'buildCommentMarkdown',
  'createExportFileName',
  'downloadTextFile',
  '导出标记 PDF',
  '导出批注 Markdown',
  'PDF 包含批注内容',
  'print-comment-appendix',
  '@media print',
  'window.print()'
]) {
  assert.match(workspacePage, new RegExp(escapeRegExp(token)), `WorkspacePage should contain ${token}`)
}

assert.match(workspacePage, /:disabled="!store\.currentDocument"/, 'PDF export should require an opened document')
assert.match(workspacePage, /:disabled="!activeCommentThreads\.length"/, 'Markdown export should require comment threads')
assert.match(workspacePage, /class="export-panel panel-section"/, 'Export controls should live in the annotation panel')
assert.match(workspacePage, /class="print-comment-appendix"[\s\S]*?thread\.selected_text[\s\S]*?thread\.comments/, 'PDF appendix should include selected text and comments when enabled')

for (const token of [
  'buildCommentMarkdown',
  'groupThreadsByHeading',
  'findHeadingForThread',
  'getLineStartOffset',
  '### 命中文字',
  '### 批注内容',
  'downloadTextFile',
  'Blob',
  'URL.createObjectURL',
  'createExportFileName',
  '批注汇总'
]) {
  assert.match(exportService, new RegExp(escapeRegExp(token)), `export service should contain ${token}`)
}

assert.doesNotMatch(exportService, /fetch\(|axios|XMLHttpRequest/i, 'Export should stay local-only')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
