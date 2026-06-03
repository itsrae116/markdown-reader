import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const documentService = readFileSync(join(root, 'src/services/localDocumentService.ts'), 'utf8')

for (const token of [
  'hasHierarchyWord',
  '维度|业务标签|标签|场景|项目|领域',
  'hasSeparators',
  'branchCount >= 3',
  'shouldRenderAsOutlineBlock(content: string): boolean',
  'return lines.some(isTreeLikeLine)',
  "language === 'text'",
  'renderPlainTextBlock',
  'repairMalformedFences',
  'shouldCloseMalformedFence',
  'isMarkdownContentLine',
  'isBoxDrawingLine',
  'formatOutlineContent',
  'trimOuterBlankLines'
]) {
  assert.match(documentService, new RegExp(escapeRegExp(token)), `readable block rules should contain ${token}`)
}

assert.doesNotMatch(documentService, /splitOutlineLine/, 'outline blocks should preserve ASCII and box-drawing diagrams')
assert.doesNotMatch(documentService, /shouldRenderAsProseBlock/, 'fenced prompt templates should not be rendered as Markdown prose')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
