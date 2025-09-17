"use client"

import { useState } from "react"
import { ArrowLeft, Share2, Download, Users, Wifi, WifiOff, MoreHorizontal, Copy, Link, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { useYjsRoom } from "./hooks/useYjsRoom"
import { useAwareness } from "./hooks/useAwareness"
import ClientOnly from "./components/ClientOnly"

export default function EditorHeader({ documentId }) {
  const [title, setTitle] = useState("Untitled Document")
  const [showShare, setShowShare] = useState(false)
  const router = useRouter()

  const roomName = documentId || "default-room"
  const { provider } = useYjsRoom(roomName)
  const { peerCount, connectionStatus, activePeers } = useAwareness(provider, roomName)

  const connectionIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi size={16} className="text-emerald-500" />
      case "connecting":
        return <WifiOff size={16} className="text-amber-500 animate-pulse" />
      default:
        return <WifiOff size={16} className="text-red-500" />
    }
  }

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      // You could add a toast notification here
    }
  }

  const handleExport = () => {
    // Export functionality would go here
  }

// app/editor/[documentId]/EditorHeader.js
return (
  <ClientOnly
    fallback={
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-6">
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        </div>
      </header>
    }
  >
<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div className="w-full flex h-16 items-center justify-between px-6 mx-auto"> {/* Removed container class */}
    
    {/* Left Section */}
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="p-2">
        <ArrowLeft size={20} />
      </Button>

      <div className="flex items-center gap-2">
        <FileText size={20} className="text-muted-foreground" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-medium bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto min-w-[200px] max-w-[400px]"
          placeholder="Untitled Document"
        />
      </div>

      <div className="flex items-center gap-3 ml-4">
        {/* Your collaboration status and peers */}
      </div>
    </div>

    {/* Right Section - Now will properly align to the right */}
    <div className="flex items-center gap-2 flex-shrink-0"> {/* Added flex-shrink-0 */}
      <DropdownMenu open={showShare} onOpenChange={setShowShare}>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <Share2 size={16} />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleCopyLink}>
            <Copy size={16} className="mr-2" />
            Copy Link
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link size={16} className="mr-2" />
            One-time Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" onClick={handleExport} className="gap-2 bg-transparent">
        <Download size={16} />
        <span className="hidden sm:inline">Export</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="p-2">
            <MoreHorizontal size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuItem>Version History</DropdownMenuItem>
          <DropdownMenuItem>Help</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</header>
  </ClientOnly>
)

}
