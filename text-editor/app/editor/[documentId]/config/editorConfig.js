import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import Placeholder from "@tiptap/extension-placeholder"

export function createEditorExtensions(ydoc, provider, roomName, cursorsEnabled = true) {
  const extensions = [
    StarterKit.configure({
      history: false,
      paragraph: {
        HTMLAttributes: {
          class: "editor-paragraph",
        },
      },
    }),
    Collaboration.configure({
      document: ydoc,
      field: `editor-${roomName}`,
    }),
    Placeholder.configure({
      placeholder: "Start writing — changes are shared in real time",
    }),
  ]

  // Only add CollaborationCaret if explicitly enabled and provider is ready
  if (cursorsEnabled && provider && provider.connected) {
    extensions.push(
      CollaborationCaret.configure({
        provider,
        render: (user) => {
          try {
            const cursor = document.createElement("span")
            cursor.classList.add("collaboration-cursor__caret")
            cursor.setAttribute(
              "style",
              `border-color: ${user.color || "#000"}; background-color: ${user.color || "#000"};`,
            )

            const label = document.createElement("div")
            label.classList.add("collaboration-cursor__label")
            label.setAttribute("style", `background-color: ${user.color || "#000"}; color: white;`)
            label.insertBefore(document.createTextNode(user.name || "Anonymous"), null)
            cursor.insertBefore(label, null)

            return cursor
          } catch (err) {
            console.warn("Error rendering cursor:", err)
            return document.createElement("span")
          }
        },
      }),
    )
  }

  return extensions
}

export const editorProps = {
  attributes: {
    class: "prose prose-lg max-w-none focus:outline-none min-h-[400px] p-4",
    spellcheck: "false",
    style: "user-select: text; -webkit-user-select: text; -moz-user-select: text;",
  },
}

export const editorCallbacks = {
  onCreate: ({ editor }) => {
    console.log("Editor created")
  },
  onUpdate: ({ editor, transaction }) => {
    if (transaction.docChanged) {
      if (Date.now() % 100 < 10) {
        console.log("Document updated via CRDT")
      }
    }
  },
  onDestroy: () => {
    console.log("Editor destroyed")
  },
}
