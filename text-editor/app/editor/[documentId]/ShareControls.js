// ShareControls.js

"use client";
import React from "react";

export default function ShareControls() {
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("📋 Link copied!");
  };

  const handleExport = () => {
    // TODO: export editor content → pdf/markdown
    alert("🚀 Export feature coming soon");
  };

  const handleRevoke = () => {
    // TODO: trigger DK rotation via signaling server
    alert("🔐 Revoke access not implemented yet");
  };

  return (
    <div className="share-controls">
      <button onClick={handleShare}>Share</button>
      <button onClick={handleExport}>Export</button>
      <button onClick={handleRevoke}>Revoke</button>
    </div>
  );
}
