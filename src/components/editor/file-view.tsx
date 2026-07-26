import { useEffect, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { X } from "lucide-react";
import { basename, fileViewerKindForPath, imageMimeForPath } from "@/lib";

type FileViewProps = {
  path: string;
  onClose: () => void;
};

type ViewerContent = { kind: "image" | "pdf"; url: string };

/**
 * Renders a binary file (image / pdf) selected in the sidebar, in place of the
 * editor/preview panes. Both load as blob URLs; PDFs render via WKWebView's
 * native viewer.
 */
export function FileView({ path, onClose }: FileViewProps) {
  const [content, setContent] = useState<ViewerContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setContent(null);
    setError(null);

    const kind = fileViewerKindForPath(path);
    const load = async () => {
      if (kind !== "image" && kind !== "pdf") {
        throw new Error(`unsupported viewer file: ${basename(path)}`);
      }
      const bytes = await readFile(path);
      if (cancelled) return;
      const mime = kind === "pdf" ? "application/pdf" : imageMimeForPath(path);
      objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
      setContent({ kind, url: objectUrl });
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
  }, [path]);

  return (
    <div className="mdv-image-view">
      <div className="mdv-image-view__bar">
        <span className="mdv-image-view__title" title={path}>{basename(path)}</span>
        <button
          type="button"
          className="mdv-image-view__close"
          aria-label="Close file preview"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className={`mdv-image-view__body${content && content.kind !== "image" ? " mdv-image-view__body--frame" : ""}`}>
        {error ? (
          <p className="mdv-image-view__error">{error}</p>
        ) : content?.kind === "image" ? (
          <img className="mdv-image-view__img" src={content.url} alt={basename(path)} />
        ) : content?.kind === "pdf" ? (
          <iframe className="mdv-image-view__frame" src={content.url} title={basename(path)} />
        ) : null}
      </div>
    </div>
  );
}
