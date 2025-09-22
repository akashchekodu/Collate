"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Share2, Download, Users, Wifi, WifiOff, MoreHorizontal, Copy, Link, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import ClientOnly from "./components/ClientOnly"

export default function EditorHeader({
  documentId,
  initialTitle = "Untitled Document",
  // ✅ UPDATED: Removed isPermanentlyCollaborative prop
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

  // ✅ FIXED: Enhanced clipboard access with focus handling
  // ✅ FIXED: Much simpler clipboard with better error handling
  const copyToClipboardSafely = useCallback(async (text, description = "Link") => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(text);
      console.log(`✅ ${description} copied to clipboard:`, text.slice(0, 50) + '...');
      return true;
    } catch (error) {
      console.warn(`⚠️ Modern clipboard failed for ${description}:`, error);

      // Fallback: Create textarea and select
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);

        // Focus and select
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);

        // Try copy command
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (success) {
          console.log(`✅ ${description} copied via fallback`);
          return true;
        }
      } catch (fallbackError) {
        console.warn(`❌ Fallback copy failed:`, fallbackError);
      }

      // Last resort: Show the link in alert so user can copy manually
      alert(`${description} generated! Please copy it manually:\n\n${text}`);
      return false;
    }
  }, []);

  // ✅ FIXED: Generate permanent link with focus handling
  const handleGeneratePermanentLink = useCallback(async () => {
    if (!documentId || !isElectron) return;

    try {
      console.log('🔗 Generating permanent link from header dropdown...');

      const { collaborationService } = await import('../../services/collabService');
      const link = await collaborationService.generateLongExpiryLink(documentId, ['read', 'write']);

      if (link?.url) {
        const copySuccess = await copyToClipboardSafely(link.url, "Permanent link");

        console.log('✅ Permanent link generated:', link.url);

        alert(`🔗 Permanent Link Created!\n\n${copySuccess ? 'Link copied to clipboard!' : 'Please copy the link from the alert above'}\n\nURL: ${link.url}\n\nExpires: ${new Date(link.expiresAt).toLocaleDateString()}\n\nThis link will work for 30 days and can be used multiple times.`);
      } else {
        alert('❌ Failed to generate permanent link. Please try again.');
      }
    } catch (error) {
      console.error('❌ Failed to generate permanent link:', error);
      alert(`❌ Error generating permanent link: ${error.message}`);
    }
  }, [documentId, isElectron, copyToClipboardSafely]);

  const handleGenerateOneTimeInvitation = useCallback(async () => {
    if (!documentId || !isElectron) return;

    try {
      console.log('🎫 Generating one-time invitation from header dropdown...');

      const { collaborationService } = await import('../../services/collabService');
      const invitation = await collaborationService.generateOneTimeInvitation(documentId, 'Header User');

      if (invitation?.url) {
        const copySuccess = await copyToClipboardSafely(invitation.url, "One-time invitation");

        console.log('✅ One-time invitation generated:', invitation.url);

        alert(`🎫 One-Time Invitation Created!\n\n${copySuccess ? 'Link copied to clipboard!' : 'Please copy the link from the alert above'}\n\nURL: ${invitation.url}\n\nExpires: ${new Date(invitation.expiresAt).toLocaleDateString()}\n\n⚠️ This link can only be used ONCE and will be disabled after the first person joins.`);
      } else {
        alert('❌ Failed to generate one-time invitation. Please try again.');
      }
    } catch (error) {
      console.error('❌ Failed to generate one-time invitation:', error);
      alert(`❌ Error generating one-time invitation: ${error.message}`);
    }
  }, [documentId, isElectron, copyToClipboardSafely]);

  const handleShowCollaborationInfo = useCallback(async () => {
    if (!documentId || !isElectron) return;

    try {
      console.log('📊 Getting collaboration info...');

      const { collaborationService } = await import('../../services/collabService');
      const data = await collaborationService.getEnhancedCollaborationData(documentId);

      const permanentCount = data.links?.permanent?.length || 0;
      const oneTimeCount = data.links?.oneTime?.length || 0;
      const usedOneTime = data.links?.oneTime?.filter(link => link.used).length || 0;

      alert(`📊 Collaboration Status\n\n` +
        `Document: ${title}\n` +
        `Mode: ${data.mode || 'solo'}\n` +
        `Session Persistent: ${data.sessionPersistent ? 'Yes' : 'No'}\n` +
        `Active Peers: ${peerCount}\n\n` +
        `📎 Links Created:\n` +
        `• Permanent Links: ${permanentCount}\n` +
        `• One-time Invitations: ${oneTimeCount}\n` +
        `• Used Invitations: ${usedOneTime}\n\n` +
        `🔒 Security:\n` +
        `• Revoked Links: ${data.revoked?.length || 0}\n` +
        `• Schema Version: ${data.schemaVersion || 1}`);

    } catch (error) {
      console.error('❌ Failed to get collaboration info:', error);
      alert('❌ Failed to get collaboration information');
    }
  }, [documentId, isElectron, title, peerCount]);

  // ✅ DEBUG: Debug collaboration data
  const debugCollaborationData = useCallback(async () => {
    if (!documentId || !isElectron) return;

    try {
      console.log('🔍 DEBUG: Checking collaboration data for:', documentId);

      // Check what's in the document
      const doc = await window.electronAPI.documents.load(documentId);
      console.log('📄 Raw document data:', doc);
      console.log('📄 Collaboration metadata:', doc?.metadata?.collaboration);

      // Check what collaborationService sees
      const { collaborationService } = await import('../../services/collabService');
      const collabData = await collaborationService.getCollaborationData(documentId);
      console.log('🤝 CollaborationService data:', collabData);

      // Show alert with debug info
      alert(`🔍 DEBUG INFO\n\n` +
        `Document ID: ${documentId.slice(0, 8)}...\n` +
        `Has metadata: ${!!doc?.metadata}\n` +
        `Has collaboration: ${!!doc?.metadata?.collaboration}\n` +
        `Collaboration mode: ${doc?.metadata?.collaboration?.mode || 'none'}\n` +
        `Enabled: ${doc?.metadata?.collaboration?.enabled || false}\n` +
        `Session Persistent: ${doc?.metadata?.collaboration?.sessionPersistent || false}\n` +
        `Link exists: ${!!doc?.metadata?.collaboration?.link}\n` +
        `Token exists: ${!!doc?.metadata?.collaboration?.link?.token}\n\n` +
        `Service sees mode: ${collabData?.mode || 'none'}\n` +
        `Service sees enabled: ${collabData?.enabled || false}\n` +
        `Service sees session persistent: ${collabData?.sessionPersistent || false}`);

    } catch (error) {
      console.error('❌ Debug failed:', error);
      alert('Debug failed: ' + error.message);
    }
  }, [documentId, isElectron]);

  // ✅ SIMPLE FIX: Generate link directly, don't rely on enableCollaboration having token
  const handleEnableCollaboration = useCallback(async () => {
    if (isSwitching || !enableCollaboration) return;

    try {
      console.log('🔄 Starting collaboration from header');

      // ✅ STEP 1: Generate collaboration link directly
      const { collaborationService } = await import('../../services/collabService');
      const linkData = await collaborationService.generateCollaborationLink(documentId);

      if (!linkData?.url || !linkData?.token) {
        throw new Error('Failed to generate collaboration link');
      }

      console.log('✅ Collaboration link generated:', linkData.url);

      // ✅ STEP 2: Enable in UI state
      await enableCollaboration(linkData.token);

      // ✅ STEP 3: Copy link
      const copySuccess = await copyToClipboardSafely(linkData.url, "Collaboration link");

      // ✅ STEP 4: Show success message
      const message = copySuccess
        ? `✅ Collaboration enabled!\n\nLink copied to clipboard:\n${linkData.url}\n\nYour document will stay in collaboration mode until you click "Solo Mode".`
        : `✅ Collaboration enabled!\n\nYour document will stay in collaboration mode until you click "Solo Mode".`;

      alert(message);

      console.log('✅ Collaboration enabling completed successfully');

    } catch (error) {
      console.error('❌ Collaboration enabling failed:', error);
      alert(`❌ Error enabling collaboration: ${error.message}\n\nPlease try again.`);
    }
  }, [documentId, enableCollaboration, isSwitching, copyToClipboardSafely]);

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

          {/* ✅ UPDATED: Right Section with Session-Persistent Collaboration */}
          <div className="flex items-center gap-2 flex-shrink-0">
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
                      const copySuccess = await copyToClipboardSafely(url, "Current collaboration link");
                      alert(`${copySuccess ? 'Current collaboration link copied!' : 'Please copy the link from the alert above'}\n\n${url}\n\nUse the menu (⋯) for more sharing options.`);
                    } catch (error) {
                      alert('Failed to copy link');
                    }
                  }}
                  className="gap-2 bg-green-500 hover:bg-green-600"
                >
                  <Copy size={16} />
                  <span className="hidden sm:inline">Copy Current</span>
                </Button>

                {/* ✅ CHANGED: Solo Mode button is ALWAYS visible in collaboration mode */}
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

            {/* ✅ ENHANCED: Dropdown with debug options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <MoreHorizontal size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleCopyCurrentPageLink}>
                  <Copy size={16} className="mr-2" />
                  Copy Current URL
                </DropdownMenuItem>

                {/* ✅ NEW: Enhanced sharing options (only show when in collaboration mode) */}
                {isCollaborationMode && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleGeneratePermanentLink} disabled={!isElectron}>
                      <Link size={16} className="mr-2" />
                      Generate Permanent Link
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleGenerateOneTimeInvitation} disabled={!isElectron}>
                      <Users size={16} className="mr-2" />
                      Create One-Time Invitation
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleShowCollaborationInfo} disabled={!isElectron}>
                      <Share2 size={16} className="mr-2" />
                      Collaboration Info
                    </DropdownMenuItem>

                    {/* ✅ DEBUG: Add debug option */}
                    <DropdownMenuItem onClick={debugCollaborationData} disabled={!isElectron}>
                      <span className="mr-2">🔍</span>
                      Debug Collaboration Data
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

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
