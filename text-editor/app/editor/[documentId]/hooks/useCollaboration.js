"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useRef, useMemo } from "react"
import { createEditorExtensions, editorProps } from "../config/editorConfig"
import { useDocumentPersistence } from "../../../hooks/useDocumentPersistence"
import * as Y from 'yjs'
import { useCallback } from "react"

export function useCollaboration(ydoc, provider, documentId, title = "Untitled Document", standardFieldName, collaborationState = null) {
  const [initialContent, setInitialContent] = useState(null)
  const [editorError, setEditorError] = useState(null)

  const collaborationMetadata = useMemo(() => {
    if (!collaborationState) return null;

    return {
      enabled: collaborationState.isCollaborationMode || false,
      mode: collaborationState.isCollaborationMode ? 'collaborative' : 'solo',
      sessionPersistent: true, // Since we're in collaboration mode
      roomId: `collab-${documentId}`,
      fieldName: standardFieldName,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),

      // ✅ Token and link management  
      link: collaborationState.collaborationToken ? {
        token: collaborationState.collaborationToken,
        url: `${window.location.origin}/editor/${documentId}?token=${collaborationState.collaborationToken}`,
        createdAt: new Date().toISOString()
      } : null,

      // ✅ Enhanced structure (initialized empty, populated by services)
      links: { permanent: [], oneTime: [] },
      participants: [],
      revoked: [],
      schemaVersion: 2
    };
  }, [collaborationState, documentId, standardFieldName]);
  const { saveDocument, loadDocument, saveStatus } = useDocumentPersistence(ydoc, documentId, title, collaborationMetadata)
  const isLoadedRef = useRef(false)
  const errorCountRef = useRef(0)

  // ✅ STANDARD: Use consistent field name
  const fieldName = standardFieldName || `editor-${documentId}`;

  console.log('🏗️ useCollaboration init:', {
    documentId: documentId.slice(0, 8) + '...',
    fieldName,
    hasYdoc: !!ydoc,
    hasProvider: !!provider
  });




  // Safe Y.Text getter with standard field name
  const getYText = useCallback(() => {
    if (!ydoc || !documentId) return null;

    if (ydoc.share.has(fieldName)) {
      return ydoc.share.get(fieldName);
    }

    console.log('🆕 Creating standard Y.Text field for persistence:', fieldName);
    return ydoc.getText(fieldName);
  }, [ydoc, documentId, fieldName]);

  // Load saved content
  useEffect(() => {
    async function loadSavedContent() {
      if (typeof window === 'undefined' || !window.electronAPI?.isElectron || !ydoc || isLoadedRef.current) {
        if (!isLoadedRef.current) {
          setInitialContent(true)
          isLoadedRef.current = true
        }
        return
      }

      try {
        const savedDoc = await loadDocument()
        if (savedDoc && savedDoc.state) {
          const state = new Uint8Array(savedDoc.state)
          Y.applyUpdate(ydoc, state)
          console.log('📚 Document restored from storage using standard field')
        }
      } catch (error) {
        console.warn('Failed to load document:', error)
      }

      setInitialContent(true)
      isLoadedRef.current = true
    }

    loadSavedContent()
  }, [ydoc, loadDocument])

  // Error handler
  const handleEditorError = useCallback((error, context = 'unknown') => {
    errorCountRef.current += 1;
    console.error(`❌ Editor error #${errorCountRef.current} (${context}):`, error);

    if (errorCountRef.current >= 3) {
      setEditorError(`Collaboration error: ${error.message || error}`);
    }
  }, []);

  // ✅ CURSOR-ONLY EDITOR: Remove all typing status code
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, documentId, standardFieldName),
    immediatelyRender: false,
    editorProps,
    onCreate: ({ editor }) => {
      console.log("✅ Cursor-only editor created:", fieldName)
      setEditorError(null)
      errorCountRef.current = 0;
    },
    onUpdate: ({ editor, transaction }) => {
      if (transaction.docChanged) {
        try {
          console.log("📝 Editor updated:", {
            fieldName,
            length: editor.getText().length
          });
          // ✅ REMOVED: All typing status code
        } catch (error) {
          handleEditorError(error, 'update');
        }
      }
    },
    onSelectionUpdate: ({ editor }) => {
      try {
        if (provider?.awareness && ydoc) {
          const { from, to } = editor.state.selection;
          const docSize = editor.state.doc.content.size;

          const safeFrom = Math.max(0, Math.min(from, docSize));
          const safeTo = Math.max(0, Math.min(to, docSize));

          // ✅ SIMPLE: Direct cursor update without helper functions
          provider.awareness.setLocalStateField("cursor", {
            anchor: safeFrom,
            head: safeTo,
            timestamp: Date.now(),
          });

          console.log('👆 Cursor position updated:', { from: safeFrom, to: safeTo });
        }
      } catch (error) {
        console.warn("❌ Cursor position update failed:", error);
      }
    },
    onDestroy: () => {
      console.log("❌ Cursor-only editor destroyed:", fieldName)
      // ✅ REMOVED: All typing cleanup code
    },
    onError: ({ editor, error }) => {
      handleEditorError(error, 'tiptap');
    }
  }, [ydoc, provider, documentId, standardFieldName, initialContent, handleEditorError])

  // Monitor Y.js changes for standard field
  useEffect(() => {
    if (!ydoc || !editor || !documentId || editorError) return

    const setupObserver = () => {
      try {
        const ytext = getYText();
        if (ytext) {
          console.log('📝 Setting up Y.Text observer for standard field:', fieldName)

          const onYTextChange = (event) => {
            console.log("📝 Y.Text changed (standard field):", {
              fieldName,
              operations: event.delta?.length || 0,
              contentLength: ytext.length
            })
          }

          ytext.observe(onYTextChange)
          return () => ytext.unobserve(onYTextChange)
        }
      } catch (error) {
        handleEditorError(error, 'observer-setup');
      }
    }

    let cleanup = setupObserver()
    if (!cleanup) {
      const timeout = setTimeout(() => {
        cleanup = setupObserver()
      }, 500)
      return () => clearTimeout(timeout)
    }

    return cleanup
  }, [ydoc, editor, documentId, fieldName, editorError, getYText, handleEditorError])

  // ✅ SIMPLE: Just keep user active (for cursor visibility)
  useEffect(() => {
    if (!provider?.awareness) return;

    const activityInterval = setInterval(() => {
      try {
        const currentUser = provider.awareness.getLocalState()?.user;
        if (currentUser) {
          provider.awareness.setLocalStateField("user", {
            ...currentUser,
            lastSeen: Date.now()
          });
        }
      } catch (error) {
        console.warn('❌ Activity update failed:', error);
      }
    }, 30000);

    return () => clearInterval(activityInterval);
  }, [provider]);

  // Clean up
  useEffect(() => {
    isLoadedRef.current = false
    setInitialContent(null)
    setEditorError(null)
    errorCountRef.current = 0;
  }, [documentId])

  return {
    editor: (initialContent && !editorError) ? editor : null,
    saveStatus,
    saveDocument,
    editorError,
    fieldName
  }
}
