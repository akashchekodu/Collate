// app/editor/[documentId]/hooks/useWebCollaboration.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect, useState, useCallback } from "react"
import { createEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"

export function useWebCollaboration(ydoc, provider, roomName, title = "Shared Document") {
  console.log('🌐 useWebCollaboration initialized:', { roomName, title, hasYdoc: !!ydoc, hasProvider: !!provider })
  
  const [initialContent, setInitialContent] = useState(null)
  const [debugInfo, setDebugInfo] = useState({ connected: false, contentLength: 0 })

  // Web collaborative editor
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, roomName),
    immediatelyRender: false,
    content: '<p>🌐 Web collaboration mode - waiting for content from document owner...</p>',
    editorProps,
    ...editorCallbacks,
    
    onCreate: ({ editor }) => {
      console.log('✅ Web collaborative editor created successfully')
      setInitialContent(true)
    },

    onUpdate: ({ editor }) => {
      const length = editor.getText().length
      console.log('📝 Web collaboration editor content updated, length:', length)
      setDebugInfo(prev => ({ ...prev, contentLength: length }))
    }
  }, [ydoc, provider, roomName])

  // Monitor Y.js updates
  useEffect(() => {
    if (!ydoc) {
      console.log('⏳ Web collaboration Y.js not ready yet')
      return
    }

    console.log('👂 Setting up Y.js update listener for web collaboration')

    const handleUpdate = (update, origin) => {
      const fieldName = `editor-${roomName}`
      console.log('📡 Y.js update received in web mode:', { 
        updateSize: update.length, 
        origin: origin?.constructor?.name || 'unknown',
        field: fieldName 
      })
      
      try {
        const yxml = ydoc.getXmlFragment(fieldName)
        const hasContent = yxml.length > 0
        console.log('📄 Y.js content status:', { hasContent, length: yxml.length })
        
        if (hasContent) {
          console.log('✅ Document content received from peer in web mode')
          setDebugInfo(prev => ({ ...prev, connected: true }))
        }
      } catch (error) {
        console.warn('⚠️ Error checking Y.js content in web mode:', error)
      }
    }

    ydoc.on('update', handleUpdate)
    
    return () => {
      console.log('🧹 Cleaning up Y.js update listener in web mode')
      ydoc.off('update', handleUpdate)
    }
  }, [ydoc, roomName])

  // Monitor provider connection
  useEffect(() => {
    if (!provider) {
      console.log('⏳ Web collaboration provider not ready yet')
      return
    }

    console.log('🔌 Setting up provider connection listeners for web mode')

    const onConnect = () => {
      console.log('✅ Web collaboration provider connected')
      setDebugInfo(prev => ({ ...prev, connected: true }))
    }

    const onDisconnect = () => {
      console.log('❌ Web collaboration provider disconnected')
      setDebugInfo(prev => ({ ...prev, connected: false }))
    }

    provider.on('connect', onConnect)
    provider.on('disconnect', onDisconnect)

    return () => {
      console.log('🧹 Cleaning up provider listeners in web mode')
      provider.off('connect', onConnect)
      provider.off('disconnect', onDisconnect)
    }
  }, [provider])

  // No-op save for web
  const saveDocument = useCallback(async () => {
    console.log('💾 Web collaboration save requested - changes are automatically synced')
  }, [])

  console.log('📊 Web collaboration hook state:', {
    editorReady: !!editor,
    initialContent,
    debugInfo
  })

  return {
    editor: initialContent ? editor : null,
    saveStatus: 'synced',
    saveDocument,
    debugInfo
  }
}
