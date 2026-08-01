"use client";

import { useState } from "react";
import { Flag, MoreVertical } from "lucide-react";
import { ReportSheet } from "@/components/report-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReportDirection } from "@/lib/reports";

export function ReportMenuButton({
  direction,
  reportedUserId,
  reportedName,
  jobId,
  applicationId,
  align = "end",
}: {
  direction: ReportDirection;
  reportedUserId: string;
  reportedName: string;
  jobId: string | null;
  applicationId: string | null;
  align?: "start" | "end" | "center";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Options for ${reportedName}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          sideOffset={6}
          className="min-w-48 rounded-xl p-1.5 shadow-lg ring-1 ring-border/60"
        >
          <DropdownMenuItem
            className="gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold"
            onSelect={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Flag className="size-3.5" />
            </span>
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportSheet
        open={open}
        onOpenChange={setOpen}
        direction={direction}
        reportedUserId={reportedUserId}
        reportedName={reportedName}
        jobId={jobId}
        applicationId={applicationId}
      />
    </>
  );
}
