export type MarkdownMediaKind = "image" | "video" | "audio";

export type MarkdownMediaAsset = {
  kind: MarkdownMediaKind;
  mime: string;
};

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
};

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
};

export function markdownMediaAssetForExtension(ext: string): MarkdownMediaAsset {
  const normalized = ext.toLowerCase();
  const video = VIDEO_MIME[normalized];
  if (video) return { kind: "video", mime: video };
  const audio = AUDIO_MIME[normalized];
  if (audio) return { kind: "audio", mime: audio };
  return { kind: "image", mime: IMAGE_MIME[normalized] ?? "image/png" };
}

export type FileViewerKind = "image" | "pdf" | "video" | "audio" | "external";

// Binary formats with no in-app renderer — the viewer shows a launcher card
// that opens them in the OS default app instead of an error toast.
const EXTERNAL_APP_EXT = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

/** Viewer kind for files rendered by the in-app file viewer, or null when the path isn't viewable.
 *  HTML is NOT a viewer kind — it opens editable with a live preview pane. */
export function fileViewerKindForPath(path: string): FileViewerKind | null {
  if (isImagePath(path)) return "image";
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  if (ext === "pdf") return "pdf";
  if (ext in VIDEO_MIME) return "video";
  if (ext in AUDIO_MIME) return "audio";
  if (EXTERNAL_APP_EXT.has(ext)) return "external";
  return null;
}

/** MIME type for a video/audio path (viewer playback); empty string when unknown. */
export function mediaMimeForPath(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  return VIDEO_MIME[ext] ?? AUDIO_MIME[ext] ?? "";
}

/** True when the path has a renderable image extension (used by the in-app image viewer). */
export function isImagePath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return false;
  return path.slice(dot + 1).toLowerCase() in IMAGE_MIME;
}

/** MIME type for an image path; falls back to image/png. */
export function imageMimeForPath(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  return IMAGE_MIME[ext] ?? "image/png";
}

export function extensionFromMarkdownAssetSrc(src: string): string {
  const path = src.split("#", 1)[0].split("?", 1)[0];
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1) : "png";
}
