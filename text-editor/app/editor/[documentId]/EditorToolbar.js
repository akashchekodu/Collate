// app/editor/[documentId]/EditorToolbar.js
"use client";
import { Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallback, useEffect, useState } from "react";

export default function EditorToolbar({ editor }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      setIsReady(true);
      console.log("📝 Toolbar: Editor ready");
    } else {
      setIsReady(false);
    }
  }, [editor]);

  // Direct command execution - no delays, no double focus
  const executeCommand = useCallback((commandFn, commandName) => {
    if (!editor || editor.isDestroyed) {
      console.warn("Editor not available");
      return;
    }

    try {
      // Execute command immediately without additional focus
      const result = commandFn();
      console.log(`✅ ${commandName}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ ${commandName} failed:`, error);
      return false;
    }
  }, [editor]);

  const getCurrentHeading = useCallback(() => {
    if (!editor || editor.isDestroyed) return "0";
    
    try {
      if (editor.isActive("heading", { level: 1 })) return "1";
      if (editor.isActive("heading", { level: 2 })) return "2";
      if (editor.isActive("heading", { level: 3 })) return "3";
      return "0";
    } catch (error) {
      return "0";
    }
  }, [editor]);

  const handleHeadingChange = useCallback((value) => {
    const level = parseInt(value);
    if (level === 0) {
      executeCommand(
        () => editor.chain().focus().setParagraph().run(),
        "setParagraph"
      );
    } else {
      executeCommand(
        () => editor.chain().focus().setHeading({ level }).run(),
        `setHeading${level}`
      );
    }
  }, [editor, executeCommand]);

  if (!editor || !isReady || editor.isDestroyed) {
    return (
      <div className="flex items-center gap-1 p-3 border-b bg-muted/20">
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
        <div className="h-8 w-8 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // Direct button handler - no event manipulation
  const ToolbarButton = ({ onClick, isActive, children, title, disabled = false }) => {
    return (
      <Button
        variant={isActive ? "default" : "ghost"}
        size="sm"
        onMouseDown={(e) => {
          // Use onMouseDown instead of onClick for immediate response
          e.preventDefault();
          if (!disabled) {
            onClick();
          }
        }}
        title={title}
        disabled={disabled}
        className="h-8 w-8 p-0"
        type="button"
      >
        {children}
      </Button>
    );
  };

  return (
    <div className="flex items-center gap-1 p-3 border-b bg-muted/20 overflow-x-auto">
      {/* History Commands */}
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().undo().run(),
          "undo"
        )}
        title="Undo (Ctrl+Z)"
        disabled={!editor.can().undo()}
      >
        <Undo size={16} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().redo().run(),
          "redo"
        )}
        title="Redo (Ctrl+Y)"
        disabled={!editor.can().redo()}
      >
        <Redo size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text Formatting - Direct commands */}
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().toggleBold().run(),
          "toggleBold"
        )}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold size={16} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().toggleItalic().run(),
          "toggleItalic"
        )}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic size={16} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().toggleStrike().run(),
          "toggleStrike"
        )}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().toggleBulletList().run(),
          "toggleBulletList"
        )}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List size={16} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().toggleOrderedList().run(),
          "toggleOrderedList"
        )}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Block Formatting */}
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().toggleBlockquote().run(),
          "toggleBlockquote"
        )}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote size={16} />
      </ToolbarButton>
      
      <ToolbarButton
        onClick={() => executeCommand(
          () => editor.chain().focus().toggleCodeBlock().run(),
          "toggleCodeBlock"
        )}
        isActive={editor.isActive("codeBlock")}
        title="Code Block"
      >
        <Code size={16} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      <Select value={getCurrentHeading()} onValueChange={handleHeadingChange}>
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Paragraph</SelectItem>
          <SelectItem value="1">Heading 1</SelectItem>
          <SelectItem value="2">Heading 2</SelectItem>
          <SelectItem value="3">Heading 3</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
