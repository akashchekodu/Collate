"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Share2, Download, Users, Wifi, WifiOff, MoreHorizontal, Copy, Link, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import ClientOnly from "./components/ClientOnly"

export default function EditorHeader({
  documentId,
  initialTitle = "Untitled Document",
  // ✅ NEW: Collaboration props passed from EditorContainer
  isCollaborationMode,
  collaborationToken,
  isSwitching,
  enableCollaboration,
  disableCollaboration,
  peerCount,
  connectionStatus,
  activePeers
}) {
  const [title, setTitle] = useState(initialTitle)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  const router = useRouter()

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI?.isElectron);
  }, []);

  // Load document title on mount
  useEffect(() => {
    const loadDocumentData = async () => {
      if (!documentId || !isElectron) return;

      try {
        const result = await window.electronAPI.documents.load(documentId);
        if (result?.metadata?.title) {
          setTitle(result.metadata.title);
        }
      } catch (error) {
        console.error('Failed to load document data:', error);
      }
    };

    loadDocumentData();
  }, [documentId, isElectron]);

  // Save title changes to backend
  const saveTitle = useCallback(async (newTitle) => {
    if (!documentId || !isElectron || !newTitle.trim()) return;

    setIsSaving(true);
    try {
      const currentDoc = await window.electronAPI.documents.load(documentId);
      if (currentDoc) {
        await window.electronAPI.documents.save(documentId, currentDoc.state, {
          ...currentDoc.metadata,
          title: newTitle.trim(),
          lastSaved: new Date().toISOString()
        });
        console.log('✅ Document title saved:', newTitle);
      }
    } catch (error) {
      console.error('❌ Failed to save document title:', error);
    } finally {
      setIsSaving(false);
    }
  }, [documentId, isElectron]);

  // Handle title change with debouncing
  const handleTitleChange = useCallback((newTitle) => {
    setTitle(newTitle);

    // Debounce save operation
    const timeoutId = setTimeout(() => {
      if (newTitle.trim() && newTitle !== initialTitle) {
        saveTitle(newTitle);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [saveTitle, initialTitle]);

  // Handle title blur (when user clicks away)
  const handleTitleBlur = () => {
    setIsEditing(false);
    if (title.trim() && title !== initialTitle) {
      saveTitle(title);
    }
  };

  // Handle Enter key press
  const handleTitleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

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

  const handleCopyCurrentPageLink = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      console.log('📋 Current page link copied to clipboard');
    }
  }

  const handleExport = async () => {
    if (!documentId || !isElectron) return;

    try {
      const result = await window.electronAPI.documents.export(documentId, 'md');
      if (result.success) {
        console.log('✅ Document exported to:', result.path);
      }
    } catch (error) {
      console.error('❌ Export failed:', error);
    }
  }

  // ✅ NEW: Collaboration functions moved to header
  const handleEnableCollaboration = useCallback(async () => {
    if (isSwitching || !enableCollaboration) return;

    try {
      console.log('🔄 Starting collaboration from header');

      const { collaborationService } = await import('../../services/collabService')
      const linkData = await collaborationService.generateCollaborationLink(documentId)

      if (linkData?.url && linkData?.token) {
        await enableCollaboration(linkData.token);
        await new Promise(resolve => setTimeout(resolve, 500));
        await navigator.clipboard.writeText(linkData.url)

        alert(`✅ Collaboration enabled!\n\nLink copied to clipboard:\n${linkData.url}\n\nYour document is now in collaboration mode!`)
      } else {
        alert('Failed to generate collaboration link.')
      }
    } catch (error) {
      console.error('Share error:', error)
      alert(`Error enabling collaboration: ${error.message}`)
    }
  }, [documentId, enableCollaboration, isSwitching]);

  const handleDisableCollaboration = useCallback(async () => {
    if (isSwitching || !disableCollaboration) return;

    try {
      await disableCollaboration();
      alert('📝 Switched to solo mode.\n\nYour document is now private.');
    } catch (error) {
      console.error('Disable collaboration error:', error)
      alert(`Error switching to solo mode: ${error.message}`)
    }
  }, [disableCollaboration, isSwitching]);

  return (
    <ClientOnly
      fallback={
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center px-6">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          </div>
        </header>
      }
    >
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full flex h-16 items-center justify-between px-6 mx-auto">

          {/* Left Section */}
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
                    const cleanup = handleTitleChange(e.target.value);
                    if (cleanup && typeof cleanup === 'function') {
                      setTimeout(cleanup, 2000);
                    }
                  }}
                  onFocus={() => setIsEditing(true)}
                  onBlur={handleTitleBlur}
                  onKeyPress={handleTitleKeyPress}
                  className={`text-lg font-medium bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto min-w-[200px] max-w-[400px] ${isEditing ? 'text-primary' : 'text-foreground'
                    }`}
                  placeholder="Untitled Document"
                  disabled={!isElectron}
                />

                {/* Saving indicator */}
                {isSaving && (
                  <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Collaboration Status */}
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
                        {peer.name ? peer.name.charAt(0).toUpperCase() : '?'}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {activePeers.length > 3 && (
                    <Avatar className="h-8 w-8 border-2 border-background">
                      <AvatarFallback className="text-xs bg-muted">
                        +{activePeers.length - 3}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ✅ UPDATED: Right Section with Working Collaboration Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* ✅ COLLABORATION CONTROLS MOVED HERE */}
            {!isCollaborationMode ? (
              <Button
                onClick={handleEnableCollaboration}
                disabled={isSwitching || !isElectron}
                className={`gap-2 ${isSwitching ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                <Share2 size={16} />
                <span className="hidden sm:inline">
                  {isSwitching ? 'Enabling...' : 'Enable Collaboration'}
                </span>
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    try {
                      const url = window.location.href;
                      await navigator.clipboard.writeText(url);
                      alert(`Collaboration link copied!\n\n${url}`);
                    } catch (error) {
                      alert('Failed to copy link');
                    }
                  }}
                  className="gap-2 bg-green-500 hover:bg-green-600"
                >
                  <Copy size={16} />
                  <span className="hidden sm:inline">Copy Link</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDisableCollaboration}
                  disabled={isSwitching}
                  className={`gap-2 ${isSwitching ? 'bg-gray-400' : 'hover:bg-orange-50'}`}
                >
                  <FileText size={16} />
                  <span className="hidden sm:inline">
                    {isSwitching ? 'Switching...' : 'Solo Mode'}
                  </span>
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleExport}
              className="gap-2 bg-transparent"
              disabled={!isElectron}
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <MoreHorizontal size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyCurrentPageLink}>
                  <Copy size={16} className="mr-2" />
                  Copy Current URL
                </DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Version History</DropdownMenuItem>
                <DropdownMenuItem>Help</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </ClientOnly>
  )
}
