"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { jobShareUrl, shareOrCopy } from "@/lib/share";
import { cn } from "@/lib/utils";

export function ReferJobButton({
  jobId,
  jobTitle,
  className,
}: {
  jobId: string;
  jobTitle: string;
  className?: string;
}) {
  async function onRefer() {
    try {
      const result = await shareOrCopy({
        url: jobShareUrl(jobId),
        title: jobTitle,
        text: `Check out this gig on Freelanzo: ${jobTitle}`,
      });
      if (result === "copied") toast.success("Job link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Couldn't share right now");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("text-muted-foreground", className)}
      aria-label="Refer this gig"
      onClick={onRefer}
    >
      <Share2 className="size-4" />
    </Button>
  );
}
