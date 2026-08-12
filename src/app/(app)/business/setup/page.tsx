"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { refreshSessionProfile } from "@/hooks/use-session-profile";
import { isValidGstinFormat, normalizeGstin } from "@/lib/gstin";
import { setActiveModeCookie } from "@/lib/role-session";
import { createClient } from "@/lib/supabase/client";

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function BusinessSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <BusinessSetupForm />
    </Suspense>
  );
}

function BusinessSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    contact_person: "",
    address: "",
    description: "",
    gst_number: "",
  });

  useEffect(() => {
    async function checkExisting() {
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
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        await refreshSessionProfile();
        router.replace(returnTo ?? "/business/edit");
        return;
      }
      setChecking(false);
    }
    void checkExisting();
  }, [router, returnTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const gst = normalizeGstin(form.gst_number);
    if (gst && !isValidGstinFormat(gst)) {
      toast.error("Enter a valid 15-character GSTIN, or leave it blank");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("business_profiles").insert({
      owner_id: user.id,
      business_name: form.business_name.trim(),
      contact_person: form.contact_person.trim() || null,
      address: form.address.trim() || null,
      description: form.description.trim() || null,
      gst_number: gst,
    });

    if (!error) {
      await supabase
        .from("profiles")
        .update({ active_mode: "business" })
        .eq("id", user.id);
      setActiveModeCookie("business");
    }

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Business profile created");
    // Must refresh shared session before gated routes (e.g. /business/jobs/new)
    // or stale business:null + returnTo ping-pongs forever.
    await refreshSessionProfile();
    router.push(returnTo ?? "/business");
  }

  if (checking) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <PageContent>
      <PageHeader
        backHref="/business"
        title="Business Profile"
        description="Required before posting a gig."
      />

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="setup_business_name">Business Name</Label>
          <Input
            id="setup_business_name"
            required
            className="mt-1 h-11 rounded-xl"
            value={form.business_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, business_name: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="setup_contact_person">Contact Person</Label>
          <Input
            id="setup_contact_person"
            className="mt-1 h-11 rounded-xl"
            value={form.contact_person}
            onChange={(e) =>
              setForm((f) => ({ ...f, contact_person: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="setup_address">Address</Label>
          <Input
            id="setup_address"
            className="mt-1 h-11 rounded-xl"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="setup_description">Description</Label>
          <Textarea
            id="setup_description"
            className="mt-1 rounded-xl"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="setup_gst">GSTIN (optional)</Label>
          <Input
            id="setup_gst"
            className="mt-1 h-11 rounded-xl font-mono uppercase tracking-wide"
            placeholder="e.g. 29ABCDE1234F1Z5"
            maxLength={15}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={form.gst_number}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                gst_number: e.target.value.toUpperCase(),
              }))
            }
          />
        </div>
        <Button className="h-12 w-full rounded-xl" disabled={loading}>
          {loading ? "Saving…" : "Save & Continue"}
        </Button>
      </form>
    </PageContent>
  );
}
