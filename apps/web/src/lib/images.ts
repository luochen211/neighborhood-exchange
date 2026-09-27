import type { ImageKey } from "@neighborhood/contracts";
/** Single integration point for approved local assets; shared imageKey values stay unchanged. */
export const itemImages: Record<
  ImageKey,
  { label: string; src?: string; caption: string }
> = {
  chair: { label: "椅子", caption: "预置示意图" },
  lamp: { label: "台灯", caption: "预置示意图" },
  cooker: { label: "电磁炉", caption: "预置示意图" },
  books: { label: "书籍", caption: "预置示意图" },
};
