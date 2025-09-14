import { contextBridge, ipcRenderer } from 'electron';

console.log('🔧 Preload script loading...');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Auth API
  auth: {
    initiateLogin: () => ipcRenderer.invoke('auth:initiateLogin'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getToken: () => ipcRenderer.invoke('auth:getToken'),
    onAuthStateChange: (callback: (user: any) => void) => {
      ipcRenderer.on('auth:stateChange', (_, user) => callback(user));
      return () => ipcRenderer.removeAllListeners('auth:stateChange');
    }
  },
  
  // Store API
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key)
  },
  
  // File Dialog API
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: (content: string, filename: string) => ipcRenderer.invoke('dialog:saveFile', content, filename)
  },
  
  // Window API
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },
  
  // App API
  app: {
    getName: () => ipcRenderer.invoke('app:getName'),
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  }
});

// Add global interface for TypeScript
declare global {
  interface Window {
    electronAPI: {
      isElectron: boolean;
      auth: {
        initiateLogin: () => Promise<void>;
        logout: () => Promise<void>;
        getToken: () => Promise<string | null>;
        onAuthStateChange: (callback: (user: any) => void) => () => void;
      };
      store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        delete: (key: string) => Promise<void>;
      };
      dialog: {
        openFile: () => Promise<any>;
        saveFile: (content: string, filename: string) => Promise<any>;
      };
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
      };
      app: {
        getName: () => Promise<string>;
        getVersion: () => Promise<string>;
      };
    };
  }
}

console.log('✅ Preload script loaded - APIs exposed to renderer');