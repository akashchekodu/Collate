// app/editor/[documentId]/components/FileSidebar.js
'use client'
import { useState, useEffect } from 'react'
import { ChevronRight, Folder, File, Plus, Search, Star, Trash2, MoreHorizontal } from 'lucide-react'
import FileTreeItem from './FileTreeItem'
import { cn } from '@/lib/utils'

export default function FileSidebar({ 
  currentDocumentId, 
  onDocumentSelect, 
  isCollapsed = false, 
  onToggleCollapse 
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [documents, setDocuments] = useState([])
  const [isElectron, setIsElectron] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI?.isElectron)
  }, [])

  // Load documents from Electron storage
  const loadDocuments = async () => {
    if (!isElectron) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const allDocs = await window.electronAPI.documents.getAll()
      console.log('📁 Loaded documents:', allDocs)
      setDocuments(allDocs || [])
    } catch (error) {
      console.error('❌ Failed to load documents:', error)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  // Load documents on mount and when Electron becomes available
  useEffect(() => {
    loadDocuments()
  }, [isElectron])

  // Filter documents based on search term
  const filteredDocuments = documents.filter(doc => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      doc.title.toLowerCase().includes(term) ||
      (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(term)))
    )
  })

  // Group documents by creation date (optional)
  const groupedDocuments = filteredDocuments.reduce((groups, doc) => {
    const date = new Date(doc.createdAt).toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(doc)
    return groups
  }, {})

  const handleCreateFile = async () => {
    if (!isElectron) return

    try {
      const newDoc = await window.electronAPI.documents.create('Untitled Document')
      console.log('📄 Created new document:', newDoc)
      
      // Refresh the document list
      await loadDocuments()
      
      // Navigate to the new document
      if (onDocumentSelect && newDoc.id) {
        onDocumentSelect(newDoc.id, newDoc.title)
      }
    } catch (error) {
      console.error('❌ Failed to create document:', error)
    }
  }

  const handleDeleteDocument = async (documentId, event) => {
    event.stopPropagation()
    
    if (!isElectron || !documentId) return
    
    const confirmed = confirm('Are you sure you want to delete this document?')
    if (!confirmed) return

    try {
      await window.electronAPI.documents.delete(documentId)
      console.log('🗑️ Deleted document:', documentId)
      
      // Refresh the document list
      await loadDocuments()
      
      // If we're currently viewing the deleted document, navigate away
      if (currentDocumentId === documentId) {
        const remainingDocs = documents.filter(doc => doc.id !== documentId)
        if (remainingDocs.length > 0 && onDocumentSelect) {
          onDocumentSelect(remainingDocs[0].id, remainingDocs[0].title)
        }
      }
    } catch (error) {
      console.error('❌ Failed to delete document:', error)
    }
  }

  const handleDuplicateDocument = async (documentId, event) => {
    event.stopPropagation()
    
    if (!isElectron || !documentId) return

    try {
      const originalDoc = documents.find(doc => doc.id === documentId)
      const newTitle = `${originalDoc?.title || 'Document'} (Copy)`
      
      const duplicatedDoc = await window.electronAPI.documents.duplicate(documentId, newTitle)
      console.log('📋 Duplicated document:', duplicatedDoc)
      
      // Refresh the document list
      await loadDocuments()
      
      // Navigate to the duplicated document
      if (onDocumentSelect && duplicatedDoc.id) {
        onDocumentSelect(duplicatedDoc.id, duplicatedDoc.title)
      }
    } catch (error) {
      console.error('❌ Failed to duplicate document:', error)
    }
  }

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleCreateFile}
          className="p-2 hover:bg-gray-200 rounded-md transition-colors mt-2"
          title="New document"
        >
          <File className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Documents</h2>
          <div className="flex gap-1">
            <button
              onClick={handleCreateFile}
              className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
              title="New document"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
              title="Collapse sidebar"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : !isElectron ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Document management</p>
            <p>available in desktop app</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No documents found</p>
            <button
              onClick={handleCreateFile}
              className="mt-2 text-blue-600 hover:text-blue-700"
            >
              Create your first document
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredDocuments.map((doc) => (
              <DocumentItem
                key={doc.id}
                document={doc}
                isSelected={doc.id === currentDocumentId}
                onSelect={() => onDocumentSelect(doc.id, doc.title)}
                onDelete={(e) => handleDeleteDocument(doc.id, e)}
                onDuplicate={(e) => handleDuplicateDocument(doc.id, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {isElectron && documents.length > 0 && (
        <div className="border-t border-gray-200 p-3 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>{documents.length} documents</span>
            <span>
              {documents.reduce((total, doc) => total + (doc.statistics?.words || 0), 0)} words
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Individual document item component
function DocumentItem({ document, isSelected, onSelect, onDelete, onDuplicate }) {
  const [showActions, setShowActions] = useState(false)

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
      className={cn(
        "group flex items-center p-2 rounded-md cursor-pointer text-sm transition-colors relative",
        "hover:bg-gray-200",
        isSelected && "bg-blue-100 text-blue-900"
      )}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <File className="w-4 h-4 text-gray-500 mr-3 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{document.title}</div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>{formatDate(document.updatedAt)}</span>
          {document.statistics?.words > 0 && (
            <span>• {document.statistics.words} words</span>
          )}
          {document.favorite && (
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-1 ml-2">
          <button
            onClick={onDuplicate}
            className="p-1 hover:bg-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Duplicate document"
          >
            <File className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete document"
          >
            <Trash2 className="w-3 h-3 text-red-600" />
          </button>
        </div>
      )}
    </div>
  )
}
