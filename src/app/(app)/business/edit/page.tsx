"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { BusinessProfile } from "@/types/database";

export default function BusinessEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [form, setForm] = useState({
    business_name: "",
    contact_person: "",
    address: "",
    description: "",
  });

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("business_profiles")
      .update({
        business_name: form.business_name.trim(),
        contact_person: form.contact_person.trim() || null,
        address: form.address.trim() || null,
        description: form.description.trim() || null,
      })
      .eq("id", businessId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Business information updated");
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
        title="Business Information"
        description="Name, address, contact person, and how you describe your business."
      />

      <form onSubmit={submit} className="space-y-4">
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
