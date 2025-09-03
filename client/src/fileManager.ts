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

  // Generate room-based share link for live P2P collaboration
  generateRoomShareLink(shareCode: string): string {
    return `${window.location.origin}?room=${shareCode}`;
  }

  // Keep for backward compatibility
  generateShareLink(shareCode: string): string {
    return this.generateRoomShareLink(shareCode);
  }

  // DEPRECATED: Remove import functionality as we use live P2P rooms
  async importDocument(shareCode: string, userId: string): Promise<Document | null> {
    console.warn('importDocument is deprecated. Use room-based live sharing instead.');
    return null;
  }

  // Get or create room document for live collaboration
  async getOrCreateRoomDocument(roomId: string, userId: string): Promise<Document> {
    // Check if user already has a document for this room
    const existingDoc = await this.db.documents
      .where('shareCode')
      .equals(roomId)
      .and(doc => (doc.shareCode?.length === 8) && (doc.isPublic === true))
      .and(doc => doc.userId === userId)
      .first();

    if (existingDoc) {
      return existingDoc;
    }

    // Create a new document for this room
    const roomDoc: Document = {
      id: uuidv4(),
      title: `Shared Room: ${roomId}`,
      content: '',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      sharedWith: [],
      isPublic: true,
      shareCode: roomId
    };

    await this.db.documents.add(roomDoc);
    return roomDoc;
  }

  // Save room content locally (optional - for offline access)
  async saveRoomContent(roomId: string, userId: string, content: string, title?: string): Promise<void> {
    const roomDoc = await this.getOrCreateRoomDocument(roomId, userId);
    
    await this.updateDocument(roomDoc.id, {
      content,
      title: title || roomDoc.title
    });
  }

  // Get room history for a user (their local copy)
  async getRoomDocument(roomId: string, userId: string): Promise<Document | null> {
    const roomDoc = await this.db.documents
      .where('shareCode')
      .equals(roomId)
      .and(doc => doc.userId === userId)
      .first();

    return roomDoc || null;
  }

  // List rooms the user has participated in
  async getUserRooms(userId: string): Promise<Document[]> {
    return await this.db.documents
      .where('userId')
      .equals(userId)
      .and(doc => {
        // Fixed boolean type issue
        return (doc.shareCode?.length === 8) && (doc.isPublic === true);
      })
      .reverse()
      .sortBy('updatedAt');
  }
}