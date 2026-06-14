import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // bind toàn bộ interface để Docker expose được
    port: 5173,
    watch: {
      usePolling: true,  // Windows host → Linux container: fs events không qua được, cần polling
      interval: 300,
    },
    hmr: {
      host: 'localhost', // browser kết nối HMR WebSocket về localhost (không phải 0.0.0.0)
    },
  },
})
