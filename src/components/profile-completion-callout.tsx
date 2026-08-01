import Link from "next/link";
import { UserRound } from "lucide-react";
import { InfoCallout } from "@/components/info-callout";
import { Button } from "@/components/ui/button";
import type { ProfileGap } from "@/lib/profile-eligibility";

export function ProfileCompletionCallout({
  gaps,
  editHref,
  className,
}: {
  gaps: ProfileGap[];
  editHref: string;
  className?: string;
}) {
  if (gaps.length === 0) return null;

  const labels = gaps.map((g) => g.label).join(", ");

  return (
    <InfoCallout
      className={className}
      title="Complete your profile"
      icon={<UserRound className="size-4" />}
    >
      <p>
        Your application is in. Finish your profile so businesses can review
        you faster — still needed: {labels}.
      </p>
      <Button
        className="mt-3 h-9 w-full rounded-lg text-sm font-semibold"
        asChild
      >
        <Link href={editHref}>Complete profile</Link>
      </Button>
    </InfoCallout>
  );
}
