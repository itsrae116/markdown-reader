<script setup lang="ts">
defineProps<{
  name: 'home' | 'library' | 'search' | 'settings' | 'comments' | 'workspace'
}>()
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <g v-if="name === 'home'">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-5h4v5" />
    </g>
    <g v-else-if="name === 'library'">
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h5" />
    </g>
    <g v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
    </g>
    <g v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 4.5v4" />
      <path d="M12 15.5v4" />
      <path d="M4.5 12h4" />
      <path d="M15.5 12h4" />
      <path d="m6.7 6.7 2.8 2.8" />
      <path d="m14.5 14.5 2.8 2.8" />
      <path d="m17.3 6.7-2.8 2.8" />
      <path d="m9.5 14.5-2.8 2.8" />
    </g>
    <g v-else-if="name === 'comments'">
      <path d="M5 5h14v10H9l-4 4z" />
      <path d="M8 9h8" />
      <path d="M8 12h6" />
    </g>
    <g v-else-if="name === 'workspace'">
      <path d="M4 5h16v14H4z" />
      <path d="M9 5v14" />
      <path d="M12 9h5" />
      <path d="M12 12h5" />
      <path d="M12 15h3" />
    </g>
  </svg>
</template>
