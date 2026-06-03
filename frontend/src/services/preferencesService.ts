import type { Preferences } from '@/types/document'
import { readLocalJson, writeLocalJson } from '@/utils/storage'

const PREFERENCES_KEY = 'markdown-reader:preferences'

export const defaultPreferences: Preferences = {
  theme: 'warm',
  font_size: 16,
  reading_width: 720,
  show_left_sidebar: true,
  show_right_panel: true,
  right_panel_tab: 'comments'
}

export function getPreferences(): Preferences {
  return readLocalJson<Preferences>(PREFERENCES_KEY, defaultPreferences)
}

export function savePreferences(preferences: Partial<Preferences>): Preferences {
  const nextPreferences = {
    ...getPreferences(),
    ...preferences
  }
  writeLocalJson(PREFERENCES_KEY, nextPreferences)
  return nextPreferences
}

export function resetPreferences(): Preferences {
  writeLocalJson(PREFERENCES_KEY, defaultPreferences)
  return defaultPreferences
}
