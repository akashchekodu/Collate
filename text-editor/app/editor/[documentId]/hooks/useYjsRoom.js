// app/editor/[documentId]/hooks/useYjsRoom.js
import { useMemo, useEffect } from "react";
import { ensureRoom, releaseRoom } from "../utils/yjsCache";

export function useYjsRoom(roomName) {
  const { ydoc, provider } = useMemo(() => ensureRoom(roomName), [roomName]);

  useEffect(() => {
    return () => {
      releaseRoom(roomName);
    };
  }, [roomName]);

  return { ydoc, provider };
}
