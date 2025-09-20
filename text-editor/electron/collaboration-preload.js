// electron/collaboration-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronCollaboration', {
  // Send updates back to main process
  sendUpdate: (updateData) => {
    ipcRenderer.send('collaboration-update', updateData);
  },

  // Receive owner initialization
  onInitOwnerState: (callback) => {
    ipcRenderer.on('init-owner-state', (event, data) => {
      callback(data);
    });
  },

  // Mark as hidden collaboration window
  isHiddenCollaboration: true,
  isOwner: true
});
