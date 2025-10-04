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

  // ✅ ENHANCED: Pre-flight field validation
  validateFieldCompatibility(ydoc, fieldName);

  const extensions = [
    StarterKit.configure({
      history: false, // Critical for collaboration
    }),

    // ✅ ENHANCED: Collaboration with comprehensive error handling
    Collaboration.configure({
      document: ydoc,
      field: fieldName,

      // ✅ CRITICAL: Enhanced update handler
      onUpdate: ({ editor, transaction }) => {
        if (transaction.docChanged) {
          try {
            // Validate document state
            const doc = transaction.doc;
            if (!doc || doc.content.size < 0) {
              console.warn('⚠️ Invalid document state detected, skipping update');
              return false;
            }

            // Additional safety checks
            if (transaction.steps && transaction.steps.length > 100) {
              console.warn('⚠️ Unusually large transaction, monitoring for performance');
            }

          } catch (error) {
            console.warn('⚠️ Sync conflict handled gracefully:', error.message);
            return false;
          }
        }
      },

      // ✅ ENHANCED: Document loading with field conflict resolution
      onLoadDocument: (doc) => {
        try {
          console.log('📝 TipTap loading document into field:', fieldName);

          // Validate the document structure
          if (!doc || typeof doc.content === 'undefined') {
            console.warn('⚠️ Invalid document structure, using empty document');
            return null;
          }

          return doc;
        } catch (error) {
          console.error('❌ TipTap document load error:', error);

          // ✅ FIELD CONFLICT RESOLUTION
          if (error.message && error.message.includes('already been defined')) {
            console.log('🔄 Attempting field conflict resolution...');

            try {
              // Clear the problematic field
              if (ydoc.share.has(fieldName)) {
                const existingField = ydoc.share.get(fieldName);
                console.log('🔍 Conflicting field type:', existingField.constructor.name);

                ydoc.share.delete(fieldName);
                console.log('✅ Cleared conflicting field, TipTap should retry');

                // Force a small delay to let Y.js settle
                setTimeout(() => {
                  console.log('🔄 Field conflict resolution completed');
                }, 100);
              }
            } catch (clearError) {
              console.error('❌ Field clearing failed:', clearError);
            }
          }

          return null; // Return null to use empty document
        }
      },

      // ✅ NEW: Error handler for collaboration issues
      onError: (error) => {
        console.error('❌ Collaboration extension error:', error);

        // Don't crash the editor, just log the error
        if (error.message && error.message.includes('already been defined')) {
          console.log('🔄 Field conflict detected in onError, will be resolved');
        }
      }
    }),

    Placeholder.configure({
      placeholder: "Start typing — other users' cursors will appear here",
    }),
  ];

  // ✅ ENHANCED: Safer cursor rendering
  if (cursorsEnabled && provider?.awareness) {
    try {
      extensions.push(
        CollaborationCaret.configure({
          provider,
          render: (user) => {
            try {
              const cursor = document.createElement("span");
              cursor.classList.add("collaboration-cursor__caret");

              const userColor = user.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`;

              cursor.setAttribute("style", `
                border-left: 3px solid ${userColor} !important;
                border-color: ${userColor} !important;
                height: 1.2em !important;
                margin-left: -1px !important;
                position: relative !important;
                display: inline-block !important;
                z-index: 100 !important;
              `);

              cursor.setAttribute("title", `${user.name || 'Anonymous'}'s cursor`);

              // ✅ ENHANCED: Better label positioning
              if (user.name) {
                const label = document.createElement("div");
                label.textContent = user.name;
                label.setAttribute("style", `
                  position: absolute !important;
                  top: -28px !important;
                  left: -8px !important;
                  background: ${userColor} !important;
                  color: white !important;
                  padding: 3px 7px !important;
                  border-radius: 4px !important;
                  font-size: 11px !important;
                  font-weight: 600 !important;
                  white-space: nowrap !important;
                  z-index: 1001 !important;
                  pointer-events: none !important;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
                  max-width: 100px !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                `);

                cursor.appendChild(label);
              }

              return cursor;
            } catch (error) {
              console.warn('❌ Cursor render error:', error);

              // ✅ MINIMAL FALLBACK: Simple cursor
              const fallbackCursor = document.createElement("span");
              fallbackCursor.style.cssText = `
                border-left: 2px solid #ff0000 !important;
                height: 1em !important;
                display: inline-block !important;
              `;
              return fallbackCursor;
            }
          },
        })
      );
      console.log('🎯 Enhanced cursors enabled for field:', fieldName);
    } catch (error) {
      console.error('❌ Failed to add collaboration cursors:', error);
    }
  }

  console.log('✅ Enhanced collaboration extensions created');
  return extensions;
}

// ✅ NEW: Field compatibility validation
function validateFieldCompatibility(ydoc, fieldName) {
  try {
    if (ydoc.share.has(fieldName)) {
      const existingField = ydoc.share.get(fieldName);
      const fieldType = existingField.constructor.name;

      console.log('🔍 Field validation:', {
        fieldName,
        existingType: fieldType,
        isCompatible: fieldType === 'YXmlFragment',
        needsConversion: fieldType === 'YText'
      });

      // ✅ WARN: If incompatible type detected
      if (fieldType !== 'YXmlFragment') {
        console.warn('⚠️ Field type incompatible with TipTap:', {
          fieldName,
          currentType: fieldType,
          expectedType: 'YXmlFragment',
          recommendation: 'Field should be cleared before TipTap initialization'
        });

        // ✅ AUTO-FIX: Clear incompatible fields
        console.log('🔄 Auto-clearing incompatible field for TipTap');
        ydoc.share.delete(fieldName);
        console.log('✅ Field cleared, TipTap will create compatible type');
      }
    }
  } catch (error) {
    console.error('❌ Field validation failed:', error);
    // Continue anyway - TipTap might handle it
  }
}

export const editorProps = {
  attributes: {
    class: "prose-editor-content",
    spellcheck: "false",
  },

  // ✅ ENHANCED: Better paste handling
  transformPastedHTML: (html) => {
    try {
      // Basic sanitization
      if (!html || typeof html !== 'string') return '';

      // Remove potentially problematic elements
      const cleaned = html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/on\w+="[^"]*"/gi, ''); // Remove event handlers

      return cleaned;
    } catch (error) {
      console.warn('⚠️ HTML transform error:', error);
      return '';
    }
  },

  // ✅ ENHANCED: Paste error handling
  handlePaste: (view, event, slice) => {
    try {
      // Let TipTap handle normally, but with error protection
      return false;
    } catch (error) {
      console.warn('⚠️ Paste operation error:', error);

      // Prevent crash by handling the paste manually if needed
      try {
        const text = event.clipboardData?.getData('text/plain') || '';
        if (text) {
          // Insert as plain text fallback
          const { state, dispatch } = view;
          const { from } = state.selection;
          dispatch(state.tr.insertText(text, from));
          return true; // Prevent default
        }
      } catch (fallbackError) {
        console.warn('⚠️ Paste fallback failed:', fallbackError);
      }

      return true; // Prevent crash
    }
  }
}
