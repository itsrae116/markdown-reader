import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const settingsPage = readFileSync(join(root, 'src/pages/SettingsPage.vue'), 'utf8')
const appShell = readFileSync(join(root, 'src/components/AppShell.vue'), 'utf8')
const preferencesService = readFileSync(join(root, 'src/services/preferencesService.ts'), 'utf8')
const localStorageService = readFileSync(join(root, 'src/services/localStorageService.ts'), 'utf8')
const themeCss = readFileSync(join(root, 'src/styles/theme.css'), 'utf8')

for (const token of [
  'settings-drawer',
  'themeOptions',
  '浅色',
  '暖色',
  '深色',
  'font_size',
  'reading_width',
  'show_left_sidebar',
  'show_right_panel',
  'handlePreferenceChange',
  'confirmClearLocalData',
  'clearLocalData',
  '再次点击清除记录',
  '按你的阅读习惯调整',
  '关闭',
  'RouterLink to="/workspace"'
]) {
  assert.match(settingsPage, new RegExp(escapeRegExp(token)), `SettingsPage should contain ${token}`)
}

assert.match(settingsPage, /type="range"/, 'Reading width should use a slider')
assert.match(settingsPage, /type="number"/, 'Font size should use a numeric control')
assert.match(settingsPage, /type="checkbox"/, 'Panel visibility should use checkboxes')
assert.doesNotMatch(settingsPage, /<RouterLink class="icon-button" to="\/search"/, 'Settings topbar should not duplicate search navigation')
assert.doesNotMatch(settingsPage, /<RouterLink class="icon-button" to="\/workspace"/, 'Settings topbar should not duplicate workspace navigation')
assert.doesNotMatch(settingsPage, /title="历史"/, 'Settings rail should not expose placeholder history action')
assert.doesNotMatch(settingsPage, /fetch\(|axios|XMLHttpRequest/i, 'Settings should stay local-only')

for (const token of [
  'getPreferences',
  'savePreferences',
  'resetPreferences',
  'defaultPreferences'
]) {
  assert.match(preferencesService, new RegExp(escapeRegExp(token)), `preferences service should contain ${token}`)
}

for (const token of [
  'removeLocalKey',
  'markdown-reader:preferences',
  'clearLocalData'
]) {
  assert.match(localStorageService, new RegExp(escapeRegExp(token)), `local storage service should contain ${token}`)
}

for (const token of [
  'theme-${store.preferences.theme}',
  ':class="themeClass"',
  'getPreferences',
  'updatePreferences'
]) {
  assert.match(appShell, new RegExp(escapeRegExp(token)), `AppShell should contain ${token}`)
}

for (const token of [
  '.theme-light',
  '.theme-warm',
  '.theme-dark'
]) {
  assert.match(themeCss, new RegExp(escapeRegExp(token)), `theme.css should contain ${token}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
