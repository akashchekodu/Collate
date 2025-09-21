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
  const [opening, setOpening] = useState(false); // Changed from 'creating' to 'opening'
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [testingCollaboration, setTestingCollaboration] = useState(false);
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

  // ✅ NEW: Open document function with folder browser
// In app/page.js, replace openDocument:
  const openDocument = async () => {
    if (!isElectron) {
      alert('Document opening only works in Electron app');
      return;
    }

    setOpening(true);
    try {
      console.log('📁 Opening file browser...');
      
      // Use openFile, not openFolder
      const result = await window.electronAPI.documents.openFile();
      
      if (result.canceled) {
        console.log('📁 File selection canceled');
        return;
      }
      if (result.filePaths && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        console.log('📄 File selected:', filePath);
        
        // Load the external file as a document and navigate
        const loaded = await window.electronAPI.documents.load(filePath);
        if (loaded) {
          console.log('✅ External document loaded:', loaded.metadata.id);
          router.push(`/editor/${loaded.metadata.id}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to open document:', error);
      alert('Failed to open document: ' + error.message);
    } finally {
      setOpening(false);
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

  // ✅ Test collaboration function (unchanged)
  const testCollaboration = async () => {
    if (!isElectron || !window.electronAPI.collaboration) {
      alert('Collaboration testing only works in Electron app with updated preload.js');
      return;
    }

    try {
      if (window.__yjs) {
        console.log('🧹 Current Y.js providers:', Object.keys(window.__yjs.providers));
        
        window.__yjs.providers.forEach((provider, roomName) => {
          console.log('🧹 Destroying provider:', roomName);
          provider.destroy();
        });
        
        window.__yjs.providers.clear();
        window.__yjs.docs.clear(); 
        window.__yjs.refs.clear();
        
        console.log('✅ Y.js cache cleared completely');
      }
    } catch (error) {
      console.warn('⚠️ Cache clearing failed:', error);
    }

    setTestingCollaboration(true);
    try {
      console.log('🧪 Testing collaboration join...');
      const testParams = {
        room: 'room_1758300505040_L0RQdqZB',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGVybWFuZW50IiwibGlua0lkIjoicGVybV9MS2UtNlFmcVBuIiwicm9vbUlkIjoicm9vbV8xNzU4MzAwNTA1MDQwX0wwUlFkcVpCIiwiZG9jdW1lbnRJZCI6Im1mcjJwbmgxLXduMWtvbmg3eiIsInBlcm1pc3Npb25zIjpbInJlYWQiLCJ3cml0ZSJdLCJleHAiOjE3NjA4OTI1MDUsImlhdCI6MTc1ODMwMDUwNSwiZGV2Ijp0cnVlLCJwZWVySWQiOiJwZWVyXzE3NTgzMDA1MDUwNDBfLUJmc21rNkgifQ.kZ4U-mL40CnH1SkUHUembzrxkMTnk37NZlYkHcGMuXw&doc=mfr2pnh1-wn1konh7z',
        documentId: 'collaboration-test-document'
      }; 
      
      const result = await window.electronAPI.collaboration.testJoin(testParams);
      
      if (result.success) {
        alert('✅ Collaboration test successful! Check console and open browser to test sync.');
        console.log('✅ Collaboration test successful');
        console.log('📋 Next steps:');
        console.log('1. Open browser: http://localhost:3000/editor/' + testParams.documentId);
        console.log('2. Open console, run: setCollaborationToken("' + testParams.token + '")');
        console.log('3. Test real-time synchronization!');
      } else {
        alert('❌ Collaboration test failed: ' + result.error);
        console.error('❌ Collaboration test failed:', result);
      }
    } catch (error) {
      console.error('❌ Error testing collaboration:', error);
      alert('❌ Error testing collaboration. Check console for details.');
    } finally {
      setTestingCollaboration(false);
    }
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

        {/* Open Document Button - CHANGED */}
        <div className="mb-6">
          <button
            onClick={openDocument}
            disabled={opening || !isElectron}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isElectron
                ? opening
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {opening ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Opening Document...
              </span>
            ) : (
              '📁 Open Document'
            )}
          </button>
          
          {!isElectron && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Document opening is only available in the desktop app
            </p>
          )}
        </div>

        {/* Documents List - UNCHANGED */}
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
              <p className="text-sm mt-1">Open your first document to get started</p>
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

        {/* Test Collaboration Section - UNCHANGED */}
        {isElectron && process.env.NODE_ENV === 'development' && (
          <div className="mt-6 pt-4 border-t">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-yellow-800">
                  🧪 Development Testing
                </h3>
                <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-1 rounded">
                  DEV ONLY
                </span>
              </div>
              
              <p className="text-sm text-yellow-700 mb-4">
                Test collaboration functionality without protocol handler installation.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={testCollaboration}
                  disabled={testingCollaboration}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    testingCollaboration
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  {testingCollaboration ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing Collaboration...
                    </span>
                  ) : (
                    '🤝 Test Collaboration Join'
                  )}
                </button>
                
                <div className="text-xs text-yellow-600 space-y-1">
                  <p><strong>Room:</strong> room_1758291824279_oJaKqWcS8</p>
                  <p><strong>Status:</strong> Uses real authentication token</p>
                  <p><strong>Next:</strong> Open browser, set same token, test sync</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer with Debug Info */}
        <div className="mt-6 pt-4 border-t text-center text-xs text-gray-500">
          <p>Documents are stored locally at: <code>~/.local/share/Collite/documents</code></p>
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-1">Debug - Refresh trigger: {refreshTrigger} | Documents: {documents.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}
