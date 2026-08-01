"use client";

import Link from "next/link";
import { Phone, LifeBuoy } from "lucide-react";
import { DialLink } from "@/components/dial-link";
import { InfoCallout } from "@/components/info-callout";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { SosBadge } from "@/components/sos-badge";
import { Button } from "@/components/ui/button";
import { EMERGENCY_PHONE } from "@/lib/utils";

export default function SafetyPage() {
  return (
    <PageContent>
      <PageHeader
        backHref="/profile"
        title="Safety & Support"
        description="SOS, help, and safety tips for active gigs."
      />

      <div className="rounded-2xl border-2 border-red-400 bg-gradient-to-br from-red-50 to-red-100/80 p-5 text-center shadow-md shadow-red-500/15">
        <SosBadge size="lg" className="mx-auto ring-4 ring-red-200/80" />
        <h2 className="mt-3 text-xl font-extrabold tracking-tight text-red-700">
          Emergency SOS
        </h2>
        <p className="mt-1 text-xs font-medium text-red-800/80">
          Available during active gigs. Use only in a real emergency.
        </p>
        <div className="mt-4 grid gap-2">
          <Button
            className="h-12 w-full rounded-xl bg-red-600 text-base font-bold hover:bg-red-700"
            asChild
          >
            <DialLink phone={EMERGENCY_PHONE}>
              <Phone className="mr-2 size-4" />
              Call Emergency ({EMERGENCY_PHONE})
            </DialLink>
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl border-red-300 bg-white font-bold text-red-700"
            asChild
          >
            <Link href="/feedback">
              <LifeBuoy className="mr-2 size-4" />
              Contact Freelanzo Support
            </Link>
          </Button>
        </div>
      </div>

      <InfoCallout title="Safety tips">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Share your live gig status with a trusted contact</li>
          <li>Use check-in OTP + photo so attendance is verified</li>
          <li>Phone unlocks after accept, and locks again when the gig ends</li>
          <li>Leave immediately if you feel unsafe — then report</li>
        </ul>
      </InfoCallout>
    </PageContent>
  );
}
