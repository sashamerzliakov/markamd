type HtmlPreviewProps = {
  source: string;
};

/**
 * Live preview pane for HTML files — renders the editor buffer in a sandboxed
 * iframe (scripts run; relative asset references won't resolve). Sits where
 * the markdown Preview normally renders, so split view, preview-only mode and
 * reading mode all work unchanged for .html files.
 */
export function HtmlPreview({ source }: HtmlPreviewProps) {
  return (
    <div className="mdv-html-preview">
      <iframe
        className="mdv-html-preview__frame"
        srcDoc={source}
        sandbox="allow-scripts"
        title="html preview"
      />
    </div>
  );
}
