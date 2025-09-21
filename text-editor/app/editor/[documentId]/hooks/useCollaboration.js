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
  console.log('🧩 useCollaboration initialized with room:', roomName);
  const [initialContent, setInitialContent] = useState(null);
  const [isExternalDocument, setIsExternalDocument] = useState(false);
  const { saveDocument, loadDocument, saveStatus } = useDocumentPersistence(ydoc, roomName, title);
  const isLoadedRef = useRef(false);
  const ytextRef = useRef(null);

  // ✅ Safe Y.Text getter with error handling
  const getYText = useCallback(() => {
    if (!ydoc || !roomName) return null;
    const fieldName = `editor-${roomName}`;
    return getSafeYText(ydoc, fieldName);
  }, [ydoc, roomName]);

  useEffect(() => {
    async function loadSavedContent() {
      if (!ydoc || isLoadedRef.current) return;

      try {
        console.log('📖 Loading saved content for document:', roomName);
        const savedDoc = await loadDocument();

        console.log('📡 Streaming external file from:', savedDoc);
        setIsExternalDocument(true);

        // Fetch atom:// stream
        const response = await fetch(savedDoc.streamUrl);
        console.log('📡 Stream fetch response:', response.status, response.statusText);
        const fileContent = await response.text();
        console.log('📄 External file content length:', fileContent.length);

        // Insert into Y.Text
        const ytext = getYText();
        if (ytext) {
          ytext.delete(0, ytext.length);
          ytext.insert(0, fileContent);
          console.log('✅ External file loaded into Y.Text:', fileContent.length, 'chars');
        }else if (savedDoc?.state) {
          // ✅ EXISTING: Internal document - apply Y.js state
          console.log('📄 Loading internal document with Y.js state');
          setIsExternalDocument(false);
          
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
  }, [ydoc, loadDocument, getYText]);

  // ✅ UNCHANGED: Editor creation with Y.js extensions
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, roomName),
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
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

  // ✅ UPDATED: Custom save function that handles both internal and external Y.js-first
  const customSaveDocument = useCallback(async () => {
    if (!ydoc || !window.electronAPI) return;

    try {
      if (isExternalDocument) {
        // ✅ NEW: External document - get text from Y.js and save to original file
        const ytext = getYText();
        if (!ytext) {
          console.error('❌ No Y.Text instance for external save');
          return;
        }

        const currentContent = ytext.toString();
        
        // Get document metadata to find original path
        const docResult = await window.electronAPI.documents.loadById(roomName);
        if (docResult?.metadata?.originalPath) {
          // Save plain text to original file location
          await window.electronAPI.documents.saveExternal(
            docResult.metadata.originalPath, 
            currentContent
          );
          console.log('✅ External document saved from Y.js state');
        } else {
          console.error('❌ No original path found for external document');
        }
        
      } else {
        // ✅ EXISTING: Internal document - save Y.js state as before
        const state = Array.from(Y.encodeStateAsUpdate(ydoc));
        await window.electronAPI.documents.save(roomName, state, { title });
        console.log('✅ Internal document saved with Y.js state');
      }
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      throw error;
    }
  }, [ydoc, roomName, title, isExternalDocument, getYText]);

  // ✅ Clean up Y.Text reference when document changes
  useEffect(() => {
    ytextRef.current = null;
    isLoadedRef.current = false;
    setInitialContent(null);
    setIsExternalDocument(false);
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
    saveDocument: customSaveDocument, // ✅ Use custom save logic
    getYText,
    isExternalDocument // ✅ Expose document type for debugging
  }
}
