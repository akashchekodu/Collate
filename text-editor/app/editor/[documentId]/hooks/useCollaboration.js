// app/editor/[documentId]/hooks/useCollaboration.js
"use client"
import { useEditor } from "@tiptap/react"
import { useEffect } from "react"
import { createEditorExtensions, editorProps, editorCallbacks } from "../config/editorConfig"

export function useCollaboration(ydoc, provider, roomName) {
  const editor = useEditor({
    extensions: createEditorExtensions(ydoc, provider, roomName),
    immediatelyRender: false,
    editorProps,
    ...editorCallbacks,
    onSelectionUpdate: ({ editor }) => {
      if (provider?.awareness && ydoc) {
        try {
          const { from, to } = editor.state.selection
          const docSize = editor.state.doc.content.size

          const safeFrom = Math.max(0, Math.min(from, docSize))
          const safeTo = Math.max(0, Math.min(to, docSize))

          provider.awareness.setLocalStateField("cursor", {
            anchor: safeFrom,
            head: safeTo,
            timestamp: Date.now(),
          })
        } catch (error) {
          console.warn("Cursor position update failed:", error)
        }
      }
    },
  }) // Remove dependencies to prevent editor recreation

  // Y.js event listeners
  useEffect(() => {
    if (!ydoc || !editor) return

    try {
      const fieldName = `editor-${roomName}`
      const ytext = ydoc.getText(fieldName)

      const onYTextChange = (event) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Y.Text changed:", event.delta)
        }
      }

      ytext.observe(onYTextChange)

      return () => {
        try {
          ytext.unobserve(onYTextChange)
        } catch (error) {
          console.warn("Error unobserving Y.Text:", error)
        }
      }
    } catch (error) {
      console.warn("Y.js getText error:", error)
    }
  }, [ydoc, editor, roomName])

  return editor
}
