import type { CommentThread, DocumentItem, Heading } from '@/types/document'

export function buildCommentMarkdown(document: DocumentItem, threads: CommentThread[]): string {
  const sections = groupThreadsByHeading(document, threads)
  const lines = [
    `# ${formatDocumentName(document.name)} 批注汇总`,
    '',
    `- 文档路径：${document.path}`,
    `- 导出时间：${formatExportTime(new Date())}`,
    `- 批注数量：${threads.length}`,
    ''
  ]

  for (const section of sections) {
    lines.push(`## ${section.heading}`)
    lines.push('')

    for (const thread of section.threads) {
      lines.push('### 命中文字')
      lines.push('')
      lines.push(formatQuote(thread.selected_text))
      lines.push('')
      lines.push('### 批注内容')
      lines.push('')
      for (const [index, comment] of thread.comments.entries()) {
        lines.push(`${index + 1}. ${comment.content}`)
      }
      lines.push('')
    }
  }

  return `${lines.join('\n').trim()}\n`
}

export function downloadTextFile(fileName: string, content: string, mimeType = 'text/markdown;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function createExportFileName(document: DocumentItem, suffix: string, extension: string): string {
  const baseName = formatDocumentName(document.name)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'markdown-reader'
  return `${baseName}-${suffix}.${extension}`
}

function groupThreadsByHeading(document: DocumentItem, threads: CommentThread[]): Array<{ heading: string, threads: CommentThread[] }> {
  const groups: Array<{ heading: string, threads: CommentThread[] }> = []

  for (const thread of [...threads].sort((left, right) => left.anchor.start_offset - right.anchor.start_offset)) {
    const heading = findHeadingForThread(document, thread)?.text ?? '文档开头'
    const group = groups.find((item) => item.heading === heading)
    if (group) {
      group.threads.push(thread)
    } else {
      groups.push({ heading, threads: [thread] })
    }
  }

  return groups
}

function findHeadingForThread(document: DocumentItem, thread: CommentThread): Heading | undefined {
  let currentHeading: Heading | undefined

  for (const heading of document.headings) {
    const headingOffset = getLineStartOffset(document.content, heading.position)
    if (headingOffset > thread.anchor.start_offset) break
    currentHeading = heading
  }

  return currentHeading ?? document.headings.find((heading) => heading.id === thread.anchor.heading_id)
}

function getLineStartOffset(content: string, lineIndex: number): number {
  if (lineIndex <= 0) return 0
  let offset = 0
  for (let index = 0; index < lineIndex; index += 1) {
    const nextBreak = content.indexOf('\n', offset)
    if (nextBreak === -1) return content.length
    offset = nextBreak + 1
  }
  return offset
}

function formatDocumentName(name: string): string {
  return name.replace(/\.(md|markdown)$/i, '')
}

function formatQuote(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n')
}

function formatExportTime(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}
