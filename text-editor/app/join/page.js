'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function JoinPage() {
  const [params, setParams] = useState(null)
  const [status, setStatus] = useState('loading')
  const [countdown, setCountdown] = useState(3)
  const [debugInfo, setDebugInfo] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Extract URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const room = urlParams.get('room')
    const token = urlParams.get('token')
    const doc = urlParams.get('doc')
    
    // Debug logging
    const debug = {
      url: window.location.href,
      room: room ? `${room.substring(0, 20)}...` : 'missing',
      token: token ? 'present' : 'missing',
      doc: doc || 'missing'
    }
    setDebugInfo(JSON.stringify(debug, null, 2))
    console.log('🔗 Join page parameters:', debug)
    
    // Validate required parameters
    if (!room || !token || !doc) {
      console.error('❌ Missing required parameters:', { room: !!room, token: !!token, doc: !!doc })
      setStatus('invalid')
      return
    }
    
    setParams({ room, token, doc })
    setStatus('ready')
  }, [])

  const joinInBrowser = () => {
    if (!params) {
      console.error('❌ No parameters available for browser join')
      return
    }
    
    console.log('🌐 Joining collaboration in browser:', {
      room: params.room.substring(0, 20) + '...',
      hasToken: !!params.token,
      doc: params.doc
    })
    
    setStatus('joining-browser')
    
    try {
      // Store collaboration parameters for the editor
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('collaborationToken', params.token)
        sessionStorage.setItem('collaborationRoom', params.room)
        sessionStorage.setItem('collaborationDoc', params.doc)
        
        console.log('💾 Stored collaboration parameters in sessionStorage')
      }
      
      // Navigate to the editor with the document
      const editorUrl = `/editor/${params.doc}?room=${encodeURIComponent(params.room)}&token=${encodeURIComponent(params.token)}&mode=collaboration`
      
      console.log('🚀 Navigating to editor:', editorUrl.substring(0, 100) + '...')
      router.push(editorUrl)
      
    } catch (error) {
      console.error('❌ Error joining in browser:', error)
      setStatus('browser-error')
    }
  }

  const openInApp = () => {
    if (!params) {
      console.error('❌ No parameters available for app launch')
      return
    }
    
    console.log('🚀 Launching Collate app with parameters:', {
      room: params.room.substring(0, 20) + '...',
      hasToken: !!params.token,
      doc: params.doc
    })
    
    setStatus('launching')
    
    try {
      // Create protocol URL with proper encoding
      const protocolUrl = `collate://collaborate?room=${encodeURIComponent(params.room)}&token=${encodeURIComponent(params.token)}&doc=${encodeURIComponent(params.doc)}`
      
      console.log('🔗 Protocol URL created:', protocolUrl.substring(0, 100) + '...')
      
      // Launch Electron app
      window.location.href = protocolUrl
      
      // Start countdown for fallback
      let count = 3
      const countdownInterval = setInterval(() => {
        count -= 1
        setCountdown(count)
        
        if (count <= 0) {
          clearInterval(countdownInterval)
          setStatus('app-not-found')
          console.log('⏰ App launch timeout - showing download option')
        }
      }, 1000)
      
      // Clear countdown if user returns to page (app didn't launch)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          clearInterval(countdownInterval)
          setStatus('app-not-found')
          console.log('👁️ Page became visible - app likely not installed')
        }
      }
      
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      // Cleanup after 5 seconds
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        clearInterval(countdownInterval)
      }, 5000)
      
    } catch (error) {
      console.error('❌ Error launching app:', error)
      setStatus('app-not-found')
    }
  }

  // Browser error state
  if (status === 'browser-error') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">❌</div>
          <h1>Browser Join Failed</h1>
          <p>There was an error joining the collaboration in your browser.</p>
          <div className="error-message">
            Please try opening in the desktop app or refresh the page.
          </div>
          
          <div className="button-group">
            <button onClick={openInApp} className="primary-button">
              Open in Desktop App
            </button>
            <button onClick={() => window.location.reload()} className="secondary-button">
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Joining in browser state
  if (status === 'joining-browser') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">🌐</div>
          <h1>Opening in Browser...</h1>
          <p>Starting your collaborative editing session</p>
          <div className="status-message">
            You&rsquo;ll be redirected to the editor in just a moment...
          </div>
          <div className="collaboration-details">
            <p><strong>Document:</strong> {params?.doc}</p>
            <p><strong>Room:</strong> {params?.room?.substring(0, 20)}...</p>
            <p><strong>Mode:</strong> Browser Collaboration</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">📝</div>
          <h1>Loading collaboration...</h1>
          <p>Preparing your collaborative session</p>
          <div className="debug-info">
            <details>
              <summary>Debug Info</summary>
              <pre>{debugInfo}</pre>
            </details>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">❌</div>
          <h1>Invalid collaboration link</h1>
          <p>This link appears to be missing required information.</p>
          <div className="error-details">
            <p><strong>Required parameters:</strong></p>
            <ul>
              <li>Room ID: {params?.room ? '✅' : '❌'}</li>
              <li>Authentication token: {params?.token ? '✅' : '❌'}</li>
              <li>Document ID: {params?.doc ? '✅' : '❌'}</li>
            </ul>
          </div>
          <div className="debug-info">
            <details>
              <summary>Debug Info</summary>
              <pre>{debugInfo}</pre>
            </details>
          </div>
          <Link href="/" className="secondary-button">
            Go to homepage
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'launching') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">🚀</div>
          <h1>Opening Collate App...</h1>
          <p>Your collaborative session is starting</p>
          <div className="status-message">
            If the app doesn&rsquo;t open in {countdown} seconds, you may need to install it first.
          </div>
          <div className="collaboration-details">
            <p><strong>Document:</strong> {params?.doc}</p>
            <p><strong>Room:</strong> {params?.room?.substring(0, 20)}...</p>
          </div>
          <div className="button-group">
            <a href="/download" className="secondary-button">
              Download Collate App
            </a>
            <button onClick={joinInBrowser} className="primary-button">
              Join in Browser Instead
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'app-not-found') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">📱</div>
          <h1>Choose How to Join</h1>
          <p>It looks like you don&rsquo;t have the Collate app installed, but you can still collaborate!</p>
          
          <div className="join-options">
            <div className="action-option browser-option">
              <h3>🌐 Join in Browser</h3>
              <p>Start collaborating right now with:</p>
              <ul>
                <li>✅ Instant access - no download needed</li>
                <li>✅ Real-time collaboration</li>
                <li>✅ Cross-platform compatibility</li>
                <li>✅ Secure P2P connection</li>
              </ul>
              <button onClick={joinInBrowser} className="primary-button">
                Join in Browser Now
              </button>
            </div>
            
            <div className="action-option app-option">
              <h3>📱 Desktop App</h3>
              <p>Get the full experience with:</p>
              <ul>
                <li>✅ Offline editing capabilities</li>
                <li>✅ Save documents locally</li>
                <li>✅ Enhanced desktop features</li>
                <li>✅ Better performance</li>
              </ul>
              <a href="/download" className="primary-button">
                Download App
              </a>
              <button onClick={openInApp} className="secondary-button">
                Try Opening Again
              </button>
            </div>
          </div>
          
          <div className="debug-info" style={{ marginTop: '2rem' }}>
            <details>
              <summary>Technical Details</summary>
              <pre>{debugInfo}</pre>
              <p><strong>Protocol URL pattern:</strong></p>
              <code>collate://collaborate?room=...&token=...&doc=...</code>
            </details>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <div className="logo">🤝</div>
        <h1>You&rsquo;re invited to collaborate!</h1>
        <p>Someone has shared a document with you for real-time collaboration.</p>
        
        <div className="collaboration-preview">
          <h3>📄 Document Details</h3>
          <p><strong>Document ID:</strong> {params?.doc}</p>
          <p><strong>Collaboration Room:</strong> {params?.room?.substring(0, 30)}...</p>
          <p><strong>Authentication:</strong> ✅ Secured with token</p>
        </div>
        
        <div className="collaboration-actions">
          <div className="action-option">
            <h3>🌐 Quick Start</h3>
            <p>Join instantly in your browser</p>
            <button onClick={joinInBrowser} className="primary-button">
              Join in Browser
            </button>
          </div>
          
          <div className="action-option">
            <h3>💻 Full Experience</h3>
            <p>Open in the desktop app</p>
            <button onClick={openInApp} className="secondary-button">
              Open in App
            </button>
          </div>
        </div>
        
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Don&rsquo;t have the app yet?</h3>
          <a href="/download" className="secondary-button">
            Download for free
          </a>
        </div>
        
        <div className="footer">
          <p>🔒 Your privacy is protected - documents are never stored on our servers</p>
          <p>🚀 Powered by peer-to-peer technology for maximum security</p>
        </div>
      </div>
    </div>
  )
}
