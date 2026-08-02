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
  // Dev (Vite): SW đăng ký từ lần chạy trước vẫn đang control trang và trả
  // index.html/CSS từ cache cũ. unregister() chỉ có hiệu lực từ lần load sau,
  // nên phải xoá cache rồi reload ngay để lần truy cập đầu có đủ stylesheet.
  navigator.serviceWorker
    .getRegistrations()
    .then(async (regs) => {
      const hadController = Boolean(navigator.serviceWorker.controller)
      if (!regs.length && !hadController) return
      await Promise.all(regs.map((reg) => reg.unregister()))
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
      if (hadController) window.location.reload()
    })
    .catch(() => {})
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
