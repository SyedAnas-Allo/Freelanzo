"use client";

import Link from "next/link";
import { Phone, MessageCircle, MessageSquare } from "lucide-react";
import { DialLink } from "@/components/dial-link";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { InfoCallout } from "@/components/info-callout";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { SosBadge } from "@/components/sos-badge";
import { Button } from "@/components/ui/button";
import {
  EMERGENCY_PHONE,
  SUPPORT_WHATSAPP_MESSAGE,
  SUPPORT_WHATSAPP_PHONE,
} from "@/lib/utils";

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
            <WhatsAppLink
              phone={SUPPORT_WHATSAPP_PHONE}
              message={SUPPORT_WHATSAPP_MESSAGE}
            >
              <MessageCircle className="mr-2 size-4" />
              WhatsApp Freelanzo Support
            </WhatsAppLink>
          </Button>
        </div>
        <p className="mt-3 text-[11px] font-medium text-red-800/70">
          Support WhatsApp: +91 96200 55756
        </p>
      </div>

      <InfoCallout title="Safety tips">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>Share your live gig status with a trusted contact</li>
          <li>Use live-photo attendance requests so presence is verified</li>
          <li>Phone unlocks after accept, and locks again when the gig ends</li>
          <li>Leave immediately if you feel unsafe — then report</li>
        </ul>
      </InfoCallout>

      <div className="mt-4 rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-bold text-foreground">Product feedback</p>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          Ideas and app ratings are separate from emergency support.
        </p>
        <Button variant="ghost" className="mt-2 h-9 px-0 text-primary" asChild>
          <Link href="/feedback">
            <MessageSquare className="mr-2 size-4" />
            Send feedback
          </Link>
        </Button>
      </div>
    </PageContent>
  );
}
