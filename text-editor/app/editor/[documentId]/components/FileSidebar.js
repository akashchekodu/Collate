// app/editor/[documentId]/components/FileSidebar.js
'use client'
import { useState, useEffect } from 'react'
import { ChevronRight, Folder, File, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function FileSidebar({ 
  currentDocumentId, 
  onDocumentSelect, 
  isCollapsed = false, 
  onToggleCollapse 
}) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [isElectron, setIsElectron] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI?.isElectron)
  }, [])

  const loadDocuments = async () => {
    if (!isElectron) return;
    
    try {
      setLoading(true)
      const allDocs = await window.electronAPI.documents.getAll()
      setDocuments(allDocs || [])
    } catch (error) {
      console.error('❌ Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [isElectron])

  // ✅ Handle document selection
  const handleDocumentClick = (doc) => {
    console.log('📁 Opening document:', doc.title, doc.id);
    
    // Navigate to editor with the document ID
    router.push(`/editor/${doc.id}`)
    
    // Also call the callback if provided
    if (onDocumentSelect) {
      onDocumentSelect(doc.id, doc.title)
    }
  }

  if (loading) {
    return (
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Documents</h2>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2">
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No documents found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {documents.map((doc) => (
              <DocumentItem
                key={doc.id}
                document={doc}
                isSelected={doc.id === currentDocumentId}
                onClick={() => handleDocumentClick(doc)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ✅ SIMPLIFIED: Document item component
function DocumentItem({ document, isSelected, onClick }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div
      className={`
        group flex items-center p-2 rounded-md cursor-pointer text-sm transition-colors
        hover:bg-gray-200 
        ${isSelected ? 'bg-blue-100 text-blue-900' : ''}
      `}
      onClick={onClick}
    >
      <File className="w-4 h-4 text-gray-500 mr-3 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{document.title}</div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>{formatDate(document.updatedAt)}</span>
          {document.statistics?.words > 0 && (
            <span>• {document.statistics.words} words</span>
          )}
          {document.isExternal && (
            <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">
              External
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
