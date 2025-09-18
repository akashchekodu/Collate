// app/editor/[documentId]/config/editorConfig.js
import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Placeholder from "@tiptap/extension-placeholder"

export function createEditorExtensions(ydoc, provider, roomName, cursorsEnabled = true) {
  if (!ydoc) {
    console.warn('⚠️ No Y.Doc provided to createEditorExtensions');
    return [StarterKit];
  }

  const fieldName = `editor-${roomName}`;
  console.log('📝 TipTap using field name:', fieldName);

  const extensions = [
    StarterKit.configure({
      history: false, // ✅ Critical: Disable for collaboration
      // Ensure all formatting is enabled
      bold: {},
      italic: {},
      strike: {},
      code: {},
      bulletList: {},
      orderedList: {},
      listItem: {},
      blockquote: {},
      codeBlock: {},
      heading: { levels: [1, 2, 3] },
      paragraph: {},
    }),
    
    // ✅ Critical: Proper Collaboration setup
    Collaboration.configure({
      document: ydoc,
      field: fieldName, // Use exact same field name
    }),
    
    Placeholder.configure({
      placeholder: "Start writing — changes are shared in real time",
    }),
  ]

  // Add collaboration cursors if enabled
  if (cursorsEnabled && provider && provider.connected) {
    extensions.push(
      CollaborationCaret.configure({
        provider,
        render: (user) => {
          const cursor = document.createElement("span")
          cursor.classList.add("collaboration-cursor__caret")
          cursor.setAttribute("style", `border-color: ${user.color || "#000"};`)
          return cursor
        },
      }),
    )
  }

  console.log('📋 Created extensions:', extensions.length);
  return extensions
}

export const editorProps = {
  attributes: {
    class: "prose-editor-content",
    spellcheck: "false",
  },
}

export const editorCallbacks = {
  onCreate: ({ editor }) => {
    console.log("✅ TipTap editor created");
    
    // ✅ Debug: Check initial content sync
    setTimeout(() => {
      const content = editor.getText();
      console.log('📝 Initial editor content length:', content.length);
    }, 100);
  },
  
  onUpdate: ({ editor, transaction }) => {
    if (transaction.docChanged) {
      console.log("📝 TipTap content updated");
      
      // ✅ Debug: Log content changes
      const content = editor.getText();
      console.log('📊 Updated content length:', content.length);
      console.log('📄 Content preview:', content.slice(0, 50));
    }
  },
  
  onDestroy: () => {
    console.log("❌ TipTap editor destroyed");
  },
}
