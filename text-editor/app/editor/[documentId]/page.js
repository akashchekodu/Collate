// app/editor/[documentId]/page.js
'use client'
import { useParams, useSearchParams } from 'next/navigation'
import EditorContainer from './EditorContainer'
import FileSidebar from './components/FileSidebar'
import { useState, useEffect } from 'react'

export default function EditorPage() {
  const { documentId } = useParams()
  const searchParams = useSearchParams()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [title, setTitle] = useState('Untitled Document')
  
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron
  const shouldStartInCollabMode = searchParams.get('collab') === 'true'

  console.log('📄 EditorPage mounted:', { 
    documentId, 
    isElectron, 
    shouldStartInCollabMode,
    searchParams: Object.fromEntries(searchParams.entries())
  })

  // Load document metadata only in Electron
  useEffect(() => {
    if (!isElectron || !documentId) {
      console.log('⏭️ Skipping document metadata load:', { isElectron, documentId })
      return
    }

    console.log('📖 Loading document metadata for page title')

    if (window.electronAPI?.documents?.loadById) {
      window.electronAPI.documents.loadById(documentId)
        .then((result) => {
          console.log('📄 Document metadata loaded:', result?.metadata)
          if (result?.metadata?.title) {
            console.log('📝 Setting page title:', result.metadata.title)
            setTitle(result.metadata.title)
          }
        })
        .catch((err) => {
          console.error('❌ Failed to load document metadata:', err)
        })
    } else {
      console.warn('⚠️ electronAPI.documents.loadById not available')
    }
  }, [documentId, isElectron])

  return (
    <div className="h-screen flex">
      {/* Only show sidebar in Electron */}
      {isElectron && (
        <FileSidebar
          currentDocumentId={documentId}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            console.log('📂 Toggling sidebar:', !sidebarCollapsed)
            setSidebarCollapsed(!sidebarCollapsed)
          }}
        />
      )}
      
      {/* Editor takes remaining space */}
      <div className={isElectron ? "flex-1" : "w-full"}>
        <EditorContainer 
          documentId={documentId} 
          title={title}
          initialCollabMode={shouldStartInCollabMode}
        />
      </div>
    </div>
  )
}
