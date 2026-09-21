"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Upload, Trash2, Loader2, ImageIcon, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "@/lib/images";

type MediaFile = {
  name: string;
  id: string;
  size: number;
  created_at: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibraryClient() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { listMediaAction } = await import("@/app/admin/actions");
      const result = await listMediaAction();
      if (result.ok) {
        setFiles(
          result.files.filter((f) => {
            const ext = f.name.split(".").pop()?.toLowerCase();
            return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(
              ext || "",
            );
          }),
        );
        setLoaded(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load media.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "media");

        const { uploadImageAction } = await import("@/app/admin/actions");
        const result = await uploadImageAction(formData);

        if (result.ok) {
          loadFiles();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Upload failed.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [loadFiles],
  );

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} image(s)? This cannot be undone.`))
      return;

    setError(null);
    try {
      const paths = Array.from(selected);
      const { deleteMediaAction } = await import("@/app/admin/actions");
      const result = await deleteMediaAction(paths);

      if (result.ok) {
        setSelected(new Set());
        loadFiles();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Delete failed.");
    }
  }, [selected, loadFiles]);

  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Media Library</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Manage uploaded images. Upload once, use everywhere in the admin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={handleUpload}
            className="hidden"
            id="media-upload-input"
          />
          <label
            htmlFor="media-upload-input"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload Image"}
          </label>
          {selected.size > 0 && (
            <Button
              variant="outline"
              onClick={handleDelete}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete ({selected.size})
            </Button>
          )}
          <button
            onClick={loadFiles}
            className="rounded-full border border-charcoal/15 px-3 py-2.5 text-charcoal-muted transition-colors hover:border-plum/40 hover:text-plum"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-plum" />
        </div>
      ) : !loaded ? (
        <div className="rounded-2xl border border-charcoal/10 bg-neutral-soft py-20 text-center">
          <ImageIcon className="mx-auto mb-3 h-10 w-10 text-charcoal/30" />
          <p className="text-sm text-charcoal-muted mb-4">
            Click below to load your media library.
          </p>
          <button
            onClick={loadFiles}
            className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-plum-dark"
          >
            <RefreshCw className="h-4 w-4" />
            Load Media
          </button>
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-charcoal/10 bg-neutral-soft py-20 text-center">
          <ImageIcon className="mx-auto mb-3 h-10 w-10 text-charcoal/30" />
          <p className="text-sm text-charcoal-muted">
            No images uploaded yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {files.map((file) => {
            const filePath = `media/${file.name}`;
            const url = resolveImageUrl(filePath) || "";
            const isSelected = selected.has(filePath);
            return (
              <button
                key={file.id || file.name}
                type="button"
                onClick={() => toggleSelect(filePath)}
                className={`group relative overflow-hidden rounded-xl border-2 transition-colors ${
                  isSelected
                    ? "border-plum ring-2 ring-plum/20"
                    : "border-charcoal/10 hover:border-plum/40"
                }`}
              >
                <div className="relative aspect-square">
                  <Image
                    src={url}
                    alt={file.name}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 768px) 20vw, 33vw"
                    className="object-cover"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {file.name.length > 25
                      ? file.name.slice(0, 25) + "..."
                      : file.name}
                    {file.size > 0 && (
                      <> · {formatFileSize(file.size)}</>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
