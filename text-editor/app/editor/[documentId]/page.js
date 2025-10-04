"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import ClientOnly from "./components/ClientOnly";
import EditorHeader from "./EditorHeader";
import EditorContainer from "./EditorContainer";
import { useYjsRoom } from "./hooks/useYjsRoom";
import { useAwareness } from "./hooks/useAwareness";
import { useStableDocumentData } from "./hooks/useStableDocumentData";

export default function EditorPage() {
  const { documentId } = useParams();
  const [isElectron, setIsElectron] = useState(false);

  // ✅ DEBUG: Track component lifecycle (SSR-safe)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🔄 EditorPage render:', {
        documentId: documentId?.slice(0, 8) + '...' || 'undefined',
        timestamp: Date.now(),
        renderCount: ++window.editorPageRenderCount || (window.editorPageRenderCount = 1)
      });
    }
  });

  // ✅ SINGLE SOURCE: Load document data once
  const { documentData, isLoading, isError } = useStableDocumentData(documentId);

  // ✅ STABLE: Use document data from single source
  const title = documentData?.title || "Untitled Document";

  const {
    ydoc,
    provider,
    isCollaborationMode,
    collaborationToken,
    standardFieldName,
    isSwitching,
    enableCollaboration,
    disableCollaboration
  } = useYjsRoom(documentId, {
    documentId,
    documentTitle: title,
    collaborationData: documentData?.collaboration // ✅ Pass collaboration data
  });

  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, documentId);

  // Check if running in Electron
  useEffect(() => {
    console.log('🔄 EditorPage isElectron effect triggered');
    setIsElectron(typeof window !== 'undefined' && window.electronAPI?.isElectron);
  }, []);

  // ✅ LOADING STATE: Show loading until document data is ready
  if (isLoading) {
    return (
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
            <div className="ml-4 text-muted-foreground">Loading document...</div>
          </div>
        </main>
      </div>
    );
  }

  // ✅ ERROR STATE: Show error if document failed to load (but not for Electron fallback)
  if (isError && !documentData?.isElectronFallback) {
    return (
      <div className="h-screen bg-background overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-destructive mb-2">Failed to load document</div>
            <div className="text-sm text-muted-foreground mb-4">{documentData?.error}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly fallback={null}>
      <div className="h-screen bg-background overflow-hidden flex flex-col">
        <EditorHeader
          documentId={documentId}
          initialTitle={title}
          onTitleChange={() => { }} // ✅ Remove title changing for now
          isCollaborationMode={isCollaborationMode}
          collaborationToken={collaborationToken}
          isSwitching={isSwitching}
          enableCollaboration={enableCollaboration}
          disableCollaboration={disableCollaboration}
          peerCount={peerCount}
          connectionStatus={connectionStatus}
          activePeers={activePeers}
        />

        <main className="flex-1 overflow-hidden">
          <EditorContainer
            documentId={documentId}
            title={title}
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
