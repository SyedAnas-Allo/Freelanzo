"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { refreshSessionProfile } from "@/hooks/use-session-profile";
import {
  removeAvatarObject,
  removeReplacedOwnedAvatar,
  uploadPublicAvatar,
  validateAvatarFile,
} from "@/lib/avatar-upload";
import { createClient } from "@/lib/supabase/client";
import type { BusinessProfile } from "@/types/database";

export default function BusinessEditPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [initialLogoUrl, setInitialLogoUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoPreviewUrl = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : ""),
    [logoFile],
  );
  const [form, setForm] = useState({
    business_name: "",
    contact_person: "",
    address: "",
    description: "",
  });

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

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

      const { data } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!data) {
        router.replace("/business/setup");
        return;
      }

      const biz = data as BusinessProfile;
      setBusinessId(biz.id);
      setOwnerId(biz.owner_id);
      const storedLogoUrl = biz.logo_url?.startsWith("data:")
        ? ""
        : biz.logo_url ?? "";
      setInitialLogoUrl(storedLogoUrl);
      setLogoUrl(storedLogoUrl);
      setForm({
        business_name: biz.business_name ?? "",
        contact_person: biz.contact_person ?? "",
        address: biz.address ?? "",
        description: biz.description ?? "",
      });
      setLoading(false);
    }
    void load();
  }, [router]);

  function pickPhoto(file: File | null) {
    if (!file) return;
    const validationMessage = validateAvatarFile(file);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    setLogoFile(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !ownerId) return;
    setSaving(true);
    const supabase = createClient();
    let uploadedLogo: Awaited<ReturnType<typeof uploadPublicAvatar>> | null =
      null;
    try {
      if (logoFile) {
        uploadedLogo = await uploadPublicAvatar({
          supabase,
          file: logoFile,
          ownerId,
          kind: "businesses",
        });
      }
    } catch (error) {
      setSaving(false);
      toast.error(error instanceof Error ? error.message : "Logo upload failed");
      return;
    }

    const nextLogoUrl = (uploadedLogo?.publicUrl ?? logoUrl) || null;
    const { error } = await supabase
      .from("business_profiles")
      .update({
        business_name: form.business_name.trim(),
        contact_person: form.contact_person.trim() || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
        logo_url: nextLogoUrl,
      })
      .eq("id", businessId);

    setSaving(false);
    if (error) {
      if (uploadedLogo) {
        await removeAvatarObject(supabase, uploadedLogo.path).catch(() => {});
      }
      toast.error(error.message);
      return;
    }
    if (uploadedLogo || nextLogoUrl !== initialLogoUrl) {
      await removeReplacedOwnedAvatar({
        supabase,
        previousUrl: initialLogoUrl,
        ownerId,
        replacementPath: uploadedLogo?.path,
      }).catch(() => {});
    }
    toast.success("Business information updated");
    await refreshSessionProfile();
    router.push("/profile");
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <PageContent className="pb-10">
      <PageHeader
        backHref="/profile"
        title="Business Information"
        description="Name, address, contact person, and how you describe your business."
      />

      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <Label>Business photo (optional)</Label>
          <div className="relative">
            <Avatar className="size-24 border-2 border-primary/20">
              <AvatarImage src={logoPreviewUrl || logoUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                {(form.business_name || "?").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              aria-label="Change business photo"
              className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                pickPhoto(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="text-xs font-bold text-primary"
              onClick={() => fileRef.current?.click()}
            >
              {logoPreviewUrl || logoUrl ? "Change photo" : "Add photo"}
            </button>
            {logoPreviewUrl || logoUrl ? (
              <button
                type="button"
                className="text-xs font-bold text-muted-foreground"
                onClick={() => {
                  setLogoFile(null);
                  setLogoUrl("");
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <Label htmlFor="business_name">Business Name</Label>
          <Input
            id="business_name"
            required
            className="mt-1 h-11 rounded-xl"
            value={form.business_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, business_name: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="contact_person">Contact Person</Label>
          <Input
            id="contact_person"
            className="mt-1 h-11 rounded-xl"
            value={form.contact_person}
            onChange={(e) =>
              setForm((f) => ({ ...f, contact_person: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            className="mt-1 h-11 rounded-xl"
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            className="mt-1 rounded-xl"
            rows={4}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>
        <Button className="h-12 w-full rounded-xl" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </PageContent>
  );
}
