import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import type { DocumentItem, Heading, LibraryNode } from '@/types/document'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

const defaultHeadingOpen = markdown.renderer.rules.heading_open ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))
const defaultHeadingClose = markdown.renderer.rules.heading_close ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))
const defaultImage = markdown.renderer.rules.image ?? ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
const defaultTableOpen = markdown.renderer.rules.table_open ?? ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
const defaultTableClose = markdown.renderer.rules.table_close ?? ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))

markdown.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const level = Number(tokens[index].tag.replace('h', ''))
  if (level > 3) {
    return defaultHeadingOpen(tokens, index, options, env, self)
  }

  const headings = ((env as { headings?: Heading[] }).headings ?? [])
  const headingIndex = ((env as { headingIndex?: number }).headingIndex ?? 0)
  const heading = headings[headingIndex]
  if (heading) {
    tokens[index].attrSet('id', heading.id)
  }
  ;(env as { headingIndex?: number }).headingIndex = headingIndex + 1
  return defaultHeadingOpen(tokens, index, options, env, self)
}

markdown.renderer.rules.heading_close = (tokens, index, options, env, self) => {
  return defaultHeadingClose(tokens, index, options, env, self)
}

markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  const src = tokens[index].attrGet('src')
  const assets = (env as { assets?: Record<string, string> }).assets ?? {}
  const documentPath = (env as { documentPath?: string }).documentPath ?? ''
  const resolvedSrc = src ? resolveAssetSource(src, documentPath, assets) : ''
  if (resolvedSrc) {
    tokens[index].attrSet('src', resolvedSrc)
  }
  tokens[index].attrSet('loading', 'lazy')
  return defaultImage(tokens, index, options, env, self)
}

markdown.renderer.rules.table_open = (tokens, index, options, env, self) => {
  tokens[index].attrJoin('class', 'md-table')
  return `<div class="md-table-frame">${defaultTableOpen(tokens, index, options, env, self)}`
}

markdown.renderer.rules.table_close = (tokens, index, options, env, self) => {
  return `${defaultTableClose(tokens, index, options, env, self)}</div>`
}

markdown.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index]
  const language = normalizeLanguage(token.info)

  if (language === 'mermaid') {
    return renderMermaidBlock(token.content)
  }

  if (language === 'api') {
    return renderApiDocBlock(token.content)
  }

  if (language === 'outline' || shouldRenderAsOutlineBlock(token.content)) {
    return renderOutlineBlock(token.content)
  }

  if (language === 'text') {
    return renderPlainTextBlock(token.content)
  }

  return renderCodeBlock(token.content, language)
}

export function isMarkdownFile(fileName: string): boolean {
  return /\.(md|markdown)$/i.test(fileName)
}

export function createDocumentFromContent(name: string, content: string, lastModified = Date.now()): DocumentItem {
  return {
    id: createDocumentId(name),
    name,
    path: name,
    type: 'file',
    content,
    last_modified: lastModified,
    headings: extractHeadings(content),
    assets: {}
  }
}

export async function readMarkdownFile(file: File): Promise<DocumentItem> {
  const content = await file.text()
  return createDocumentFromContent(file.name, content, file.lastModified)
}

export async function readMarkdownFolder(files: FileList | File[]): Promise<{ documents: DocumentItem[]; tree: LibraryNode[] }> {
  const allFiles = Array.from(files)
  const markdownFiles = allFiles.filter((file) => isMarkdownFile(file.name))
  const assets = await createFolderAssetMap(allFiles)
  const documents = await Promise.all(
    markdownFiles.map(async (file) => {
      const path = getRelativePath(file)
      const content = await file.text()
      return {
        ...createDocumentFromContent(path, content, file.lastModified),
        name: file.name,
        path,
        type: 'folder_document' as const,
        assets
      }
    })
  )

  return {
    documents,
    tree: createLibraryTree(documents)
  }
}

export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(markdown.render(repairMalformedFences(content)))
}

export function renderMarkdownPreview(content: string): string {
  return markdown.render(repairMalformedFences(content))
}

export function renderMarkdownDocument(document: DocumentItem): string {
  const env = {
    headings: document.headings,
    headingIndex: 0,
    assets: document.assets ?? {},
    documentPath: document.path
  }
  return DOMPurify.sanitize(markdown.render(repairMalformedFences(document.content), env))
}

