"use client";

class CollaborationMetadataService {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  }

  // ✅ IMMEDIATE: Update collaboration metadata without document content
  async updateCollaborationMetadata(documentId, collaborationData) {
    if (!this.isElectron || !documentId) {
      console.log('⚠️ Cannot update metadata: Not in Electron or no documentId');
      return false;
    }

    try {
      console.log('🔄 Updating collaboration metadata immediately:', {
        documentId: documentId.slice(0, 8) + '...',
        enabled: collaborationData.enabled,
        mode: collaborationData.mode,
        sessionPersistent: collaborationData.sessionPersistent
      });

      // ✅ METADATA ONLY: Update just the collaboration metadata
      const success = await window.electronAPI.documents.updateCollaborationMetadata(documentId, collaborationData);

      if (success) {
        console.log('✅ Collaboration metadata updated immediately');
        return true;
      } else {
        console.error('❌ Failed to update collaboration metadata');
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating collaboration metadata:', error);
      return false;
    }
  }

  // ✅ READ: Get current collaboration metadata
  async getCollaborationMetadata(documentId) {
    if (!this.isElectron || !documentId) return null;

    try {
      const result = await window.electronAPI.documents.load(documentId);
      return result?.metadata?.collaboration || null;
    } catch (error) {
      console.error('❌ Error reading collaboration metadata:', error);
      return null;
    }
  }
}

export const collaborationMetadataService = new CollaborationMetadataService();
