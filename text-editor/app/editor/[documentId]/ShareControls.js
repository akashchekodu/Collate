"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Share2, MoreVertical, Copy, Download } from "lucide-react"
import { clearDocumentCache } from "./hooks/useStableDocumentData"
import { useModal } from "@/app/components/ui/modal-provider"

export default function ShareControls({
  documentId,
  isElectron,
  isCollaborationMode,
  isSwitching,
  enableCollaboration,
  disableCollaboration,
  title = "Untitled Document"
}) {
  const modal = useModal()

  // ✅ Clipboard helper with modal feedback
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
      
      // ✅ Show modal with copyable text if clipboard fails
      modal.showInfo(
        'Copy Link',
        `Please copy this ${description.toLowerCase()} manually:`,
        {
          copyableText: text
        }
      )
      return false
    }
  }, [modal])

  // ✅ HELPER: Save collaboration metadata immediately
  const saveCollaborationMetadataImmediately = useCallback(async (collaborationData) => {
    try {
      console.log('💾 Saving collaboration metadata immediately:', collaborationData);

      const currentDoc = await window.electronAPI.documents.load(documentId);
      if (!currentDoc) {
        throw new Error('Failed to load current document');
      }

      const updatedMetadata = {
        ...currentDoc.metadata,
        collaboration: {
          ...currentDoc.metadata?.collaboration,
          ...collaborationData,
          enabled: collaborationData.enabled ?? true,
          mode: collaborationData.mode ?? 'collaborative',
          sessionPersistent: collaborationData.sessionPersistent ?? true,
          lastActivity: new Date().toISOString(),
          schemaVersion: 2
        }
      };

      await window.electronAPI.documents.save(
        documentId,
        currentDoc.state,
        updatedMetadata
      );

      console.log('✅ Collaboration metadata saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to save collaboration metadata:', error);
      return false;
    }
  }, [documentId]);

  // ✅ Export with modal feedback
  const handleExport = async () => {
    if (!documentId || !isElectron) return
    try {
      const result = await window.electronAPI.documents.export(documentId, "md")
      if (result.success) {
        console.log("✅ Document exported to:", result.path)
        modal.showSuccess(
          'Export Successful',
          `Document exported successfully!\n\nSaved to: ${result.path}`
        )
      }
    } catch (error) {
      console.error("❌ Export failed:", error)
      modal.showError('Export Failed', 'Export failed. Please try again.')
    }
  }

  // ✅ Copy current page link
  const handleCopyCurrentPageLink = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const success = await copyToClipboardSafely(window.location.href, "Current page link")
      if (success) {
        modal.showSuccess('Link Copied', 'Current page link copied to clipboard!')
      }
    }
  }, [copyToClipboardSafely, modal])

  // ✅ Collaboration actions with modals
  const handleGeneratePermanentLink = useCallback(async () => {
    if (!documentId || !isElectron) return
    try {
      console.log('🔗 Generating permanent link from ShareControls...')
      const { collaborationService } = await import("../../services/collabService")
      const link = await collaborationService.generateLongExpiryLink(documentId, ["read", "write"])

      if (link?.url) {
        await saveCollaborationMetadataImmediately({
          links: {
            permanent: [link],
            oneTime: []
          }
        });

        const copySuccess = await copyToClipboardSafely(link.url, "Permanent link")
        
        modal.showSuccess(
          'Permanent Link Created!',
          copySuccess 
            ? `Link copied to clipboard!\n\nExpires: ${new Date(link.expiresAt).toLocaleDateString()}`
            : `Link created successfully!\n\nExpires: ${new Date(link.expiresAt).toLocaleDateString()}`,
          {
            copyableText: link.url,
            customButtons: copySuccess ? undefined : [{
              text: 'Copy Link',
              variant: 'outline',
              onClick: () => copyToClipboardSafely(link.url, "Permanent link"),
              closeOnClick: false
            }]
          }
        )
      } else {
        modal.showError(
          'Link Generation Failed',
          'Failed to generate permanent link. Please try again.'
        )
      }
    } catch (error) {
      console.error('❌ Failed to generate permanent link:', error)
      modal.showError(
        'Link Generation Error',
        `Error generating permanent link: ${error.message}`
      )
    }
  }, [documentId, isElectron, copyToClipboardSafely, saveCollaborationMetadataImmediately, modal])

  const handleGenerateOneTimeInvitation = useCallback(async () => {
    if (!documentId || !isElectron) return
    try {
      console.log('🎫 Generating one-time invitation from ShareControls...')
      const { collaborationService } = await import("../../services/collabService")
      const invitation = await collaborationService.generateOneTimeInvitation(documentId, "ShareControls User")

      if (invitation?.url) {
        const currentDoc = await window.electronAPI.documents.load(documentId);
        const existingOneTime = currentDoc?.metadata?.collaboration?.links?.oneTime || [];

        await saveCollaborationMetadataImmediately({
          links: {
            permanent: currentDoc?.metadata?.collaboration?.links?.permanent || [],
            oneTime: [...existingOneTime, invitation]
          }
        });

        const copySuccess = await copyToClipboardSafely(invitation.url, "One-time invitation")
        
        modal.showWarning(
          'One-Time Invitation Created!',
          copySuccess
            ? 'Link copied to clipboard!\n\n⚠️ This link can only be used ONCE.'
            : 'Link created successfully!\n\n⚠️ This link can only be used ONCE.',
          {
            copyableText: invitation.url,
            customButtons: copySuccess ? undefined : [{
              text: 'Copy Link',
              variant: 'outline',
              onClick: () => copyToClipboardSafely(invitation.url, "One-time invitation"),
              closeOnClick: false
            }]
          }
        )
      } else {
        modal.showError(
          'Invitation Generation Failed',
          'Failed to generate one-time invitation. Please try again.'
        )
      }
    } catch (error) {
      console.error('❌ Failed to generate one-time invitation:', error)
      modal.showError(
        'Invitation Generation Error',
        `Error generating one-time invitation: ${error.message}`
      )
    }
  }, [documentId, isElectron, copyToClipboardSafely, saveCollaborationMetadataImmediately, modal])

  const handleShowCollaborationInfo = useCallback(async () => {
    if (!documentId || !isElectron) return
    try {
      console.log('📊 Getting collaboration info from ShareControls...')
      const { collaborationService } = await import("../../services/collabService")
      const data = await collaborationService.getEnhancedCollaborationData(documentId)

      const permanentCount = data.links?.permanent?.length || 0
      const oneTimeCount = data.links?.oneTime?.length || 0
      const usedOneTime = data.links?.oneTime?.filter(link => link.used).length || 0

      const infoMessage = 
        `Document: ${title}\n` +
        `Mode: ${data.mode || 'solo'}\n` +
        `Session Persistent: ${data.sessionPersistent ? 'Yes' : 'No'}\n\n` +
        `Links Created:\n` +
        `• Permanent Links: ${permanentCount}\n` +
        `• One-time Invitations: ${oneTimeCount}\n` +
        `• Used Invitations: ${usedOneTime}\n\n` +
        `Security:\n` +
        `• Revoked Links: ${data.revoked?.length || 0}`
      
      modal.showInfo('Collaboration Status', infoMessage)
    } catch (error) {
      console.error('❌ Failed to get collaboration info:', error)
      modal.showError('Info Error', 'Failed to get collaboration information')
    }
  }, [documentId, isElectron, title, modal])

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

      const debugInfo = 
        `Document ID: ${documentId.slice(0, 8)}...\n` +
        `Has metadata: ${!!doc?.metadata}\n` +
        `Has collaboration: ${!!doc?.metadata?.collaboration}\n` +
        `Mode: ${doc?.metadata?.collaboration?.mode || 'none'}\n` +
        `Enabled: ${doc?.metadata?.collaboration?.enabled || false}\n` +
        `Session Persistent: ${doc?.metadata?.collaboration?.sessionPersistent || false}\n` +
        `Link exists: ${!!doc?.metadata?.collaboration?.link}\n` +
        `Token exists: ${!!doc?.metadata?.collaboration?.link?.token}`
      
      modal.showInfo('Debug Info', debugInfo)
    } catch (error) {
      console.error('❌ Debug failed:', error)
      modal.showError('Debug Error', `Debug failed: ${error.message}`)
    }
  }, [documentId, isElectron, modal])

  // ✅ Enable collaboration with modal
  const handleEnableCollaboration = useCallback(async () => {
    if (isSwitching || !enableCollaboration) return;

    try {
      console.log('🔄 Starting collaboration from ShareControls');

      const { collaborationService } = await import("../../services/collabService");
      const linkData = await collaborationService.generateCollaborationLink(documentId);

      if (!linkData?.url || !linkData?.token) {
        throw new Error('Failed to generate collaboration link');
      }

      console.log('✅ Generated collaboration link:', linkData.url);

      // ✅ Save metadata (keep your existing logic)
      try {
        if (window.electronAPI?.documents?.updateCollaborationMetadata) {
          const collaborationData = {
            enabled: true,
            mode: 'collaborative',
            sessionPersistent: true,
            roomId: `collab-${documentId}`,
            fieldName: `editor-${documentId}`,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            link: {
              token: linkData.token,
              url: linkData.url,
              createdAt: new Date().toISOString()
            },
            links: { permanent: [], oneTime: [] },
            participants: [],
            revoked: [],
            schemaVersion: 2
          };

          const metadataSuccess = await window.electronAPI.documents.updateCollaborationMetadata(
            documentId, 
            collaborationData
          );

          if (metadataSuccess) {
            console.log('✅ Collaboration metadata saved immediately via IPC');
            clearDocumentCache(documentId);
            console.log('🗑️ Document cache cleared - will reload fresh metadata');
          } else {
            console.warn('⚠️ Immediate metadata save failed, using fallback');
            await saveCollaborationMetadataImmediately(collaborationData);
            clearDocumentCache(documentId);
          }
        } else {
          console.log('🔄 Using fallback metadata save method');
          await saveCollaborationMetadataImmediately({
            enabled: true,
            mode: 'collaborative',
            sessionPersistent: true,
            link: { token: linkData.token, url: linkData.url }
          });
          clearDocumentCache(documentId);
        }
      } catch (metadataError) {
        console.error('❌ Metadata save failed:', metadataError);
        console.warn('⚠️ Collaboration mode may not persist across reloads');
      }

      await enableCollaboration(linkData.token);

      const copySuccess = await copyToClipboardSafely(linkData.url, "Collaboration link");
      
      modal.showSuccess(
        'Collaboration Enabled!',
        copySuccess 
          ? 'Link copied to clipboard! Share it with others to collaborate.'
          : 'Share this link with others to collaborate:',
        {
          copyableText: linkData.url,
          customButtons: copySuccess ? undefined : [{
            text: 'Copy Link',
            variant: 'outline',
            onClick: () => copyToClipboardSafely(linkData.url, "Collaboration link"),
            closeOnClick: false
          }]
        }
      )

      console.log('✅ Collaboration enabling completed');

    } catch (error) {
      console.error('❌ Collaboration enabling failed:', error);
      modal.showError(
        'Collaboration Error',
        `Error enabling collaboration: ${error.message}`
      );
    }
  }, [documentId, enableCollaboration, isSwitching, copyToClipboardSafely, saveCollaborationMetadataImmediately, clearDocumentCache, modal]);

  // ✅ Disable collaboration with confirmation
  const handleDisableCollaboration = useCallback(async () => {
    if (isSwitching || !disableCollaboration) return;

    // Show confirmation dialog
    const confirmed = await modal.showConfirm(
      'Switch to Solo Mode?',
      'This will disable collaboration and make your document private. Others will no longer be able to access it.',
      {
        confirmText: 'Switch to Solo',
        cancelText: 'Keep Collaborating'
      }
    )

    if (!confirmed) return;

    try {
      console.log('🔄 Disabling collaboration from ShareControls');

      // ✅ Save metadata (keep your existing logic)
      try {
        if (window.electronAPI?.documents?.updateCollaborationMetadata) {
          const collaborationData = {
            enabled: false,
            mode: 'solo',
            sessionPersistent: false,
            lastActivity: new Date().toISOString(),
            link: null,
            schemaVersion: 2
          };

          const metadataSuccess = await window.electronAPI.documents.updateCollaborationMetadata(
            documentId, 
            collaborationData
          );

          if (metadataSuccess) {
            console.log('✅ Solo mode metadata saved immediately via IPC');
            clearDocumentCache(documentId);
            console.log('🗑️ Document cache cleared - will reload fresh metadata');
          } else {
            console.warn('⚠️ Immediate metadata save failed, using fallback');
            await saveCollaborationMetadataImmediately(collaborationData);
            clearDocumentCache(documentId);
          }
        } else {
          console.log('🔄 Using fallback metadata save method');
          await saveCollaborationMetadataImmediately({
            enabled: false,
            mode: 'solo',
            sessionPersistent: false
          });
          clearDocumentCache(documentId);
        }
      } catch (metadataError) {
        console.warn('⚠️ Metadata save failed (non-critical for disable):', metadataError);
      }

      await disableCollaboration();

      modal.showSuccess(
        'Switched to Solo Mode',
        'Your document is now private. Collaboration has been disabled.'
      );
      
      console.log('✅ Collaboration disabling completed');

    } catch (error) {
      console.error('❌ Disable collaboration error:', error);
      modal.showError(
        'Mode Switch Error', 
        `Error switching to solo mode: ${error.message}`
      );
    }
  }, [documentId, disableCollaboration, isSwitching, saveCollaborationMetadataImmediately, clearDocumentCache, modal]);

  const handleCopyCurrentLink = useCallback(async () => {
    try {
      const url = window.location.href
      const copySuccess = await copyToClipboardSafely(url, "Current collaboration link")
      
      if (copySuccess) {
        modal.showSuccess('Link Copied!', 'Current collaboration link copied to clipboard!')
      }
    } catch (error) {
      console.error('Failed to copy current link:', error)
      modal.showError('Copy Failed', 'Failed to copy current link')
    }
  }, [copyToClipboardSafely, modal]);

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
            onClick={handleCopyCurrentLink}
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
