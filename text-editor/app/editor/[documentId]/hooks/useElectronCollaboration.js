// app/editor/[documentId]/hooks/useElectronCollaboration.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useRef, useCallback } from "react"
import { createEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"
import { useDocumentPersistence } from "../../../hooks/useDocumentPersistence"
import * as Y from 'yjs'

export function useElectronCollaboration(ydoc, provider, roomName, title = "Untitled Document") {
  console.log('👥 useElectronCollaboration initialized:', { roomName, title, hasYdoc: !!ydoc, hasProvider: !!provider })
  
  const [initialContent, setInitialContent] = useState(null)
  const [isExternalDocument, setIsExternalDocument] = useState(false)
  const [debugInfo, setDebugInfo] = useState({ loaded: false, contentLength: 0 })
  
  const { saveDocument, loadDocument, saveStatus } = useDocumentPersistence(ydoc, roomName, title)
  const isLoadedRef = useRef(false)

  // Load document content
  useEffect(() => {
    if (!ydoc || isLoadedRef.current) {
      console.log('⏳ Collaboration loading skipped:', { hasYdoc: !!ydoc, isLoaded: isLoadedRef.current })
      return
    }

    async function loadSavedContent() {
      console.log('📖 Loading document in collaboration mode:', roomName)
      
      try {
        console.log('🔍 Calling electronAPI.documents.loadById for collab:', roomName)
        const savedDoc = await window.electronAPI.documents.loadById(roomName)
        console.log('📄 Collaboration document load result:', savedDoc)

        if (savedDoc?.streamUrl) {
          console.log('📡 Loading external file in collaboration mode:', savedDoc.streamUrl)
          setIsExternalDocument(true)
          
          const response = await fetch(savedDoc.streamUrl)
          console.log('🌐 Collaboration fetch response:', response.status, response.statusText)
          
          const fileContent = await response.text()
          console.log('📄 External collaboration file content loaded, length:', fileContent.length)
          console.log('📄 Content preview:', fileContent.slice(0, 200))
          
          // Content will be set when editor is created
          
        } else if (savedDoc?.state) {
          console.log('📄 Loading internal document in collaboration mode, state length:', savedDoc.state.length)
          setIsExternalDocument(false)
          
          const state = new Uint8Array(savedDoc.state)
          Y.applyUpdate(ydoc, state)
          console.log('📚 Y.js state applied to collaboration document')
          
        } else {
          console.log('📄 No existing collaboration content found')
          setIsExternalDocument(false)
        }
      } catch (error) {
        console.error('❌ Failed to load collaboration document:', error)
      }

      setInitialContent(true)
      isLoadedRef.current = true
      console.log('✅ Collaboration document loading complete')
    }

    loadSavedContent()
  }, [ydoc, roomName])

  // Collaborative editor
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, roomName),
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
    
    onCreate: async ({ editor }) => {
      console.log('✅ Collaboration editor created successfully')
      
      // Load external content if needed
      if (isExternalDocument) {
        try {
          console.log('📡 Loading external content into collaboration editor')
          const savedDoc = await window.electronAPI.documents.loadById(roomName)
          
          if (savedDoc?.streamUrl) {
            const response = await fetch(savedDoc.streamUrl)
            const content = await response.text()
            
            editor.commands.setContent(content)
            console.log('✅ External file loaded into collaborative editor, length:', content.length)
          }
        } catch (error) {
          console.error('❌ Failed to load external content into collaborative editor:', error)
        }
      }
    },

    onUpdate: ({ editor }) => {
      const length = editor.getText().length
      console.log('📝 Collaboration editor content updated, length:', length)
      setDebugInfo(prev => ({ ...prev, contentLength: length }))
    }
  }, [ydoc, provider, roomName, isExternalDocument])

  // Custom save function
  const customSaveDocument = useCallback(async () => {
    console.log('💾 Collaboration save initiated')
    
    if (!ydoc || !window.electronAPI) {
      console.error('❌ Cannot save: ydoc or electronAPI not available')
      return
    }

    try {
      if (isExternalDocument) {
        console.log('💾 Saving external collaboration document')
        
        const currentContent = editor?.getText() || ''
        console.log('💾 Current content length:', currentContent.length)
        
        const docResult = await window.electronAPI.documents.loadById(roomName)
        if (docResult?.metadata?.originalPath) {
          console.log('💾 Saving to original path:', docResult.metadata.originalPath)
          
          await window.electronAPI.documents.saveExternal(
            docResult.metadata.originalPath, 
            currentContent
          )
          console.log('✅ External collaboration document saved')
        } else {
          console.error('❌ No original path found for external collaboration document')
        }
      } else {
        console.log('💾 Saving internal collaboration document')
        
        const state = Array.from(Y.encodeStateAsUpdate(ydoc))
        console.log('💾 Y.js state size:', state.length)
        
        await window.electronAPI.documents.save(roomName, state, { title })
        console.log('✅ Internal collaboration document saved')
      }
    } catch (error) {
      console.error('❌ Collaboration save failed:', error)
      throw error
    }
  }, [ydoc, roomName, title, isExternalDocument, editor])

  // Reset on room change
  useEffect(() => {
    isLoadedRef.current = false
    setInitialContent(null)
    setIsExternalDocument(false)
    setDebugInfo({ loaded: false, contentLength: 0 })
    console.log('🔄 Collaboration hook reset for new room:', roomName)
  }, [roomName])

  console.log('📊 Collaboration hook state:', {
    editorReady: !!editor,
    initialContent,
    saveStatus,
    isExternalDocument,
    debugInfo
  })

  return {
    editor: initialContent ? editor : null,
    saveStatus,
    saveDocument: customSaveDocument,
    debugInfo
  }
}
