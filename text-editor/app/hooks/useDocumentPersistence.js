// app/hooks/useDocumentPersistence.js
"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

export function useDocumentPersistence(ydoc, documentId, title = "Untitled Document") {
  const saveTimeoutRef = useRef(null);
  const lastSavedRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [isElectron, setIsElectron] = useState(false);
  const ytextRef = useRef(null);

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
        
        console.log('📝 Using Y.Text field:', fieldName);
      } catch (error) {
        console.warn('Failed to get Y.Text instance:', error);
        return null;
      }
    }
    
    return ytextRef.current;
  }, [ydoc, documentId]);

  const saveDocument = useCallback(async () => {
    if (!ydoc || !documentId || !isElectron) return;

    try {
      setSaveStatus('saving');
      
      // ✅ Debug: Log content before saving
      const ytext = getYText();
      if (ytext) {
        const currentText = ytext.toString();
        console.log('💾 Saving content preview:', currentText.slice(0, 100) + '...');
        console.log('💾 Content length:', currentText.length);
      }
      
      const state = Y.encodeStateAsUpdate(ydoc);
      const metadata = {
        title,
        lastSaved: new Date().toISOString()
      };

      await window.electronAPI.documents.save(documentId, Array.from(state), metadata);
      lastSavedRef.current = Date.now();
      setSaveStatus('saved');
      
      console.log('💾 Document auto-saved:', documentId);
    } catch (error) {
      console.error('❌ Failed to save document:', error);
      setSaveStatus('error');
    }
  }, [ydoc, documentId, title, isElectron, getYText]);

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
    console.log('📖 WAAAAAAAAAATTTTTTTTTTTTTTTTTT', documentId);
    try {
      const result = await window.electronAPI.documents.loadById(documentId);
      console.log('📖 GOOOOOOOOOOOOOOOO Load result:', result);
      if (result) {
        console.log('📖 Document loaded from storage:', documentId);
        return {
          metadata: result.metadata,
          streamUrl: result.streamUrl
        };
      }
    } catch (error) {
      console.error('❌ Failed to load document:', error);
    }
  }, [documentId, isElectron]);

  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveDocument();
  }, [saveDocument]);

  // ✅ Enhanced: Set up auto-save with better debugging
// app/hooks/useDocumentPersistence.js
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
    // event.delta is the array of changes
    console.log('📝 Y.Text changed, scheduling save...', { 
      deltaLength: event.delta.length,
      deltaPreview: event.delta.slice(0, 2), // ✅ Now works correctly
      contentLength: ytext.toString().length,
      transaction: event.transaction?.origin || 'local'
    });
    debouncedSave();
  };

  ytext.observe(onChange);

  return () => {
    try {
      ytext.unobserve(onChange);
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
