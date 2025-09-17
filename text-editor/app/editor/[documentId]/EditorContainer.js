"use client"
import { useEffect } from "react"
import { EditorContent } from "@tiptap/react"
import { useYjsRoom } from "./hooks/useYjsRoom"
import { useAwareness } from "./hooks/useAwareness"
import { useCollaboration } from "./hooks/useCollaboration"
import EditorToolbar from "./EditorToolbar"
import CollaborationStatus from "./components/CollaborationStatus"
import EditorStyles from "./components/EditorStyles"
import ClientOnly from "./components/ClientOnly"

function EditorContainerContent({ documentId }) {
  const roomName = documentId || "default-room"

  const { ydoc, provider } = useYjsRoom(roomName)
  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, roomName)
  const editor = useCollaboration(ydoc, provider, roomName)

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

          <EditorToolbar editor={editor} />

          <div className="flex-1 overflow-auto">
            <EditorContent
              editor={editor}
              className="h-full w-full p-6 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none"
            />
          </div>

        </div>
      </div>
    </>
  )
}

export default function EditorContainer({ documentId }) {
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
      <EditorContainerContent documentId={documentId} />
    </ClientOnly>
  )
}
