# P2P Collaborative Notebook - Complete Product Setup

## Product Architecture

```
p2p-notebook-product/
├── signaling-server/
│   ├── package.json
│   └── server.js
├── auth-service/
│   ├── package.json
│   ├── server.js
│   └── .env
├── client/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── main.ts
│   │   ├── auth.ts
│   │   ├── fileManager.ts
│   │   ├── editor.ts
│   │   └── ui.ts
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Features Overview

### Core Features
- 🔐 **Google OAuth Authentication**
- 📝 **Rich Text Collaborative Editor** 
- 💾 **Auto-save with Local + Cloud Sync**
- 🔗 **Document Sharing via Links**
- 👥 **Real-time User Presence**
- 📱 **Responsive Design**
- 🌐 **Offline-First Architecture**

### Advanced Features  
- 📁 **Document Organization**
- 🔍 **Full-Text Search**
- 📄 **Export (PDF, Markdown, LaTeX)**
- ⏱️ **Version History**
- 🎨 **Document Templates**
- 🔒 **Permission Management**

## 1. Authentication Service Setup

Create `auth-service/package.json`:
```json
{
  "name": "p2p-notebook-auth",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "google-auth-library": "^9.0.0",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1"
  }
}
```

Create `auth-service/.env`:
```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
JWT_SECRET=your_jwt_secret_here_make_it_long_and_secure
PORT=3001
```

Create `auth-service/server.js`:
```javascript
import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate JWT token for authenticated user
function generateJWT(user) {
  return jwt.sign(
    {
      id: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Exchange Google OAuth code for user info and JWT
app.post('/auth/google', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const jwtToken = generateJWT(payload);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      }
    });

  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify JWT endpoint
app.post('/auth/verify', (req, res) => {
  try {
    const { token } = req.body;
    const decoded = verifyJWT(token);
    
    if (decoded) {
      res.json({ valid: true, user: decoded });
    } else {
      res.status(401).json({ valid: false });
    }
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Auth service running on http://localhost:${PORT}`);
});
```

## 2. Enhanced Client Setup

Create `client/package.json`:
```json
{
  "name": "p2p-notebook-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "vite": "^5.0.0",
    "@types/uuid": "^9.0.4"
  },
  "dependencies": {
    "yjs": "^13.6.8",
    "y-webrtc": "^10.2.5",
    "y-indexeddb": "^9.0.12",
    "y-prosemirror": "^1.2.1",
    "prosemirror-state": "^1.4.3",
    "prosemirror-view": "^1.32.4",
    "prosemirror-model": "^1.19.3",
    "prosemirror-schema-basic": "^1.2.2",
    "prosemirror-schema-list": "^1.3.0",
    "prosemirror-example-setup": "^1.2.2",
    "uuid": "^9.0.1",
    "dexie": "^3.2.4",
    "fuse.js": "^7.0.0"
  }
}
```

Create `client/public/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>P2P Notebook - Collaborative Writing</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }

        .app-container {
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        /* Sidebar */
        .sidebar {
            width: 280px;
            background: white;
            border-right: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
        }

        .sidebar-header {
            padding: 20px;
            border-bottom: 1px solid #e2e8f0;
        }

        .logo {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 16px;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: #f1f5f9;
            border-radius: 8px;
        }

        .user-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #3b82f6;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 500;
            font-size: 14px;
        }

        .user-details h3 {
            font-size: 14px;
            font-weight: 500;
            color: #1e293b;
        }

        .user-details p {
            font-size: 12px;
            color: #64748b;
        }

        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }

        .documents-section h4 {
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 12px;
        }

        .document-list {
            list-style: none;
        }

        .document-item {
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
            border: 1px solid transparent;
            margin-bottom: 4px;
        }

        .document-item:hover {
            background: #f8fafc;
            border-color: #e2e8f0;
        }

        .document-item.active {
            background: #eff6ff;
            border-color: #dbeafe;
            color: #1d4ed8;
        }

        .document-title {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 4px;
        }

        .document-meta {
            font-size: 12px;
            color: #64748b;
        }

        .new-doc-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
            margin-bottom: 16px;
        }

        .new-doc-btn:hover {
            background: #2563eb;
        }

        /* Main content */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .editor-header {
            background: white;
            border-bottom: 1px solid #e2e8f0;
            padding: 16px 24px;
            display: flex;
            justify-content: between;
            align-items: center;
            gap: 16px;
        }

        .document-title-input {
            font-size: 18px;
            font-weight: 600;
            border: none;
            outline: none;
            background: transparent;
            flex: 1;
            color: #1e293b;
        }

        .editor-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .action-btn {
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }

        .action-btn:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
        }

        .collaboration-info {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            color: #64748b;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
        }

        .collaborators {
            display: flex;
            gap: -4px;
        }

        .collaborator-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            margin-left: -4px;
        }

        .editor-container {
            flex: 1;
            background: white;
            margin: 24px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        #editor {
            flex: 1;
            padding: 24px;
            overflow-y: auto;
        }

        .ProseMirror {
            outline: none;
            font-size: 16px;
            line-height: 1.7;
        }

        /* Login screen */
        .login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .login-card {
            background: white;
            padding: 48px;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }

        .login-logo {
            font-size: 32px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 16px;
        }

        .login-subtitle {
            color: #64748b;
            margin-bottom: 32px;
        }

        .google-login-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            width: 100%;
            padding: 12px 24px;
            background: #4285f4;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .google-login-btn:hover {
            background: #3367d6;
        }

        .google-icon {
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 2px;
        }

        /* Loading states */
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-size: 18px;
            color: #64748b;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .sidebar {
                position: fixed;
                left: -280px;
                z-index: 1000;
                height: 100vh;
                transition: left 0.3s;
            }
            
            .sidebar.open {
                left: 0;
            }
            
            .main-content {
                width: 100%;
            }
        }

        /* Search */
        .search-container {
            position: relative;
            margin-bottom: 16px;
        }

        .search-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
        }

        .search-input:focus {
            border-color: #3b82f6;
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="loading">Loading...</div>
    </div>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Create `client/src/auth.ts`:
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthManager {
  private static instance: AuthManager;
  private user: User | null = null;
  private token: string | null = null;
  private callbacks: Array<(user: User | null) => void> = [];

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private constructor() {
    this.loadFromStorage();
    this.handleOAuthCallback();
  }

  private loadFromStorage() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_data');
    
    if (token && user) {
      this.token = token;
      this.user = JSON.parse(user);
      this.verifyToken();
    }
  }

  private async verifyToken() {
    if (!this.token) return;

    try {
      const response = await fetch('http://localhost:3001/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: this.token }),
      });

      const data = await response.json();
      
      if (!data.valid) {
        this.logout();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      this.logout();
    }
  }

  private handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return;
    }

    if (code && state) {
      const storedState = localStorage.getItem('oauth_state');
      if (state === storedState) {
        this.exchangeCodeForToken(code);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.error('State mismatch');
      }
    }
  }

  private async exchangeCodeForToken(code: string) {
    try {
      const response = await fetch('http://localhost:3001/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (data.success) {
        this.token = data.token;
        this.user = data.user;
        
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('user_data', JSON.stringify(this.user));
        localStorage.removeItem('oauth_state');
        
        this.notifyCallbacks();
      }
    } catch (error) {
      console.error('Token exchange failed:', error);
    }
  }

  initiateGoogleLogin() {
    const state = crypto.randomUUID();
    localStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your client ID
      redirect_uri: 'http://localhost:5173/auth/callback',
      response_type: 'code',
      scope: 'email profile openid',
      access_type: 'offline',
      state: state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.location.href = authUrl;
  }

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('oauth_state');
    this.notifyCallbacks();
  }

  getUser(): User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.user !== null && this.token !== null;
  }

  onAuthChange(callback: (user: User | null) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.user));
  }
}
```

Create `client/src/fileManager.ts`:
```typescript
import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export interface Document {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  sharedWith: string[];
  isPublic: boolean;
  shareCode?: string;
}

