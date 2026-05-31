import { useEffect, useState } from 'react'

function Toast({ id, message, type, onClose }) {
  return (
    <div className={`max-w-sm w-full shadow-lg rounded p-3 mb-2 text-white ${type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-gray-800'}`}>
      <div className="flex items-start justify-between">
        <div className="text-sm">{message}</div>
        <button aria-label="close" onClick={() => onClose(id)} className="ml-3 font-bold">×</button>
      </div>
    </div>
  )
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function listener(e) {
      const id = Date.now() + Math.random()
      const toast = { id, message: e.detail?.message ?? '', type: e.detail?.type ?? 'info' }
      setToasts((s) => [...s, toast])
      // auto remove
      setTimeout(() => setToasts((s) => s.filter(t => t.id !== id)), 4500)
    }

    window.addEventListener('app-toast', listener)
    return () => window.removeEventListener('app-toast', listener)
  }, [])

  function handleClose(id) {
    setToasts((s) => s.filter(t => t.id !== id))
  }

  return (
    <>
      {children}
      <div style={{ position: 'fixed', right: 16, top: 16, zIndex: 9999 }}>
        {toasts.map(t => (
          <Toast key={t.id} id={t.id} message={t.message} type={t.type} onClose={handleClose} />
        ))}
      </div>
    </>
  )
}
