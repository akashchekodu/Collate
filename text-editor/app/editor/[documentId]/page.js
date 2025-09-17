"use client";
import dynamic from 'next/dynamic';
import { useParams } from "next/navigation";
import EditorHeader from "./EditorHeader";

// Dynamic import with no SSR for EditorContainer
const EditorContainer = dynamic(() => import('./EditorContainer'), { 
  ssr: false,
  loading: () => (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <div className="text-gray-400">Loading collaborative editor...</div>
      </div>
    </div>
  )
});

export default function EditorPage() {
  const { documentId } = useParams();

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <EditorHeader documentId={documentId} />
      
      <main className="flex-1 p-6 overflow-hidden">
        <div className="h-full max-w-6xl mx-auto">
          <EditorContainer documentId={documentId} />
        </div>
      </main>
    </div>
  );
}
