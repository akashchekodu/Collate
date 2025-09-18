// app/page.js
'use client'

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [isElectron, setIsElectron] = useState(false);
  const [electronInfo, setElectronInfo] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // ✅ Add refresh trigger
  const router = useRouter();

  // ✅ Memoized loadDocuments function
  const loadDocuments = useCallback(async () => {
    if (!isElectron || !window.electronAPI) {
      console.log('⏳ Skipping load - Electron not ready');
      return;
    }
    
    setLoading(true);
    try {
      console.log('📚 Loading documents...');
      const docs = await window.electronAPI.documents.getAll();
      setDocuments(docs || []);
      console.log('✅ Loaded documents:', docs?.length || 0, 'documents');
    } catch (error) {
      console.error('❌ Failed to load documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [isElectron]);

  // ✅ Initial Electron detection
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('⚡ Electron detected, setting up...');
      setIsElectron(true);
      setElectronInfo(window.electronAPI.versions);
    }
  }, []);

  // ✅ Auto-load documents when Electron is ready or refresh triggered
  useEffect(() => {
    if (isElectron) {
      console.log('🔄 Triggering document load (trigger:', refreshTrigger, ')');
      loadDocuments();
    }
  }, [isElectron, refreshTrigger, loadDocuments]);

  // ✅ Enhanced create function with auto-refresh
  const createNewDocument = async () => {
    if (!isElectron) {
      alert('Document creation only works in Electron app');
      return;
    }

    setCreating(true);
    try {
      console.log('📝 Creating new document...');
      const newDoc = await window.electronAPI.documents.create('Untitled Document');
      console.log('✅ Created new document:', newDoc);
      
      // ✅ Trigger automatic refresh
      setRefreshTrigger(prev => prev + 1);
      
      // Navigate to the new document
      router.push(`/editor/${newDoc.id}`);
    } catch (error) {
      console.error('❌ Failed to create document:', error);
      alert('Failed to create document. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ✅ Enhanced delete function with auto-refresh
  const deleteDocument = async (documentId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      console.log('🗑️ Deleting document:', documentId);
      await window.electronAPI.documents.delete(documentId);
      console.log('✅ Document deleted successfully');
      
      // ✅ Trigger automatic refresh
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('❌ Failed to delete document:', error);
      alert('Failed to delete document.');
    }
  };

  // ✅ Manual refresh function
  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            P2P Text Editor
          </h1>
          <p className="text-gray-600">
            Collaborative document editing with offline persistence
          </p>
        </div>

        {/* Environment Info */}
        <div className="text-center mb-6">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isElectron 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {isElectron ? '🖥️ Electron App' : '🌐 Web Browser'}
          </span>
          
          {isElectron && electronInfo && (
            <div className="mt-2 text-xs text-gray-500 space-x-4">
              <span>Electron: {electronInfo.electron}</span>
              <span>Node: {electronInfo.node}</span>
              <span>Chrome: {electronInfo.chrome}</span>
            </div>
          )}
        </div>

        {/* Create New Document Button */}
        <div className="mb-6">
          <button
            onClick={createNewDocument}
            disabled={creating || !isElectron}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isElectron
                ? creating
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {creating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Document...
              </span>
            ) : (
              '📝 Create New Document'
            )}
          </button>
          
          {!isElectron && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Document creation is only available in the desktop app
            </p>
          )}
        </div>

        {/* Documents List */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Recent Documents</h2>
            {isElectron && (
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                className="text-sm text-cyan-600 hover:text-cyan-700 disabled:opacity-50"
                title={`Refresh documents (trigger: ${refreshTrigger})`}
              >
                {loading ? '🔄' : '↻'} Refresh
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading documents...</p>
            </div>
          ) : !isElectron ? (
            <div className="text-center py-8 text-gray-500">
              <p>📱 Open in desktop app to see your documents</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>📄 No documents yet</p>
              <p className="text-sm mt-1">Create your first document to get started</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <Link href={`/editor/${doc.id}`} className="flex-1">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800 group-hover:text-cyan-600">
                          {doc.title || 'Untitled Document'}
                        </h3>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                          <span>📅 {formatDate(doc.updatedAt)}</span>
                          {doc.statistics && (
                            <span>📊 {doc.statistics.words || 0} words</span>
                          )}
                          {doc.version && (
                            <span>🔄 v{doc.version}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  <button
                    onClick={(e) => deleteDocument(doc.id, e)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete document"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Debug Info */}
        <div className="mt-6 pt-4 border-t text-center text-xs text-gray-500">
          <p>Documents are stored locally at: <code>D:\Collite\documents</code></p>
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-1">Debug - Refresh trigger: {refreshTrigger} | Documents: {documents.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}