export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  let insideFence = false

  for (const [index, line] of repairMalformedFences(content).split('\n').entries()) {
    if (/^\s*```/.test(line)) {
      insideFence = !insideFence
      continue
    }

    if (insideFence || !/^#{1,3}\s+/.test(line)) continue

    const marker = line.match(/^#{1,3}/)?.[0] ?? '#'
    const text = line.replace(/^#{1,3}\s+/, '').trim()
    headings.push({
      id: createDocumentId(`${index}-${text}`),
      level: marker.length,
      text,
      position: index
    })
  }

  return headings
}

function createDocumentId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_').replace(/^_|_$/g, '') || 'document'
}

function normalizeLanguage(info: string): string {
  return info.trim().split(/\s+/)[0]?.toLowerCase() || 'text'
}

function renderCodeBlock(content: string, language: string): string {
  const label = language === 'text' ? '代码' : language.toUpperCase()
  return [
    `<figure class="md-code-block" data-language="${escapeHtml(language)}">`,
    '<figcaption class="md-code-header">',
    `<span>${escapeHtml(label)}</span>`,
    '<button type="button" class="copy-code-button" data-copy-code>复制</button>',
    '</figcaption>',
    `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(content)}</code></pre>`,
    '</figure>'
  ].join('')
}

function renderMermaidBlock(content: string): string {
  const encoded = escapeHtml(content)
  return [
    `<figure class="md-mermaid-block" data-mermaid="${encoded}">`,
    '<figcaption>Mermaid 图</figcaption>',
    `<pre><code>${encoded}</code></pre>`,
    '</figure>'
  ].join('')
}

function renderOutlineBlock(content: string): string {
  return `<pre class="md-outline-block">${escapeHtml(formatOutlineContent(content))}</pre>`
}

function renderPlainTextBlock(content: string): string {
  return `<pre class="md-plain-block">${escapeHtml(trimOuterBlankLines(content))}</pre>`
}

function renderApiDocBlock(content: string): string {
  const lines = content.trim().split(/\r?\n/)
  const firstLine = lines.shift()?.trim() ?? ''
  const endpoint = firstLine.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i)
  const sections = parseApiSections(lines)
  const method = endpoint?.[1]?.toUpperCase() ?? 'API'
  const path = (endpoint?.[2] ?? firstLine) || '未命名接口'

  const sectionHtml = sections.map((section) => {
    const body = section.body.join('\n').trim()
    const contentHtml = body.includes('\n')
      ? `<pre>${escapeHtml(body)}</pre>`
      : `<p>${escapeHtml(body || '未填写')}</p>`
    return `<section><h4>${escapeHtml(section.label)}</h4>${contentHtml}</section>`
  }).join('')

  return [
    '<article class="api-doc-block">',
    '<header>',
    `<span class="api-method api-method-${escapeHtml(method.toLowerCase())}">${escapeHtml(method)}</span>`,
    `<code>${escapeHtml(path)}</code>`,
    '</header>',
    sectionHtml || `<section><h4>说明</h4><p>${escapeHtml(content.trim() || '未填写')}</p></section>`,
    '</article>'
  ].join('')
}

function repairMalformedFences(content: string): string {
  const lines = content.split(/\r?\n/)
  const output: string[] = []
  let insideFence = false
  let fenceLanguage = ''
  let fenceBody: string[] = []

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*```\s*([^\s`]*)\s*$/)
    if (fenceMatch) {
      output.push(line)
      insideFence = !insideFence
      fenceLanguage = insideFence ? (fenceMatch[1] ?? '').toLowerCase() : ''
      fenceBody = []
      continue
    }

    if (insideFence && !fenceLanguage && shouldCloseMalformedFence(fenceBody, line)) {
      output.push('```')
      insideFence = false
      fenceLanguage = ''
      fenceBody = []
    }

    output.push(line)
    if (insideFence) {
      fenceBody.push(line)
    }
  }

  if (insideFence) {
    output.push('```')
  }

  return output.join('\n')
}

function shouldCloseMalformedFence(fenceBody: string[], line: string): boolean {
  const current = line.trim()
  if (!current) return false
  if (!fenceBody.at(-1)?.trim()) {
    const diagramLines = fenceBody.filter((item) => isTreeLikeLine(item) || isBoxDrawingLine(item)).length
    return diagramLines >= 2 && isMarkdownContentLine(current)
  }
  return false
}