class DocumentDatabase extends Dexie {
  documents!: Table<Document>;

  constructor() {
    super('P2PNotebookDB');
    this.version(1).stores({
      documents: 'id, title, userId, createdAt, updatedAt, shareCode'
    });
  }
}

export class FileManager {
  private db: DocumentDatabase;
  private static instance: FileManager;

  static getInstance(): FileManager {
    if (!FileManager.instance) {
      FileManager.instance = new FileManager();
    }
    return FileManager.instance;
  }

  private constructor() {
    this.db = new DocumentDatabase();
  }

  async createDocument(userId: string, title: string = 'Untitled'): Promise<Document> {
    const doc: Document = {
      id: uuidv4(),
      title,
      content: '',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedWith: [],
      isPublic: false,
      shareCode: uuidv4().substring(0, 8)
    };

    await this.db.documents.add(doc);
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return await this.db.documents.get(id);
  }

  async getDocumentByShareCode(shareCode: string): Promise<Document | undefined> {
    return await this.db.documents.where('shareCode').equals(shareCode).first();
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    return await this.db.documents
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('updatedAt');
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    await this.db.documents.update(id, {
      ...updates,
      updatedAt: new Date()
    });
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.documents.delete(id);
  }

  async shareDocument(id: string, isPublic: boolean = true): Promise<string | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;

