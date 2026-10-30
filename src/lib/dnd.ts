// Drag-and-drop payload for moving recordings onto sidebar workspaces/folders.
export const RECORDINGS_MIME = "application/x-echo-recordings";

export function readDraggedIds(e: React.DragEvent): string[] {
  try {
    const ids = JSON.parse(e.dataTransfer.getData(RECORDINGS_MIME));
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const isRecordingDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(RECORDINGS_MIME);
