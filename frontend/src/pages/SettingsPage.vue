<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useAppStore } from '@/stores/appStore'
import { clearLocalData } from '@/services/localStorageService'
import { resetPreferences, savePreferences } from '@/services/preferencesService'
import type { Preferences, Theme } from '@/types/document'

const router = useRouter()
const store = useAppStore()
const confirmClear = ref(false)

const themeOptions: Array<{ label: string; value: Theme }> = [
  { label: '浅色', value: 'light' },
  { label: '暖色', value: 'warm' },
  { label: '深色', value: 'dark' }
]

const fontSize = computed({
  get: () => store.preferences.font_size,
  set: (font_size: number) => handlePreferenceChange({ font_size })
})

const readingWidth = computed({
  get: () => store.preferences.reading_width,
  set: (reading_width: number) => handlePreferenceChange({ reading_width })
})

function handlePreferenceChange(preferences: Partial<Preferences>) {
  const nextPreferences = savePreferences(preferences)
  store.updatePreferences(nextPreferences)
}

function confirmClearLocalData() {
  if (!confirmClear.value) {
    confirmClear.value = true
    return
  }

  clearLocalData()
  store.setHistory([])
  store.setMarks([])
  store.setCommentThreads([])
  store.updatePreferences(resetPreferences())
  confirmClear.value = false
}

async function closeSettings() {
  await router.push('/workspace')
}
</script>

<template>
  <main class="settings-page">
    <nav class="app-rail" aria-label="主导航">
      <RouterLink class="rail-logo rail-link" to="/" aria-label="返回启动页"><AppIcon name="home" /></RouterLink>
      <RouterLink class="rail-link" to="/workspace" title="阅读工作台"><AppIcon name="library" /></RouterLink>
      <RouterLink class="rail-link" to="/search" title="搜索"><AppIcon name="search" /></RouterLink>
      <RouterLink class="rail-link rail-bottom router-link-active" to="/settings" title="设置"><AppIcon name="settings" /></RouterLink>
    </nav>
    <header class="app-topbar">
      <h1>Markdown Reader</h1>
    </header>
    <section class="settings-preview" aria-hidden="true">
      <article>
        <h2>关于深入理解 Markdown 的排版美学</h2>
        <p>在数字阅读的时代，文字的承载方式正在经历一场深刻的变革。Markdown 不仅仅是一种标记语言，它代表了一种“内容优先”的哲学。</p>
        <blockquote>“设计不应该是装饰，而是为了消除干扰。”</blockquote>
        <h3>排版的物理性</h3>
        <p>这里的背景色调经过了精心的暖色处理，以减轻长时间阅读带来的视觉疲劳。</p>
      </article>
    </section>
    <div class="settings-overlay" aria-hidden="true"></div>
    <section class="settings-drawer" aria-label="阅读设置">
      <header>
        <div>
          <h1>阅读设置</h1>
          <p>按你的阅读习惯调整</p>
        </div>
        <RouterLink to="/workspace" aria-label="关闭">×</RouterLink>
      </header>

      <section class="setting-group">
        <h2>阅读外观</h2>
        <div class="segmented">
          <button
            v-for="theme in themeOptions"
            :key="theme.value"
            type="button"
            :class="{ active: store.preferences.theme === theme.value }"
            @click="handlePreferenceChange({ theme: theme.value })"
          >
            {{ theme.label }}
          </button>
        </div>

        <label>
          <span>字号大小 <strong>{{ store.preferences.font_size }}px</strong></span>
          <input
            v-model.number="fontSize"
            type="range"
            min="14"
            max="22"
            step="1"
          />
          <input class="sr-only" type="number" :value="store.preferences.font_size" readonly aria-label="字号数值" />
        </label>

        <label>
          <span>页面宽度 <strong>{{ store.preferences.reading_width }}px</strong></span>
          <input
            v-model.number="readingWidth"
            type="range"
            min="620"
            max="860"
            step="20"
          />
        </label>
      </section>

      <section class="setting-group">
        <h2>面板显示</h2>
        <label class="switch-row">
          <span>显示目录栏</span>
          <input
            type="checkbox"
            :checked="store.preferences.show_left_sidebar"
            @change="handlePreferenceChange({ show_left_sidebar: !store.preferences.show_left_sidebar })"
          />
        </label>
        <label class="switch-row">
          <span>显示批注栏</span>
          <input
            type="checkbox"
            :checked="store.preferences.show_right_panel"
            @change="handlePreferenceChange({ show_right_panel: !store.preferences.show_right_panel })"
          />
        </label>
      </section>

      <section class="setting-group danger-zone">
        <h2>本地记录</h2>
        <p>阅读位置、高亮、划线和批注会留在当前浏览器，原始文件不会被修改。</p>
        <button type="button" class="danger" @click="confirmClearLocalData">
          {{ confirmClear ? '再次点击清除记录' : '清除阅读记录和批注' }}
        </button>
      </section>

      <button type="button" class="close-button" @click="closeSettings">关闭</button>
    </section>
  </main>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding-left: var(--rail-width);
  background: var(--color-background);
  overflow: hidden;
}

