"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/hooks/use-app-router";
import {
  BadgeCheck,
  Briefcase,
  Images,
  LogOut,
  MessageSquare,
  Pencil,
  Scale,
  Share2,
  Shield,
  Star,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { BusinessProfileView } from "@/components/business-profile-view";
import { FreelancerProfileView } from "@/components/freelancer-profile-view";
import { LegalDocumentSheet } from "@/components/legal-document-sheet";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { SosBadge } from "@/components/sos-badge";
import { Button } from "@/components/ui/button";
import { useWorkPhotos } from "@/hooks/use-work-photos";
import { hasGstin } from "@/lib/gstin";
import type { LegalDocumentId } from "@/lib/legal";
import { loadBusinessStats } from "@/lib/load-business-stats";
import { loadFreelancerStats } from "@/lib/load-freelancer-stats";
import {
  type BusinessProfileStats,
  type FreelancerProfileStats,
} from "@/lib/profile-stats";
import { clearRoleReadyCookie } from "@/lib/role-session";
import { shareOrCopy, SITE_URL } from "@/lib/share";
import { createClient } from "@/lib/supabase/client";
import { invalidateSessionProfile } from "@/hooks/use-session-profile";
import { PageLoading } from "@/components/page-loading";
import type { BusinessProfile, Profile } from "@/types/database";

const EMPTY_FREELANCER_STATS: FreelancerProfileStats = {
  jobsCompleted: 0,
  acceptedJobs: 0,
  attendanceRate: 100,
  cancellationRate: 0,
  noShowRate: 0,
  reliability: 80,
  avgRating: null,
  reviewCount: 0,
  totalEarnings: 0,
  jobsInProgress: 0,
};

const EMPTY_BUSINESS_STATS: BusinessProfileStats = {
  jobsPosted: 0,
  jobsCompleted: 0,
  jobsCancelled: 0,
  freelancersHired: 0,
  paymentRate: 100,
  cancelRate: 0,
  reliability: 80,
  avgRating: null,
  reviewCount: 0,
  activeGigs: 0,
  categories: [],
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FreelancerProfileStats>(
    EMPTY_FREELANCER_STATS,
  );
  const [businessStats, setBusinessStats] =
    useState<BusinessProfileStats>(EMPTY_BUSINESS_STATS);
  const [legalDoc, setLegalDoc] = useState<LegalDocumentId | null>(null);
  const { photos } = useWorkPhotos(profile?.id);

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
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      const { data: b } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      setProfile(p as Profile | null);
      setBusiness(b as BusinessProfile | null);

      const loaded = await loadFreelancerStats(supabase, user.id);
      setStats(loaded);

      if (b) {
        const biz = b as BusinessProfile;
        const loadedBiz = await loadBusinessStats(supabase, biz.id, biz.owner_id);
        setBusinessStats(loadedBiz);
      }

      setLoading(false);
    }
    void load();
  }, [router]);

  async function logout() {
    const supabase = createClient();
    clearRoleReadyCookie();
    invalidateSessionProfile();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function referFreelanzo() {
    try {
      const result = await shareOrCopy({
        url: SITE_URL,
        title: "Freelanzo",
        text: "Find gigs near you on Freelanzo",
      });
      if (result === "copied") {
        toast.success("Link copied — share Freelanzo with friends");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Couldn't share right now");
    }
  }

  if (loading) {
    return <PageLoading variant="profile" />;
  }

  const isBusiness = profile?.active_mode === "business";

  if (!isBusiness && profile) {
    return (
      <div className="space-y-4 px-4 py-4 pb-8">
        <FreelancerProfileView
          profile={profile}
          stats={stats}
          workPhotos={photos}
          variant="self"
        />

        <SettingsGroup>
          <SettingsRow
            href="/profile/edit"
            icon={<Pencil className="size-4" />}
            label="Edit Profile"
            description="Name, photo, age, phone, location"
          />
          <SettingsRow
            href="/profile/experience"
            icon={<Briefcase className="size-4" />}
            label="Work History"
            description="Gigs you’ve completed"
          />
          <SettingsRow
            href="/profile/photos"
            icon={<Images className="size-4" />}
            label="Profile Photos"
            description="Add & preview work photos"
          />
          <SettingsRow
            href="/freelancer/earnings"
            icon={<Wallet className="size-4" />}
            label="Earnings"
            description="View your earnings"
          />
          <SettingsRow
            href="/reviews"
            icon={<Star className="size-4" />}
            label="Reviews"
            description="Ratings given by businesses"
          />
          <SettingsRow
            onClick={referFreelanzo}
            icon={<Share2 className="size-4" />}
            label="Refer Freelanzo"
            description="Share freelanzo-three.vercel.app with friends"
          />
          <SettingsRow
            href="/feedback"
            icon={<MessageSquare className="size-4" />}
            label="Send feedback"
            description="Rate Freelanzo and share ideas"
          />
          <SettingsRow
            href="/safety"
            icon={<SosBadge size="sm" />}
            label="Safety & SOS"
            description="Emergency help on gigs"
            danger
            bareIcon
          />
          <SettingsRow
            onClick={() => setLegalDoc("terms")}
            icon={<Scale className="size-4" />}
            label="Terms & Conditions"
            description="Rules for using Freelanzo"
          />
          <SettingsRow
            onClick={() => setLegalDoc("privacy")}
            icon={<Shield className="size-4" />}
            label="Privacy Policy"
            description="How we use your data"
          />
        </SettingsGroup>

        <Button
          variant="outline"
          className="h-12 w-full rounded-xl text-destructive"
          onClick={logout}
        >
          <LogOut className="size-4" /> Logout
        </Button>

        <LegalDocumentSheet
          documentId={legalDoc}
          open={legalDoc !== null}
          onOpenChange={(open) => {
            if (!open) setLegalDoc(null);
          }}
        />
      </div>
    );
  }

  const location = [profile?.area, profile?.city].filter(Boolean).join(", ");

  return (
    <div className="space-y-4 px-4 py-4 pb-8">
      {business ? (
        <BusinessProfileView
          business={business}
          location={location || business.address}
          stats={businessStats}
          variant="self"
        />
      ) : null}

      <SettingsGroup>
        <SettingsRow
          href="/profile/edit"
          icon={<Pencil className="size-4" />}
          label="Edit Profile"
          description="Name, photo, phone, location"
        />
        <SettingsRow
          href="/business/edit"
          icon={<Briefcase className="size-4" />}
          label="Business Information"
          description="Name, address & contact"
        />
        <SettingsRow
          href="/business/gst"
          icon={<BadgeCheck className="size-4" />}
          label="GST Details"
          description="Tax information"
          pill={hasGstin(business?.gst_number) ? "GSTIN Added" : "Add GSTIN"}
          pillVariant={hasGstin(business?.gst_number) ? "success" : "outline"}
        />
        <SettingsRow
          href="/business/jobs/history"
          icon={<Briefcase className="size-4" />}
          label="Gig History"
          description="Past and completed gigs"
        />
        <SettingsRow
          href="/reviews"
          icon={<Star className="size-4" />}
          label="Ratings & Reviews"
          description="Feedback from freelancers"
        />
        <SettingsRow
          onClick={referFreelanzo}
          icon={<Share2 className="size-4" />}
          label="Refer Freelanzo"
          description="Share freelanzo-three.vercel.app with friends"
        />
        <SettingsRow
          href="/feedback"
          icon={<MessageSquare className="size-4" />}
          label="Send feedback"
          description="Rate Freelanzo and share ideas"
        />
        <SettingsRow
          onClick={() => setLegalDoc("terms")}
          icon={<Scale className="size-4" />}
          label="Terms & Conditions"
          description="Rules for using Freelanzo"
        />
        <SettingsRow
          onClick={() => setLegalDoc("privacy")}
          icon={<Shield className="size-4" />}
          label="Privacy Policy"
          description="How we use your data"
        />
      </SettingsGroup>

      <Button
        variant="outline"
        className="h-12 w-full rounded-xl text-destructive"
        onClick={logout}
      >
        <LogOut className="size-4" /> Logout
      </Button>

      <LegalDocumentSheet
        documentId={legalDoc}
        open={legalDoc !== null}
        onOpenChange={(open) => {
          if (!open) setLegalDoc(null);
        }}
      />
    </div>
  );
}
