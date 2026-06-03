import type { CommentThread, DocumentItem, HistoryItem, LibraryNode, Mark, Preferences } from '@/types/document'

export const mockDocuments: DocumentItem[] = [{
  id: 'doc_reader_guide_md',
  name: '[Mock] 阅读指南.md',
  path: '示例/阅读指南.md',
  type: 'folder_document',
  content: '# [Mock] Markdown 阅读指南\n\n这是一份用于演示阅读器能力的本地样例文档。\n\n## 本地保存状态\n\n历史、阅读位置和批注仅保存在当前浏览器。',
  last_modified: 1780026000000,
  headings: [
    { id: 'heading_1', level: 1, text: '[Mock] Markdown 阅读指南', position: 0 },
    { id: 'heading_2', level: 2, text: '本地保存状态', position: 4 }
  ]
}]

export const mockDocument = mockDocuments[0]

export const mockLibraryTree: LibraryNode[] = [
  {
    id: 'node_sample',
    name: '[Mock] 示例',
    path: '示例',
    kind: 'folder',
    children: [
      {
        id: 'doc_reader_guide_md',
        name: '[Mock] 阅读指南.md',
        path: '示例/阅读指南.md',
        kind: 'document',
        children: []
      }
    ]
  }
]

export const mockHistory: HistoryItem[] = [
  {
    id: 'history_doc_reader_guide_md',
    document_id: 'doc_reader_guide_md',
    name: '[Mock] 阅读指南.md',
    path: '示例/阅读指南.md',
    source_type: 'folder_document',
    last_opened_at: '2026-05-29T10:30:00+08:00',
    scroll_position: 1280
  }
]

export const mockMarks: Mark[] = [
  {
    id: 'mark_001',
    document_id: 'doc_reader_guide_md',
    type: 'highlight',
    selected_text: '本地保存状态',
    anchor: { heading_id: 'heading_2', start_offset: 0, end_offset: 6 },
    created_at: '2026-05-29T10:32:00+08:00'
  }
]

export const mockCommentThreads: CommentThread[] = [
  {
    id: 'thread_001',
    document_id: 'doc_reader_guide_md',
    selected_text: '本地保存状态',
    anchor: { heading_id: 'heading_2', start_offset: 0, end_offset: 6 },
    comments: [
      {
        id: 'comment_001',
        content: '[Mock] 这里后续需要补导出策略。',
        created_at: '2026-05-29T10:33:00+08:00',
        updated_at: '2026-05-29T10:33:00+08:00'
      }
    ],
    created_at: '2026-05-29T10:33:00+08:00'
  }
]

export const mockPreferences: Preferences = {
  theme: 'warm',
  font_size: 16,
  reading_width: 720,
  show_left_sidebar: true,
  show_right_panel: true,
  right_panel_tab: 'comments'
}
