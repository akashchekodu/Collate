// app/editor/[documentId]/page.js
"use client";
import { useParams } from "next/navigation";
import ClientOnly from "./components/ClientOnly";
import EditorHeader from "./EditorHeader";
import EditorContainer from "./EditorContainer";

export default function EditorPage() {
  const { documentId } = useParams();

  return (
    <ClientOnly
      fallback={
        <div className="min-h-screen bg-background">
          <div className="sticky top-0 z-50 border-b bg-background/95">
            <div className="container flex h-16 items-center px-6">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
          <main className="py-6">
            <div className="container max-w-5xl mx-auto p-6">
              <div className="rounded-lg border bg-card p-8 shadow-lg">
                <div className="flex items-center justify-center min-h-[500px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              </div>
            </div>
          </main>
        </div>
      }
    >
      <div className="min-h-screen bg-background">
        <EditorHeader documentId={documentId} />
        <main className="py-6">
          <EditorContainer documentId={documentId} />
        </main>
      </div>
    </ClientOnly>
  );
}
