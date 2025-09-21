// app/editor/[documentId]/hooks/useElectronSolo.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useCallback } from "react"
import { createSoloEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"
import * as Y from 'yjs'

export function useElectronSolo(roomName, title = "Untitled Document") {
  console.log('📝 useElectronSolo initialized:', { roomName, title })
  
  const [saveStatus, setSaveStatus] = useState('saved')
  const [isExternalDocument, setIsExternalDocument] = useState(false)
  const [initialContent, setInitialContent] = useState(null)
  const [debugInfo, setDebugInfo] = useState({ loaded: false, contentLength: 0 })

  // Solo editor (no Y.js)
  const editor = useEditor({
    extensions: createSoloEditorExtensions(),
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
    onCreate: ({ editor }) => {
      console.log('✅ Solo editor created successfully')
    },
    onUpdate: ({ editor }) => {
      const length = editor.getText().length
      console.log('📝 Solo editor content updated, length:', length)
      setDebugInfo(prev => ({ ...prev, contentLength: length }))
    }
  })

  // Load document content
  useEffect(() => {
    if (!editor || !roomName || !window.electronAPI) {
      console.log('⏳ Solo editor not ready yet:', { 
        editor: !!editor, 
        roomName: !!roomName, 
        electronAPI: !!window.electronAPI 
      })
      return
    }

    console.log('📖 Loading document in solo mode:', roomName)

    const loadContent = async () => {
      try {
        console.log('🔍 Calling electronAPI.documents.loadById:', roomName)
        const result = await window.electronAPI.documents.loadById(roomName)
        console.log('📄 Document load result:', result)

        if (result?.streamUrl) {
          console.log('📡 Loading external file in solo mode:', result.streamUrl)
          setIsExternalDocument(true)
          
          const response = await fetch(result.streamUrl)
          console.log('🌐 Fetch response:', response.status, response.statusText)
          
          const content = await response.text()
          console.log('📄 External file content loaded, length:', content.length)
          console.log('📄 Content preview:', content.slice(0, 200))
          
          editor.commands.setContent(content)
          console.log('✅ External file content set in solo editor')
          
        } else if (result?.state) {
          console.log('📄 Loading internal document in solo mode, state length:', result.state.length)
          setIsExternalDocument(false)
          
          const ydoc = new Y.Doc()
          const state = new Uint8Array(result.state)
          Y.applyUpdate(ydoc, state)
          
          const ytext = ydoc.getText(`editor-${roomName}`)
          const content = ytext.toString()
          console.log('📄 Y.js content extracted, length:', content.length)
          console.log('📄 Content preview:', content.slice(0, 200))
          
          editor.commands.setContent(content)
          console.log('✅ Internal document content set in solo editor')
          
        } else {
          console.log('📄 No existing content found, starting with empty document')
          editor.commands.setContent('<p>Start writing...</p>')
        }
        
        setInitialContent(true)
        setDebugInfo(prev => ({ ...prev, loaded: true, contentLength: editor.getText().length }))
        console.log('✅ Solo document loading complete')
        
      } catch (error) {
        console.error('❌ Failed to load document in solo mode:', error)
        setInitialContent(true) // Still show editor even if load failed
      }
    }

    loadContent()
  }, [editor, roomName])

  // Save function
  const saveDocument = useCallback(async () => {
    console.log('💾 Solo save initiated')
    
    if (!editor || !window.electronAPI) {
      console.error('❌ Cannot save: editor or electronAPI not available')
      return
    }

    setSaveStatus('saving')
    console.log('💾 Save status: saving')
    
    try {
      const content = editor.getText()
      console.log('💾 Saving content, length:', content.length)
      
      if (isExternalDocument) {
        console.log('💾 Saving external document')
        
        const result = await window.electronAPI.documents.loadById(roomName)
        if (result?.metadata?.originalPath) {
          console.log('💾 Saving to original path:', result.metadata.originalPath)
          
          await window.electronAPI.documents.saveExternal(
            result.metadata.originalPath, 
            content
          )
          console.log('✅ External document saved in solo mode')
        } else {
          console.error('❌ No original path found for external document')
        }
      } else {
        console.log('💾 Saving internal document')
        
        // Create Y.js state from current content
        const ydoc = new Y.Doc()
        const ytext = ydoc.getText(`editor-${roomName}`)
        ytext.insert(0, content)
        const state = Array.from(Y.encodeStateAsUpdate(ydoc))
        
        console.log('💾 Generated Y.js state, length:', state.length)
        
        await window.electronAPI.documents.save(roomName, state, { title })
        console.log('✅ Internal document saved in solo mode')
      }
      
      setSaveStatus('saved')
      console.log('💾 Save status: saved')
    } catch (error) {
      console.error('❌ Solo save failed:', error)
      setSaveStatus('error')
    }
  }, [editor, roomName, title, isExternalDocument])

  console.log('📊 Solo hook state:', {
    editorReady: !!editor,
    initialContent,
    saveStatus,
    isExternalDocument,
    debugInfo
  })

  return {
    editor: initialContent ? editor : null,
    saveStatus,
    saveDocument,
    debugInfo
  }
}
