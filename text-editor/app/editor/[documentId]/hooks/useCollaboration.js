// app/editor/[documentId]/hooks/useCollaboration.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"
import { useDocumentPersistence } from "../../../hooks/useDocumentPersistence"
import * as Y from 'yjs'

export function useCollaboration(ydoc, provider, roomName, title = "Untitled Document") {
  console.log('🧩 useCollaboration initialized with room:', roomName);
  const [initialContent, setInitialContent] = useState(null);
  const [isExternalDocument, setIsExternalDocument] = useState(false);
  const { saveDocument, loadDocument, saveStatus } = useDocumentPersistence(ydoc, roomName, title);
  const isLoadedRef = useRef(false);

  // ✅ Get the YXmlFragment used by Collaboration extension
  const getYXmlFragment = useCallback(() => {
    if (!ydoc || !roomName) return null;
    const fieldName = `editor-${roomName}`;
    return ydoc.getXmlFragment(fieldName); // Use XmlFragment, not Text
  }, [ydoc, roomName]);

  // ✅ Enhanced: Load content and sync to Y.js for collaboration
  useEffect(() => {
    async function loadSavedContent() {
      if (!ydoc || isLoadedRef.current) return;

      try {
        console.log('📖 Loading document:', roomName);
        const savedDoc = await window.electronAPI.documents.loadById(roomName);

        if (savedDoc?.streamUrl) {
          // ✅ External document - load text and convert to ProseMirror format
          console.log('📡 Loading external file from:', savedDoc.streamUrl);
          setIsExternalDocument(true);
          
          const response = await fetch(savedDoc.streamUrl);
          const fileContent = await response.text();
          console.log('📄 External file content length:', fileContent.length);

          // ✅ FIXED: Don't insert into Y.js directly, let the editor handle it
          // The editor will be created first, then we'll set content via TipTap
          
        } else if (savedDoc?.state) {
          // ✅ Internal document - apply Y.js state as before
          console.log('📄 Loading internal document with Y.js state');
          setIsExternalDocument(false);
          const state = new Uint8Array(savedDoc.state);
          Y.applyUpdate(ydoc, state);
          console.log('📚 Internal document restored from Y.js state');
        } else {
          console.log('📄 New empty document');
          setIsExternalDocument(false);
        }
      } catch (error) {
        console.warn('Failed to load document:', error);
      }

      setInitialContent(true);
      isLoadedRef.current = true;
    }

    loadSavedContent();
  }, [ydoc, roomName]);

  // ✅ Editor with Y.js collaboration extensions
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, roomName),
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
    
    // ✅ Load external content after editor is ready
    onCreate: async ({ editor }) => {
      if (isExternalDocument) {
        try {
          const savedDoc = await window.electronAPI.documents.loadById(roomName);
          if (savedDoc?.streamUrl) {
            const response = await fetch(savedDoc.streamUrl);
            const content = await response.text();
            // ✅ Set content through TipTap, which will sync to Y.js automatically
            editor.commands.setContent(content);
            console.log('✅ External file loaded into collaborative editor');
          }
        } catch (error) {
          console.error('❌ Failed to load external content:', error);
        }
      }
    },
  }, [ydoc, provider, roomName, isExternalDocument]);

  // ✅ Enhanced save function - always saves from Y.js state
  const customSaveDocument = useCallback(async () => {
    if (!ydoc || !window.electronAPI) return;

    try {
      if (isExternalDocument) {
        // ✅ External document - get current text from editor (includes all collaborative changes)
        const currentContent = editor?.getText() || '';
        const docResult = await window.electronAPI.documents.loadById(roomName);
        if (docResult?.metadata?.originalPath) {
          await window.electronAPI.documents.saveExternal(
            docResult.metadata.originalPath, 
            currentContent
          );
          console.log('✅ External document saved with collaborative changes');
        }
      } else {
        // ✅ Internal document - save complete Y.js state (includes all peer changes)
        const state = Array.from(Y.encodeStateAsUpdate(ydoc));
        await window.electronAPI.documents.save(roomName, state, { title });
        console.log('✅ Internal document saved with Y.js collaborative state');
      }
    } catch (error) {
      console.error('❌ Save failed:', error);
      throw error;
    }
  }, [ydoc, roomName, title, isExternalDocument, editor]);

  // ✅ Reset collaboration state on room change
  useEffect(() => {
    isLoadedRef.current = false;
    setInitialContent(null);
    setIsExternalDocument(false);
  }, [roomName]);

  return {
    editor: initialContent ? editor : null,
    saveStatus,
    saveDocument: customSaveDocument,
    getYText: getYXmlFragment, // Return YXmlFragment for debugging
    isExternalDocument
  }
}
