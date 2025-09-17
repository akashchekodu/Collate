"use client";

export default function EditorStyles() {
  return (
    <style jsx global>{`
      .ProseMirror {
        background-color: #111827;
        color: #f9fafb;
        padding: 2rem;
        min-height: 500px;
        outline: none;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 16px;
        line-height: 1.7;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .ProseMirror h1 {
        font-size: 2.25rem;
        font-weight: 700;
        color: #ffffff;
        margin: 2rem 0 1rem 0;
        line-height: 1.2;
      }

      .ProseMirror h2 {
        font-size: 1.875rem;
        font-weight: 600;
        color: #ffffff;
        margin: 1.5rem 0 0.75rem 0;
        line-height: 1.3;
      }

      .ProseMirror h3 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #ffffff;
        margin: 1.25rem 0 0.5rem 0;
        line-height: 1.4;
      }

      .ProseMirror p {
        margin: 0.75rem 0;
        color: #e5e7eb;
      }

      .ProseMirror p:first-child {
        margin-top: 0;
      }

      .ProseMirror p:last-child {
        margin-bottom: 0;
      }

      .ProseMirror strong {
        color: #ffffff;
        font-weight: 600;
      }

      .ProseMirror em {
        color: #d1d5db;
        font-style: italic;
      }

      .ProseMirror s {
        color: #9ca3af;
      }

      .ProseMirror code {
        background-color: #374151;
        color: #fbbf24;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
        font-size: 0.875rem;
      }

      .ProseMirror pre {
        background-color: #1f2937;
        color: #e5e7eb;
        padding: 1.5rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 1.5rem 0;
        border: 1px solid #374151;
      }

      .ProseMirror pre code {
        background: none;
        color: inherit;
        padding: 0;
        font-size: 0.875rem;
      }

      .ProseMirror blockquote {
        border-left: 4px solid #3b82f6;
        background-color: #1e293b;
        margin: 1.5rem 0;
        padding: 1rem 1.5rem;
        border-radius: 0 0.5rem 0.5rem 0;
        color: #cbd5e1;
        font-style: italic;
      }

      .ProseMirror ul, .ProseMirror ol {
        padding-left: 1.5rem;
        margin: 0.75rem 0;
      }

      .ProseMirror li {
        margin: 0.5rem 0;
        color: #e5e7eb;
      }

      .ProseMirror ul li {
        list-style-type: disc;
      }

      .ProseMirror ol li {
        list-style-type: decimal;
      }

      /* Collaboration cursors */
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
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transform: translateY(-2px);
        opacity: 0.95;
      }
      
      .collaboration-cursor__label::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: inherit;
      }
      
      @keyframes cursor-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.4; }
      }

      /* Placeholder styling */
      .ProseMirror .is-editor-empty:first-child::before {
        color: #6b7280;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
        font-style: italic;
      }

      /* Selection styling */
      .ProseMirror ::selection {
        background-color: #3b82f6;
        color: white;
      }

      /* Scrollbar styling */
      .scrollbar-thin {
        scrollbar-width: thin;
      }

      .scrollbar-thumb-gray-600::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      .scrollbar-thumb-gray-600::-webkit-scrollbar-track {
        background: transparent;
      }

      .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
        background-color: #4b5563;
        border-radius: 3px;
      }

      .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb:hover {
        background-color: #6b7280;
      }
    `}</style>
  );
}
