import { Banknote } from "lucide-react";
import { InfoCallout } from "@/components/info-callout";

export function PaymentResponsibilityCallout({
  className,
}: {
  className?: string;
}) {
  return (
    <InfoCallout
      className={className}
      variant="important"
      title="Payment is between you and the client"
      icon={<Banknote className="size-4.5" />}
    >
      <p>
        You are responsible for collecting payment directly from the client
        after the gig. Freelanzo does not hold or transfer wages.
      </p>
    </InfoCallout>
  );
}
