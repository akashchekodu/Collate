// app/editor/[documentId]/page.js
"use client";
import dynamic from 'next/dynamic';
import { useParams } from "next/navigation";
import EditorHeader from "./EditorHeader";
import PeerStatus from "./PeerStatus";

// Dynamic import with no SSR for EditorContainer
const EditorContainer = dynamic(() => import('./EditorContainer'), { 
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl shadow-md border p-6 flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-500">Loading collaborative editor...</div>
    </div>
  )
});

export default function EditorPage() {
  const { documentId } = useParams();

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <EditorHeader documentId={documentId} />
      <main className="flex-1 flex flex-col items-center p-6">
        <div className="w-full max-w-5xl flex flex-col gap-4">
          <EditorContainer documentId={documentId} />
          <PeerStatus documentId={documentId} />
        </div>
      </main>
    </div>
  );
}
