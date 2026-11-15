import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // livekit-client is big and changes rarely — cache it separately
        manualChunks: { livekit: ['livekit-client'], react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});
