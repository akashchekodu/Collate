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

export default function EditorContainer({ documentId }) {
  const roomName = documentId || "default-room";
  
  // Y.js room management
  const { ydoc, provider } = useYjsRoom(roomName);
  
  // Awareness and peer management
  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, roomName);
  
  // Editor collaboration
  const editor = useCollaboration(ydoc, provider, roomName);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      try {
        editor?.destroy();
      } catch (_) {}
    };
  }, [editor]);
    useEffect(() => {
    const handleError = (event) => {
      if (
        event.error?.message?.includes('Unexpected case') && 
        event.error?.stack?.includes('createAbsolutePositionFromRelativePosition')
      ) {
        console.warn('CollaborationCaret position mapping error suppressed:', event.error.message);
        event.preventDefault(); // Prevent the error from showing in console
        return false;
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);


  return (
    <>
      <EditorStyles />
      <div className="bg-white rounded-2xl shadow-md border p-6 flex flex-col min-h-[60vh]">
        <EditorToolbar editor={editor} />
        
        <CollaborationStatus
          peerCount={peerCount}
          activePeers={activePeers}
          connectionStatus={connectionStatus}
          ydoc={ydoc}
          provider={provider}
          roomName={roomName}
        />
        
        <div className="flex-1 border rounded-lg">
          <EditorContent 
            editor={editor} 
            className="min-h-[400px]"
          />
        </div>
      </div>
    </>
  );
}
