"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Share2, MoreVertical, Copy, Download } from "lucide-react"

export default function ShareControls({
  documentId,
  isElectron,
  isCollaborationMode,
  isSwitching,
  // ✅ MISSING: Add the callback functions as props
  enableCollaboration,
  disableCollaboration,
  title = "Untitled Document" // ✅ Add title prop for better alerts
}) {
  // ✅ Clipboard helper
  const copyToClipboardSafely = useCallback(async (text, description = "Link") => {
    try {
      await navigator.clipboard.writeText(text)
      console.log(`✅ ${description} copied:`, text)
      return true
    } catch (error) {
      console.warn("⚠️ Clipboard API failed:", error)
      try {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const success = document.execCommand("copy")
        document.body.removeChild(textarea)
        if (success) return true
      } catch (fallbackError) {
        console.warn("❌ Fallback copy failed:", fallbackError)
      }
      alert(`${description}:\n${text}`)
      return false
    }
  }, [])

  // ✅ Export
  const handleExport = async () => {
    if (!documentId || !isElectron) return
    try {
      const result = await window.electronAPI.documents.export(documentId, "md")
      if (result.success) {
        console.log("✅ Document exported to:", result.path)
        alert(`✅ Document exported successfully!\n\nSaved to: ${result.path}`)
      }
    } catch (error) {
      console.error("❌ Export failed:", error)
      alert("❌ Export failed. Please try again.")
    }
  }

  // ✅ Copy current page link
  const handleCopyCurrentPageLink = () => {
    if (typeof window !== 'undefined') {
      copyToClipboardSafely(window.location.href, "Current page link")
    }
  }

  // ✅ Collaboration actions
  const handleGeneratePermanentLink = useCallback(async () => {
    if (!documentId || !isElectron) return
    try {
      console.log('🔗 Generating permanent link from ShareControls...')
      const { collaborationService } = await import("../../services/collabService")
      const link = await collaborationService.generateLongExpiryLink(documentId, ["read", "write"])

      if (link?.url) {
        const copySuccess = await copyToClipboardSafely(link.url, "Permanent link")
        const message = copySuccess
          ? `🔗 Permanent Link Created!\n\nLink copied to clipboard!\n\nURL: ${link.url}\n\nExpires: ${new Date(link.expiresAt).toLocaleDateString()}`
          : `🔗 Permanent Link Created!\n\nURL: ${link.url}\n\nExpires: ${new Date(link.expiresAt).toLocaleDateString()}`
        alert(message)
      } else {
        alert('❌ Failed to generate permanent link. Please try again.')
      }
    } catch (error) {
      console.error('❌ Failed to generate permanent link:', error)
      alert(`❌ Error generating permanent link: ${error.message}`)
    }
  }, [documentId, isElectron, copyToClipboardSafely])

  const handleGenerateOneTimeInvitation = useCallback(async () => {
    if (!documentId || !isElectron) return
    try {
      console.log('🎫 Generating one-time invitation from ShareControls...')
      const { collaborationService } = await import("../../services/collabService")
      const invitation = await collaborationService.generateOneTimeInvitation(documentId, "ShareControls User")

      if (invitation?.url) {
        const copySuccess = await copyToClipboardSafely(invitation.url, "One-time invitation")
        const message = copySuccess
          ? `🎫 One-Time Invitation Created!\n\nLink copied to clipboard!\n\nURL: ${invitation.url}\n\n⚠️ This link can only be used ONCE.`
          : `🎫 One-Time Invitation Created!\n\nURL: ${invitation.url}\n\n⚠️ This link can only be used ONCE.`
        alert(message)
      } else {
        alert('❌ Failed to generate one-time invitation. Please try again.')
      }
    } catch (error) {
      console.error('❌ Failed to generate one-time invitation:', error)
      alert(`❌ Error generating one-time invitation: ${error.message}`)
    }
  }, [documentId, isElectron, copyToClipboardSafely])

  const handleShowCollaborationInfo = useCallback(async () => {
    if (!documentId || !isElectron) return
    try {
      console.log('📊 Getting collaboration info from ShareControls...')
      const { collaborationService } = await import("../../services/collabService")
      const data = await collaborationService.getEnhancedCollaborationData(documentId)

      const permanentCount = data.links?.permanent?.length || 0
      const oneTimeCount = data.links?.oneTime?.length || 0
      const usedOneTime = data.links?.oneTime?.filter(link => link.used).length || 0

      alert(
        `📊 Collaboration Status\n\n` +
        `Document: ${title}\n` +
        `Mode: ${data.mode || 'solo'}\n` +
        `Session Persistent: ${data.sessionPersistent ? 'Yes' : 'No'}\n\n` +
        `📎 Links Created:\n` +
        `• Permanent Links: ${permanentCount}\n` +
        `• One-time Invitations: ${oneTimeCount}\n` +
        `• Used Invitations: ${usedOneTime}\n\n` +
        `🔒 Security:\n` +
        `• Revoked Links: ${data.revoked?.length || 0}`
      )
    } catch (error) {
      console.error('❌ Failed to get collaboration info:', error)
      alert("❌ Failed to get collaboration information")
    }
  }, [documentId, isElectron, title])

  const debugCollaborationData = useCallback(async () => {
    if (!documentId || !isElectron) return
    try {
      console.log('🔍 DEBUG: Checking collaboration data from ShareControls:', documentId)
      const doc = await window.electronAPI.documents.load(documentId)
      console.log('📄 Raw document data:', doc)
      console.log('📄 Collaboration metadata:', doc?.metadata?.collaboration)

      const { collaborationService } = await import("../../services/collabService")
      const collabData = await collaborationService.getCollaborationData(documentId)
      console.log('🤝 CollaborationService data:', collabData)

      alert(
        `🔍 DEBUG INFO\n\n` +
        `Document ID: ${documentId.slice(0, 8)}...\n` +
        `Has metadata: ${!!doc?.metadata}\n` +
        `Has collaboration: ${!!doc?.metadata?.collaboration}\n` +
        `Mode: ${doc?.metadata?.collaboration?.mode || 'none'}\n` +
        `Enabled: ${doc?.metadata?.collaboration?.enabled || false}\n` +
        `Session Persistent: ${doc?.metadata?.collaboration?.sessionPersistent || false}\n` +
        `User Choice: ${doc?.metadata?.collaboration?.userChoice || 'none'}\n` +
        `Link exists: ${!!doc?.metadata?.collaboration?.link}\n` +
        `Token exists: ${!!doc?.metadata?.collaboration?.link?.token}`
      )
    } catch (error) {
      console.error('❌ Debug failed:', error)
      alert("❌ Debug failed: " + error.message)
    }
  }, [documentId, isElectron])

  // ✅ FIXED: Use the passed callback functions
  const handleEnableCollaboration = useCallback(async () => {
    if (isSwitching || !enableCollaboration) return

    try {
      console.log('🔄 Starting collaboration from ShareControls')

      // ✅ Generate collaboration link
      const { collaborationService } = await import("../../services/collabService")
      const linkData = await collaborationService.generateCollaborationLink(documentId)

      if (!linkData?.url || !linkData?.token) {
        throw new Error('Failed to generate collaboration link')
      }

      // ✅ Enable in UI state using the passed callback
      await enableCollaboration(linkData.token)

      // ✅ Copy link and show success
      const copySuccess = await copyToClipboardSafely(linkData.url, "Collaboration link")
      const message = copySuccess
        ? `✅ Collaboration enabled!\n\nLink copied to clipboard:\n${linkData.url}\n\nShare this link with others to collaborate.`
        : `✅ Collaboration enabled!\n\nShare this link:\n${linkData.url}`

      alert(message)
      console.log('✅ Collaboration enabling completed from ShareControls')

    } catch (error) {
      console.error('❌ Collaboration enabling failed:', error)
      alert(`❌ Error enabling collaboration: ${error.message}\n\nPlease try again.`)
    }
  }, [documentId, enableCollaboration, isSwitching, copyToClipboardSafely])

  const handleDisableCollaboration = useCallback(async () => {
    if (isSwitching || !disableCollaboration) return

    try {
      await disableCollaboration()
      alert('📝 Switched to solo mode.\n\nYour document is now private.')
    } catch (error) {
      console.error('❌ Disable collaboration error:', error)
      alert(`❌ Error switching to solo mode: ${error.message}`)
    }
  }, [disableCollaboration, isSwitching])

  return (
    <div className="flex items-center gap-2">
      {/* ✅ Main collaboration button */}
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
                const url = window.location.href
                const copySuccess = await copyToClipboardSafely(url, "Current collaboration link")
                alert(`${copySuccess ? 'Current collaboration link copied!' : 'Please copy the link from the alert above'}\n\n${url}`)
              } catch (error) {
                alert('Failed to copy link')
              }
            }}
            className="gap-2 bg-green-500 hover:bg-green-600"
          >
            <Copy size={16} />
            <span className="hidden sm:inline">Copy Current</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleDisableCollaboration}
            disabled={isSwitching}
            className={`gap-2 ${isSwitching ? 'bg-gray-400' : 'hover:bg-orange-50'}`}
          >
            <span className="hidden sm:inline">
              {isSwitching ? 'Switching...' : 'Solo Mode'}
            </span>
          </Button>
        </div>
      )}

      {/* ✅ Export button */}
      <Button
        variant="outline"
        onClick={handleExport}
        className="gap-2 bg-transparent"
        disabled={!isElectron}
      >
        <Download size={16} />
        <span className="hidden sm:inline">Export</span>
      </Button>

      {/* ✅ Dropdown menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="p-2">
            <MoreVertical size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleCopyCurrentPageLink}>
            <Copy size={16} className="mr-2" />
            Copy Current URL
          </DropdownMenuItem>

          {/* ✅ Enhanced sharing options (only show when in collaboration mode) */}
          {isCollaborationMode && (
            <>
              <DropdownMenuItem onClick={handleGeneratePermanentLink} disabled={!isElectron}>
                <Share2 size={16} className="mr-2" />
                Generate Permanent Link
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleGenerateOneTimeInvitation} disabled={!isElectron}>
                <Share2 size={16} className="mr-2" />
                Create One-Time Invitation
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleShowCollaborationInfo} disabled={!isElectron}>
                <Share2 size={16} className="mr-2" />
                Collaboration Info
              </DropdownMenuItem>

              <DropdownMenuItem onClick={debugCollaborationData} disabled={!isElectron}>
                <span className="mr-2">🔍</span>
                Debug Collaboration Data
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
