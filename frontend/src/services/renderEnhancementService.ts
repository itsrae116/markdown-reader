interface MermaidRenderResult {
  svg: string
  bindFunctions?: (element: Element) => void
}

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, definition: string) => Promise<MermaidRenderResult>
}

declare global {
  interface Window {
    mermaid?: MermaidApi
  }
}

let mermaidLoadPromise: Promise<MermaidApi> | null = null

export function copyCodeFromButton(button: HTMLButtonElement): string {
  const block = button.closest<HTMLElement>('.md-code-block')
  const code = block?.querySelector('code')?.textContent ?? ''
  if (!code) return ''

  void navigator.clipboard?.writeText(code)
  button.textContent = '已复制'
  button.dataset.copied = 'true'
  window.setTimeout(() => {
    button.textContent = '复制'
    delete button.dataset.copied
  }, 1200)
  return code
}

export async function renderMermaidBlocks(root: HTMLElement | null): Promise<void> {
  const blocks = Array.from(root?.querySelectorAll<HTMLElement>('.md-mermaid-block:not([data-rendered])') ?? [])
  if (blocks.length === 0) return

  try {
    const mermaid = await loadMermaid()
    for (const block of blocks) {
      const definition = block.dataset.mermaid ?? ''
      if (!definition.trim()) continue

      const diagramId = `mermaid_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const result = await mermaid.render(diagramId, definition)
      block.innerHTML = `<figcaption>Mermaid 图</figcaption><div class="md-mermaid-canvas">${result.svg}</div>`
      result.bindFunctions?.(block)
      block.dataset.rendered = 'true'
    }
  } catch {
    for (const block of blocks) {
      block.dataset.rendered = 'error'
      block.classList.add('is-render-error')
    }
  }
}

function loadMermaid(): Promise<MermaidApi> {
  if (window.mermaid) return Promise.resolve(window.mermaid)
  if (mermaidLoadPromise) return mermaidLoadPromise

  mermaidLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/vendor/mermaid.min.js'
    script.async = true
    script.onload = () => {
      if (!window.mermaid) {
        reject(new Error('Mermaid is unavailable'))
        return
      }
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral'
      })
      resolve(window.mermaid)
    }
    script.onerror = () => reject(new Error('Failed to load Mermaid'))
    document.head.appendChild(script)
  })

  return mermaidLoadPromise
}
