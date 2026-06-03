import type { DocumentItem, SearchResult } from '@/types/document'

const SNIPPET_RADIUS = 28

export function searchCurrentDocument(document: DocumentItem, keyword: string): SearchResult[] {
  return searchDocuments([document], keyword)
}

export function searchDocuments(documents: DocumentItem[], keyword: string): SearchResult[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return []

  return documents.flatMap((document) => {
    const content = document.content.toLowerCase()
    const results: SearchResult[] = []
    let position = content.indexOf(normalizedKeyword)

    while (position >= 0) {
      results.push({
        document_id: document.id,
        document_name: document.name,
        path: document.path,
        snippet: highlightSnippet(createSnippet(document.content, position, keyword.length), keyword),
        position
      })
      position = content.indexOf(normalizedKeyword, position + normalizedKeyword.length)
    }

    return results
  })
}

export function highlightSnippet(snippet: string, keyword: string): string {
  const keywordLength = keyword.length
  const index = snippet.toLowerCase().indexOf(keyword.toLowerCase())
  if (index < 0 || keywordLength === 0) return escapeHtml(snippet)

  return [
    escapeHtml(snippet.slice(0, index)),
    '<mark>',
    escapeHtml(snippet.slice(index, index + keywordLength)),
    '</mark>',
    escapeHtml(snippet.slice(index + keywordLength))
  ].join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function createSnippet(content: string, position: number, keywordLength: number): string {
  const start = Math.max(0, position - SNIPPET_RADIUS)
  const end = Math.min(content.length, position + keywordLength + SNIPPET_RADIUS)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < content.length ? '...' : ''
  return `${prefix}${content.slice(start, end)}${suffix}`.replace(/\s+/g, ' ')
}
