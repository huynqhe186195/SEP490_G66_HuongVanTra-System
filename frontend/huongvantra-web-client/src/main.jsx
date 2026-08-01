import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './app/App.jsx'
import DialogProvider from './app/DialogProvider.jsx'
import ToastProvider from './app/ToastProvider'
import { installApiDebugPanel } from './lib/apiDebugPanel.js'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
} else if ('serviceWorker' in navigator) {
  // Dev (Vite): SW cache index/CSS cũ → F5 mất Tailwind. Gỡ mọi SW còn sót.
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister())
  }).catch(() => {})
}

installApiDebugPanel()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
