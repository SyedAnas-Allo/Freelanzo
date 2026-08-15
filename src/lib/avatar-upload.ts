import type { SupabaseClient } from "@supabase/supabase-js";

const AVATAR_BUCKET = "avatar-images";
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 900 * 1024;
const MAX_DIMENSION = 1280;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type AvatarKind = "profiles" | "businesses";

export type UploadedAvatar = {
  path: string;
  publicUrl: string;
};

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Choose a JPEG, PNG, or WebP image";
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return "Keep the original photo under 10 MB";
  }
  return null;
}

async function decodeImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress this image"));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function compressAvatar(file: File): Promise<Blob> {
  const validationMessage = validateAvatarFile(file);
  if (validationMessage) throw new Error(validationMessage);

  const decoded = await decodeImage(file);
  try {
    if (!decoded.width || !decoded.height) {
      throw new Error("Could not read this image");
    }

    const initialScale = Math.min(
      1,
      MAX_DIMENSION / Math.max(decoded.width, decoded.height),
    );
    let width = Math.max(1, Math.round(decoded.width * initialScale));
    let height = Math.max(1, Math.round(decoded.height * initialScale));
    let quality = 0.84;
    let output: Blob | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image compression is unavailable");

      context.drawImage(decoded.source, 0, 0, width, height);
      output = await canvasBlob(canvas, quality);
      if (output.size <= MAX_OUTPUT_BYTES) return output;

      const scale = Math.max(
        0.7,
        Math.sqrt(MAX_OUTPUT_BYTES / output.size) * 0.92,
      );
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      quality = Math.max(0.55, quality - 0.07);
    }

    if (!output || output.size > MAX_OUTPUT_BYTES) {
      throw new Error("Could not reduce this image below 900 KB");
    }
    return output;
  } finally {
    decoded.dispose();
  }
}

export async function uploadPublicAvatar({
  supabase,
  file,
  ownerId,
  kind,
}: {
  supabase: SupabaseClient;
  file: File;
  ownerId: string;
  kind: AvatarKind;
}): Promise<UploadedAvatar> {
  const compressed = await compressAvatar(file);
  const path = `${ownerId}/${kind}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, compressed, {
      cacheControl: "3600",
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    throw new Error("Could not create the uploaded image URL");
  }

  return { path, publicUrl: data.publicUrl };
}

export async function removeAvatarObject(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw error;
}

function ownedAvatarPath(
  publicUrl: string | null | undefined,
  ownerId: string,
  expectedOrigin: string,
): string | null {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    if (url.origin !== expectedOrigin) return null;
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const path = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length),
    );
    return path.startsWith(`${ownerId}/`) ? path : null;
  } catch {
    return null;
  }
}

export async function removeReplacedOwnedAvatar({
  supabase,
  previousUrl,
  ownerId,
  replacementPath,
}: {
  supabase: SupabaseClient;
  previousUrl: string | null | undefined;
  ownerId: string;
  replacementPath?: string | null;
}): Promise<void> {
  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl("__origin_check__");
  const expectedOrigin = new URL(data.publicUrl).origin;
  const previousPath = ownedAvatarPath(previousUrl, ownerId, expectedOrigin);
  if (!previousPath || previousPath === replacementPath) return;
  await removeAvatarObject(supabase, previousPath);
}
