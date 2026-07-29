import { useEffect, useState } from "react";
import { readFile, stat } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { ExternalLink, FileCode2, X } from "lucide-react";
import {
  basename,
  fileViewerKindForPath,
  imageMimeForPath,
  isSvgPath,
  mediaMimeForPath,
  type FileViewerKind,
} from "@/lib";

type FileViewProps = {
  path: string;
  onClose: () => void;
  /** Reopen this file as an editable plain-text tab (svg only). */
  onOpenAsText?: (path: string) => void;
  /** Bumped when the file changes on disk — forces a re-read of the bytes. */
  reloadToken?: number;
};

type ViewerContent =
  | { kind: "image" | "pdf" | "video" | "audio"; url: string; mime: string }
  | { kind: "external" };

// Media loads fully into memory for the blob URL — refuse silly sizes.
const MAX_VIEWER_BYTES = 512 * 1024 * 1024;

/**
 * Renders a binary file selected in the sidebar, in place of the editor/
 * preview panes. Images and PDFs load as blob URLs (PDFs render via
 * WKWebView's native viewer); video/audio play with native controls; Office
 * formats get a launcher card that opens the OS default app.
 */
export function FileView({ path, onClose, onOpenAsText, reloadToken = 0 }: FileViewProps) {
  const [content, setContent] = useState<ViewerContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setContent(null);
    setError(null);

    const kind: FileViewerKind | null = fileViewerKindForPath(path);
    const load = async () => {
      if (kind === "external") {
        setContent({ kind });
        return;
      }
      if (kind !== "image" && kind !== "pdf" && kind !== "video" && kind !== "audio") {
        throw new Error(`unsupported viewer file: ${basename(path)}`);
      }
      // Size-check before reading — checking byteLength after readFile would
      // already have pulled the whole file into memory, which is the thing the
      // cap exists to prevent.
      const info = await stat(path);
      if (cancelled) return;
      if (info.size > MAX_VIEWER_BYTES) {
        const mb = (info.size / (1024 * 1024)).toFixed(0);
        throw new Error(`${basename(path)} is ${mb} MB — too large to preview in-app`);
      }
      const bytes = await readFile(path);
      if (cancelled) return;
      const mime =
        kind === "pdf" ? "application/pdf"
        : kind === "image" ? imageMimeForPath(path)
        : mediaMimeForPath(path);
      objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
      setContent({ kind, url: objectUrl, mime });
    };

    load().catch((err) => {
      if (cancelled) return;
      console.error("marka.md: file view load failed", path, err);
      setError(String(err));
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, reloadToken]);

  const name = basename(path);
  const frame = content && (content.kind === "pdf" || content.kind === "video");

  return (
    <div className="mdv-image-view">
      <div className="mdv-image-view__bar">
        <span className="mdv-image-view__title" title={path}>{name}</span>
        <span className="mdv-image-view__actions">
          {onOpenAsText && isSvgPath(path) ? (
            <button
              type="button"
              className="mdv-image-view__close"
              data-tooltip="edit as text (⌘E)"
              aria-label={`edit ${name} as text`}
              onClick={() => onOpenAsText(path)}
            >
              <FileCode2 size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="mdv-image-view__close"
            aria-label="Close file preview"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </span>
      </div>
      <div className={`mdv-image-view__body${frame ? " mdv-image-view__body--frame" : ""}`}>
        {error ? (
          <p className="mdv-image-view__error">{error}</p>
        ) : content?.kind === "image" ? (
          <img className="mdv-image-view__img" src={content.url} alt={name} />
        ) : content?.kind === "pdf" ? (
          <iframe className="mdv-image-view__frame" src={content.url} title={name} />
        ) : content?.kind === "video" ? (
          <video className="mdv-image-view__media" src={content.url} controls playsInline />
        ) : content?.kind === "audio" ? (
          <audio className="mdv-image-view__audio" src={content.url} controls />
        ) : content?.kind === "external" ? (
          <div className="mdv-image-view__external">
            <p className="mdv-image-view__external-name">{name}</p>
            <p className="mdv-image-view__error">no in-app renderer for this format</p>
            <button
              type="button"
              className="mdv-image-view__open-external"
              onClick={() => {
                void openPath(path).catch((err) =>
                  console.error("marka.md: openPath failed", err),
                );
              }}
            >
              <ExternalLink size={13} /> open in default app
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
