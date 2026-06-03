import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const requiredFiles = [
  'src/types/document.ts',
  'src/mocks/documents.ts',
  'src/services/localDocumentService.ts',
  'src/services/localStorageService.ts',
  'src/services/searchService.ts',
  'src/services/preferencesService.ts',
  'src/utils/storage.ts'
]

for (const path of requiredFiles) {
  assert.equal(existsSync(join(root, path)), true, `${path} should exist`)
}

const types = readFileSync(join(root, 'src/types/document.ts'), 'utf8')
for (const exportedType of [
  'LibraryNode',
  'Mark',
  'CommentThread',
  'CommentItem',
  'SearchResult',
  'Preferences'
]) {
  assert.match(types, new RegExp(`export interface ${exportedType}`), `${exportedType} should be exported`)
}

for (const field of [
  'document_id',
  'selected_text',
  'start_offset',
  'end_offset',
  'scroll_position',
  'reading_width',
  'show_left_sidebar',
  'show_right_panel'
]) {
  assert.match(types, new RegExp(field), `types should preserve persisted field ${field}`)
}

const mocks = readFileSync(join(root, 'src/mocks/documents.ts'), 'utf8')
for (const mockExport of [
  'mockDocuments',
  'mockLibraryTree',
  'mockHistory',
  'mockMarks',
  'mockCommentThreads',
  'mockPreferences'
]) {
  assert.match(mocks, new RegExp(`export const ${mockExport}`), `${mockExport} should be centralized in mocks`)
}
assert.match(mocks, /\[Mock\]/, 'visible mock data should include [Mock] label')

const documentService = readFileSync(join(root, 'src/services/localDocumentService.ts'), 'utf8')
assert.match(documentService, /FileReader|arrayBuffer|text\(/, 'local document service should read local files')
assert.match(documentService, /webkitRelativePath/, 'local document service should support folder relative paths')
assert.match(documentService, /DOMPurify\.sanitize/, 'Markdown HTML should be sanitized')

const storageService = readFileSync(join(root, 'src/services/localStorageService.ts'), 'utf8')
assert.match(storageService, /localStorage/, 'local data service should explicitly use current browser localStorage')
assert.doesNotMatch(storageService, /fetch\(|axios|XMLHttpRequest|indexedDB/i, 'local data service should not imply remote upload or cloud sync')
assert.match(storageService, /clearLocalData/, 'local data service should expose local data clearing')

const searchService = readFileSync(join(root, 'src/services/searchService.ts'), 'utf8')
assert.match(searchService, /searchDocuments/, 'search service should expose library search')
assert.match(searchService, /searchCurrentDocument/, 'search service should expose current document search')
assert.match(searchService, /snippet/, 'search service should return result snippets')

const preferencesService = readFileSync(join(root, 'src/services/preferencesService.ts'), 'utf8')
assert.match(preferencesService, /font_size/, 'preferences service should use persisted field names')
assert.match(preferencesService, /reading_width/, 'preferences service should use persisted field names')

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(packageJson.scripts?.['test:t002'], 'node tests/t002-contract.test.mjs')
