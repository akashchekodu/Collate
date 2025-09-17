const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  
  // Add methods for future IPC communication
  // Example: saveFile: (data) => ipcRenderer.invoke('save-file', data),
  // Example: openFile: () => ipcRenderer.invoke('open-file'),
});
