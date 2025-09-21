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

  // ✅ Safe Y.Text getter
  const getYText = useCallback(() => {
    if (!ydoc || !roomName) return null;
    const fieldName = `editor-${roomName}`;
    return getSafeYText(ydoc, fieldName);
  }, [ydoc, roomName]);

  // ✅ SIMPLIFIED: Load content without Y.js complexity
  useEffect(() => {
    async function loadSavedContent() {
      if (!ydoc || isLoadedRef.current) return;

      try {
        console.log('📖 Loading document:', roomName);
        const savedDoc = await loadDocument();

        if (savedDoc?.streamUrl) {
          // External document - just load text for display
          console.log('📡 Loading external file from:', savedDoc.streamUrl);
          setIsExternalDocument(true);
        } else if (savedDoc?.state) {
          // Internal document - apply Y.js state as before
          console.log('📄 Loading internal document');
          setIsExternalDocument(false);
          const state = new Uint8Array(savedDoc.state);
          Y.applyUpdate(ydoc, state);
        } else {
          console.log('📄 New document');
          setIsExternalDocument(false);
        }
      } catch (error) {
        console.warn('Failed to load document:', error);
      }

      setInitialContent(true);
      isLoadedRef.current = true;
    }

    loadSavedContent();
  }, [ydoc, loadDocument, roomName]);

  // ✅ SIMPLIFIED: Editor with basic content loading
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, roomName),
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
    
    // ✅ Load file content after editor is ready
    onCreate: async ({ editor }) => {
      if (isExternalDocument) {
        try {
          const savedDoc = await loadDocument();
          if (savedDoc?.streamUrl) {
            const response = await fetch(savedDoc.streamUrl);
            const content = await response.text();
            editor.commands.setContent(content);
            console.log('✅ External file loaded into editor');
          }
        } catch (error) {
          console.error('❌ Failed to load external content:', error);
        }
      }
    },
  }, [isExternalDocument]);

  // ✅ SIMPLIFIED: Save function
  const customSaveDocument = useCallback(async () => {
    if (!editor || !window.electronAPI) return;

    try {
      if (isExternalDocument) {
        const content = editor.getText();
        const docResult = await loadDocument();
        if (docResult?.metadata?.originalPath) {
          await window.electronAPI.documents.saveExternal(
            docResult.metadata.originalPath, 
            content
          );
          console.log('✅ External document saved');
        }
      } else {
        // Internal Y.js save
        if (ydoc) {
          const state = Array.from(Y.encodeStateAsUpdate(ydoc));
          await window.electronAPI.documents.save(roomName, state, { title });
          console.log('✅ Internal document saved');
        }
      }
    } catch (error) {
      console.error('❌ Save failed:', error);
      throw error;
    }
  }, [editor, ydoc, roomName, title, isExternalDocument, loadDocument]);

  // ✅ Reset on room change
  useEffect(() => {
    isLoadedRef.current = false;
    setInitialContent(null);
    setIsExternalDocument(false);
  }, [roomName]);

  return {
    editor: initialContent ? editor : null,
    saveStatus,
    saveDocument: customSaveDocument,
    getYText,
    isExternalDocument
  }
}