function isMarkdownContentLine(line: string): boolean {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^\|.+\|$/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^\*\*.+\*\*/.test(line) ||
    /[*_]{2}.+[*_]{2}/.test(line)
  )
}

function isBoxDrawingLine(line: string): boolean {
  return /[┌┐└┘├┤┬┴┼─│╔╗╚╝═║]/.test(line)
}

function isTreeLikeLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const hasHierarchyWord = /(维度|业务标签|标签|场景|项目|领域|硬层级|软属性|dimension|scene|project|domain)/i.test(trimmed)
  const hasTreeMarks = /[│├└┬┴┐┘┌┤─]{1,}|[—-]{2,}|[|｜]/.test(trimmed)
  const hasSeparators = /[|｜].*[|｜]|[—─-]{2,}|[├└│]/.test(trimmed)
  const branchCount = (trimmed.match(/[|｜│├└─—]/g) ?? []).length
  return (hasHierarchyWord && hasSeparators) || (hasTreeMarks && branchCount >= 3)
}

function shouldRenderAsOutlineBlock(content: string): boolean {
  const lines = content.trim().split(/\r?\n/)
  return lines.some(isTreeLikeLine)
}

function formatOutlineContent(content: string): string {
  return trimOuterBlankLines(content)
}

function trimOuterBlankLines(content: string): string {
  return content.replace(/^\s*\n/, '').replace(/\n\s*$/, '')
}

function parseApiSections(lines: string[]): Array<{ label: string; body: string[] }> {
  const sections: Array<{ label: string; body: string[] }> = []
  let current: { label: string; body: string[] } | null = null

  for (const line of lines) {
    const match = line.match(/^([A-Za-z\u4e00-\u9fa5][A-Za-z\u4e00-\u9fa5\s_-]{0,18})[:：]\s*(.*)$/)
    if (match) {
      current = { label: normalizeApiLabel(match[1]), body: match[2] ? [match[2]] : [] }
      sections.push(current)
      continue
    }

    if (!current) {
      current = { label: '说明', body: [] }
      sections.push(current)
    }
    current.body.push(line)
  }

  return sections
}

function normalizeApiLabel(label: string): string {
  const key = label.trim().toLowerCase()
  const labels: Record<string, string> = {
    summary: '说明',
    description: '说明',
    request: '请求',
    response: '响应',
    params: '参数',
    parameters: '参数',
    headers: '请求头',
    body: '请求体',
    example: '示例'
  }
  return labels[key] ?? label.trim()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getRelativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
}

function isLocalImageFile(fileName: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName)
}

async function createFolderAssetMap(files: File[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    files
      .filter((file) => isLocalImageFile(file.name))
      .map(async (file) => {
        const relativePath = normalizePath(getRelativePath(file))
        const dataUrl = await readFileAsDataUrl(file)
        return [relativePath, dataUrl] as const
      })
  )
  const assets: Record<string, string> = {}
  for (const [path, dataUrl] of entries) {
    assets[path] = dataUrl
    assets[path.split('/').pop() ?? path] = dataUrl
  }
  return assets
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function resolveAssetSource(src: string, documentPath: string, assets: Record<string, string>): string {
  if (/^(https?:|data:|blob:)/i.test(src)) return src
  const decodedSrc = normalizePath(decodeURIComponent(src))
  const documentDir = normalizePath(documentPath.split('/').slice(0, -1).join('/'))
  const candidates = [
    decodedSrc,
    normalizePath(`${documentDir}/${decodedSrc}`),
    decodedSrc.split('/').pop() ?? decodedSrc
  ]
  return candidates.map((candidate) => assets[candidate]).find(Boolean) ?? src
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/')
}

function createLibraryTree(documents: DocumentItem[]): LibraryNode[] {
  const root: LibraryNode[] = []

  for (const document of documents) {
    const parts = document.path.split('/').filter(Boolean)
    let cursor = root

    for (const [index, part] of parts.entries()) {
      const isDocument = index === parts.length - 1
      const path = parts.slice(0, index + 1).join('/')
      let node = cursor.find((item) => item.path === path)

      if (!node) {
        node = {
          id: isDocument ? document.id : createDocumentId(path),
          name: part,
          path,
          kind: isDocument ? 'document' : 'folder',
          children: []
        }
        cursor.push(node)
      }

      cursor = node.children
    }
  }

  return root
}
