// app/editor/[documentId]/page.js
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ClientOnly from "./components/ClientOnly";
import EditorHeader from "./EditorHeader";
import EditorContainer from "./EditorContainer";
import FileSidebar from "./FileSidebar";

export default function EditorPage() {
  const { documentId } = useParams();
  const router = useRouter();
  const [title, setTitle] = useState("Untitled Document");
  const [isElectron, setIsElectron] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI?.isElectron);
  }, []);

  // Load document title from storage
  useEffect(() => {
    const loadDocumentTitle = async () => {
      if (!documentId || !isElectron) return;
      
      try {
        const result = await window.electronAPI.documents.loadById(documentId);
        console.log('📄 Loaded document metadata:', result);
        if (result && result.metadata && result.metadata.title) {
          setTitle(result.metadata.title);
        }
      } catch (error) {
        console.error('Failed to load document title:', error);
        setTitle("Untitled Document");
      }
    };

    loadDocumentTitle();
  }, [documentId, isElectron]);

  // Handle document selection from sidebar
  const handleDocumentSelect = (docId, docTitle) => {
    // Navigate to the new document using Next.js router
    router.push(`/editor/${docId}`);
  };

  // Handle title changes and save to storage
  const handleTitleChange = async (newTitle) => {
    setTitle(newTitle);
    
    if (isElectron && documentId) {
      try {
        await window.electronAPI.documents.updateTitle(documentId, newTitle);
        console.log('📝 Document title updated:', newTitle);
      } catch (error) {
        console.error('❌ Failed to update document title:', error);
      }
    }
  };

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
          <main className="flex h-[calc(100vh-4rem)]">
            {/* Sidebar loading skeleton */}
            <div className="w-80 bg-gray-50 border-r border-gray-200 p-4">
              <div className="h-4 w-24 bg-muted animate-pulse rounded mb-4" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-6 bg-muted animate-pulse rounded" />
                ))}
              </div>
            </div>
            
            {/* Editor loading skeleton */}
            <div className="flex-1 flex flex-col">
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
        <EditorHeader 
          documentId={documentId} 
          initialTitle={title} 
          onTitleChange={handleTitleChange}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 overflow-hidden flex">
          {/* File Sidebar with real Electron data */}
          <FileSidebar
            currentDocumentId={documentId}
            onDocumentSelect={handleDocumentSelect}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          
          {/* Editor Container */}
          <div className="flex-1 overflow-hidden">
            <EditorContainer documentId={documentId} title={title} />
          </div>
        </main>
      </div>
    </ClientOnly>
  );
}
