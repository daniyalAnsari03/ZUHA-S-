"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { ImagePlus, Upload, X, Check, Loader2, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "@/lib/images";

type MediaFile = {
  name: string;
  id: string;
  size: number;
  created_at: string;
};

type ImagePickerProps = {
  name: string;
  value?: string;
  folder?: string;
  label?: string;
  hint?: string;
  onChange?: (path: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable image picker component. Opens a modal with media library
 * (existing images) and upload capability. Stores the storage path
 * in a hidden input for form submission.
 */
export function ImagePicker({
  name,
  value,
  folder = "uploads",
  label = "Image",
  hint,
  onChange,
}: ImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState(value || "");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");

  const currentValue = value || selectedPath;
  const displayUrl = resolveImageUrl(currentValue) || "";

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { listMediaAction } = await import("@/app/admin/actions");
      const result = await listMediaAction(folder);
      if (result.ok) {
        setMediaFiles(
          result.files.filter((f) => {
            const ext = f.name.split(".").pop()?.toLowerCase();
            return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(
              ext || "",
            );
          }),
        );
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load media.");
    } finally {
      setLoading(false);
    }
  }, [folder]);

  const openModal = useCallback(() => {
    setIsOpen(true);
    loadMedia();
  }, [loadMedia]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const { uploadImageAction } = await import("@/app/admin/actions");
        const result = await uploadImageAction(formData);

        if (result.ok) {
          setSelectedPath(result.path);
          setIsOpen(false);
          onChange?.(result.path);
          loadMedia();
        } else {
          setError(result.error);
        }
      } catch (uploadError) {
        setError(
          uploadError instanceof Error && uploadError.message
            ? uploadError.message
            : "Upload failed.",
        );
      } finally {
        setUploading(false);
      }
    },
    [folder, loadMedia, onChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const selectExisting = useCallback(
    (file: MediaFile) => {
      const path = `${folder}/${file.name}`;
      setSelectedPath(path);
      setIsOpen(false);
      onChange?.(path);
    },
    [folder, onChange],
  );

  const removeImage = useCallback(() => {
    setSelectedPath("");
    onChange?.("");
  }, [onChange]);

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
          {label}
        </span>
        <div className="flex items-start gap-3">
          <input type="hidden" name={name} value={selectedPath} />
          <button
            type="button"
            onClick={openModal}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-charcoal/20 bg-neutral-soft text-charcoal-muted transition-colors hover:border-plum/40 hover:text-plum"
          >
            {displayUrl ? (
              <div className="relative h-full w-full overflow-hidden rounded-lg">
                <Image
                  src={displayUrl}
                  alt="Selected image"
                  fill
                  sizes="96px"
                  className="object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                  <ImagePlus className="h-5 w-5 text-white" />
                </span>
              </div>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px]">Select</span>
              </>
            )}
          </button>
          <div className="flex-1 pt-1">
            {displayUrl && (
              <button
                type="button"
                onClick={removeImage}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove image
              </button>
            )}
            {hint && (
              <span className="mt-1 block text-xs text-charcoal-muted">
                {hint}
              </span>
            )}
          </div>
        </div>
      </label>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl bg-neutral-soft shadow-xl">
            <div className="flex items-center justify-between border-b border-charcoal/10 px-6 py-4">
              <h3 className="font-serif text-lg text-charcoal">Choose Image</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-charcoal-muted transition-colors hover:bg-charcoal/5 hover:text-charcoal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-charcoal/10 px-6">
              <button
                type="button"
                onClick={() => setActiveTab("library")}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "library"
                    ? "border-plum text-plum"
                    : "border-transparent text-charcoal-muted hover:text-charcoal"
                }`}
              >
                Media Library
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "upload"
                    ? "border-plum text-plum"
                    : "border-transparent text-charcoal-muted hover:text-charcoal"
                }`}
              >
                Upload New
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6">
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {activeTab === "library" && (
                <>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-plum" />
                    </div>
                  ) : mediaFiles.length === 0 ? (
                    <div className="py-12 text-center text-sm text-charcoal-muted">
                      <ImageIcon className="mx-auto mb-3 h-8 w-8 text-charcoal/30" />
                      No images yet. Upload one to get started.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {mediaFiles.map((file) => {
                        const fileUrl =
                          resolveImageUrl(`${folder}/${file.name}`) || "";
                        const isSelected =
                          selectedPath === `${folder}/${file.name}`;
                        return (
                          <button
                            key={file.id || file.name}
                            type="button"
                            onClick={() => selectExisting(file)}
                            className={`group relative overflow-hidden rounded-xl border-2 transition-colors ${
                              isSelected
                                ? "border-plum ring-2 ring-plum/20"
                                : "border-charcoal/10 hover:border-plum/40"
                            }`}
                          >
                            <div className="relative aspect-square">
                              <Image
                                src={fileUrl}
                                alt={file.name}
                                fill
                                sizes="(min-width: 640px) 25vw, 33vw"
                                className="object-cover"
                              />
                              {isSelected && (
                                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-plum text-white">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                {file.name.length > 20
                                  ? file.name.slice(0, 20) + "..."
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
                </>
              )}

              {activeTab === "upload" && (
                <div className="py-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-plum" />
                      <p className="text-sm text-charcoal-muted">
                        Uploading...
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mx-auto flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-charcoal/20 px-12 py-10 transition-colors hover:border-plum/40 hover:text-plum"
                    >
                      <Upload className="h-8 w-8 text-charcoal-muted" />
                      <div>
                        <p className="text-sm font-medium text-charcoal">
                          Click to upload
                        </p>
                        <p className="mt-1 text-xs text-charcoal-muted">
                          JPEG, PNG, WebP, GIF, SVG — max 5MB
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-charcoal/10 px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
