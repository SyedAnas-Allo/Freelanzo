"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  hasGstin,
  isValidGstinFormat,
  normalizeGstin,
} from "@/lib/gstin";
import { createClient } from "@/lib/supabase/client";
import type { BusinessProfile } from "@/types/database";

export default function BusinessGstPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [gstNumber, setGstNumber] = useState("");
  const [savedGstin, setSavedGstin] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      const current = normalizeGstin(biz.gst_number);
      setSavedGstin(current);
      setGstNumber(current ?? "");
      setLoading(false);
    }
    void load();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    const normalized = normalizeGstin(gstNumber);
    if (normalized && !isValidGstinFormat(normalized)) {
      toast.error("Enter a valid 15-character GSTIN");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("business_profiles")
      .update({ gst_number: normalized })
      .eq("id", businessId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedGstin(normalized);
    toast.success(normalized ? "GSTIN saved" : "GSTIN removed");
    router.push("/profile");
    router.refresh();
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
        title="GST Details"
        description="Optional tax registration shown as a trust signal on your profile."
        action={
          hasGstin(savedGstin) ? (
            <Badge variant="success" size="sm">
              GSTIN Added
            </Badge>
          ) : (
            <Badge variant="outline" size="sm">
              Not added
            </Badge>
          )
        }
      />

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="gst_number">GSTIN</Label>
          <Input
            id="gst_number"
            className="mt-1 h-11 rounded-xl font-mono uppercase tracking-wide"
            placeholder="e.g. 29ABCDE1234F1Z5"
            maxLength={15}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
          />
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            15-character GST Identification Number. Leave blank to remove.
          </p>
        </div>
        <Button className="h-12 w-full rounded-xl" disabled={saving}>
          {saving ? "Saving…" : "Save GSTIN"}
        </Button>
      </form>
    </PageContent>
  );
}
