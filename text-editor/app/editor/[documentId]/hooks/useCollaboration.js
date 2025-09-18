// app/editor/[documentId]/hooks/useCollaboration.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useRef } from "react"
import { createEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"
import { useDocumentPersistence } from "../../../hooks/useDocumentPersistence"
import * as Y from 'yjs'
import { useCallback } from "react"
import { getSafeYText } from "@/utils/yjsUtils"
export function useCollaboration(ydoc, provider, roomName, title = "Untitled Document") {
  const [initialContent, setInitialContent] = useState(null);
  const { saveDocument, loadDocument, saveStatus } = useDocumentPersistence(ydoc, roomName, title);
  const isLoadedRef = useRef(false);
  const ytextRef = useRef(null); // ✅ Cache Y.Text instance


  // ✅ Safe Y.Text getter with error handling
  const getYText = useCallback(() => {
    if (!ydoc || !roomName) return null;
    const fieldName = `editor-${roomName}`;
    return getSafeYText(ydoc, fieldName);
  }, [ydoc, roomName]);

  // Load saved content on mount - only once
  useEffect(() => {
    async function loadSavedContent() {
      if (typeof window === 'undefined' || !window.electronAPI?.isElectron || !ydoc || isLoadedRef.current) {
        if (!isLoadedRef.current) {
          setInitialContent(true);
          isLoadedRef.current = true;
        }
        return;
      }
      
      try {
        const savedDoc = await loadDocument();
        if (savedDoc && savedDoc.state) {
          const state = new Uint8Array(savedDoc.state);
          Y.applyUpdate(ydoc, state);
          console.log('📚 Restored document from local storage');
        }
      } catch (error) {
        console.warn('Failed to load saved document:', error);
      }
      
      setInitialContent(true);
      isLoadedRef.current = true;
    }

    loadSavedContent();
  }, [ydoc, loadDocument]);

// app/editor/[documentId]/hooks/useCollaboration.js - Revert to simple version
const editor = useEditor({
  extensions: createEditorExtensions(ydoc, provider, roomName),
  immediatelyRender: false,
  editorProps,
  ...editorCallbacks,
  // ✅ Revert to simple cursor handling - don't break selection
  onSelectionUpdate: ({ editor }) => {
    if (provider?.awareness && ydoc) {
      try {
        const { from, to } = editor.state.selection
        const docSize = editor.state.doc.content.size

        const safeFrom = Math.max(0, Math.min(from, docSize))
        const safeTo = Math.max(0, Math.min(to, docSize))

        provider.awareness.setLocalStateField("cursor", {
          anchor: safeFrom,
          head: safeTo,
          timestamp: Date.now(),
        })
      } catch (error) {
        console.warn("Cursor position update failed:", error)
      }
    }
  },
})

  // ✅ Y.js event listeners with safe access
  useEffect(() => {
    if (!ydoc || !editor || !roomName) return

    try {
      const ytext = getYText();
      if (!ytext) {
        console.warn('❌ Could not get Y.Text instance');
        return;
      }

      const onYTextChange = (event) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Y.Text changed:", event.delta.length, 'operations');
        }
      }

      ytext.observe(onYTextChange)

      return () => {
        try {
          ytext.unobserve(onYTextChange)
        } catch (error) {
          console.warn("Error unobserving Y.Text:", error)
        }
      }
    } catch (error) {
      console.warn("Y.js setup error:", error)
    }
  }, [ydoc, editor, roomName, getYText])

  // ✅ Clean up Y.Text reference when document changes
  useEffect(() => {
    ytextRef.current = null;
    isLoadedRef.current = false;
    setInitialContent(null);
  }, [roomName]);

  // ✅ Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      ytextRef.current = null;
    };
  }, []);

  return {
    editor: initialContent ? editor : null,
    saveStatus,
    saveDocument,
    getYText // ✅ Expose safe Y.Text getter
  }
}
