// app/editor/[documentId]/page.js
"use client";
import { useParams } from "next/navigation";
import { useState } from "react";  // Add this import
import ClientOnly from "./components/ClientOnly";
import EditorHeader from "./EditorHeader";
import EditorContainer from "./EditorContainer";

export default function EditorPage() {
  const { documentId } = useParams();
  const [title, setTitle] = useState("Untitled Document");  // Add title state

  

  return (
    <ClientOnly
      fallback={
        <div className="h-screen bg-background overflow-hidden">
          <div className="sticky top-0 z-50 border-b bg-background/95">
            <div className="container flex h-16 items-center px-6">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
          <main className="h-[calc(100vh-4rem)]">
            <div className="container max-w-5xl mx-auto p-6 h-full">
              <div className="rounded-lg border bg-card p-8 shadow-lg h-full">
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              </div>
            </div>
          </main>
        </div>
      }
    >
      <div className="h-screen bg-background overflow-hidden flex flex-col">
        <EditorHeader documentId={documentId} title={title} onTitleChange={setTitle} />
        <main className="flex-1 overflow-hidden">
          <EditorContainer documentId={documentId} title={title} />
        </main>
      </div>
    </ClientOnly>
  );
}
