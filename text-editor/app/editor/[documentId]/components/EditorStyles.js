// app/editor/[documentId]/components/EditorStyles.js
"use client";

export default function EditorStyles() {
  return (
    <style jsx global>{`
      .ProseMirror {
        outline: none;
        padding: 1.5rem;
        min-height: 500px;
        line-height: 1.6;
        font-size: 16px;
      }

      .ProseMirror p {
        margin: 0.75rem 0;
      }

      .ProseMirror p:first-child {
        margin-top: 0;
      }

      .ProseMirror p:last-child {
        margin-bottom: 0;
      }

      /* List Styling */
      .ProseMirror ul {
        list-style-type: disc;
        margin: 1rem 0;
        padding-left: 1.5rem;
      }

      .ProseMirror ol {
        list-style-type: decimal;
        margin: 1rem 0;
        padding-left: 1.5rem;
      }

      .ProseMirror li {
        margin: 0.25rem 0;
        padding-left: 0.25rem;
      }

      .ProseMirror li p {
        margin: 0;
      }

      /* Heading Styling */
      .ProseMirror h1 {
        font-size: 2rem;
        font-weight: bold;
        margin: 1.5rem 0 0.75rem 0;
      }

      .ProseMirror h2 {
        font-size: 1.5rem;
        font-weight: bold;
        margin: 1.25rem 0 0.5rem 0;
      }

      .ProseMirror h3 {
        font-size: 1.25rem;
        font-weight: bold;
        margin: 1rem 0 0.5rem 0;
      }

      /* Blockquote Styling */
      .ProseMirror blockquote {
        border-left: 3px solid #ddd;
        margin: 1rem 0;
        padding-left: 1rem;
        color: #666;
        font-style: italic;
      }

      /* Code Block Styling */
      .ProseMirror pre {
        background: #f5f5f5;
        border-radius: 4px;
        margin: 1rem 0;
        padding: 1rem;
        overflow-x: auto;
      }

      .ProseMirror code {
        background: #f5f5f5;
        border-radius: 2px;
        padding: 0.2rem 0.4rem;
        font-family: 'Monaco', 'Consolas', monospace;
      }

      /* Collaboration Cursors */
      .collaboration-cursor__caret {
        position: relative;
        margin-left: -1px;
        margin-right: -1px;
        border-left: 2px solid;
        border-right: 2px solid;
        word-break: normal;
        pointer-events: none;
        animation: cursor-blink 1.5s ease-in-out infinite alternate;
      }
      
      .collaboration-cursor__label {
        position: absolute;
        top: -2.2em;
        left: -1px;
        font-size: 11px;
        font-weight: 600;
        font-style: normal;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1;
        user-select: none;
        color: white;
        padding: 3px 6px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transform: translateY(-2px);
        opacity: 0.95;
      }
      
      @keyframes cursor-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
    `}</style>
  );
}
