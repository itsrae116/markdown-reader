import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const workspacePage = readFileSync(join(root, 'src/pages/WorkspacePage.vue'), 'utf8')
const searchService = readFileSync(join(root, 'src/services/searchService.ts'), 'utf8')
const themeCss = readFileSync(join(root, 'src/styles/theme.css'), 'utf8')

assert.match(workspacePage, /defineComponent/, 'Library tree rendering should use a stable Vue component')
assert.match(workspacePage, /LibraryTreeNode/, 'Workspace should render library tree with LibraryTreeNode')
assert.doesNotMatch(workspacePage, /<component\s+[\s\S]*:is="renderLibraryNode\(node\)"/, 'Workspace should not pass VNodes through dynamic component :is')

assert.match(searchService, /escapeHtml/, 'Search snippets rendered with v-html should escape local document text')
assert.match(searchService, /highlightSnippet\(createSnippet/, 'Search snippets should still highlight keyword after escaping')

assert.match(themeCss, /\.theme-dark[\s\S]*--color-ink: #0f1115/, 'Dark theme action ink should preserve contrast with white button text')
