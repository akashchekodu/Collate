// app/editor/[documentId]/hooks/useWebSoloEditor.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useCallback } from "react"
import { createSoloEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"

export function useWebSoloEditor(roomName, title = "Untitled Document") {
  const [initialContent, setInitialContent] = useState(null);

  const editor = useEditor({
    extensions: createSoloEditorExtensions(),
    immediatelyRender: false,
    content: '<p>Welcome to the web editor! This is solo mode - no real-time collaboration.</p>',
    editorProps,
    ...editorCallbacks,
  });

  useEffect(() => {
    setInitialContent(true);
  }, []);

  const saveDocument = useCallback(async () => {
    console.log('💾 Web solo mode - changes are local only');
  }, []);

  return {
    editor: initialContent ? editor : null,
    saveStatus: 'saved',
    saveDocument,
    getYText: () => null,
    isExternalDocument: false
  }
}
