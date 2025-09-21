// app/editor/[documentId]/page.js
'use client'
import { useParams } from 'next/navigation'
import EditorContainer from './EditorContainer'
import FileSidebar from './components/FileSidebar'
import { useState } from 'react'

export default function EditorPage() {
  const params = useParams()
  const documentId = params.documentId
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="h-screen flex">
      <FileSidebar
        currentDocumentId={documentId}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1">
        <EditorContainer documentId={documentId} />
      </div>
    </div>
  )
}
