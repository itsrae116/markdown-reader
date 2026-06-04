import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const searchPage = readFileSync(join(root, 'src/pages/SearchPage.vue'), 'utf8')
const searchService = readFileSync(join(root, 'src/services/searchService.ts'), 'utf8')
const store = readFileSync(join(root, 'src/stores/appStore.ts'), 'utf8')

for (const token of [
  'search-drawer',
  'searchScope',
  'current_document',
  'library',
  'searchCurrentDocument',
  'searchDocuments',
  'groupedResults',
  'handleResultClick',
  'router.push',
  'setCurrentDocument',
  'setCurrentSearchPosition',
  '--search-drawer-width',
  'width: var(--search-drawer-width)',
  'overflow-wrap: anywhere',
  '.result-item strong',
  '命中片段',
  '没有找到相关内容',
  '换个关键词',
  '当前文档',
  '文档库',
  '在打开的文档中定位内容'
]) {
  assert.match(searchPage, new RegExp(escapeRegExp(token)), `SearchPage should contain ${token}`)
}

assert.match(searchPage, /v-for="group in groupedResults"/, 'Search results should be grouped')
assert.match(searchPage, /result\.snippet/, 'Search results should show snippets')
assert.match(searchPage, /result\.position/, 'Search results should show positions')
assert.match(searchPage, /\.search-controls[\s\S]*?min-width: 0/, 'Search controls should not overflow the drawer')
assert.match(searchPage, /\.scope-control[\s\S]*?margin-inline: 0/, 'Search scope tabs should stay inside the drawer')
assert.match(searchPage, /\.result-item strong[\s\S]*?white-space: normal/, 'Search snippets should wrap inside the result card')
assert.doesNotMatch(searchPage, /title="历史"/, 'Search rail should not expose placeholder history action')
assert.doesNotMatch(searchPage, /fetch\(|axios|XMLHttpRequest/i, 'Search should stay local-only')

for (const token of [
  'highlightSnippet',
  'keywordLength',
  'document_id',
  'document_name',
  'snippet',
  'position'
]) {
  assert.match(searchService, new RegExp(escapeRegExp(token)), `search service should contain ${token}`)
}

for (const token of [
  'currentSearchPosition',
  'setCurrentSearchPosition'
]) {
  assert.match(store, new RegExp(escapeRegExp(token)), `store should contain ${token}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
