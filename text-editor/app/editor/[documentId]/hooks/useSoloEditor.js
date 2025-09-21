// app/editor/[documentId]/hooks/useSoloEditor.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useCallback } from "react"
import { createSoloEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"
import * as Y from 'yjs'

export function useSoloEditor(roomName, title = "Untitled Document") {
  const [saveStatus, setSaveStatus] = useState('saved')
  const [isExternalDocument, setIsExternalDocument] = useState(false)
  const [initialContent, setInitialContent] = useState(null)

  // ✅ Solo editor without Y.js collaboration
  const editor = useEditor({
    extensions: createSoloEditorExtensions(), // No Y.js extensions
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
  })

  // ✅ Load document content directly into editor (no Y.js)
  useEffect(() => {
    if (!editor || !roomName || !window.electronAPI) return

    const loadContent = async () => {
      try {
        const result = await window.electronAPI.documents.loadById(roomName)
        
        if (result?.streamUrl) {
          // External document - fetch and set content directly
          console.log('📡 Loading external file in solo mode:', result.streamUrl)
          setIsExternalDocument(true)
          
          const response = await fetch(result.streamUrl)
          const content = await response.text()
          editor.commands.setContent(content)
          console.log('✅ External file loaded in solo editor')
          
        } else if (result?.state) {
          // Internal document - extract text from Y.js state
          console.log('📄 Loading internal document in solo mode')
          setIsExternalDocument(false)
          
          const ydoc = new Y.Doc()
          Y.applyUpdate(ydoc, new Uint8Array(result.state))
          const ytext = ydoc.getText(`editor-${roomName}`)
          const content = ytext.toString()
          editor.commands.setContent(content)
          console.log('✅ Internal document loaded in solo editor')
        }
        
        setInitialContent(true)
      } catch (error) {
        console.error('❌ Failed to load document in solo mode:', error)
      }
    }

    loadContent()
  }, [editor, roomName])

  // ✅ Solo save function - saves as plain text
  const saveDocument = useCallback(async () => {
    if (!editor || !window.electronAPI) return

    setSaveStatus('saving')
    
    try {
      const content = editor.getText()
      
      if (isExternalDocument) {
        // External document - save to original file
        const result = await window.electronAPI.documents.loadById(roomName)
        if (result?.metadata?.originalPath) {
          await window.electronAPI.documents.saveExternal(
            result.metadata.originalPath, 
            content
          )
          console.log('✅ External document saved in solo mode')
        }
      } else {
        // Internal document - create Y.js state from current content
        const ydoc = new Y.Doc()
        const ytext = ydoc.getText(`editor-${roomName}`)
        ytext.insert(0, content)
        const state = Array.from(Y.encodeStateAsUpdate(ydoc))
        
        await window.electronAPI.documents.save(roomName, state, { title })
        console.log('✅ Internal document saved in solo mode')
      }
      
      setSaveStatus('saved')
    } catch (error) {
      console.error('❌ Solo save failed:', error)
      setSaveStatus('error')
    }
  }, [editor, roomName, title, isExternalDocument])

  return {
    editor: initialContent ? editor : null,
    saveStatus,
    saveDocument,
    getYText: () => null, // No Y.js in solo mode
    isExternalDocument
  }
}
