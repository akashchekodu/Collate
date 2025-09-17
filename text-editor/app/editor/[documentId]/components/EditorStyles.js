// app/editor/[documentId]/components/EditorStyles.js
"use client";

export default function EditorStyles() {
  return (
    <style jsx global>{`
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
        51%, 100% { opacity: 0.3; }
      }
      
      .editor-paragraph {
        margin: 0.5rem 0;
        line-height: 1.6;
      }
      
      .editor-paragraph:first-child {
        margin-top: 0;
      }
      
      .editor-paragraph:last-child {
        margin-bottom: 0;
      }
      
      .ProseMirror {
        white-space: pre-wrap;
        word-wrap: break-word;
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
    `}</style>
  );
}
