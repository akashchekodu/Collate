// Editorheader.js

"use client";
import { useState } from "react";
import { Share2, Download } from "lucide-react";

export default function EditorHeader({ documentId }) {
  const [title, setTitle] = useState("Untitled Document");

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
      {/* Left side: Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-lg font-semibold border-none focus:outline-none bg-transparent"
      />

      {/* Right side: Buttons */}
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow">
          <Share2 size={16} />
          Share
        </button>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-200 rounded-lg hover:bg-gray-300">
          <Download size={16} />
          Export
        </button>
      </div>
    </header>
  );
}
