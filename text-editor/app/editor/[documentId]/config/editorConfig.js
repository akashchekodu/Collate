// app/editor/[documentId]/config/editorConfig.js

import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Placeholder from "@tiptap/extension-placeholder"

// ------------------------------------------------------
// 1) Collaborative extensions (Y.js enabled)
// ------------------------------------------------------
export function createEditorExtensions(
  ydoc,
  provider,
  roomName,
  cursorsEnabled = true
) {
  if (!ydoc) {
    console.warn("⚠️ No Y.Doc provided to createEditorExtensions")
    return [
      StarterKit.configure({
        history: false,
      }),
    ]
  }

  const fieldName = `editor-${roomName}`
  console.log("📝 TipTap using field name:", fieldName)

  const extensions = [
    StarterKit.configure({
      history: false, // Disable built-in history when using CRDT
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
    Collaboration.configure({
      document: ydoc,
      field: fieldName,
    }),
    Placeholder.configure({
      placeholder: "Start writing — changes are shared in real time",
    }),
  ]

  if (cursorsEnabled && provider?.connected) {
    extensions.push(
      CollaborationCaret.configure({
        provider,
        render: (user) => {
          const cursor = document.createElement("span")
          cursor.classList.add("collaboration-cursor__caret")
          cursor.setAttribute("style", `border-color:${user.color};`)
          return cursor
        },
      })
    )
  }

  console.log("📋 Created extensions:", extensions.length)
  return extensions
}

// ------------------------------------------------------
// 2) Solo extensions (no Y.js)
// ------------------------------------------------------
export function createSoloEditorExtensions() {
  return [
    StarterKit.configure({
      history: true, // Enable built-in history in solo mode
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
    Placeholder.configure({
      placeholder: "Start writing — solo mode",
    }),
    // No Collaboration or CollaborationCaret here
  ]
}

// ------------------------------------------------------
// 3) Shared editor props & callbacks
// ------------------------------------------------------
export const editorProps = {
  attributes: {
    class: "prose-editor-content",
    spellcheck: "false",
  },
}

export const editorCallbacks = {
  onCreate: ({ editor }) => {
    console.log("✅ TipTap editor created")
    setTimeout(() => {
      const content = editor.getText()
      console.log("📝 Initial content length:", content.length)
    }, 100)
  },

  onUpdate: ({ editor, transaction }) => {
    if (transaction.docChanged) {
      console.log("📝 TipTap content updated")
      const content = editor.getText()
      console.log("📊 Updated length:", content.length)
      console.log("📄 Preview:", content.slice(0, 50))
    }
  },

  onDestroy: () => {
    console.log("❌ TipTap editor destroyed")
  },
}
