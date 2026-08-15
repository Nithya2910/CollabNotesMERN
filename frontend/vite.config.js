import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // FIX: Proxy target updated from 5000 (Node.js) to 8080 (Spring Boot)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Also proxy /uploads for file serving from Spring Boot
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy socket.io for WebSocket connections
      '/socket.io': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
