// app/editor/[documentId]/page.js
'use client'
import { useParams } from 'next/navigation'
import EditorContainer from './EditorContainer'
import FileSidebar from './components/FileSidebar'
import { useState, useEffect } from 'react'

export default function EditorPage() {
  const { documentId } = useParams()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [title, setTitle] = useState('Untitled Document')

  useEffect(() => {
    if (!documentId || typeof window === 'undefined' || !window.electronAPI?.isElectron) {
      return
    }
    // ✅ Call loadById instead of load
    window.electronAPI.documents.loadById(documentId)
      .then((result) => {
        if (result?.metadata?.title) {
          setTitle(result.metadata.title)
        }
      })
      .catch((err) => {
        console.error('Failed to load document metadata by ID:', err)
      })
  }, [documentId])

  return (
    <div className="h-screen flex">
      <FileSidebar
        currentDocumentId={documentId}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1">
        <EditorContainer documentId={documentId} title={title} />
      </div>
    </div>
  )
}
