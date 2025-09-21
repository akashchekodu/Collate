'use client'
import { useState } from 'react'
import { ChevronRight, Folder, FolderOpen, File } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function FileTreeItem({ 
  node, 
  currentDocumentId, 
  onDocumentSelect, 
  level = 0 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isFolder = node.type === 'folder'
  const hasChildren = isFolder && node.children && node.children.length > 0
  const isSelected = node.id === currentDocumentId
  const paddingLeft = level * 16 + 8

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen)
    } else {
      onDocumentSelect(node.id, node.name)
    }
  }

  const handleChevronClick = (e) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  return (
    <li>
      <div
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors",
          "hover:bg-gray-200",
          isSelected && "bg-blue-100 text-blue-900"
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
      >
        {/* Chevron for folders with children */}
        {hasChildren && (
          <button
            onClick={handleChevronClick}
            className="mr-1 p-0.5 hover:bg-gray-300 rounded"
          >
            <ChevronRight
              className={cn(
                "w-3 h-3 text-gray-500 transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </button>
        )}

        {/* Icon */}
        <div className={cn("mr-2", !hasChildren && "ml-4")}>
          {isFolder ? (
            isOpen ? (
              <FolderOpen className="w-4 h-4 text-blue-500" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500" />
            )
          ) : (
            <File className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {/* Name */}
        <span className="truncate flex-1">{node.name}</span>
      </div>

      {/* Children */}
      {isFolder && hasChildren && isOpen && (
        <ul className="mt-1">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              currentDocumentId={currentDocumentId}
              onDocumentSelect={onDocumentSelect}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
