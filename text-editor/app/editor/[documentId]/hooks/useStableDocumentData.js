"use client";
import { useRef, useEffect, useState } from 'react';

// ✅ SINGLETON: Global document data cache to prevent render loops
const globalDocumentCache = new Map();
const documentLoadPromises = new Map();
const documentLoadingFlags = new Set();

export function useStableDocumentData(documentId) {
    const [documentData, setDocumentData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isElectron, setIsElectron] = useState(false);
    const loadedRef = useRef(false);
    const documentIdRef = useRef(documentId);
    const cacheCheckCountRef = useRef(0); // ✅ NEW: Track cache checks

    // ✅ IMMEDIATE ELECTRON CHECK
    useEffect(() => {
        const electronAvailable = typeof window !== 'undefined' &&
            !!window.electronAPI &&
            !!window.electronAPI.isElectron;

        console.log('🔍 Electron detection:', {
            hasWindow: typeof window !== 'undefined',
            hasElectronAPI: typeof window !== 'undefined' && !!window.electronAPI,
            hasIsElectron: typeof window !== 'undefined' && !!window.electronAPI?.isElectron,
            electronAvailable
        });

        setIsElectron(electronAvailable);
    }, []);

    // ✅ RESET: When documentId changes
    if (documentIdRef.current !== documentId) {
        documentIdRef.current = documentId;
        loadedRef.current = false;
        setIsLoading(true);
        setDocumentData(null);
        cacheCheckCountRef.current = 0; // ✅ RESET: Cache check counter
    }

    useEffect(() => {
        // ✅ SSR SAFETY: Only run on client side
        if (typeof window === 'undefined') return;

        if (!documentId || loadedRef.current) return;

        // ✅ WAIT FOR ELECTRON CHECK
        if (isElectron === false && typeof window.electronAPI !== 'undefined') {
            setTimeout(() => {
                const stillChecking = typeof window.electronAPI !== 'undefined' && !window.electronAPI?.isElectron;
                if (!stillChecking) {
                    setIsElectron(!!window.electronAPI?.isElectron);
                }
            }, 100);
            return;
        }

        // ✅ ELECTRON CHECK: Only proceed if Electron is available
        if (!isElectron && typeof window !== 'undefined') {
            const hasElectronAPI = !!window.electronAPI?.documents?.load;

            if (!hasElectronAPI) {
                console.log('⚠️ Not in Electron, using fallback data');
                const fallbackData = {
                    id: documentId,
                    title: 'Untitled Document',
                    collaboration: null,
                    metadata: null,
                    state: null,
                    loadedAt: Date.now(),
                    isElectronFallback: true
                };
                setDocumentData(fallbackData);
                setIsLoading(false);
                loadedRef.current = true;
                return;
            } else {
                setIsElectron(true);
            }
        }

        // ✅ CACHE CHECK: Only use cache for first few requests, then force refresh
        cacheCheckCountRef.current += 1;
        const allowCache = cacheCheckCountRef.current <= 2; // Allow cache for first 2 checks only

        if (allowCache && globalDocumentCache.has(documentId)) {
            const cachedData = globalDocumentCache.get(documentId);
            const cacheAge = Date.now() - cachedData.loadedAt;
            
            // ✅ CACHE EXPIRY: Only use cache if it's less than 5 seconds old
            if (cacheAge < 5000) {
                console.log('📋 Using fresh cached document data:', documentId.slice(0, 8) + '...', `(${Math.round(cacheAge/1000)}s old)`);
                setDocumentData(cachedData);
                setIsLoading(false);
                loadedRef.current = true;
                return;
            } else {
                console.log('🗑️ Cache expired, removing old data:', documentId.slice(0, 8) + '...', `(${Math.round(cacheAge/1000)}s old)`);
                globalDocumentCache.delete(documentId);
            }
        } else if (!allowCache) {
            console.log('🔄 Forcing fresh load (cache limit reached):', documentId.slice(0, 8) + '...');
            globalDocumentCache.delete(documentId); // Force fresh load
        }

        // ✅ PREVENT CONCURRENT LOADS
        if (documentLoadingFlags.has(documentId)) {
            console.log('⚠️ Document already loading, waiting...', documentId.slice(0, 8) + '...');

            if (documentLoadPromises.has(documentId)) {
                documentLoadPromises.get(documentId).then(data => {
                    setDocumentData(data);
                    setIsLoading(false);
                    loadedRef.current = true;
                }).catch(() => {
                    setIsLoading(false);
                    loadedRef.current = true;
                });
            }
            return;
        }

        // ✅ MARK: Document as loading
        documentLoadingFlags.add(documentId);

        // ✅ FRESH LOAD: Always load fresh data for collaboration consistency
        const loadPromise = (async () => {
            try {
                console.log('🔄 FRESH DOCUMENT LOAD:', documentId.slice(0, 8) + '...', `(attempt #${cacheCheckCountRef.current})`);

                if (!window.electronAPI?.documents?.load) {
                    throw new Error('Electron API not available');
                }

                const result = await window.electronAPI.documents.load(documentId);

                const data = {
                    id: documentId,
                    title: result?.metadata?.title || 'Untitled Document',
                    collaboration: result?.metadata?.collaboration || null,
                    metadata: result?.metadata || null,
                    state: result?.state || null,
                    loadedAt: Date.now()
                };

                console.log('✅ Fresh document data loaded:', {
                    id: documentId.slice(0, 8) + '...',
                    title: data.title,
                    hasCollaboration: !!data.collaboration,
                    hasState: !!data.state,
                    collaborationEnabled: data.collaboration?.enabled,
                    sessionPersistent: data.collaboration?.sessionPersistent,
                    collaborationMode: data.collaboration?.mode
                });

                // ✅ CACHE: Store fresh data
                globalDocumentCache.set(documentId, data);
                return data;
            } catch (error) {
                console.error('❌ Document load failed:', error);

                const fallbackData = {
                    id: documentId,
                    title: 'Untitled Document',
                    collaboration: null,
                    metadata: null,
                    state: null,
                    loadedAt: Date.now(),
                    error: error.message
                };

                globalDocumentCache.set(documentId, fallbackData);
                return fallbackData;
            } finally {
                documentLoadingFlags.delete(documentId);
                documentLoadPromises.delete(documentId);
            }
        })();

        documentLoadPromises.set(documentId, loadPromise);

        loadPromise.then(data => {
            setDocumentData(data);
            setIsLoading(false);
            loadedRef.current = true;
        }).catch(() => {
            setIsLoading(false);
            loadedRef.current = true;
        });

    }, [documentId, isElectron]);

    return {
        documentData,
        isLoading,
        isError: documentData?.error ? true : false,
        isElectron
    };
}

// ✅ ENHANCED: Clear cache and force refresh
export function clearDocumentCache(documentId) {
    if (typeof window === 'undefined') return;

    if (documentId) {
        globalDocumentCache.delete(documentId);
        documentLoadPromises.delete(documentId);
        documentLoadingFlags.delete(documentId);
        
        // ✅ TRIGGER: Force component to reload fresh data
        window.dispatchEvent(new CustomEvent('documentCacheCleared', { 
            detail: { documentId } 
        }));
        
        console.log('🗑️ Cleared document cache and triggered refresh for:', documentId.slice(0, 8) + '...');
    } else {
        globalDocumentCache.clear();
        documentLoadPromises.clear();
        documentLoadingFlags.clear();
        console.log('🗑️ Cleared entire document cache');
    }
}
