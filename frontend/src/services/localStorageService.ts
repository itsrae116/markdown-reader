import type { CommentItem, CommentThread, HistoryItem, Mark } from '@/types/document'
import { readLocalJson, removeLocalKey, writeLocalJson } from '@/utils/storage'

const STORAGE_KEYS = {
  history: 'markdown-reader:history',
  marks: 'markdown-reader:marks',
  commentThreads: 'markdown-reader:comment-threads'
} as const

// V1 data is intentionally scoped to the current browser localStorage only.
export function getHistory(): HistoryItem[] {
  return readLocalJson<HistoryItem[]>(STORAGE_KEYS.history, [])
}

export function saveHistory(items: HistoryItem[]): void {
  writeLocalJson(STORAGE_KEYS.history, items)
}

export function updateHistoryItem(item: HistoryItem): HistoryItem[] {
  const scroll_position = item.scroll_position
  const nextHistory = [
    {
      ...item,
      scroll_position,
      last_opened_at: new Date().toISOString()
    },
    ...getHistory().filter((historyItem) => historyItem.document_id !== item.document_id)
  ].slice(0, 5)
  saveHistory(nextHistory)
  return nextHistory
}

export function getMarks(document_id: string): Mark[] {
  return readLocalJson<Mark[]>(STORAGE_KEYS.marks, []).filter((mark) => mark.document_id === document_id)
}

export function saveMarks(items: Mark[]): void {
  writeLocalJson(STORAGE_KEYS.marks, items)
}

export function upsertMark(mark: Mark): Mark[] {
  const selected_text = mark.selected_text
  const nextMarks = [
    {
      ...mark,
      selected_text
    },
    ...readLocalJson<Mark[]>(STORAGE_KEYS.marks, []).filter((item) => item.id !== mark.id)
  ]
  saveMarks(nextMarks)
  return nextMarks
}

export function removeMark(markId: string, document_id: string): Mark[] {
  const nextMarks = readLocalJson<Mark[]>(STORAGE_KEYS.marks, []).filter((item) => item.id !== markId)
  saveMarks(nextMarks)
  return nextMarks.filter((mark) => mark.document_id === document_id)
}

export function getCommentThreads(document_id: string): CommentThread[] {
  return readLocalJson<CommentThread[]>(STORAGE_KEYS.commentThreads, []).filter((thread) => thread.document_id === document_id)
}

export function saveCommentThreads(items: CommentThread[]): void {
  writeLocalJson(STORAGE_KEYS.commentThreads, items)
}

export function upsertCommentThread(commentThread: CommentThread): CommentThread[] {
  const selected_text = commentThread.selected_text
  const nextThreads = [
    {
      ...commentThread,
      selected_text
    },
    ...readLocalJson<CommentThread[]>(STORAGE_KEYS.commentThreads, []).filter((item) => item.id !== commentThread.id)
  ]
  saveCommentThreads(nextThreads)
  return nextThreads
}

export function appendCommentToThread(threadId: string, content: string): CommentItem | null {
  const comment: CommentItem = {
    id: `comment_${Date.now()}`,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  const commentThreads = readLocalJson<CommentThread[]>(STORAGE_KEYS.commentThreads, [])
  const nextThreads = commentThreads.map((thread) => (
    thread.id === threadId
      ? { ...thread, comments: [...thread.comments, comment] }
      : thread
  ))

  if (!nextThreads.some((thread) => thread.id === threadId)) return null

  saveCommentThreads(nextThreads)
  return comment
}

export function removeCommentThread(threadId: string, document_id: string): CommentThread[] {
  const nextThreads = readLocalJson<CommentThread[]>(STORAGE_KEYS.commentThreads, []).filter((thread) => thread.id !== threadId)
  saveCommentThreads(nextThreads)
  return nextThreads.filter((thread) => thread.document_id === document_id)
}

export function clearLocalData(): void {
  removeLocalKey(STORAGE_KEYS.history)
  removeLocalKey(STORAGE_KEYS.marks)
  removeLocalKey(STORAGE_KEYS.commentThreads)
  removeLocalKey('markdown-reader:preferences')
}
