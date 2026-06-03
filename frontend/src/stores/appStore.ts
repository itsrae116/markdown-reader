import { defineStore } from 'pinia'
import type { CommentItem, CommentThread, DocumentItem, HistoryItem, LibraryNode, Mark, Preferences } from '@/types/document'

export const useAppStore = defineStore('app', {
  state: () => ({
    currentDocument: null as DocumentItem | null,
    currentScrollPosition: 0,
    currentSearchPosition: 0,
    documents: [] as DocumentItem[],
    libraryTree: [] as LibraryNode[],
    history: [] as HistoryItem[],
    marks: [] as Mark[],
    commentThreads: [] as CommentThread[],
    preferences: {
      theme: 'warm',
      font_size: 16,
      reading_width: 720,
      show_left_sidebar: true,
      show_right_panel: true,
      right_panel_tab: 'comments'
    } as Preferences
  }),
  actions: {
    setCurrentDocument(document: DocumentItem, scrollPosition = 0) {
      this.currentDocument = document
      this.currentScrollPosition = scrollPosition
      if (!this.documents.some((item) => item.id === document.id)) {
        this.documents = [document, ...this.documents]
      }
    },
    setCurrentScrollPosition(scrollPosition: number) {
      this.currentScrollPosition = scrollPosition
    },
    setCurrentSearchPosition(position: number) {
      this.currentSearchPosition = position
      this.currentScrollPosition = position
    },
    setLibrary(documents: DocumentItem[], libraryTree: LibraryNode[]) {
      this.documents = documents
      this.libraryTree = libraryTree
      if (!this.currentDocument && documents[0]) {
        this.currentDocument = documents[0]
      }
    },
    setHistory(history: HistoryItem[]) {
      this.history = history
    },
    setMarks(marks: Mark[]) {
      this.marks = marks
    },
    addMark(mark: Mark) {
      this.marks = [mark, ...this.marks.filter((item) => item.id !== mark.id)]
    },
    removeMark(markId: string) {
      this.marks = this.marks.filter((item) => item.id !== markId)
    },
    setCommentThreads(commentThreads: CommentThread[]) {
      this.commentThreads = commentThreads
    },
    addCommentThread(commentThread: CommentThread) {
      this.commentThreads = [commentThread, ...this.commentThreads.filter((item) => item.id !== commentThread.id)]
    },
    removeCommentThread(threadId: string) {
      this.commentThreads = this.commentThreads.filter((thread) => thread.id !== threadId)
    },
    appendCommentToThread(threadId: string, comment: CommentItem) {
      this.commentThreads = this.commentThreads.map((thread) => (
        thread.id === threadId
          ? { ...thread, comments: [...thread.comments, comment] }
          : thread
      ))
    },
    updatePreferences(preferences: Partial<Preferences>) {
      this.preferences = { ...this.preferences, ...preferences }
    }
  }
})
