import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite forwards API and screenshot requests to Express,
// so the browser sees one origin and no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/files': 'http://localhost:3001',
    },
  },
});
