import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Create __dirname manually for ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  // 1. REMOVED: tailwindcss() plugin (v4 only)
  plugins: [react()], 
  
  define: {
    'process.env': {}
  },
  resolve: {
    alias: {
      // 2. This keeps your "@" imports working
      "@": path.resolve(__dirname, "./src"),
    },
  },
})