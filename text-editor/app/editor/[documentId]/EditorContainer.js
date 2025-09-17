// app/editor/[documentId]/EditorContainer.js
"use client";
import React, { useEffect } from "react";
import { EditorContent } from "@tiptap/react";
import { useYjsRoom } from "./hooks/useYjsRoom";
import { useAwareness } from "./hooks/useAwareness";
import { useCollaboration } from "./hooks/useCollaboration";
import EditorToolbar from "./EditorToolbar";
import CollaborationStatus from "./components/CollaborationStatus";
import EditorStyles from "./components/EditorStyles";
import ClientOnly from "./components/ClientOnly";

// Extract the actual content into a separate component
function EditorContainerContent({ documentId }) {
  const roomName = documentId || "default-room";
  
  // Y.js room management
  const { ydoc, provider } = useYjsRoom(roomName);
  
  // Awareness and peer management
  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, roomName);
  
  // Editor collaboration
  const editor = useCollaboration(ydoc, provider, roomName);

  // Error handling for cursor position mapping
  useEffect(() => {
    const handleError = (event) => {
      if (
        event.error?.message?.includes('Unexpected case') && 
        event.error?.stack?.includes('createAbsolutePositionFromRelativePosition')
      ) {
        console.warn('CollaborationCaret position mapping error suppressed:', event.error.message);
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      try {
        editor?.destroy();
      } catch (_) {}
    };
  }, [editor]);

  return (
    <>
      <EditorStyles />
      <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl">
        <CollaborationStatus
          peerCount={peerCount}
          activePeers={activePeers}
          connectionStatus={connectionStatus}
          ydoc={ydoc}
          provider={provider}
          roomName={roomName}
        />
        
        <EditorToolbar editor={editor} />
        
        <div className="flex-1 overflow-y-auto">
          <EditorContent 
            editor={editor} 
            className="h-full min-h-[500px]"
          />
        </div>
      </div>
    </>
  );
}


export default function EditorContainer({ documentId }) {
  const roomName = documentId || "default-room";
  
  return (
    <ClientOnly
      fallback={
        <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b text-sm">
            <div className="h-4 w-24 bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-16 bg-gray-700 animate-pulse rounded" />
          </div>
          <div className="border-b bg-muted/30 p-3">
            <div className="flex items-center gap-1">
              <div className="h-8 w-8 bg-gray-700 animate-pulse rounded" />
              <div className="h-8 w-8 bg-gray-700 animate-pulse rounded" />
              <div className="h-8 w-8 bg-gray-700 animate-pulse rounded" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      }
    >
      <EditorContainerContent documentId={documentId} />
    </ClientOnly>
  );
}

