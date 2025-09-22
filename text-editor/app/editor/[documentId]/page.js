// app/editor/[documentId]/page.js
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import ClientOnly from "./components/ClientOnly";
import EditorHeader from "./EditorHeader";
import EditorContainer from "./EditorContainer";
import { useYjsRoom } from "./hooks/useYjsRoom";
import { useAwareness } from "./hooks/useAwareness";

export default function EditorPage() {
  const { documentId } = useParams();
  const [title, setTitle] = useState("Untitled Document");
  const [isElectron, setIsElectron] = useState(false);

  // ✅ GET COLLABORATION STATE AT PAGE LEVEL
  const {
    ydoc,
    provider,
    isCollaborationMode,
    collaborationToken,
    standardFieldName,
    isSwitching,
    enableCollaboration,
    disableCollaboration
  } = useYjsRoom(documentId, { documentId, documentTitle: title });

  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, documentId);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI?.isElectron);
  }, []);

  // Load document title from storage
  useEffect(() => {
    const loadDocumentTitle = async () => {
      if (!documentId || !isElectron) return;

      try {
        const result = await window.electronAPI.documents.load(documentId);
        if (result && result.metadata && result.metadata.title) {
          setTitle(result.metadata.title);
        }
      } catch (error) {
        console.error('Failed to load document title:', error);
        setTitle("Untitled Document");
      }
    };

    loadDocumentTitle();
  }, [documentId, isElectron]);

  return (
    <ClientOnly
      fallback={
        <div className="h-screen bg-background overflow-hidden">
          <div className="sticky top-0 z-50 border-b bg-background/95">
            <div className="container flex h-16 items-center px-6">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
          <main className="h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </main>
        </div>
      }
    >
      <div className="h-screen bg-background overflow-hidden flex flex-col">
        {/* ✅ HEADER WITH ALL COLLABORATION PROPS */}
        <EditorHeader
          documentId={documentId}
          initialTitle={title}
          onTitleChange={setTitle}
          // ✅ PASS COLLABORATION STATE FROM PAGE LEVEL
          isCollaborationMode={isCollaborationMode}
          collaborationToken={collaborationToken}
          isSwitching={isSwitching}
          enableCollaboration={enableCollaboration}
          disableCollaboration={disableCollaboration}
          peerCount={peerCount}
          connectionStatus={connectionStatus}
          activePeers={activePeers}
        />

        {/* ✅ CONTAINER WITH EXISTING COLLABORATION DATA */}
        <main className="flex-1 overflow-hidden">
          <EditorContainer
            documentId={documentId}
            title={title}
            // ✅ PASS THE SAME COLLABORATION STATE TO CONTAINER
            ydoc={ydoc}
            provider={provider}
            isCollaborationMode={isCollaborationMode}
            collaborationToken={collaborationToken}
            standardFieldName={standardFieldName}
            isSwitching={isSwitching}
            peerCount={peerCount}
            connectionStatus={connectionStatus}
            activePeers={activePeers}
          />
        </main>
      </div>
    </ClientOnly>
  );
}