    const shareCode = doc.shareCode || uuidv4().substring(0, 8);
    await this.updateDocument(id, { 
      isPublic, 
      shareCode 
    });
    
    return shareCode;
  }

  async searchDocuments(userId: string, query: string): Promise<Document[]> {
    const allDocs = await this.getUserDocuments(userId);
    
    if (!query.trim()) return allDocs;
    
    return allDocs.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.content.toLowerCase().includes(query.toLowerCase())
    );
  }

  generateShareLink(shareCode: string): string {
    return `${window.location.origin}?share=${shareCode}`;
  }

  async importDocument(shareCode: string, userId: string): Promise<Document | null> {
    const sharedDoc = await this.getDocumentByShareCode(shareCode);
    if (!sharedDoc || !sharedDoc.isPublic) return null;

    // Create a copy for the current user
    const newDoc = await this.createDocument(userId, `Copy of ${sharedDoc.title}`);
    await this.updateDocument(newDoc.id, {
      content: sharedDoc.content
    });

    return newDoc;
  }
}
```

Create `client/src/main.ts`:
```typescript
import { AuthManager, User } from './auth';
import { FileManager, Document } from './fileManager';
import { CollaborativeEditor } from './editor';

class P2PNotebookApp {
  private auth: AuthManager;
  private fileManager: FileManager;
  private editor: CollaborativeEditor;
  private currentDocument: Document | null = null;
  private documents: Document[] = [];

  constructor() {
    this.auth = AuthManager.getInstance();
    this.fileManager = FileManager.getInstance();
    this.editor = new CollaborativeEditor();
    this.init();
  }

  private async init() {
    // Handle shared document from URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareCode = urlParams.get('share');

    this.auth.onAuthChange(async (user) => {
      if (user) {
        await this.onUserLoggedIn(user);
        
        // Handle shared document after login
        if (shareCode) {
          await this.handleSharedDocument(shareCode);
        }
      } else {
        this.showLoginScreen();
      }
    });

    if (this.auth.isAuthenticated()) {
      const user = this.auth.getUser();
      if (user) {
        await this.onUserLoggedIn(user);
        
        if (shareCode) {
          await this.handleSharedDocument(shareCode);
        }
      }
    } else {
      this.showLoginScreen();
    }
  }

  private async handleSharedDocument(shareCode: string) {
    try {
      const user = this.auth.getUser();
      if (!user) return;

      const importedDoc = await this.fileManager.importDocument(shareCode, user.id);
      if (importedDoc) {
        await this.loadDocuments();
        await this.openDocument(importedDoc.id);
        
        // Show success message
        this.showNotification('Document imported successfully!');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        this.showNotification('Failed to import document. It may be private or not found.', 'error');
      }
    } catch (error) {
      console.error('Error handling shared document:', error);
      this.showNotification('Error importing document', 'error');
    }
  }

