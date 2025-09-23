"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Wifi, WifiOff, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import ClientOnly from "./components/ClientOnly"
import ShareControls from "./ShareControls"

export default function EditorHeader({
  documentId,
  initialTitle = "Untitled Document",
  isCollaborationMode,
  collaborationToken,
  isSwitching,
  // ✅ MISSING: Add the callback functions as props
  enableCollaboration,
  disableCollaboration,
  peerCount,
  connectionStatus,
  activePeers,
}) {
  const [title, setTitle] = useState(initialTitle)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  const router = useRouter()

  // ✅ Detect Electron
  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && window.electronAPI?.isElectron)
  }, [])

  // ✅ Load doc title
  useEffect(() => {
    const loadDocumentData = async () => {
      if (!documentId || !isElectron) return
      try {
        const result = await window.electronAPI.documents.load(documentId)
        if (result?.metadata?.title) {
          setTitle(result.metadata.title)
        }
      } catch (error) {
        console.error("Failed to load document data:", error)
      }
    }
    loadDocumentData()
  }, [documentId, isElectron])

  // ✅ Save doc title
  const saveTitle = useCallback(
    async (newTitle) => {
      if (!documentId || !isElectron || !newTitle.trim()) return
      setIsSaving(true)
      try {
        const currentDoc = await window.electronAPI.documents.load(documentId)
        if (currentDoc) {
          await window.electronAPI.documents.save(documentId, currentDoc.state, {
            ...currentDoc.metadata,
            title: newTitle.trim(),
            lastSaved: new Date().toISOString(),
          })
          console.log("✅ Document title saved:", newTitle)
        }
      } catch (error) {
        console.error("❌ Failed to save document title:", error)
      } finally {
        setIsSaving(false)
      }
    },
    [documentId, isElectron]
  )

  const handleTitleChange = useCallback(
    (newTitle) => {
      setTitle(newTitle)
      const timeoutId = setTimeout(() => {
        if (newTitle.trim() && newTitle !== initialTitle) {
          saveTitle(newTitle)
        }
      }, 1000)
      return () => clearTimeout(timeoutId)
    },
    [saveTitle, initialTitle]
  )

  const handleTitleBlur = () => {
    setIsEditing(false)
    if (title.trim() && title !== initialTitle) {
      saveTitle(title)
    }
  }

  const handleTitleKeyPress = (e) => {
    if (e.key === "Enter") e.target.blur()
  }

  // ✅ Connection icon
  const connectionIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi size={16} className="text-emerald-500" />
      case "connecting":
        return <WifiOff size={16} className="text-amber-500 animate-pulse" />
      default:
        return <WifiOff size={16} className="text-red-500" />
    }
  }

  return (
    <ClientOnly
      fallback={
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center px-6">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          </div>
        </header>
      }
    >
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full flex h-16 items-center justify-between px-6 mx-auto">
          {/* ✅ Left: Back + Title + Peers */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="p-2">
              <ArrowLeft size={20} />
            </Button>

            <div className="flex items-center gap-2">
              <FileText size={20} className="text-muted-foreground" />
              <div className="relative">
                <Input
                  value={title}
                  onChange={(e) => {
                    const cleanup = handleTitleChange(e.target.value)
                    if (cleanup && typeof cleanup === "function") {
                      setTimeout(cleanup, 2000)
                    }
                  }}
                  onFocus={() => setIsEditing(true)}
                  onBlur={handleTitleBlur}
                  onKeyPress={handleTitleKeyPress}
                  className={`text-lg font-medium bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto min-w-[200px] max-w-[400px] ${isEditing ? "text-primary" : "text-foreground"
                    }`}
                  placeholder="Untitled Document"
                  disabled={!isElectron}
                />
                {isSaving && (
                  <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Collaboration Status */}
            <div className="flex items-center gap-3 ml-4">
              <div className="flex items-center gap-2">
                {connectionIcon()}
                <Badge variant="outline" className="text-xs">
                  {peerCount === 0 ? "Solo" : `${peerCount} ${peerCount === 1 ? "peer" : "peers"}`}
                </Badge>
              </div>

              {/* Active Peers Avatars */}
              {activePeers && activePeers.length > 0 && (
                <div className="flex -space-x-2">
                  {activePeers.slice(0, 3).map((peer, index) => (
                    <Avatar key={peer.clientId || index} className="h-8 w-8 border-2 border-background">
                      <AvatarFallback className="text-xs" style={{ backgroundColor: peer.color }}>
                        {peer.name ? peer.name.charAt(0).toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {activePeers.length > 3 && (
                    <Avatar className="h-8 w-8 border-2 border-background">
                      <AvatarFallback className="text-xs bg-muted">+{activePeers.length - 3}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ✅ FIXED: Pass all required props to ShareControls */}
          <ShareControls
            documentId={documentId}
            isElectron={isElectron}
            isCollaborationMode={isCollaborationMode}
            isSwitching={isSwitching}
            // ✅ FIXED: Pass the callback functions
            enableCollaboration={enableCollaboration}
            disableCollaboration={disableCollaboration}
            title={title} // ✅ Pass title for better alerts
          />
        </div>
      </header>
    </ClientOnly>
  )
}
