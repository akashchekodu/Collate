import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'es2020'
  },
  optimizeDeps: {
    include: [
      'yjs',
      'y-webrtc', 
      'y-indexeddb',
      'y-prosemirror',
      'prosemirror-state',
      'prosemirror-view',
      'prosemirror-model',
      'prosemirror-schema-basic',
      'prosemirror-schema-list',
      'prosemirror-example-setup',
      'uuid',
      'dexie'
    ]
  }
})