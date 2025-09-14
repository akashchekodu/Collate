import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron';
import { join } from 'path';
import Store from 'electron-store';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

export class MainApplication {
  private mainWindow: BrowserWindow | null = null;
  private store: Store;

  constructor() {
    this.store = new Store();
    this.init();
  }

  private init(): void {
    // Set application ID on Windows
    app.setAppUserModelId('com.p2p-notebook');

    app.whenReady().then(() => {
      this.createWindow();
      this.setupIpcHandlers();

      app.on('activate', () => {
        // Re-create a window when dock icon is clicked on macOS
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Prevent new window creation from renderer
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });
    });
  }

  private createWindow(): void {
    // Restore window state or use defaults
    const windowState = this.store.get('windowState', {
      width: 1200,
      height: 800
    }) as WindowState;

    this.mainWindow = new BrowserWindow({
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: 800,
      minHeight: 600,
      show: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      icon: join(__dirname, '../../build/icon.png'),
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      }
    });

    // Restore maximized state
    if (windowState.isMaximized) {
      this.mainWindow.maximize();
    }

    // Save window state on changes
    this.mainWindow.on('resize', () => this.saveWindowState());
    this.mainWindow.on('move', () => this.saveWindowState());
    this.mainWindow.on('maximize', () => this.saveWindowState());
    this.mainWindow.on('unmaximize', () => this.saveWindowState());
    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Load the app from Vite dev server in development,
    // or local index.html when packaged
    if (!app.isPackaged) {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../../index.html'));
    }
  }

  private saveWindowState(): void {
    if (!this.mainWindow) return;
    const bounds = this.mainWindow.getBounds();
    const isMaximized = this.mainWindow.isMaximized();
    this.store.set('windowState', { ...bounds, isMaximized });
  }

  private setupIpcHandlers(): void {
    // File dialogs
    ipcMain.handle('dialog:openFile', async () => {
      return dialog.showOpenDialog(this.mainWindow!, {
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'Text', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
    });

    ipcMain.handle('dialog:saveFile', async (_, content: string, filename: string) => {
      return dialog.showSaveDialog(this.mainWindow!, {
        defaultPath: filename,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'Text', extensions: ['txt'] }
        ]
      });
    });

    // App info
    ipcMain.handle('app:getVersion', () => app.getVersion());
    ipcMain.handle('app:getName', () => app.getName());

    // Store operations
    ipcMain.handle('store:get', (_, key: string) => this.store.get(key));
    ipcMain.handle('store:set', (_, key: string, value: any) => this.store.set(key, value));
    ipcMain.handle('store:delete', (_, key: string) => this.store.delete(key));

    // Auth endpoints
    ipcMain.handle('auth:initiateLogin', async () => {
      await shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:5173/auth/callback&response_type=code&scope=email%20profile%20openid');
    });
    ipcMain.handle('auth:logout', () => {
      this.store.delete('auth_token');
      this.store.delete('user_data');
    });
    ipcMain.handle('auth:getToken', () => this.store.get('auth_token'));

    // Window controls
    ipcMain.handle('window:minimize', () => this.mainWindow?.minimize());
    ipcMain.handle('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });
    ipcMain.handle('window:close', () => this.mainWindow?.close());
  }
}

// Instantiate the application
new MainApplication();
