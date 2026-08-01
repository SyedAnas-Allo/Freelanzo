"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { formatPay } from "@/lib/utils";
import type { PostJobFormController } from "./use-post-job-form";

export function JobPostingConsent({
  controller: {
    form,
    postingFee,
    paymentAccepted,
    setPaymentAccepted,
  },
}: {
  controller: PostJobFormController;
}) {
  return (
    <div className="divide-y divide-primary/10 overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.06]">
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">Posting fee</p>
          <p className="text-sm font-extrabold text-primary">
            {formatPay(postingFee)}
          </p>
        </div>
        <p className="mt-1 text-[11px] font-light text-muted-foreground">
          {form.headcount} Freelancers × ₹50 · first 2 posts free ·
          non-refundable once published.
        </p>
      </div>
      <div className="flex items-start gap-3 px-3.5 py-3">
        <Checkbox
          id="immediate-payment"
          checked={paymentAccepted}
          onCheckedChange={(checked) => setPaymentAccepted(checked === true)}
          aria-describedby="payment-acknowledgment"
          className="mt-0.5 size-5"
        />
        <label
          htmlFor="immediate-payment"
          className="min-w-0 cursor-pointer"
        >
          <span className="block text-sm font-bold">
            I agree to pay freelancers immediately
          </span>
          <span
            id="payment-acknowledgment"
            className="mt-1 block text-[11px] font-light leading-relaxed text-muted-foreground"
          >
            I will pay every freelancer their full agreed amount by Cash or UPI
            as soon as their work ends.
            <br />
            Skipping or delaying payment can get my account suspended.
          </span>
        </label>
      </div>
    </div>
  );
}
