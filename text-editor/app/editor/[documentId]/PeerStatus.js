// PeerStatus.js

"use client";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";

export default function PeerStatus({ documentId }) {
  const [peers, setPeers] = useState(0);

  useEffect(() => {
    // TODO: connect to signaling server later
    setPeers(Math.floor(Math.random() * 4) + 1);
  }, [documentId]);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <Users size={16} />
      <span>{peers} connected peers</span>
    </div>
  );
}
