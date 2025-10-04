// app/editor/[documentId]/components/SaveIndicator.js
"use client";
import { CheckCircle, Clock, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SaveIndicator({ saveStatus, onManualSave }) {
  const getStatusContent = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: <Clock size={14} className="text-amber-500 animate-pulse" />,
          text: "Saving...",
          className: "text-amber-600"
        };
      case 'saved':
        return {
          icon: <CheckCircle size={14} className="text-emerald-500" />,
          text: "Saved",
          className: "text-emerald-600"
        };
      case 'error':
        return {
          icon: <AlertCircle size={14} className="text-red-500" />,
          text: "Save failed",
          className: "text-red-600"
        };
      default:
        return {
          icon: <Save size={14} className="text-gray-400" />,
          text: "Not saved",
          className: "text-gray-500"
        };
    }
  };

  const { icon, text, className } = getStatusContent();

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 text-xs ${className}`}>
        {icon}
        <span>{text}</span>
      </div>
      
      {/* Optional manual save button */}
      {onManualSave && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onManualSave}
          className="h-7 px-2 text-xs"
          disabled={saveStatus === 'saving'}
        >
          <Save size={12} className="mr-1" />
          Save
        </Button>
      )}
    </div>
  );
}
