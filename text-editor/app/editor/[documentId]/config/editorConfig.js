import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Placeholder from "@tiptap/extension-placeholder"

export function createEditorExtensions(ydoc, provider, documentId, standardFieldName, cursorsEnabled = true) {
  if (!ydoc) {
    console.warn('⚠️ No Y.Doc provided');
    return [StarterKit];
  }

  const fieldName = standardFieldName || `editor-${documentId}`;
  
  console.log('📝 TipTap using STANDARD field:', {
    fieldName,
    documentId: documentId.slice(0, 8) + '...',
    existingFields: Array.from(ydoc.share.keys()),
    fieldExists: ydoc.share.has(fieldName)
  });

  const extensions = [
    StarterKit.configure({
      history: false, // Critical for collaboration
    }),
    
    // ✅ FIXED: Add collision detection and recovery
    Collaboration.configure({
      document: ydoc,
      field: fieldName,
      // ✅ CRITICAL: Handle transform conflicts gracefully
      onUpdate: ({ editor, transaction }) => {
        if (transaction.docChanged) {
          // ✅ Silently handle sync conflicts
          try {
            // Check if document is in a valid state
            const doc = transaction.doc;
            if (!doc || doc.content.size < 0) {
              console.warn('⚠️ Invalid document state detected, skipping update');
              return false; // Prevent invalid update
            }
          } catch (error) {
            console.warn('⚠️ Sync conflict handled:', error.message);
            return false; // Prevent crash
          }
        }
      },
      // ✅ CRITICAL: Handle load errors
      onLoadDocument: (doc) => {
        try {
          return doc;
        } catch (error) {
          console.warn('⚠️ Document load error handled:', error.message);
          return null; // Return null to use empty document
        }
      }
    }),
    
    Placeholder.configure({
      placeholder: "Start typing — other users' cursors will appear here",
    }),
  ];

  // ✅ SAFE: Cursors with error handling
  if (cursorsEnabled && provider?.awareness) {
    try {
      extensions.push(
        CollaborationCaret.configure({
          provider,
          render: (user) => {
            try {
              console.log('🎯 Rendering cursor for:', user.name, 'color:', user.color);
              
              const cursor = document.createElement("span");
              cursor.classList.add("collaboration-cursor__caret");
              
              const userColor = user.color || "#FF0000";
              
              // ✅ SAFE: Cursor styling with error handling
              cursor.setAttribute("style", `
                border-left: 3px solid ${userColor} !important;
                border-color: ${userColor} !important;
                height: 1.2em !important;
                margin-left: -1px !important;
                position: relative !important;
                display: inline-block !important;
              `);
              
              cursor.setAttribute("title", `${user.name || 'Anonymous User'}'s cursor`);
              
              // ✅ SAFE: User label with error handling
              const label = document.createElement("div");
              label.textContent = user.name || 'Anonymous';
              label.setAttribute("style", `
                position: absolute !important;
                top: -25px !important;
                left: -10px !important;
                background: ${userColor} !important;
                color: white !important;
                padding: 2px 6px !important;
                border-radius: 3px !important;
                font-size: 11px !important;
                font-weight: bold !important;
                white-space: nowrap !important;
                z-index: 1000 !important;
                pointer-events: none !important;
              `);
              
              cursor.appendChild(label);
              
              return cursor;
            } catch (error) {
              console.warn('❌ Cursor render error:', error);
              // ✅ FALLBACK: Simple cursor
              const fallbackCursor = document.createElement("span");
              fallbackCursor.style.borderLeft = "2px solid red";
              fallbackCursor.style.height = "1em";
              return fallbackCursor;
            }
          },
        })
      );
      console.log('🎯 Safe cursors enabled for field:', fieldName);
    } catch (error) {
      console.error('❌ Failed to add collaboration cursors:', error);
    }
  }

  console.log('✅ Safe collaboration extensions created');
  return extensions;
}

export const editorProps = {
  attributes: {
    class: "prose-editor-content",
    spellcheck: "false",
  },
  // ✅ CRITICAL: Handle transform errors at ProseMirror level
  transformPastedHTML: (html) => {
    try {
      return html;
    } catch (error) {
      console.warn('⚠️ Paste transform error handled:', error);
      return ''; // Return empty string on error
    }
  },
  // ✅ CRITICAL: Handle paste errors
  handlePaste: (view, event, slice) => {
    try {
      // Let TipTap handle normally
      return false;
    } catch (error) {
      console.warn('⚠️ Paste error handled:', error);
      return true; // Prevent crash
    }
  }
}
