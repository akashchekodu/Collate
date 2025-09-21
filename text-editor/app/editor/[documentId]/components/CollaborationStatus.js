// app/editor/[documentId]/components/CollaborationStatus.js
'use client'
import { useState, useEffect } from 'react'
import { Users, Wifi, WifiOff, Share2, Copy, Check, X } from 'lucide-react'

export default function CollaborationStatus({
  peerCount,
  activePeers,
  connectionStatus,
  ydoc,
  provider,
  roomName
}) {
  const [shareUrl, setShareUrl] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [copyStatus, setCopyStatus] = useState('idle') // idle, copying, copied

  // ✅ Generate shareable URL
  const generateShareUrl = () => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin
      const shareLink = `${baseUrl}/editor/${roomName}?collab=true`
      setShareUrl(shareLink)
      return shareLink
    }
    return ''
  }

  // ✅ Copy URL to clipboard
  const copyShareUrl = async () => {
    try {
      setCopyStatus('copying')
      const url = generateShareUrl()
      await navigator.clipboard.writeText(url)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
      setCopyStatus('idle')
    }
  }

  // ✅ Open share modal
  const handleShare = () => {
    generateShareUrl()
    setShowShareModal(true)
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600'
      case 'connecting': return 'text-yellow-600'
      case 'disconnected': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getConnectionIcon = () => {
    return connectionStatus === 'connected' ? 
      <Wifi className="w-4 h-4" /> : 
      <WifiOff className="w-4 h-4" />
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 ${getConnectionStatusColor()}`}>
            {getConnectionIcon()}
            <span className="text-sm font-medium capitalize">
              {connectionStatus || 'Disconnected'}
            </span>
          </div>

          {/* Peer Count */}
          <div className="flex items-center gap-2 text-gray-700">
            <Users className="w-4 h-4" />
            <span className="text-sm">
              {peerCount > 0 ? `${peerCount} peer${peerCount > 1 ? 's' : ''}` : 'Solo editing'}
            </span>
          </div>

          {/* Active Peers */}
          {activePeers && activePeers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Active:</span>
              <div className="flex gap-1">
                {activePeers.slice(0, 3).map((peer, index) => (
                  <div
                    key={peer.clientId || index}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ backgroundColor: peer.color || '#3b82f6' }}
                    title={peer.name || `User ${index + 1}`}
                  >
                    {(peer.name || `U${index + 1}`).charAt(0).toUpperCase()}
                  </div>
                ))}
                {activePeers.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs text-white">
                    +{activePeers.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ✅ Share Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            title="Share this document"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      {/* ✅ Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share Document</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Anyone with this link can collaborate on this document in real-time:
              </p>
              
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none"
                />
                <button
                  onClick={copyShareUrl}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  disabled={copyStatus === 'copying'}
                >
                  {copyStatus === 'copied' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : copyStatus === 'copying' ? (
                    <>
                      <Copy className="w-4 h-4" />
                      Copying...
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              <p>💡 Tip: Recipients will need to switch to "Collab" mode to see real-time changes.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