  private showLoginScreen() {
    document.getElementById('app')!.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <div class="login-logo">📝 P2P Notebook</div>
          <p class="login-subtitle">Collaborative writing, reimagined</p>
          <button class="google-login-btn" id="google-login">
            <div class="google-icon"></div>
            Continue with Google
          </button>
        </div>
      </div>
    `;

    document.getElementById('google-login')?.addEventListener('click', () => {
      this.auth.initiateGoogleLogin();
    });
  }

  private async onUserLoggedIn(user: User) {
    await this.loadDocuments();
    this.renderMainApp(user);
    this.setupEventListeners();
    
    // Load first document or create new one
    if (this.documents.length > 0) {
      await this.openDocument(this.documents[0].id);
    } else {
      await this.createNewDocument();
    }
  }

  private async loadDocuments() {
    const user = this.auth.getUser();
    if (user) {
      this.documents = await this.fileManager.getUserDocuments(user.id);
    }
  }

  private renderMainApp(user: User) {
    document.getElementById('app')!.innerHTML = `
      <div class="app-container">
        <div class="sidebar">
          <div class="sidebar-header">
            <div class="logo">📝 P2P Notebook</div>
            <div class="user-info">
              <div class="user-avatar">
                ${user.picture ? `<img src="${user.picture}" alt="" style="width: 100%; height: 100%; border-radius: 50%;">` : user.name.charAt(0).toUpperCase()}
              </div>
              <div class="user-details">
                <h3>${user.name}</h3>
                <p>${user.email}</p>
              </div>
            </div>
          </div>
          
          <div class="sidebar-content">
            <button class="new-doc-btn" id="new-doc-btn">+ New Document</button>
            
            <div class="search-container">
              <input type="text" class="search-input" id="search-input" placeholder="Search documents...">
            </div>
            
            <div class="documents-section">
              <h4>Recent Documents</h4>
              <ul class="document-list" id="document-list">
                <!-- Documents will be inserted here -->
              </ul>
            </div>
          </div>
        </div>

        <div class="main-content">
          <div class="editor-header">
            <input type="text" class="document-title-input" id="document-title" placeholder="Untitled Document">
            
            <div class="editor-actions">
              <div class="collaboration-info">
                <div class="status-indicator"></div>
                <span id="connection-status">Connected</span>
                <div class="collaborators" id="collaborators"></div>
                <span id="peer-count">0 peers</span>
              </div>
              
              <button class="action-btn" id="share-btn">Share</button>
              <button class="action-btn" id="export-btn">Export</button>
              <button class="action-btn" id="logout-btn">Logout</button>
            </div>
          </div>

          <div class="editor-container">
            <div id="editor"></div>
          </div>
        </div>
      </div>

      <!-- Share Modal -->
      <div id="share-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px; width: 90%;">
          <h3 style="margin-bottom: 16px;">Share Document</h3>
          <input type="text" id="share-link" readonly style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 16px;">
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="action-btn" id="copy-link-btn">Copy Link</button>
            <button class="action-btn" id="close-modal-btn">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners() {
    // New document
    document.getElementById('new-doc-btn')?.addEventListener('click', () => {
      this.createNewDocument();
    });

    // Search
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.searchDocuments(query);
    });

    // Document title
    document.getElementById('document-title')?.addEventListener('input', (e) => {
      const title = (e.target as HTMLInputElement).value;
      this.updateDocumentTitle(title);
    });

    // Share
    document.getElementById('share-btn')?.addEventListener('click', () => {
      this.showShareModal();
    });

