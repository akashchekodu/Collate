"use client";

import { useState, useEffect } from 'react';
import { Copy, Link, Users, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { collaborationService } from '../services/collabService';


// Test if this component can import the service:
console.log('🧪 Testing ShareDialog import compatibility...');

// Check if the import would work from this component's location
// Since this is in app/components/, the import '../services/collabService' 
// would look for app/services/collabService.js

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

  const loadCollaborationData = async () => {
    setIsLoading(true);
    try {
      const data = await collaborationService.getCollaborationData(documentId);
      if (!data) {
        // Enable collaboration if not already enabled
        const newData = await collaborationService.enableCollaboration(documentId, documentTitle);
        setCollaborationData(newData);
      } else {
        setCollaborationData(data);
      }
    } catch (error) {
      console.error('Failed to load collaboration data:', error);
    }
    setIsLoading(false);
  };

  const generatePermanentLink = async () => {
    if (!documentId) return;
    
    try {
      const link = await collaborationService.generatePermanentLink(documentId);
      if (link) {
        await loadCollaborationData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to generate permanent link:', error);
    }
  };

  const generateInvitationLink = async () => {
    if (!documentId) return;
    
    try {
      const invitation = await collaborationService.generateInvitationLink(documentId);
      if (invitation) {
        await loadCollaborationData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to generate invitation link:', error);
    }
  };

  const copyToClipboard = async (text, linkId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (!isOpen) return null;

  return (
  <div 
    className="fixed z-50"
    style={{
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    }}
  >
    <div 
      className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden flex flex-col"
      style={{
        maxHeight: '90vh'
      }}
    >
      <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
        <h2 className="text-lg font-semibold">Share Document</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                  {collaborationData?.collaborators?.length || 0} collaborators
                </p>
              </div>

              {/* Permanent Links */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Link size={16} />
                    Permanent Links
                  </h4>
                  <Button size="sm" variant="outline" onClick={generatePermanentLink}>
                    Generate
                  </Button>
                </div>

                {collaborationData?.permanentLinks?.map((link, index) => (
                  <div key={index} className="border rounded-lg p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Permanent Access</p>
                        <p className="text-xs text-gray-600">
                          Expires: {new Date(link.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(link.url, `perm-${index}`)}
                      >
                        {copiedLink === `perm-${index}` ? <Check size={16} /> : <Copy size={16} />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* One-time Invitations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Users size={16} />
                    One-time Invitations
                  </h4>
                  <Button size="sm" variant="outline" onClick={generateInvitationLink}>
                    Create
                  </Button>
                </div>

                {collaborationData?.invitations?.map((invitation, index) => (
                  <div key={index} className="border rounded-lg p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {invitation.recipientName || 'Anonymous Invitation'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {invitation.used ? '✅ Used' : '⏳ Pending'}
                        </p>
                      </div>
                      {!invitation.used && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => copyToClipboard(invitation.url, `inv-${index}`)}
                        >
                          {copiedLink === `inv-${index}` ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {(!collaborationData?.invitations || collaborationData.invitations.length === 0) && (
                  <p className="text-sm text-gray-600 text-center py-4">
                    No invitations created yet
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}