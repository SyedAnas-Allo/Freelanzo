"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { useWorkPhotos } from "@/hooks/use-work-photos";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function ProfilePhotosPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const { photos, ready, addPhotos, removePhoto } = useWorkPhotos(userId);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
    }
    void load();
  }, [router]);

  function onAddFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      toast.error("Choose image files");
      return;
    }
    if (list.some((f) => f.size > 3 * 1024 * 1024)) {
      toast.error("Each photo should be under 3 MB");
      return;
    }

    let remaining = list.length;
    const urls: string[] = [];
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") urls.push(reader.result);
        remaining -= 1;
        if (remaining === 0) {
          addPhotos(urls);
          toast.success(
            urls.length === 1 ? "Photo added" : `${urls.length} photos added`,
          );
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function openPreview(i: number) {
    setPreviewIndex(i);
  }

  function closePreview() {
    setPreviewIndex(null);
  }

  function stepPreview(delta: number) {
    if (previewIndex == null || photos.length === 0) return;
    const next = (previewIndex + delta + photos.length) % photos.length;
    setPreviewIndex(next);
  }

  return (
    <PageContent className="pb-10">
      <PageHeader
        backHref="/profile"
        title="Work Photos"
        description="Tap a photo to preview. Add more to show businesses your work."
        action={
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Plus aria-hidden="true" className="size-4" />
            Add Photos
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Add work photos"
        onChange={(event) => {
          onAddFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {!ready ? (
        <PageLoading variant="page" />
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-primary"
          >
            <Plus className="size-6" />
            <span className="text-[10px] font-bold">Add</span>
          </button>
          {photos.map((src, i) => (
            <button
              key={`${i}-${src.slice(0, 24)}`}
              type="button"
              onClick={() => openPreview(i)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {previewIndex != null && photos[previewIndex] ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
        >
          <div className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            <button
              type="button"
              aria-label="Close"
              className="flex size-10 items-center justify-center rounded-full text-white"
              onClick={closePreview}
            >
              <X className="size-6" />
            </button>
            <p className="text-sm font-semibold text-white">
              {previewIndex + 1} / {photos.length}
            </p>
            <button
              type="button"
              aria-label="Delete photo"
              className="flex size-10 items-center justify-center rounded-full text-red-400"
              onClick={() => {
                const i = previewIndex;
                removePhoto(i);
                if (photos.length <= 1) closePreview();
                else setPreviewIndex(Math.min(i, photos.length - 2));
                toast.message("Photo removed");
              }}
            >
              <Trash2 className="size-5" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <button
              type="button"
              aria-label="Previous"
              className={cn(
                "absolute left-2 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white",
                photos.length < 2 && "opacity-0",
              )}
              onClick={() => stepPreview(-1)}
              disabled={photos.length < 2}
            >
              <ChevronLeft className="size-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[previewIndex]}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            <button
              type="button"
              aria-label="Next"
              className={cn(
                "absolute right-2 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white",
                photos.length < 2 && "opacity-0",
              )}
              onClick={() => stepPreview(1)}
              disabled={photos.length < 2}
            >
              <ChevronRight className="size-6" />
            </button>
          </div>

          <div className="flex justify-center gap-1.5 overflow-x-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {photos.map((src, i) => (
              <button
                key={`thumb-${i}`}
                type="button"
                onClick={() => setPreviewIndex(i)}
                className={cn(
                  "size-12 shrink-0 overflow-hidden rounded-md ring-2",
                  i === previewIndex ? "ring-white" : "ring-transparent opacity-60",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </PageContent>
  );
}
