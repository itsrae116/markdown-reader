import { createRouter, createWebHistory } from 'vue-router'
import StartPage from '@/pages/StartPage.vue'
import WorkspacePage from '@/pages/WorkspacePage.vue'
import SearchPage from '@/pages/SearchPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'start', component: StartPage },
    { path: '/workspace', name: 'workspace', component: WorkspacePage },
    { path: '/search', name: 'search', component: SearchPage },
    { path: '/settings', name: 'settings', component: SettingsPage }
  ]
})

export default router
