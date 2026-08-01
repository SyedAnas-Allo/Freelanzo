import { Shield } from "lucide-react";
import { InfoCallout } from "@/components/info-callout";
import type { PaymentStatus } from "@/types/database";

export function PaymentStatusCallout({
  status,
  role,
  anyDispute = false,
}: {
  status?: PaymentStatus | null;
  role: "freelancer" | "business";
  anyDispute?: boolean;
}) {
  if (role === "business") {
    if (anyDispute || status === "dispute") {
      return (
        <InfoCallout title="Payment dispute" icon={<Shield className="size-4" />}>
          <p>
            One or more freelancers reported a mismatch. Evidence (check-in/out
            photos) is stored. You can respond from each worker&apos;s payment
            detail after they submit.
          </p>
        </InfoCallout>
      );
    }

    return (
      <InfoCallout title="Immediate payment required" icon={<Shield className="size-4" />}>
        <p>Pay every freelancer in full as soon as the gig ends — no delays.</p>
        <p className="mt-1.5">
          Skipping or delaying payment can get your account suspended.
        </p>
        <p className="mt-1.5">
          Each freelancer confirms separately: matching answers close the
          payment, a mismatch opens a dispute.
        </p>
      </InfoCallout>
    );
  }

  if (status === "dispute") {
    return (
      <InfoCallout title="Dispute opened" icon={<Shield className="size-4" />}>
        <p>
          Your claim doesn&apos;t match the business. Check-in/out photos and GPS
          are stored as evidence.
        </p>
      </InfoCallout>
    );
  }

  if (status === "confirmed") {
    return (
      <InfoCallout title="Payment confirmed" icon={<Shield className="size-4" />}>
        <p>Both sides agree payment was completed. You can leave a rating next.</p>
      </InfoCallout>
    );
  }

  return (
    <InfoCallout title="Waiting on business" icon={<Shield className="size-4" />}>
      <p>
        You collect payment directly from the client — Freelanzo does not hold
        wages. Payment stays pending until both you and the business submit
        matching answers.
      </p>
    </InfoCallout>
  );
}