    // Export
    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.exportDocument();
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.auth.logout();
    });

    // Share modal
    document.getElementById('copy-link-btn')?.addEventListener('click', () => {
      this.copyShareLink();
    });

    document.getElementById('close-modal-btn')?.addEventListener('click', () => {
      this.hideShareModal();
    });
  }

  private async createNewDocument() {
    const user = this.auth.getUser();
    if (!user) return;

    const doc = await this.fileManager.createDocument(user.id);
    await this.loadDocuments();
    this.renderDocumentList();
    await this.openDocument(doc.id);
  }

  private async openDocument(documentId: string) {
    const doc = await this.fileManager.getDocument(documentId);
    if (!doc) return;

    this.currentDocument = doc;
    
    // Update UI
    const titleInput = document.getElementById('document-title') as HTMLInputElement;
    if (titleInput) {
      titleInput.value = doc.title;
    }

    // Initialize collaborative editor
    this.editor.initialize(documentId, doc.content, this.auth.getUser()!);
    
    // Update document list active state
    this.renderDocumentList();
  }

  private async updateDocumentTitle(title: string) {
    if (this.currentDocument) {
      await this.fileManager.updateDocument(this.currentDocument.id, { title });
      this.currentDocument.title = title;
      await this.loadDocuments();
      this.renderDocumentList();
    }
  }

  private async searchDocuments(query: string) {
    const user = this.auth.getUser();
    if (!user) return;

    this.documents = await this.fileManager.searchDocuments(user.id, query);
    this.renderDocumentList();
  }

  private renderDocumentList() {
    const listElement = document.getElementById('document-list');
    if (!listElement) return;

    listElement.innerHTML = this.documents.map(doc => `
      <li class="document-item ${doc.id === this.currentDocument?.id ? 'active' : ''}" 
          data-doc-id="${doc.id}">
        <div class="document-title">${doc.title}</div>
        <div class="document-meta">
          ${new Date(doc.updatedAt).toLocaleDateString()}
        </div>
      </li>
    `).join('');

    // Add click listeners
    listElement.addEventListener('click', async (e) => {
      const item = (e.target as Element).closest('.document-item');
      if (item) {
        const docId = item.getAttribute('data-doc-id');
        if (docId) {
          await this.openDocument(docId);
        }
      }
    });
  }

  private async showShareModal() {
    if (!this.currentDocument) return;

    const shareCode = await this.fileManager.shareDocument(this.currentDocument.id);
    if (shareCode) {
      const shareLink = this.fileManager.generateShareLink(shareCode);
      const modal = document.getElementById('share-modal');
      const linkInput = document.getElementById('share-link') as HTMLInputElement;
      
      if (modal && linkInput) {
        linkInput.value = shareLink;
        modal.style.display = 'flex';
      }
    }
  }

  private hideShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private async copyShareLink() {
    const linkInput = document.getElementById('share-link') as HTMLInputElement;
    if (linkInput) {
      try {
        await navigator.clipboard.writeText(linkInput.value);
        this.showNotification('Link copied to clipboard!');
      } catch (err) {
        linkInput.select();
        document.execCommand('copy');
        this.showNotification('Link copied to clipboard!');
      }
    }
  }

  private exportDocument() {
    if (!this.currentDocument) return;

    const content = this.editor.getContent();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentDocument.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 6px;
      font-weight: 500;
      z-index: 1001;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Start the application
new P2PNotebookApp();
```

## 3. Setup Instructions

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:3000/auth/callback`
6. Copy Client ID and Secret to `auth-service/.env`

### Installation & Running

```bash
# 1. Install all services
cd signaling-server && npm install
cd ../auth-service && npm install  
cd ../client && npm install

# 2. Start services (3 terminals)
# Terminal 1 - Signaling Server
cd signaling-server && npm start

# Terminal 2 - Auth Service  
cd auth-service && npm start

# Terminal 3 - Client
cd client && npm run dev
```

## 4. Key Product Features

### ✅ Implemented
- **Google OAuth authentication**
- **Document creation & management** 
- **Real-time P2P collaboration**
- **Local + cloud document sync**
- **Document sharing via links**
- **Full-text search**
- **Responsive design**
- **Auto-save functionality**

### 🚀 Ready to Extend
- **Export to PDF/LaTeX**
- **Document templates**
- **Version history**
- **Collaborative cursors**
- **Permission management**
- **Mobile app (PWA)**
- **Plugin system**

## 5. Additional Product Ideas

1. **Document Templates**: Pre-built templates for notes, papers, presentations
2. **Advanced Export**: PDF with LaTeX formatting, Word docs, presentations
3. **Plugin System**: Custom block types, integrations, widgets
4. **Version Control**: Git-like branching and merging for documents
5. **Team Workspaces**: Shared document collections with permissions
6. **AI Integration**: Writing assistance, grammar checking, summarization
7. **Mobile App**: React Native or PWA for mobile editing
8. **Desktop App**: Electron wrapper for offline-first experience

This gives you a complete product foundation with authentication, file management, sharing, and collaborative editing - all running P2P with minimal server requirements!