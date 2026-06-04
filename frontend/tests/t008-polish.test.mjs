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

assert.match(themeCss, /\.theme-dark[\s\S]*--color-ink: #f5f7fb/, 'Dark theme ink should stay visible on dark surfaces')
assert.match(themeCss, /\.theme-dark[\s\S]*--color-action: #d8e1ef/, 'Dark theme action icons should have a high-contrast base color')
assert.match(themeCss, /\.theme-dark[\s\S]*--color-action-active: #8ab4ff/, 'Dark theme active actions should use a clear blue accent')
assert.match(themeCss, /\.theme-dark[\s\S]*--color-scrollbar-track: #1a1f2b/, 'Dark theme scrollbar track should use a dark tone')
assert.match(themeCss, /\.theme-dark[\s\S]*--color-scrollbar-thumb: #3b4153/, 'Dark theme scrollbar thumb should avoid bright white contrast')
assert.match(themeCss, /scrollbar-color: var\(--color-scrollbar-thumb\) var\(--color-scrollbar-track\)/, 'Scrollable areas should use themed scrollbar colors')
assert.match(themeCss, /\*::-webkit-scrollbar-thumb[\s\S]*background: var\(--color-scrollbar-thumb\)/, 'WebKit scrollbar thumb should use theme variables')
assert.match(themeCss, /\.rail-link,[\s\S]*?\.rail-button[\s\S]*?color: var\(--color-action-soft\)/, 'Rail actions should use action colors instead of dark ink')
assert.match(themeCss, /\.icon-button[\s\S]*?color: var\(--color-action\)/, 'Top action buttons should use action colors')
