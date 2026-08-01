"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function CameraCapture({
  value,
  onChange,
  label = "Capture photo",
  className,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      toast.error("Could not start the camera preview");
    });
  }, [live]);

  function setPreviewUrl(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera is not supported on this device");
      return;
    }

    setOpening(true);
    try {
      stopStream(streamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = stream;
      setLive(true);
    } catch {
      toast.error("Camera permission is required for attendance photos");
      setLive(false);
    } finally {
      setOpening(false);
    }
  }

  function closeCamera() {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }

  function clearPhoto() {
    setPreviewUrl(null);
    onChange(null);
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera is still starting — try again");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Could not capture photo");
      return;
    }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Could not capture photo");
          return;
        }
        const file = new File([blob], `attendance-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPreviewUrl(URL.createObjectURL(blob));
        onChange(file);
        closeCamera();
      },
      "image/jpeg",
      0.85,
    );
  }

  function retake() {
    clearPhoto();
    void openCamera();
  }

  return (
    <div className={cn("space-y-2", className)}>
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border/70">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Capture preview"
            className="aspect-[4/3] w-full object-cover"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute bottom-3 right-3 gap-1.5"
            onClick={retake}
          >
            <RefreshCw className="size-3.5" />
            Retake
          </Button>
        </div>
      ) : live ? (
        <div className="relative overflow-hidden rounded-xl border border-border/70 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="aspect-[4/3] w-full object-cover"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute top-3 right-3"
            onClick={closeCamera}
            aria-label="Close camera"
          >
            <X className="size-3.5" />
          </Button>
          <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/50 to-transparent p-4 pt-10">
            <Button
              type="button"
              size="lg"
              className="gap-2 rounded-full px-6"
              onClick={takePhoto}
            >
              <Camera className="size-4" />
              Take photo
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={opening}
          onClick={() => void openCamera()}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.04] text-primary transition hover:bg-primary/[0.08] disabled:opacity-60"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Camera className="size-6" />
          </span>
          <span className="text-sm font-bold">
            {opening ? "Opening camera…" : label}
          </span>
          <span className="text-[11px] font-light text-muted-foreground">
            Live camera only — gallery upload not allowed
          </span>
        </button>
      )}
      {value ? (
        <p className="text-[11px] font-light text-muted-foreground">
          Photo ready ({Math.round(value.size / 1024)} KB)
        </p>
      ) : null}
    </div>
  );
}
