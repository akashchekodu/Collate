"use client";

import { useState, useEffect } from 'react';
import { Copy, Link, Users, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { collaborationService } from '../services/collabService';

// Test if this component can import the service:
console.log('🧪 Testing ShareDialog import compatibility...');

// Test the import path
import('../services/collabService')
  .then(module => {
    console.log('✅ SUCCESS: ShareDialog can import collabService!');
    console.log('Available exports:', Object.keys(module));

    const { collaborationService } = module;
    if (collaborationService) {
      console.log('✅ collaborationService available');
      console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(collaborationService)));

      // Test basic functionality
      return collaborationService.enableCollaboration('test-share-dialog');
    } else {
      console.log('❌ collaborationService not found in exports');
    }
  })
  .then(result => {
    if (result) {
      console.log('🎉 ShareDialog integration will work!', result);
    }
  })
  .catch(error => {
    console.error('❌ ShareDialog import will fail:', error);
    console.log('Need to fix import path or file location');
  });

export default function ShareDialog({ documentId, documentTitle, isOpen, onClose }) {
  const [collaborationData, setCollaborationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);

  useEffect(() => {
    if (isOpen && documentId) {
      loadCollaborationData();
    }
  }, [isOpen, documentId]);

  useEffect(() => {
    collaborationService.initialize();
  }, []);

  // ✅ ENHANCED: Use the new enhanced collaboration data method
  const loadCollaborationData = async () => {
    setIsLoading(true);
    try {
      console.log('📋 ShareDialog: Loading enhanced collaboration data for:', documentId.slice(0, 8));

      // ✅ NEW: Use enhanced collaboration data retrieval
      const data = await collaborationService.getEnhancedCollaborationData(documentId);

      console.log('📋 ShareDialog: Enhanced collaboration data loaded:', {
        enabled: data.enabled,
        mode: data.mode,
        permanentLinks: data.links?.permanent?.length || 0,
        oneTimeLinks: data.links?.oneTime?.length || 0,
        participants: data.participants?.length || 0
      });

      setCollaborationData(data);

      // Enable collaboration if not already enabled
      if (!data.enabled) {
        console.log('🔄 Enabling collaboration for ShareDialog...');
        const newData = await collaborationService.enableCollaboration(documentId, documentTitle);
        if (newData) {
          // Reload enhanced data after enabling
          const enhancedData = await collaborationService.getEnhancedCollaborationData(documentId);
          setCollaborationData(enhancedData);
        }
      }
    } catch (error) {
      console.error('Failed to load enhanced collaboration data:', error);
    }
    setIsLoading(false);
  };

  // ✅ NEW: Generate long-expiry permanent link
  const generateLongExpiryLink = async () => {
    if (!documentId) return;

    try {
      console.log('🔗 ShareDialog: Generating long-expiry link...');

      // ✅ NEW: Use the enhanced method  
      const link = await collaborationService.generateLongExpiryLink(documentId, ['read', 'write']);

      if (link) {
        console.log('✅ Long-expiry link created:', link.url);
        await loadCollaborationData(); // Refresh to show new link

        // Copy to clipboard and show success
        await copyToClipboard(link.url, `perm-${link.linkId}`);
        alert(`Permanent collaboration link created!\n\nLink copied to clipboard:\n${link.url}\n\nExpires: ${new Date(link.expiresAt).toLocaleDateString()}`);
      }
    } catch (error) {
      console.error('Failed to generate long-expiry link:', error);
      alert('Failed to generate permanent link');
    }
  };

  // ✅ NEW: Generate one-time invitation
  const generateOneTimeInvitation = async () => {
    if (!documentId) return;

    try {
      console.log('🎫 ShareDialog: Generating one-time invitation...');

      // ✅ NEW: Use the enhanced method
      const invitation = await collaborationService.generateOneTimeInvitation(documentId, 'Anonymous User');

      if (invitation) {
        console.log('✅ One-time invitation created:', invitation.url);
        await loadCollaborationData(); // Refresh to show new invitation

        // Copy to clipboard and show success
        await copyToClipboard(invitation.url, `inv-${invitation.linkId}`);
        alert(`One-time invitation created!\n\nLink copied to clipboard:\n${invitation.url}\n\nThis link can only be used once.\nExpires: ${new Date(invitation.expiresAt).toLocaleDateString()}`);
      }
    } catch (error) {
      console.error('Failed to generate one-time invitation:', error);
      alert('Failed to generate one-time invitation');
    }
  };

  const copyToClipboard = async (text, linkId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
      console.log('📋 Link copied to clipboard:', text.slice(0, 50) + '...');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Share Document</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Setting up collaboration...</p>
            </div>
          ) : (
            <>
              {/* Document Info */}
              <div className="text-center">
                <h3 className="font-medium text-gray-900">{documentTitle}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {collaborationData?.participants?.length || 0} participants • {collaborationData?.mode || 'solo'} mode
                </p>
              </div>

              {/* ✅ UPDATED: Permanent Links with new data structure */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Link size={16} />
                    Permanent Links
                  </h4>
                  <Button size="sm" variant="outline" onClick={generateLongExpiryLink}>
                    Generate
                  </Button>
                </div>

                {collaborationData?.links?.permanent?.map((link) => (
                  <div key={link.linkId} className="border rounded-lg p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Permanent Access</p>
                        <p className="text-xs text-gray-600">
                          Created: {new Date(link.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600">
                          Expires: {new Date(link.expiresAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Permissions: {link.permissions?.join(', ') || 'read, write'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(link.url, `perm-${link.linkId}`)}
                        title="Copy link to clipboard"
                      >
                        {copiedLink === `perm-${link.linkId}` ? <Check size={16} /> : <Copy size={16} />}
                      </Button>
                    </div>
                  </div>
                )) || null}

                {(!collaborationData?.links?.permanent || collaborationData.links.permanent.length === 0) && (
                  <p className="text-sm text-gray-600 text-center py-4">
                    No permanent links created yet
                  </p>
                )}
              </div>

              {/* ✅ UPDATED: One-time Invitations with new data structure */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Users size={16} />
                    One-time Invitations
                  </h4>
                  <Button size="sm" variant="outline" onClick={generateOneTimeInvitation}>
                    Create
                  </Button>
                </div>

                {collaborationData?.links?.oneTime?.map((invitation) => (
                  <div key={invitation.linkId} className="border rounded-lg p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {invitation.recipientName || 'Anonymous Invitation'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {invitation.used
                            ? `✅ Used ${invitation.usedAt ? 'on ' + new Date(invitation.usedAt).toLocaleDateString() : ''}`
                            : '⏳ Pending'
                          }
                        </p>
                        <p className="text-xs text-gray-600">
                          Created: {new Date(invitation.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-600">
                          Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                        {invitation.used && invitation.usedBy && (
                          <p className="text-xs text-gray-500">
                            Used by: {invitation.usedBy}
                          </p>
                        )}
                      </div>
                      {!invitation.used && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(invitation.url, `inv-${invitation.linkId}`)}
                          title="Copy invitation link"
                        >
                          {copiedLink === `inv-${invitation.linkId}` ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      )}
                    </div>
                  </div>
                )) || null}

                {(!collaborationData?.links?.oneTime || collaborationData.links.oneTime.length === 0) && (
                  <p className="text-sm text-gray-600 text-center py-4">
                    No invitations created yet
                  </p>
                )}
              </div>

              {/* ✅ NEW: Debug info (development only) */}
              {process.env.NODE_ENV === 'development' && collaborationData && (
                <div className="border-t pt-4 mt-4">
                  <details>
                    <summary className="text-xs text-gray-500 cursor-pointer">Debug Info</summary>
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      <p>Document ID: {documentId.slice(0, 8)}...</p>
                      <p>Collaboration enabled: {String(collaborationData.enabled)}</p>
                      <p>Mode: {collaborationData.mode}</p>
                      <p>Schema version: {collaborationData.schemaVersion || 'legacy'}</p>
                      <p>Permanent links: {collaborationData.links?.permanent?.length || 0}</p>
                      <p>One-time links: {collaborationData.links?.oneTime?.length || 0}</p>
                      <p>Participants: {collaborationData.participants?.length || 0}</p>
                      <p>Revoked tokens: {collaborationData.revoked?.length || 0}</p>
                    </div>
                  </details>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
