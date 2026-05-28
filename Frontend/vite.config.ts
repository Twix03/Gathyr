import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig({
  // server: {
  //   host: true,
  //   https: {
  //     key: fs.readFileSync(path.resolve(__dirname, 'certificates/192.168.168.146+2-key.pem')),
  //     cert: fs.readFileSync(path.resolve(__dirname, 'certificates/192.168.168.146+2.pem')),
  //   }
  // },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
