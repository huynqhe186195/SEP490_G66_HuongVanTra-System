/**
 * Bật panel xem API đang gọi:
 *   localStorage.setItem('hvt_debug_api', '1'); location.reload()
 * Tắt:
 *   localStorage.removeItem('hvt_debug_api'); location.reload()
 */
export function installApiDebugPanel() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem('hvt_debug_api') !== '1') return
  if (window.__hvtApiDebugInstalled) return
  window.__hvtApiDebugInstalled = true

  const panel = document.createElement('div')
  panel.id = 'hvt-api-debug'
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
      <strong style="font-size:12px">API calls</strong>
      <span style="display:flex;gap:4px">
        <button type="button" data-act="clear" style="font-size:11px;padding:2px 6px">Clear</button>
        <button type="button" data-act="close" style="font-size:11px;padding:2px 6px">Tắt</button>
      </span>
    </div>
    <pre data-log style="margin:0;max-height:240px;overflow:auto;font-size:11px;line-height:1.35;white-space:pre-wrap;word-break:break-all"></pre>
  `
  Object.assign(panel.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '99999',
    width: 'min(480px, calc(100vw - 24px))',
    maxHeight: '320px',
    padding: '10px',
    borderRadius: '10px',
    background: 'rgba(15,23,42,.94)',
    color: '#e2e8f0',
    boxShadow: '0 8px 24px rgba(0,0,0,.35)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  })
  document.documentElement.appendChild(panel)

  const logEl = panel.querySelector('[data-log]')
  const lines = []

  function push(line) {
    lines.push(line)
    if (lines.length > 80) lines.shift()
    logEl.textContent = lines.join('\n')
    logEl.scrollTop = logEl.scrollHeight
  }

  panel.addEventListener('click', (e) => {
    const act = e.target?.getAttribute?.('data-act')
    if (act === 'clear') {
      lines.length = 0
      logEl.textContent = ''
    }
    if (act === 'close') {
      localStorage.removeItem('hvt_debug_api')
      panel.remove()
      window.__hvtApiDebugInstalled = false
    }
  })

  const origFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const input = args[0]
    const init = args[1] || {}
    const url = typeof input === 'string' ? input : input?.url || String(input)
    const method = (init.method || input?.method || 'GET').toUpperCase()
    const started = performance.now()
    try {
      const res = await origFetch(...args)
      if (String(url).includes('/api')) {
        const short = String(url).replace(/^https?:\/\/[^/]+/, '')
        push(`${method} ${res.status} ${short} (${Math.round(performance.now() - started)}ms)`)
      }
      return res
    } catch (err) {
      if (String(url).includes('/api')) {
        push(`${method} ERR ${url} — ${err?.message || err}`)
      }
      throw err
    }
  }

  push('Đã bật — reload hoặc thao tác trang để xem API')
}
