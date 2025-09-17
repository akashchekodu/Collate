// app/editor/[documentId]/hooks/useCollaboration.js
import { useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { createEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig";

export function useCollaboration(ydoc, provider, roomName) {
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, roomName),
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
    onSelectionUpdate: ({ editor }) => {
    if (provider?.awareness) {
        try {
        const { from, to } = editor.state.selection;
        const docSize = editor.state.doc.content.size;
        
        // Validate and clamp positions to valid ranges
        const safeFrom = Math.max(0, Math.min(from, docSize));
        const safeTo = Math.max(0, Math.min(to, docSize));
        
        provider.awareness.setLocalStateField('cursor', {
            anchor: safeFrom,
            head: safeTo,
            timestamp: Date.now()
        });
        } catch (error) {
        console.warn('Cursor position update failed, skipping:', error);
        // Don't propagate cursor position if it fails
        }
    }
    }
  }, [ydoc, provider]);

  // Y.js event listeners for debugging
  useEffect(() => {
    if (!ydoc) return;
    
    let ytext;
    try {
      const fieldName = `editor-${roomName}`;
      ytext = ydoc.getText(fieldName);
    } catch (error) {
      console.warn('Y.js getText error:', error);
      return;
    }
    
    const onYTextChange = (event) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Y.Text changed:', {
          delta: event.delta,
          target: event.target.toString().substring(0, 100) + '...'
        });
      }
    };
    
    ytext.observe(onYTextChange);
    
    return () => {
      try {
        ytext.unobserve(onYTextChange);
      } catch (error) {
        console.warn('Error unobserving Y.Text:', error);
      }
    };
  }, [ydoc, roomName]);

  return editor;
}
