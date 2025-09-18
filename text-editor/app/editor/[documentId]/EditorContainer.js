// app/editor/[documentId]/EditorContainer.js
"use client"
import { useEffect } from "react"
import { EditorContent } from "@tiptap/react"
import { useYjsRoom } from "./hooks/useYjsRoom"
import { useAwareness } from "./hooks/useAwareness"
import { useCollaboration } from "./hooks/useCollaboration"
import EditorToolbar from "./EditorToolbar"
import CollaborationStatus from "./components/CollaborationStatus"
import EditorStyles from "./components/EditorStyles"
import SaveIndicator from "./components/SaveIndicator"
import ClientOnly from "./components/ClientOnly"
import * as Y from 'yjs'
import { getSafeYText, getSafeYTextContent, hasYTextField } from "@/utils/yjsUtils"


function EditorContainerContent({ documentId, title = "Untitled Document" }) {
  const roomName = documentId || "default-room"

  const { ydoc, provider } = useYjsRoom(roomName)
  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, roomName)
  
  // ✅ Fixed: Include getYText in destructuring
  const { editor, saveStatus, saveDocument, getYText } = useCollaboration(ydoc, provider, roomName, title)

// app/editor/[documentId]/EditorContainer.js - Safe debug function
  const debugYjsState = () => {
    if (!ydoc) {
      console.warn('❌ Y.js document not ready');
      return;
    }

    const fieldName = `editor-${documentId}`;
    const content = getSafeYTextContent(ydoc, fieldName);
    
    console.log('🔍 Y.JS STATE DEBUG:');
    console.log('📦 Document ID:', documentId);
    console.log('📦 Field name:', fieldName);
    console.log('📦 Field exists:', hasYTextField(ydoc, fieldName));
    console.log('📦 Content length:', content.length);
    console.log('📦 Content preview:', JSON.stringify(content.slice(0, 200)));
    console.log('📦 All shared types:', Array.from(ydoc.share.keys()));
  };

  const debugTipTapContent = () => {
  if (!editor || !ydoc) {
    console.warn('❌ Editor or Y.js document not ready');
    return;
  }

  try {
    const fieldName = `editor-${documentId}`;
    
    // Get TipTap content in different formats
    const editorText = editor.getText();
    const editorHTML = editor.getHTML();
    const editorJSON = editor.getJSON();
    
    console.log('🔍 TIPTAP CONTENT DEBUG:');
    console.log('📝 Editor getText():', JSON.stringify(editorText.slice(0, 100)));
    console.log('📝 Editor getHTML():', JSON.stringify(editorHTML.slice(0, 200)));
    console.log('📝 Editor getJSON():', JSON.stringify(editorJSON, null, 2));
    
    // Check what's stored in Y.js
    if (ydoc.share.has(fieldName)) {
      const ytext = ydoc.share.get(fieldName);
      const yjsContent = ytext.toString();
      
      console.log('📄 Y.js raw content type:', typeof yjsContent);
      console.log('📄 Y.js raw content:', JSON.stringify(yjsContent));
      
      // Try to parse Y.js content
      try {
        const parsedContent = JSON.parse(yjsContent);
        console.log('📄 Y.js parsed JSON:', JSON.stringify(parsedContent, null, 2));
      } catch (error) {
        console.log('📄 Y.js content is not JSON');
      }
    }
    
    // Test state encoding
    const state = Y.encodeStateAsUpdate(ydoc);
    console.log('📦 State size:', state.length, 'bytes');
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}


  // ✅ Fixed debug function with safe Y.Text access
  const debugEditorContent = () => {
    if (!editor || !ydoc) {
      console.warn('❌ Editor or Y.js document not ready');
      return;
    }

    try {
      const editorText = editor.getText();
      const editorHTML = editor.getHTML();
      const fieldName = `editor-${documentId}`;
      
      // ✅ Safe Y.Text access with multiple fallbacks
      let yjsText = '';
      try {
        if (getYText) {
          const ytext = getYText();
          yjsText = ytext ? ytext.toString() : '';
        } else {
          // Fallback: direct access
          if (ydoc.share && ydoc.share.has(fieldName)) {
            yjsText = ydoc.share.get(fieldName).toString();
          } else {
            const ytext = ydoc.getText(fieldName);
            yjsText = ytext.toString();
          }
        }
      } catch (error) {
        console.error('❌ Error accessing Y.Text:', error);
        yjsText = '[ERROR]';
      }
      
      console.log('🔍 CONTENT DEBUG:');
      console.log('📝 TipTap text:', JSON.stringify(editorText.slice(0, 100)));
      console.log('📝 TipTap HTML:', JSON.stringify(editorHTML.slice(0, 200)));
      console.log('📄 Y.js field:', fieldName);
      console.log('📄 Y.js text:', JSON.stringify(yjsText.slice(0, 100)));
      console.log('📊 TipTap length:', editorText.length);
      console.log('📊 Y.js length:', yjsText.length);
      console.log('🔗 Contents match:', editorText === yjsText);
      
      // Check Y.js state
      try {
        const state = Y.encodeStateAsUpdate(ydoc);
        console.log('📦 Y.js state size:', state.length, 'bytes');
        
        // Test state reconstruction
        if (state.length > 0) {
          const tempDoc = new Y.Doc();
          Y.applyUpdate(tempDoc, state);
          const reconstructedText = tempDoc.getText(fieldName).toString();
          console.log('🔄 Reconstructed text:', JSON.stringify(reconstructedText.slice(0, 100)));
        }
      } catch (error) {
        console.error('❌ Error getting Y.js state:', error);
      }
      
      // Analyze sync issues
      if (editorText.length > 0 && yjsText.length === 0) {
        console.error('❌ SYNC ISSUE: Editor has content but Y.js is empty!');
        console.log('🔧 This indicates TipTap → Y.js sync is broken');
      } else if (editorText.length === 0 && yjsText.length > 0) {
        console.error('❌ SYNC ISSUE: Y.js has content but editor is empty!');
        console.log('🔧 This indicates Y.js → TipTap sync is broken');
      } else if (editorText.length === 0 && yjsText.length === 0) {
        console.warn('⚠️ Both editor and Y.js are empty - type some content first');
      } else {
        console.log('✅ Content sync looks good!');
      }
      
    } catch (error) {
      console.error('❌ Debug function error:', error);
    }
  };

  // ✅ Fixed force sync function
const forceContentSync = () => {
  if (!editor || !ydoc) {
    console.error('❌ Editor or Y.js not ready for sync');
    return;
  }

  try {
    // ✅ Fixed: Ensure editorContent is a string
    const editorContent = editor.getText();
    const fieldName = `editor-${documentId}`;
    
    console.log('🔧 FORCING CONTENT SYNC:');
    console.log('📝 Editor content type:', typeof editorContent);
    console.log('📝 Editor content:', JSON.stringify(editorContent.slice(0, 100)));
    
    // ✅ Type validation
    if (typeof editorContent !== 'string') {
      console.error('❌ Editor content is not a string:', typeof editorContent);
      return;
    }
    
    // ✅ Safe Y.Text access
    let ytext;
    try {
      if (getYText) {
        ytext = getYText();
      } else {
        if (ydoc.share && ydoc.share.has(fieldName)) {
          ytext = ydoc.share.get(fieldName);
        } else {
          ytext = ydoc.getText(fieldName);
        }
      }
    } catch (error) {
      console.error('❌ Error getting Y.Text for sync:', error);
      return;
    }

    if (ytext) {
      console.log('📄 Y.js content before:', JSON.stringify(ytext.toString().slice(0, 100)));
      
      // ✅ Clear and insert string content
      ytext.delete(0, ytext.length);
      if (editorContent.length > 0) {
        ytext.insert(0, editorContent); // Insert string directly
      }
      
      console.log('📄 Y.js content after:', JSON.stringify(ytext.toString().slice(0, 100)));
      console.log('✅ Force sync complete');
    }
  } catch (error) {
    console.error('❌ Force sync failed:', error);
    console.error('Error details:', error.stack);
  }
};

// ✅ Fixed test save operation
  const testSaveOperation = async () => {
    console.log('🧪 TESTING SAVE OPERATION:');
    debugEditorContent();
    
    if (ydoc) {
      const state = Y.encodeStateAsUpdate(ydoc);
      console.log('📦 Sending state to save (size):', state.length);
      console.log('📦 State array preview:', Array.from(state).slice(0, 20));
      
      try {
        await saveDocument();
        console.log('✅ Save operation completed - check Electron console for storage logs');
      } catch (error) {
        console.error('❌ Save operation failed:', error);
      }
    }
  };

  // ✅ Monitor editor updates with safe Y.Text access
  useEffect(() => {
    if (editor && ydoc) {
      const handleUpdate = ({ editor, transaction }) => {
        if (transaction.docChanged) {
          const content = editor.getText();
          console.log('📝 Editor updated - content length:', content.length);
          
          // Check Y.js content after editor update
          try {
            const fieldName = `editor-${documentId}`;
            let yjsContent = '';
            
            if (getYText) {
              const ytext = getYText();
              yjsContent = ytext ? ytext.toString() : '';
            } else {
              if (ydoc.share && ydoc.share.has(fieldName)) {
                yjsContent = ydoc.share.get(fieldName).toString();
              }
            }
            
            console.log('📄 Y.js content after editor update:', yjsContent.length);
            
            if (content.length !== yjsContent.length) {
              console.warn('⚠️ SYNC MISMATCH after editor update!');
              console.log('📝 Editor length:', content.length, '📄 Y.js length:', yjsContent.length);
            }
          } catch (error) {
            console.warn('❌ Error checking Y.js content after editor update:', error);
          }
        }
      };

      editor.on('update', handleUpdate);
      
      return () => {
        editor.off('update', handleUpdate);
      };
    }
  }, [editor, ydoc, documentId, getYText]);

  useEffect(() => {
    const handleError = (event) => {
      if (
        event.error?.message?.includes("Unexpected case") &&
        event.error?.stack?.includes("createAbsolutePositionFromRelativePosition")
      ) {
        console.warn("CollaborationCaret position mapping error suppressed:", event.error.message)
        event.preventDefault()
        return false
      }
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  // Handle manual save with Ctrl+S
  useEffect(() => {
    const handleKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        console.log('💾 Manual save triggered (Ctrl+S)')
        saveDocument()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [saveDocument])

  useEffect(() => {
    return () => {
      try {
        editor?.destroy()
      } catch (_) {}
    }
  }, [editor])

  return (
    <>
      <EditorStyles />
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-1 mx-4 my-2 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          <CollaborationStatus
            peerCount={peerCount}
            activePeers={activePeers}
            connectionStatus={connectionStatus}
            ydoc={ydoc}
            provider={provider}
            roomName={roomName}
          />

          {/* Enhanced toolbar with save indicator and debug buttons */}
          <div className="flex items-center justify-between border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <EditorToolbar editor={editor} />
              
              {/* ✅ Debug buttons - only in development */}
              {process.env.NODE_ENV === 'development' && editor && ydoc && (
                
                <div className="flex gap-1 ml-4 border-l pl-4">
                  <button
                    onClick={debugTipTapContent}
                    className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                    title="Debug TipTap content structure"
                  >
                    🔬 TipTap Debug
                  </button>
                  <button
                    onClick={debugYjsState}
                    className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                    title="Debug Y.js state and reconstruction"
                  >
                    🔬 Y.js Debug
                  </button>
                  <button
                    onClick={debugEditorContent}
                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                    title="Debug content sync between TipTap and Y.js"
                  >
                    🔍 Debug
                  </button>
                  <button
                    onClick={forceContentSync}
                    className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
                    title="Force sync editor content to Y.js"
                  >
                    🔧 Sync
                  </button>
                  <button
                    onClick={testSaveOperation}
                    className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                    title="Test save operation with current content"
                  >
                    💾 Test Save
                  </button>
                </div>
              )}
            </div>
            
            <div className="px-4">
              <SaveIndicator saveStatus={saveStatus} />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {editor ? (
              <EditorContent
                editor={editor}
                className="h-full w-full p-6 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none"
                suppressContentEditableWarning={true}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">Loading document...</p>
                </div>
              </div>
            )}
          </div>

          {/* ✅ Development info panel */}
          {process.env.NODE_ENV === 'development' && (
            <div className="border-t bg-gray-50 p-2 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <span>Document ID: <code>{documentId}</code></span>
                <span>Field: <code>editor-{documentId}</code></span>
                <span>Save Status: <code>{saveStatus}</code></span>
                <span>Y.js Ready: <code>{!!ydoc}</code></span>
                <span>Editor Ready: <code>{!!editor}</code></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function EditorContainer({ documentId, title }) {
  return (
    <ClientOnly
      fallback={
        <div className="min-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="border-b bg-muted/10 p-3">
            <div className="flex items-center gap-1">
              <div className="h-8 w-8 bg-muted animate-pulse rounded" />
              <div className="h-8 w-8 bg-muted animate-pulse rounded" />
              <div className="h-8 w-8 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-[600px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      }
    >
      <EditorContainerContent documentId={documentId} title={title} />
    </ClientOnly>
  )
}
