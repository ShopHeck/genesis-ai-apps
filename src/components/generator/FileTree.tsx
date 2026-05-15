import { FileCode2, Folder, ChevronRight } from "lucide-react";
import type { GeneratedFile } from "./types";

export type TreeNode = {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
};

export function buildTree(files: GeneratedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isFile,
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

function FolderRow({ name, depth }: { name: string; depth: number }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 text-xs text-foreground/80 font-medium"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <ChevronRight size={11} className="opacity-50" />
      <Folder size={11} className="opacity-60" />
      <span className="truncate">{name}</span>
    </div>
  );
}

export function FileTreeView({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selected: string | null;
  onSelect: (p: string) => void;
  depth?: number;
}) {
  return (
    <ul className="space-y-0.5">
      {node.children.map((child) =>
        child.isFile ? (
          <li key={child.path}>
            <button
              onClick={() => onSelect(child.path)}
              className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
                selected === child.path
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <FileCode2 size={11} className="shrink-0 opacity-60" />
              <span className="truncate">{child.name}</span>
            </button>
          </li>
        ) : (
          <li key={child.path}>
            <FolderRow name={child.name} depth={depth} />
            <FileTreeView
              node={child}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
            />
          </li>
        ),
      )}
    </ul>
  );
}
