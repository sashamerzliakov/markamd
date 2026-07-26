import { useEffect, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { X } from "lucide-react";
import { basename, imageMimeForPath } from "@/lib";

function uint8ToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  return btoa(chunks.join(""));
}

type ImageViewProps = {
  path: string;
  onClose: () => void;
};

/** Renders an image file selected in the sidebar, in place of the editor/preview panes. */
export function ImageView({ path, onClose }: ImageViewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);
    readFile(path)
      .then((bytes) => {
        if (cancelled) return;
        setSrc(`data:${imageMimeForPath(path)};base64,${uint8ToBase64(bytes)}`);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("marka.md: image read failed", path, err);
        setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="mdv-image-view">
      <div className="mdv-image-view__bar">
        <span className="mdv-image-view__title" title={path}>{basename(path)}</span>
        <button
          type="button"
          className="mdv-image-view__close"
          aria-label="Close image preview"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="mdv-image-view__body">
        {error ? (
          <p className="mdv-image-view__error">{error}</p>
        ) : src ? (
          <img className="mdv-image-view__img" src={src} alt={basename(path)} />
        ) : null}
      </div>
    </div>
  );
}
