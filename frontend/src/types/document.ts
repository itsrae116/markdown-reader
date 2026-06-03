export type DocumentType = 'file' | 'folder_document'
export type MarkType = 'highlight' | 'underline'
export type Theme = 'light' | 'warm' | 'dark'
export type RightPanelTab = 'toc' | 'comments'
export type LibraryNodeKind = 'folder' | 'document'
export type SearchScope = 'current_document' | 'library'

export interface Heading {
  id: string
  level: number
  text: string
  position: number
}

export interface DocumentItem {
  id: string
  name: string
  path: string
  type: DocumentType
  content: string
  last_modified: number
  headings: Heading[]
  assets?: Record<string, string>
}

export interface LibraryNode {
  id: string
  name: string
  path: string
  kind: LibraryNodeKind
  children: LibraryNode[]
}

export interface HistoryItem {
  id: string
  document_id: string
  name: string
  path: string
  source_type: DocumentType
  last_opened_at: string
  scroll_position: number
}

export interface TextAnchor {
  heading_id: string
  start_offset: number
  end_offset: number
}

export interface Mark {
  id: string
  document_id: string
  type: MarkType
  selected_text: string
  anchor: TextAnchor
  created_at: string
}

export interface CommentItem {
  id: string
  content: string
  created_at: string
  updated_at: string
}

export interface CommentThread {
  id: string
  document_id: string
  selected_text: string
  anchor: TextAnchor
  comments: CommentItem[]
  created_at: string
}

export interface SearchResult {
  document_id: string
  document_name: string
  path: string
  snippet: string
  position: number
}

export interface Preferences {
  theme: Theme
  font_size: number
  reading_width: number
  show_left_sidebar: boolean
  show_right_panel: boolean
  right_panel_tab: RightPanelTab
}
