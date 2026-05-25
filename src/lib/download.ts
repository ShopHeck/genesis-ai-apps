import type JSZipType from "jszip";

export async function downloadZip(
  folderName: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  const [{ default: JSZip }, { saveAs }] = await Promise.all([
    import("jszip"),
    import("file-saver"),
  ]);
  const zip: JSZipType = new JSZip();
  const root = zip.folder(folderName)!;
  files.forEach((f) => root.file(f.path, f.content));
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${folderName}.zip`);
}
