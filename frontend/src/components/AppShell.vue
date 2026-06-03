<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { getPreferences } from '@/services/preferencesService'

const store = useAppStore()
const themeClass = computed(() => `theme-${store.preferences.theme}`)

onMounted(() => {
  store.updatePreferences(getPreferences())
})
</script>

<template>
  <div class="app-shell" :class="themeClass">
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  color: var(--color-text);
  background: var(--color-background);
}
</style>
