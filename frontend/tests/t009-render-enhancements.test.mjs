import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const documentService = readFileSync(join(root, 'src/services/localDocumentService.ts'), 'utf8')
const enhancementService = readFileSync(join(root, 'src/services/renderEnhancementService.ts'), 'utf8')
const workspacePage = readFileSync(join(root, 'src/pages/WorkspacePage.vue'), 'utf8')
const packageJson = readFileSync(join(root, 'package.json'), 'utf8')

for (const token of [
  'table_open',
  'md-table-frame',
  'md-table',
  "language === 'mermaid'",
  'renderMermaidBlock',
  "language === 'api'",
  'renderApiDocBlock',
  'md-code-block',
  'copy-code-button',
  'isTreeLikeLine',
  'renderOutlineBlock',
  'renderPlainTextBlock',
  '^#{1,3}'
]) {
  assert.match(documentService, new RegExp(escapeRegExp(token)), `document service should contain ${token}`)
}

assert.doesNotMatch(documentService, /normalizeReadableBlocks/, 'plain Markdown content should not be rewritten before markdown-it parses it')
assert.doesNotMatch(documentService, /renderProseBlock/, 'prompt templates and fenced markdown should remain preformatted unless explicitly rendered by type')

for (const token of [
  'renderMermaidBlocks',
  '/vendor/mermaid.min.js',
  'copyCodeFromButton',
  'window.mermaid.initialize',
  'securityLevel'
]) {
  assert.match(enhancementService, new RegExp(escapeRegExp(token)), `enhancement service should contain ${token}`)
}

for (const token of [
  '@click="handleReaderClick"',
  'renderEnhancedBlocks',
  'watch(annotatedContent',
  '.md-table-frame',
  '.md-mermaid-canvas',
  '.api-doc-block',
  '.copy-code-button',
  '.md-outline-block',
  '.md-plain-block',
  'ui-monospace',
  'overflow-wrap: normal'
]) {
  assert.match(workspacePage, new RegExp(escapeRegExp(token)), `workspace page should contain ${token}`)
}

assert.doesNotMatch(
  workspacePage,
  /\.md-outline-block[\s\S]*?font-family:[^;]*PingFang SC/,
  'ASCII outline blocks should not fall back to proportional Chinese UI fonts'
)
assert.doesNotMatch(
  workspacePage,
  /\.md-plain-block[\s\S]*?font-family:[^;]*PingFang SC/,
  'plain preformatted blocks should not fall back to proportional Chinese UI fonts'
)

assert.doesNotMatch(packageJson, /"mermaid"/, 'Mermaid is vendored because npm is unavailable in this environment')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
