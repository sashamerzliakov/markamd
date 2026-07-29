export type MarkdownMediaKind = "image" | "video" | "audio";

export type MarkdownMediaAsset = {
  kind: MarkdownMediaKind;
  mime: string;
};

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  apng: "image/apng",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  ico: "image/x-icon",
  // WebKit decodes these via the system codecs on Apple platforms
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
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
  opus: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  // macOS-native containers WebKit plays through the system codecs
  aiff: "audio/aiff",
  aif: "audio/aiff",
  caf: "audio/x-caf",
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

// Opaque binaries with no in-app renderer — the viewer shows a launcher card
// that opens them in the OS default app instead of an error toast. Everything
// NOT listed here (and not media) falls through to the editor as text, so this
// set is what keeps known documents and archives out of a text buffer. The
// NUL-byte sniff in files.ts is the general net for anything unlisted.
const EXTERNAL_APP_EXT = new Set([
  // word processing / spreadsheets / presentations
  "doc", "docx", "docm", "dotx",
  "xls", "xlsx", "xlsm", "xlsb",
  "ppt", "pptx", "pptm",
  "odt", "ods", "odp",
  "key", "pages", "numbers",
  "rtf", "epub",
  // archives and disk images
  "zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "dmg", "iso", "pkg",
  // compiled / opaque payloads
  "wasm", "class", "jar", "so", "dylib", "exe", "bin",
  "sqlite", "sqlite3", "db",
  "ttf", "otf", "woff", "woff2",
]);

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

/** True for SVG — the one media format that is also editable text, so it can
 *  round-trip between the rendered view and its source. */
export function isSvgPath(path: string): boolean {
  return /\.svg$/i.test(path);
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
