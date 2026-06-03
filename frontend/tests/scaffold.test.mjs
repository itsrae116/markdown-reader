import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const requiredPaths = [
  'package.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  '.env.example',
  'src/main.ts',
  'src/App.vue',
  'src/router/index.ts',
  'src/stores/appStore.ts',
  'src/services/localDocumentService.ts',
  'src/mocks/documents.ts',
  'src/styles/theme.css',
  'src/pages/StartPage.vue',
  'src/pages/WorkspacePage.vue',
  'src/pages/SearchPage.vue',
  'src/pages/SettingsPage.vue',
  'src/components/AppShell.vue',
  'src/types/document.ts',
  'src/utils/storage.ts'
]

for (const path of requiredPaths) {
  assert.equal(existsSync(join(root, path)), true, `${path} should exist`)
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
for (const script of ['dev', 'build', 'preview', 'typecheck', 'test:scaffold']) {
  assert.equal(typeof packageJson.scripts?.[script], 'string', `script ${script} should exist`)
}

const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8')
assert.match(viteConfig, /port:\s*5199/, 'Vite dev server port should default to 5199')
assert.match(viteConfig, /VITE_BACKEND_PROXY_TARGET/, 'Vite proxy target should be environment driven')

const envExample = readFileSync(join(root, '.env.example'), 'utf8')
assert.match(envExample, /VITE_API_BASE_URL=\/api/, 'API base URL should use relative /api')
assert.match(envExample, /VITE_USE_MOCK=true/, 'Mock mode should default to true for frontend MVP')
assert.match(envExample, /VITE_BACKEND_PROXY_TARGET=http:\/\/localhost:8099/, 'Backend proxy target should default to local port 8099')
