// EditorToolbar.js

"use client";
import { Bold, Italic, Undo, Redo } from "lucide-react";

export default function EditorToolbar({ editor }) {
  if (!editor) return null;

  const buttonBase =
    "p-2 rounded-lg hover:bg-gray-100 transition text-gray-600";
  const activeClass = "bg-gray-200 text-gray-900";

  return (
    <div className="flex items-center gap-2 border-b pb-2 mb-2">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${buttonBase} ${editor.isActive("bold") ? activeClass : ""}`}
      >
        <Bold size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${buttonBase} ${
          editor.isActive("italic") ? activeClass : ""
        }`}
      >
        <Italic size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().undo().run()}
        className={buttonBase}
      >
        <Undo size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        className={buttonBase}
      >
        <Redo size={18} />
      </button>
    </div>
  );
}
