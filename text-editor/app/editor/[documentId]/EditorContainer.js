// app/editor/[documentId]/EditorContainer.js
"use client"

import { useEffect, useState } from "react"
import { EditorContent } from "@tiptap/react"
import * as Y from "yjs"
import { useYjsRoom } from "./hooks/useYjsRoom"
import { useAwareness } from "./hooks/useAwareness"
import { useCollaboration } from "./hooks/useCollaboration"
import { useSoloEditor } from "./hooks/useSoloEditor"
import EditorToolbar from "./EditorToolbar"
import CollaborationStatus from "./components/CollaborationStatus"
import EditorStyles from "./components/EditorStyles"
import SaveIndicator from "./components/SaveIndicator"
import ClientOnly from "./components/ClientOnly"

// Single component handling both modes
function EditorContainerContent({ documentId, title, isCollabMode }) {
  const roomName = documentId || "default-room"

  // Conditional Y.js setup
  const { ydoc, provider } = useYjsRoom(isCollabMode ? roomName : null)
  const { peerCount, connectionStatus, activePeers } = useAwareness(
    isCollabMode ? provider : null,
    isCollabMode ? roomName : null
  )

  const collab = useCollaboration(
    isCollabMode ? ydoc : null,
    isCollabMode ? provider : null,
    roomName,
    title
  )
  const solo = useSoloEditor(!isCollabMode ? roomName : null, title)

  const { editor, saveStatus, saveDocument, getYText, isExternalDocument } =
    isCollabMode ? collab : solo

  // Debug and collaboration helpers omitted for brevity...

  return (
    <>
      <EditorStyles />
      <div className="h-full flex flex-col bg-white">
        {isCollabMode && (
          <CollaborationStatus
            peerCount={peerCount}
            activePeers={activePeers}
            connectionStatus={connectionStatus}
            ydoc={ydoc}
            provider={provider}
            roomName={roomName}
          />
        )}
        <div className="flex items-center justify-between border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <EditorToolbar editor={editor} />
            {/* Toggle */}
            <div className="flex items-center gap-2 ml-4 border-l pl-4">
              <span className="text-sm text-gray-600">Mode:</span>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => {}}
                  // No-op: toggle handled at parent
                  className={`px-3 py-1 text-sm rounded-md ${
                    !isCollabMode
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600"
                  }`}
                >
                  📝 Solo
                </button>
                <button
                  onClick={() => {}}
                  className={`px-3 py-1 text-sm rounded-md ${
                    isCollabMode
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600"
                  }`}
                >
                  👥 Collab
                </button>
              </div>
            </div>
            {/* Save */}
            <button
              onClick={() => saveDocument()}
              className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
            >
              💾 Save
            </button>
          </div>
          <div className="px-4">
            <SaveIndicator saveStatus={saveStatus} />
          </div>
        </div>
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
                Loading {isCollabMode ? "collaborative" : "solo"} editor...
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function EditorContainer({ documentId, title }) {
  const [isCollabMode, setIsCollabMode] = useState(false)

  // Unique key to force remount when mode changes
  const key = `${documentId}-${isCollabMode ? "collab" : "solo"}`

  return (
    <ClientOnly fallback={<div>Loading editor...</div>}>
      <div className="flex items-center p-2 bg-muted/20">
        <button
          onClick={() => setIsCollabMode(false)}
          className={`px-3 py-1 rounded ${
            !isCollabMode ? "bg-white shadow" : "text-gray-600"
          }`}
        >
          Solo
        </button>
        <button
          onClick={() => setIsCollabMode(true)}
          className={`px-3 py-1 rounded ml-2 ${
            isCollabMode ? "bg-white shadow" : "text-gray-600"
          }`}
        >
          Collab
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
