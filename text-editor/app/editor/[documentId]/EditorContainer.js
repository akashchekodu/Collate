// app/editor/[documentId]/EditorContainer.js
"use client"
import { useEffect, useState } from "react"
import { EditorContent } from "@tiptap/react"
import * as Y from "yjs"
import { useYjsRoom } from "./hooks/useYjsRoom"
import { useAwareness } from "./hooks/useAwareness"
import { useElectronCollaboration } from "./hooks/useElectronCollaboration"
import { useElectronSolo } from "./hooks/useElectronSolo"
import { useWebCollaboration } from "./hooks/useWebCollaboration"
import EditorToolbar from "./EditorToolbar"
import CollaborationStatus from "./components/CollaborationStatus"
import EditorStyles from "./components/EditorStyles"
import SaveIndicator from "./components/SaveIndicator"
import ClientOnly from "./components/ClientOnly"

function EditorContainerContent({ documentId, title, isCollabMode }) {
  const roomName = documentId || "default-room"
  
  // Environment detection
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron
  console.log('🌍 Environment detected:', isElectron ? 'Electron' : 'Web Browser')
  console.log('📝 Document ID:', documentId)
  console.log('🏠 Room Name:', roomName)
  console.log('⚙️ Mode:', isElectron ? (isCollabMode ? 'Electron Collab' : 'Electron Solo') : 'Web Collab Only')

  // Y.js setup (only for collab modes)
  const needsYjs = !isElectron || isCollabMode
  console.log('🔧 Y.js needed:', needsYjs)
  
  const { ydoc, provider } = useYjsRoom(needsYjs ? roomName : null)
  const { peerCount, connectionStatus, activePeers } = useAwareness(
    needsYjs ? provider : null,
    needsYjs ? roomName : null
  )

  // Hook selection based on environment and mode
  let hook
  if (isElectron) {
    if (isCollabMode) {
      console.log('🎯 Using Electron Collaboration Hook')
      hook = useElectronCollaboration(ydoc, provider, roomName, title)
    } else {
      console.log('🎯 Using Electron Solo Hook')
      hook = useElectronSolo(roomName, title)
    }
  } else {
    console.log('🎯 Using Web Collaboration Hook')
    hook = useWebCollaboration(ydoc, provider, roomName, title)
  }

  const { editor, saveStatus, saveDocument, debugInfo } = hook

  console.log('📊 Hook Status:', {
    editorReady: !!editor,
    saveStatus,
    debugInfo
  })

  // Debug function
  const debugAll = () => {
    console.log('🔍 FULL DEBUG DUMP:')
    console.log('Environment:', isElectron ? 'Electron' : 'Web')
    console.log('Mode:', isElectron ? (isCollabMode ? 'Collab' : 'Solo') : 'Web Collab')
    console.log('Room:', roomName)
    console.log('Y.js needed:', needsYjs)
    console.log('Y.Doc exists:', !!ydoc)
    console.log('Provider exists:', !!provider)
    console.log('Connection status:', connectionStatus)
    console.log('Peer count:', peerCount)
    console.log('Editor ready:', !!editor)
    console.log('Save status:', saveStatus)
    
    if (editor) {
      console.log('Editor content length:', editor.getText().length)
      console.log('Editor content preview:', editor.getText().slice(0, 100))
    }
    
    if (ydoc && needsYjs) {
      const fieldName = `editor-${roomName}`
      try {
        const yxml = ydoc.getXmlFragment(fieldName)
        console.log('Y.js field exists:', !!yxml)
        console.log('Y.js content length:', yxml.toString().length)
      } catch (e) {
        console.log('Y.js field error:', e.message)
      }
    }
  }

  return (
    <>
      <EditorStyles />
      <div className="h-full flex flex-col bg-white">
        {/* Collaboration status - only in collab modes */}
        {needsYjs && (
          <CollaborationStatus
            peerCount={peerCount}
            activePeers={activePeers}
            connectionStatus={connectionStatus}
            ydoc={ydoc}
            provider={provider}
            roomName={roomName}
          />
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <EditorToolbar editor={editor} />
            
            {/* Mode indicator */}
            <div className="flex items-center gap-2 ml-4 border-l pl-4">
              <span className="text-sm font-medium">
                {isElectron 
                  ? (isCollabMode ? '👥 Electron Collab' : '📝 Electron Solo')
                  : '🌐 Web Collab'
                }
              </span>
            </div>

            {/* Debug button */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={debugAll}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 ml-2"
              >
                🔍 Debug All
              </button>
            )}

            {/* Save button (Electron only) */}
            {isElectron && (
              <button
                onClick={() => {
                  console.log('💾 Save button clicked')
                  saveDocument()
                }}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 ml-2"
              >
                💾 Save
              </button>
            )}
          </div>
          
          {isElectron && (
            <div className="px-4">
              <SaveIndicator saveStatus={saveStatus} />
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          {editor ? (
            <EditorContent
              editor={editor}
              className="h-full w-full p-6 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none"
              suppressContentEditableWarning
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="ml-2 text-muted-foreground">
                Loading {isElectron ? (isCollabMode ? 'collaborative' : 'solo') : 'web'} editor...
              </p>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="border-t bg-gray-50 p-2 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Room: <code>{roomName}</code></span>
            <span>Env: <code>{isElectron ? 'Electron' : 'Web'}</code></span>
            <span>Mode: <code>{isElectron ? (isCollabMode ? 'Collab' : 'Solo') : 'Web-Collab'}</code></span>
            {needsYjs && <span>Peers: <code>{peerCount}</code></span>}
            {needsYjs && <span>Status: <code>{connectionStatus}</code></span>}
            <span>Save: <code>{saveStatus}</code></span>
          </div>
        </div>
      </div>
    </>
  )
}

export default function EditorContainer({ documentId, title, initialCollabMode = false }) {
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron
  const [isCollabMode, setIsCollabMode] = useState(initialCollabMode)

  console.log('🎛️ EditorContainer mounted:', { documentId, title, initialCollabMode, isElectron })

  // Web browser: always collaborative, no mode toggle
  if (!isElectron) {
    const key = `web-${documentId}`
    console.log('🌐 Rendering web-only collaborative editor with key:', key)
    
    return (
      <ClientOnly fallback={<div>Loading web collaborative editor...</div>}>
        <EditorContainerContent
          key={key}
          documentId={documentId}
          title={title}
          isCollabMode={true} // Always collab in web
        />
      </ClientOnly>
    )
  }

  // Electron: full mode toggle
  const key = `electron-${documentId}-${isCollabMode ? "collab" : "solo"}`
  console.log('⚡ Rendering Electron editor with key:', key, 'mode:', isCollabMode ? 'collab' : 'solo')

  return (
    <ClientOnly fallback={<div>Loading Electron editor...</div>}>
      {/* Mode toggle */}
      <div className="flex items-center p-2 bg-muted/20 border-b">
        <span className="text-sm text-gray-600 mr-3">Mode:</span>
        <button
          onClick={() => {
            console.log('🔄 Switching to Solo mode')
            setIsCollabMode(false)
          }}
          className={`px-3 py-1 rounded text-sm ${
            !isCollabMode ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          📝 Solo
        </button>
        <button
          onClick={() => {
            console.log('🔄 Switching to Collaboration mode')
            setIsCollabMode(true)
          }}
          className={`px-3 py-1 rounded text-sm ml-2 ${
            isCollabMode ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          👥 Collab
        </button>
      </div>
      
      <EditorContainerContent
        key={key}
        documentId={documentId}
        title={title}
        isCollabMode={isCollabMode}
      />
    </ClientOnly>
  )
}
