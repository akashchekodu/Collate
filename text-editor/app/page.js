'use client'

import { useState, useEffect } from 'react';

export default function HomePage() {
  const [isElectron, setIsElectron] = useState(false);
  const [electronInfo, setElectronInfo] = useState(null);

  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectron(true);
      setElectronInfo(window.electronAPI.versions);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          P2P Text Editor
        </h1>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Environment:</p>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isElectron 
                ? 'bg-green-100 text-green-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {isElectron ? 'Electron App' : 'Web Browser'}
            </span>
          </div>

          {isElectron && electronInfo && (
            <div className="text-center">
              <p className="text-gray-600 mb-2">Versions:</p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Electron: {electronInfo.electron}</div>
                <div>Node: {electronInfo.node}</div>
                <div>Chrome: {electronInfo.chrome}</div>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <button
              onClick={() => alert('App Router + Electron working!')}
              className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Test Integration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
