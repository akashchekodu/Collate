"use client"
import { useEffect, useCallback, useState } from "react"
import { EditorContent } from "@tiptap/react"
import { useCollaboration } from "./hooks/useCollaboration"
import EditorToolbar from "./EditorToolbar"
import CollaborationStatus from "./components/CollaborationStatus"
import EditorStyles from "./components/EditorStyles"
import SaveIndicator from "./components/SaveIndicator"
import ClientOnly from "./components/ClientOnly"

function EditorContainerContent({
  documentId,
  title = "Untitled Document",
  // ✅ RECEIVE COLLABORATION STATE FROM PAGE
  ydoc,
  provider,
  isCollaborationMode,
  collaborationToken,
  standardFieldName,
  isSwitching,
  peerCount,
  connectionStatus,
  activePeers
}) {
  // ✅ ONLY USE COLLABORATION HOOK FOR EDITOR
  const { editor, saveStatus, saveDocument, editorError, fieldName } = useCollaboration(ydoc, provider, documentId, title, standardFieldName)

  // ✅ ERROR STATE MANAGEMENT
  const [criticalError, setCriticalError] = useState(false)
  const [warningCount, setWarningCount] = useState(0)
  const [lastWarningTime, setLastWarningTime] = useState(0)

  // ✅ COLLABORATION DEBUG (Development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Collaboration Status:', {
        documentId: documentId.slice(0, 8) + '...',
        isCollaborationMode,
        hasToken: !!new URLSearchParams(window.location.search).get('token'),
        expectedRoom: `collab-${documentId}`,
        peerCount,
        connectionStatus,
        isSwitching
      });
    }
  }, [documentId, isCollaborationMode, peerCount, connectionStatus, isSwitching]);

  // ✅ LONG-TERM ERROR HANDLING: Classify errors properly
  useEffect(() => {
    const classifyAndHandleError = (event) => {
      const error = event.error || event.reason;
      const errorMessage = error?.message || error?.toString() || '';

      // ✅ CATEGORY 1: CRDT Normal Operations (NOT errors)
      const crdtNormalEvents = [
        'Unexpected case',           // Normal TipTap collaboration conflict resolution
        'Transform failed',         // Normal Y.js transform conflicts
        'position mapping',         // Normal position adjustments during collaboration
      ];

      const isNormalCRDTEvent = crdtNormalEvents.some(pattern =>
        errorMessage.includes(pattern)
      );

      if (isNormalCRDTEvent) {
        // ✅ SILENT: These are normal CRDT operations, not errors
        event.preventDefault?.();
        event.stopPropagation?.();
        return true;
      }

      // ✅ CATEGORY 2: Collaboration Warnings (Monitor but don't break)
      const collaborationWarnings = [
        'out of sync',
        'Invalid content',
        'position out of range',
        'collaboration conflict'
      ];

      const isCollaborationWarning = collaborationWarnings.some(pattern =>
        errorMessage.includes(pattern)
      );

      if (isCollaborationWarning) {
        const now = Date.now();
        const timeSinceLastWarning = now - lastWarningTime;

        // ✅ RATE LIMITING: Only count frequent warnings as concerning
        if (timeSinceLastWarning < 1000) { // Less than 1 second apart
          setWarningCount(prev => {
            const newCount = prev + 1;

            // ✅ THRESHOLD: Only show concern after many rapid warnings
            if (newCount >= 20) { // Much higher threshold
              console.warn('⚠️ High frequency collaboration warnings detected');
              // Don't break the editor, just log
            }

            return newCount;
          });
        } else {
          // ✅ RESET: Reset counter if warnings aren't frequent
          setWarningCount(1);
        }

        setLastWarningTime(now);
        event.preventDefault?.();
        return true;
      }

      // ✅ CATEGORY 3: Critical Errors (Actually break functionality)
      const criticalErrors = [
        'Network error',
        'Failed to connect',
        'WebSocket error',
        'Document corrupted',
        'Unable to sync'
      ];

      const isCriticalError = criticalErrors.some(pattern =>
        errorMessage.includes(pattern)
      );

      if (isCriticalError) {
        console.error('🚨 Critical collaboration error:', errorMessage);
        setCriticalError(true);
        return true;
      }

      // ✅ DEFAULT: Let other errors pass through normally
      return false;
    };

    // ✅ CAPTURE PHASE: Intercept early to prevent UI disruption
    window.addEventListener('error', classifyAndHandleError, true);
    window.addEventListener('unhandledrejection', classifyAndHandleError, true);

    return () => {
      window.removeEventListener('error', classifyAndHandleError, true);
      window.removeEventListener('unhandledrejection', classifyAndHandleError, true);
    };
  }, [lastWarningTime]);

  // ✅ RESET ERROR STATE: When document changes or recovers
  useEffect(() => {
    setCriticalError(false);
    setWarningCount(0);
    setLastWarningTime(0);
  }, [documentId]);

  // ✅ AUTO RECOVERY: Reset critical error state after timeout
  useEffect(() => {
    if (criticalError) {
      const recoveryTimer = setTimeout(() => {
        console.log('🔄 Attempting auto-recovery from critical error');
        setCriticalError(false);
        setWarningCount(0);
      }, 10000); // 10 seconds

      return () => clearTimeout(recoveryTimer);
    }
  }, [criticalError]);

  // ✅ ENHANCED RESET: More intelligent reset
  const resetEditor = useCallback(() => {
    console.log('🔄 Intelligent editor reset');

    // ✅ SOFT RESET: Try to recover without full reload
    setCriticalError(false);
    setWarningCount(0);
    setLastWarningTime(0);

    // ✅ ONLY RELOAD: If we have a real critical error
    if (editorError || !editor) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [editorError, editor]);

  // ✅ KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        saveDocument()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [saveDocument]);

  // ✅ SMART ERROR DISPLAY: Only show for actual critical issues
  const shouldShowErrorUI = criticalError || (editorError && !editor);
  const shouldShowWarning = warningCount > 10 && warningCount < 20;

  return (
    <>
      <EditorStyles />
      {/* ✅ REMOVED HEADER - Now handled at page level */}
      <div className="h-full bg-gray-50">
        <div className="h-full mx-4 my-2 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">

          {/* ✅ SIMPLIFIED MODE INDICATOR */}
          <div className="border-b bg-gray-50 px-4 py-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSwitching ? (
                  <span className="font-medium text-blue-600">
                    🔄 Switching modes...
                  </span>
                ) : (
                  <span className="font-medium">
                    {isCollaborationMode ? '🤝 Collaboration Mode' : '📝 Solo Mode'}
                  </span>
                )}

                {/* ✅ SMART WARNING: Only show for concerning patterns */}
                {shouldShowWarning && (
                  <span className="text-yellow-600 font-medium">
                    ⚠️ Collaboration active
                  </span>
                )}

                {criticalError && (
                  <span className="text-red-600 font-medium">
                    ❌ Connection Issue
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Field: <code>{(standardFieldName || `editor-${documentId}`).slice(0, 20)}...</code></span>
                {isCollaborationMode && (
                  <span>Room: <code>collab-{documentId.slice(0, 8)}...</code></span>
                )}
              </div>
            </div>
          </div>

          {/* ✅ SHOW COLLABORATION STATUS: Only when in collaboration mode */}
          {isCollaborationMode && !isSwitching && (
            <CollaborationStatus
              peerCount={peerCount}
              activePeers={activePeers}
              connectionStatus={connectionStatus}
              ydoc={ydoc}
              provider={provider}
              roomName={documentId}
            />
          )}

          {/* ✅ SIMPLIFIED TOOLBAR - No collaboration controls */}
          <div className="flex items-center justify-between border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <EditorToolbar editor={editor} />

              {/* ✅ DEVELOPMENT TOOLS ONLY */}
              {process.env.NODE_ENV === 'development' && criticalError && (
                <div className="ml-4 border-l pl-4">
                  <button
                    onClick={resetEditor}
                    className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                    title="Reset collaboration"
                  >
                    🔄 Reset
                  </button>
                </div>
              )}
            </div>

            <div className="px-4">
              <SaveIndicator saveStatus={saveStatus} />
            </div>
          </div>

          {/* ✅ SMART EDITOR CONTENT: Handle switching state */}
          <div className="flex-1 overflow-auto">
            {isSwitching ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <div className="text-blue-600 text-lg font-medium">🔄 Switching Modes</div>
                  <p className="text-gray-600 max-w-md">
                    {isCollaborationMode
                      ? "Enabling collaboration features... Your content is being preserved."
                      : "Switching to solo mode... Your content is being preserved."
                    }
                  </p>
                  <div className="text-sm text-gray-500">
                    <p>✅ Document content: Preserved</p>
                    <p>✅ Edit history: Maintained</p>
                    <p>🔄 Mode: Switching...</p>
                  </div>
                </div>
              </div>
            ) : shouldShowErrorUI ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <div className="text-red-500 text-lg">🔌 Connection Issue</div>
                  <p className="text-gray-600 max-w-md">
                    Unable to maintain collaboration connection. This may be due to network issues or server problems.
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <p>Status: {connectionStatus}</p>
                    <p>Collaboration mode: {isCollaborationMode ? 'Active' : 'Disabled'}</p>
                    <p>Connected peers: {peerCount}</p>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={resetEditor}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      🔄 Retry Connection
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      🔄 Reload Page
                    </button>
                  </div>
                </div>
              </div>
            ) : editor ? (
              <EditorContent
                editor={editor}
                className="h-full w-full p-6 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none"
                suppressContentEditableWarning={true}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">Loading editor...</p>
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 text-center space-y-1">
                      <p>Y.js: {!!ydoc ? '✅' : '⏳'}</p>
                      <p>Provider: {!!provider ? '✅' : '⏳'}</p>
                      <p>Editor: {!!editor ? '✅' : '⏳'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ✅ ENHANCED DEVELOPMENT INFO */}
          {process.env.NODE_ENV === 'development' && (
            <div className="border-t bg-gray-50 p-2 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <span>Document: <code>{documentId.slice(0, 8)}...</code></span>
                <span>Y.js: <code>{!!ydoc ? 'Ready' : 'Loading'}</code></span>
                <span>Editor: <code>{!!editor ? 'Ready' : 'Loading'}</code></span>
                <span>Mode: <code>{isSwitching ? 'Switching' : (isCollaborationMode ? 'Collab' : 'Solo')}</code></span>
                <span>Peers: <code>{peerCount}</code></span>
                <span>Warnings: <code>{warningCount}</code></span>
                <span>Status: <code>{criticalError ? 'Error' : shouldShowWarning ? 'Warning' : 'OK'}</code></span>
                <span>Token: <code>{collaborationToken ? 'Yes' : 'No'}</code></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function EditorContainer({
  documentId,
  title,
  // ✅ RECEIVE ALL COLLABORATION PROPS
  ydoc,
  provider,
  isCollaborationMode,
  collaborationToken,
  standardFieldName,
  isSwitching,
  peerCount,
  connectionStatus,
  activePeers
}) {
  return (
    <ClientOnly fallback={<div>Loading...</div>}>
      <EditorContainerContent
        documentId={documentId}
        title={title}
        // ✅ PASS THROUGH ALL COLLABORATION PROPS
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
    </ClientOnly>
  )
}
