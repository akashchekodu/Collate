// app/editor/[documentId]/hooks/useStableDocumentData.js
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

    // ✅ IMMEDIATE ELECTRON CHECK: Check immediately, don't wait for useEffect
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
    }

    useEffect(() => {
        // ✅ SSR SAFETY: Only run on client side
        if (typeof window === 'undefined') return;

        if (!documentId || loadedRef.current) return;

        // ✅ WAIT FOR ELECTRON CHECK: Don't proceed until we know if Electron is available
        if (isElectron === false && typeof window.electronAPI !== 'undefined') {
            // Still checking, wait a bit more
            setTimeout(() => {
                const stillChecking = typeof window.electronAPI !== 'undefined' && !window.electronAPI?.isElectron;
                if (!stillChecking) {
                    setIsElectron(!!window.electronAPI?.isElectron);
                }
            }, 100);
            return;
        }

        // ✅ ELECTRON CHECK: Only proceed if Electron is available OR we're certain it's not
        if (!isElectron && typeof window !== 'undefined') {
            // Double-check for Electron API
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
                // Found Electron API, update state
                setIsElectron(true);
            }
        }

        // ✅ PREVENT LOOPS: Check if already cached
        if (globalDocumentCache.has(documentId)) {
            const cachedData = globalDocumentCache.get(documentId);
            console.log('📋 Using cached document data:', documentId.slice(0, 8) + '...');
            setDocumentData(cachedData);
            setIsLoading(false);
            loadedRef.current = true;
            return;
        }

        // ✅ PREVENT CONCURRENT LOADS: Check if already loading
        if (documentLoadingFlags.has(documentId)) {
            console.log('⚠️ Document already loading, waiting...', documentId.slice(0, 8) + '...');

            // Wait for the existing load
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

        // ✅ SINGLE LOAD: Load document once and cache
        const loadPromise = (async () => {
            try {
                console.log('🔄 STABLE DOCUMENT LOAD:', documentId.slice(0, 8) + '...');

                // ✅ SAFETY: Double check Electron API availability
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

                console.log('✅ Document data loaded:', {
                    id: documentId.slice(0, 8) + '...',
                    title: data.title,
                    hasCollaboration: !!data.collaboration,
                    hasState: !!data.state,
                    collaborationEnabled: data.collaboration?.enabled,
                    sessionPersistent: data.collaboration?.sessionPersistent
                });

                // ✅ CACHE: Store for future use
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
                // ✅ CLEANUP: Remove loading flags
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

// ✅ UTILITY: Clear cache when needed (Client-side only)
export function clearDocumentCache(documentId) {
    if (typeof window === 'undefined') return;

    if (documentId) {
        globalDocumentCache.delete(documentId);
        documentLoadPromises.delete(documentId);
        documentLoadingFlags.delete(documentId);
        console.log('🗑️ Cleared document cache for:', documentId.slice(0, 8) + '...');
    } else {
        globalDocumentCache.clear();
        documentLoadPromises.clear();
        documentLoadingFlags.clear();
        console.log('🗑️ Cleared entire document cache');
    }
}
