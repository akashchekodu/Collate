// app/hooks/useDocumentPersistence.js
"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

// ✅ GLOBAL: Prevent multiple simultaneous saves
const globalSaveQueue = new Map();

export function useDocumentPersistence(ydoc, documentId, title = "Untitled Document", collaborationMetadata = null) {
  const saveTimeoutRef = useRef(null);
  const lastSavedRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [isElectron, setIsElectron] = useState(false);
  const ytextRef = useRef(null);

  console.log('🔄 useDocumentPersistence called:', {
    documentId: documentId?.slice(0, 8) + '...' || 'undefined',
    hasYdoc: !!ydoc,
    timestamp: Date.now(),
    persistenceCallCount: ++window.persistenceCallCount || (window.persistenceCallCount = 1)
  });


  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI?.isElectron);
  }, []);

  // ✅ Fixed: Use consistent field name
  const getYText = useCallback(() => {
    if (!ydoc || !documentId) return null;

    if (!ytextRef.current) {
      try {
        // ✅ Use same field name as editor extensions
        const fieldName = `editor-${documentId}`;

        const existingTypes = ydoc.share;
        if (existingTypes.has(fieldName)) {
          ytextRef.current = existingTypes.get(fieldName);
        } else {
          ytextRef.current = ydoc.getText(fieldName);
        }

        console.log('📝 useDocumentPersistence using Y.Text field:', fieldName);

        // ✅ DEBUG: Check the Y.Text content immediately
        if (ytextRef.current) {
          console.log('🔍 useDocumentPersistence Y.Text debug:', {
            fieldName,
            textLength: ytextRef.current.length,
            textContent: ytextRef.current.toString(),
            textType: typeof ytextRef.current.toString(),
            isYText: ytextRef.current instanceof Y.Text,
            isObjectProblem: ytextRef.current.toString() === '[object Object]'
          });
        }
      } catch (error) {
        console.warn('Failed to get Y.Text instance:', error);
        return null;
      }
    }

    return ytextRef.current;
  }, [ydoc, documentId]);

  const saveDocument = useCallback(async () => {
    if (!ydoc || !documentId || !isElectron) return;

    // ✅ PREVENT: Multiple simultaneous saves for same document
    const saveKey = documentId;
    if (globalSaveQueue.has(saveKey)) {
      console.log('⚠️ Save already in progress for:', documentId.slice(0, 8) + '...');
      return globalSaveQueue.get(saveKey); // Return existing promise
    }

    // ✅ QUEUE: This save operation
    const savePromise = (async () => {
      try {
        setSaveStatus('saving');

        console.log('💾 useDocumentPersistence coordinated save:', {
          documentId: documentId.slice(0, 8) + '...',
          hasCollaborationMetadata: !!collaborationMetadata,
          collaborationMode: collaborationMetadata?.mode,
          sessionPersistent: collaborationMetadata?.sessionPersistent
        });

        // ✅ DEBUG: Check Y.js state before encoding
        const ytext = getYText();
        if (ytext) {
          console.log('🔍 Pre-save Y.Text debug:', {
            textLength: ytext.length,
            textContent: ytext.toString(),
            isObjectProblem: ytext.toString() === '[object Object]'
          });
        }

        const state = Y.encodeStateAsUpdate(ydoc);

        const metadata = {
          title,
          lastSaved: new Date().toISOString(),
          // ✅ NEW: Pass collaboration metadata if provided
          ...(collaborationMetadata && { collaboration: collaborationMetadata })
        };

        console.log('💾 Saving with metadata keys:', Object.keys(metadata));
        console.log('💾 Collaboration metadata preview:', {
          enabled: metadata.collaboration?.enabled,
          mode: metadata.collaboration?.mode,
          sessionPersistent: metadata.collaboration?.sessionPersistent
        });

        const result = await window.electronAPI.documents.save(documentId, Array.from(state), metadata);
        lastSavedRef.current = Date.now();
        setSaveStatus('saved');

        console.log('💾 useDocumentPersistence save completed successfully');
        return result;
      } catch (error) {
        console.error('❌ useDocumentPersistence save failed:', error);
        setSaveStatus('error');
        throw error;
      } finally {
        // ✅ CLEANUP: Remove from queue when done
        globalSaveQueue.delete(saveKey);
      }
    })();

    globalSaveQueue.set(saveKey, savePromise);
    return savePromise;
  }, [ydoc, documentId, title, isElectron, collaborationMetadata, getYText]);

  const debouncedSave = useCallback(() => {
    if (!isElectron) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument();
    }, 2000);
  }, [saveDocument, isElectron]);

  const loadDocument = useCallback(async () => {
    if (!documentId || !isElectron) return null;

    console.log('🔄 useDocumentPersistence.loadDocument called:', {
      documentId: documentId.slice(0, 8) + '...',
      isElectron
    });

    try {
      console.log('📖 PERSISTENCE LOAD: Calling electronAPI.documents.load');
      const result = await window.electronAPI.documents.load(documentId);
      if (result && result.state) {
        console.log('📖 Document loaded from storage:', documentId);
        return {
          state: result.state,
          metadata: result.metadata
        };
      }
    } catch (error) {
      console.error('❌ Failed to load document:', error);
    }
    return null;
  }, [documentId, isElectron]);

  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveDocument();
  }, [saveDocument]);

  // ✅ Enhanced: Set up auto-save with proper Y.js event handling
  useEffect(() => {
    if (!ydoc || !isElectron || !documentId) return;

    const ytext = getYText();
    if (!ytext) {
      console.warn('❌ No Y.Text instance available for auto-save');
      return;
    }

    // ✅ Fixed: Proper Y.js event handling
    const onChange = (event) => {
      console.log('📝 Y.Text changed, scheduling save...', {
        deltaLength: event.delta?.length || 0,
        deltaPreview: event.delta?.slice(0, 2) || 'no delta', // ✅ Safe access
        contentLength: ytext.toString().length,
        transaction: event.transaction?.origin || 'local',
        // ✅ DEBUG: Check for object problem during changes
        isObjectProblem: ytext.toString() === '[object Object]'
      });

      // ✅ CRITICAL: If we detect [object Object] during change, investigate
      if (ytext.toString() === '[object Object]') {
        console.error('🚨 CRITICAL: [object Object] detected during Y.Text change!');
        console.error('🔍 Change event details:', {
          delta: event.delta,
          transaction: event.transaction,
          origin: event.transaction?.origin,
          local: event.transaction?.local
        });
      }

      debouncedSave();
    };

    console.log('📝 Setting up Y.Text observer for auto-save');
    ytext.observe(onChange);

    return () => {
      try {
        ytext.unobserve(onChange);
        console.log('📝 Y.Text observer removed for auto-save');
      } catch (error) {
        console.warn('Error unobserving Y.Text:', error);
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [ydoc, documentId, debouncedSave, isElectron, getYText]);

  // Save on page unload
  useEffect(() => {
    if (!isElectron) return;

    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveDocument();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveDocument, isElectron]);

  // Clean up ytext reference when dependencies change
  useEffect(() => {
    ytextRef.current = null;
  }, [ydoc, documentId]);

  return {
    saveDocument: forceSave,
    loadDocument,
    saveStatus,
    lastSaved: lastSavedRef.current,
    isElectron
  };
}
