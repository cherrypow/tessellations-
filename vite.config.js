import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps built asset paths relative, which matters once this gets
// wrapped for iOS (Capacitor serves the build from a local file/scheme, not
// from a domain root).
export default defineConfig({
  plugins: [react()],
  base: './',
})
