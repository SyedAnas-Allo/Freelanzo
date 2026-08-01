"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceKind } from "@/types/database";

type MissedWorker = {
  applicationId: string;
  name: string;
  needs: AttendanceKind;
};

export function AttendanceCorrectionPanel({
  workDate,
  workers,
}: {
  workDate: string;
  workers: MissedWorker[];
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(
    workers[0]?.applicationId ?? null,
  );

  if (workers.length === 0) return null;

  const current = workers.find((w) => w.applicationId === selected) ?? workers[0]!;

  function submit() {
    if (reason.trim().length < 5) {
      toast.error("Add a short reason (at least 5 characters)");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("correct_attendance", {
        p_application_id: current.applicationId,
        p_kind: current.needs,
        p_work_date: workDate,
        p_reason: reason.trim(),
        p_photo_path: null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(
        `Recorded ${current.needs === "check_in" ? "check-in" : "check-out"} for ${current.name}`,
      );
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-amber-900">
        Correct missed attendance
      </h2>
      <p className="mt-1 text-xs font-medium text-amber-800/80">
        {workDate} is in the past. OTP check-in is closed — record a correction
        with a reason. The freelancer will be notified.
      </p>

      <div className="mt-3 space-y-2">
        {workers.map((w) => (
          <button
            key={w.applicationId}
            type="button"
            onClick={() => setSelected(w.applicationId)}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors ${
              selected === w.applicationId
                ? "border-amber-400 bg-white text-amber-900"
                : "border-amber-100 bg-white/50 text-amber-800"
            }`}
          >
            <span>{w.name}</span>
            <span className="font-semibold text-amber-700">
              Needs {w.needs === "check_in" ? "check-in" : "check-out"}
            </span>
          </button>
        ))}
      </div>

      <Textarea
        className="mt-3 bg-white"
        placeholder="Reason for correction (required)…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={pending}
      />

      <Button
        className="mt-3 w-full"
        disabled={pending || reason.trim().length < 5}
        onClick={submit}
      >
        {pending
          ? "Saving…"
          : `Record ${current.needs === "check_in" ? "check-in" : "check-out"}`}
      </Button>
    </div>
  );
}