.settings-preview {
  height: 100vh;
  padding-top: var(--toolbar-height);
  display: grid;
  place-items: center;
}

.settings-preview article {
  width: min(720px, calc(100vw - 520px));
  min-height: 70vh;
  padding: 56px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.settings-preview h2,
.settings-preview h3 {
  font-family: var(--font-display);
  color: var(--color-ink);
}

.settings-preview p {
  color: var(--color-text-soft);
  line-height: 1.7;
}

.settings-preview blockquote {
  margin: 28px 0;
  padding: 22px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.settings-overlay {
  position: fixed;
  inset: 0 360px 0 var(--rail-width);
  z-index: 30;
  background: color-mix(in srgb, #18181b 22%, transparent);
}

.settings-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 40;
  width: min(360px, calc(100vw - var(--rail-width)));
  display: grid;
  grid-template-rows: auto auto auto auto 1fr auto;
  align-content: start;
  gap: 20px;
  padding: 0 28px 28px;
  background: var(--color-surface-panel);
  border-left: 1px solid var(--color-outline);
  box-shadow: -22px 0 48px color-mix(in srgb, #18181b 12%, transparent);
}

.settings-drawer > header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  min-height: 68px;
  margin-inline: -28px;
  padding: 0 28px;
  border-bottom: 1px solid var(--color-outline);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 0;
}

.settings-drawer > header p {
  margin: 4px 0 0;
  color: var(--color-text-soft);
  font-size: 12px;
}

h2 {
  margin: 0;
  font-size: 15px;
  letter-spacing: 0;
}

.settings-drawer a,
.settings-drawer button {
  min-height: 36px;
  padding: 0 12px;
  color: var(--color-text);
  text-decoration: none;
  background: var(--color-surface-muted);
  border-radius: 8px;
}

.settings-drawer > header a {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 30px;
  background: transparent;
}

.setting-group {
  display: grid;
  gap: 12px;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 4px;
  background: var(--color-surface-muted);
  border-radius: 8px;
}

.segmented button.active {
  color: var(--color-ink);
  background: var(--color-surface);
  box-shadow: 0 1px 8px color-mix(in srgb, #18181b 9%, transparent);
}

label {
  display: grid;
  gap: 8px;
  color: var(--color-text);
}

label > span {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

label strong {
  color: var(--color-primary);
}

input[type="range"] {
  width: 100%;
  accent-color: var(--color-ink);
}

.switch-row {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.switch-row input {
  width: 44px;
  height: 24px;
  accent-color: var(--color-ink);
}

.danger-zone {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.danger-zone p {
  margin: 0;
  color: var(--color-text-soft);
}

.danger {
  justify-self: start;
  color: #ba1a1a;
  background: transparent;
}

.close-button {
  width: 100%;
  min-height: 48px;
  align-self: end;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
</style>
