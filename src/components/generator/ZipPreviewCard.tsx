import { Eye, FileCode2, FileText } from "lucide-react";
import type { Project, GeneratedFile } from "./types";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function ZipPreviewCard({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (p: string) => void;
}) {
  const sizes = project.files.map((f) => new Blob([f.content]).size);
  const totalBytes = sizes.reduce((a, b) => a + b, 0);
  const folders = new Set(
    project.files
      .map((f) => f.path.split("/").slice(0, -1).join("/"))
      .filter(Boolean),
  ).size;

  const ranked = [...project.files]
    .map((f, i) => ({ f, size: sizes[i] }))
    .sort((a, b) => {
      const score = (x: { f: GeneratedFile; size: number }) => {
        const n = x.f.path.toLowerCase();
        let s = 0;
        if (/app\.swift$/.test(n)) s += 100;
        if (/contentview\.swift$/.test(n)) s += 80;
        if (/project\.yml$/.test(n)) s += 60;
        if (/readme/i.test(n)) s += 40;
        if (n.endsWith(".swift")) s += 10;
        return s + Math.min(x.size / 200, 20);
      };
      return score(b) - score(a);
    });
  const mainFiles = ranked.slice(0, 4);
  const ext = (p: string) => p.split(".").pop() ?? "";
  const breakdown = project.files.reduce<Record<string, number>>((acc, f) => {
    const e = ext(f.path) || "other";
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium">
            <Eye size={12} /> ZIP Preview
          </div>
          <h3 className="font-display text-lg font-semibold mt-1">
            What's inside{" "}
            <span className="font-mono text-foreground/80">{project.appName}.zip</span>
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            <span className="text-foreground font-semibold">{project.files.length}</span> files
          </div>
          <div>
            <span className="text-foreground font-semibold">{folders}</span> folders
          </div>
          <div>
            <span className="text-foreground font-semibold">{formatBytes(totalBytes)}</span>{" "}
            uncompressed
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {Object.entries(breakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([e, c]) => (
            <span
              key={e}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full bg-card/60 border border-border/40 text-muted-foreground"
            >
              .{e} <span className="text-foreground/80 ml-1">{c}</span>
            </span>
          ))}
      </div>

      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <FileText size={12} /> Main files
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {mainFiles.map(({ f, size }) => {
          const preview = f.content.split("\n").slice(0, 6).join("\n");
          return (
            <button
              key={f.path}
              onClick={() => onSelect(f.path)}
              className="text-left group rounded-lg border border-border/40 bg-card/40 hover:border-primary/50 hover:bg-card/60 transition-colors p-3 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode2 size={12} className="text-primary shrink-0" />
                  <span className="text-xs font-mono truncate text-foreground group-hover:text-primary">
                    {f.path}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {formatBytes(size)}
                </span>
              </div>
              <pre className="text-[10px] font-mono text-muted-foreground/80 leading-snug overflow-hidden whitespace-pre-wrap line-clamp-4">
                {preview}
              </pre>
            </button>
          );
        })}
      </div>
    </div>
  );
}
