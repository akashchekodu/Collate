// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  
  // Document persistence API
  documents: {
    create: (title) => ipcRenderer.invoke('documents:create', title),
    save: (documentId, state, metadata) => ipcRenderer.invoke('documents:save', documentId, state, metadata),
    load: (documentId) => ipcRenderer.invoke('documents:load', documentId),
    getAll: () => ipcRenderer.invoke('documents:getAll'),
    getRecent: (limit) => ipcRenderer.invoke('documents:getRecent', limit),
    search: (query) => ipcRenderer.invoke('documents:search', query),
    delete: (documentId) => ipcRenderer.invoke('documents:delete', documentId),
    duplicate: (documentId, newTitle) => ipcRenderer.invoke('documents:duplicate', documentId, newTitle),
    export: (documentId, format) => ipcRenderer.invoke('documents:export', documentId, format)
  },

  // ✅ FIXED: Collaboration protocol handling (moved inside contextBridge)
  onJoinCollaboration: (callback) => {
    ipcRenderer.on('join-collaboration', (event, data) => {
      callback(data);
    });
  },
  
  removeJoinCollaborationListener: () => {
    ipcRenderer.removeAllListeners('join-collaboration');
  },

  // ✅ NEW: Collaboration testing methods
  collaboration: {
    testJoin: (testParams) => ipcRenderer.invoke('collaboration:test-join', testParams)
  },

  // Check if running in Electron
  isElectron: true
});
