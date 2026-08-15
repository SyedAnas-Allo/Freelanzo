"use client";

import { useRouter } from "@/hooks/use-app-router";
import { useMemo, useState, useTransition } from "react";
import { Clock3, LogIn, LogOut, MapPin, Shield, X } from "lucide-react";
import {
  ensureOnlineForMutation,
  flashSuccess,
  presentAppError,
} from "@/lib/flash-message";
import { InfoCallout } from "@/components/info-callout";
import {
  AttendanceRecordCard,
  type AttendanceRecordView,
} from "@/components/attendance-record-card";
import { AttendanceCorrectionPanel } from "@/components/attendance-correction-panel";
import { JobHeroCard } from "@/components/job-hero-card";
import { PageContent } from "@/components/layout/page-content";
import { PageBack } from "@/components/page-back";
import { WorkDayChips } from "@/components/work-day-chips";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Surface } from "@/components/ui/surface";
import { SwipeToConfirm } from "@/components/swipe-to-confirm";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  jobWorkDates,
  localDateISO,
  pickAttendanceDay,
} from "@/lib/work-dates";
import type { AttendanceKind, Job } from "@/types/database";

type MissedWorker = {
  applicationId: string;
  name: string;
  needs: AttendanceKind;
};

export type AttendanceRequestView = {
  id: string;
  applicationId: string;
  name: string;
  kind: AttendanceKind;
  workDate: string;
  requestedAt: string;
  expiresAt: string;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  status: "pending" | "confirmed" | "rejected" | "expired" | "cancelled";
  rejectionReason: string | null;
};

function AttendanceRecordsSection({
  kindLabel,
  records,
}: {
  kindLabel: string;
  records: AttendanceRecordView[];
}) {
  if (records.length === 0) return null;
  return (
    <Surface>
      <h2 className="text-sm font-extrabold">{kindLabel} records</h2>
      <p className="mt-1 text-xs font-light text-muted-foreground">
        Photo, time, and GPS for check-in and check-out on this day.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {records.map((record) => (
          <AttendanceRecordCard key={record.id} record={record} />
        ))}
      </div>
    </Surface>
  );
}

/** Segmented switch between the arrivals (check-in) and leaving (check-out) views. */
function AttendanceKindTabs({
  value,
  onChange,
  checkedInCount,
  checkedOutCount,
  acceptedCount,
}: {
  value: AttendanceKind;
  onChange: (kind: AttendanceKind) => void;
  checkedInCount: number;
  checkedOutCount: number;
  acceptedCount: number;
}) {
  const tabs = [
    {
      kind: "check_in" as AttendanceKind,
      label: "Check-in",
      icon: LogIn,
      done: checkedInCount,
    },
    {
      kind: "check_out" as AttendanceKind,
      label: "Check-out",
      icon: LogOut,
      done: checkedOutCount,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Attendance step"
      className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/60 p-1"
    >
      {tabs.map(({ kind, label, icon: Icon, done }) => {
        const active = kind === value;
        return (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(kind)}
            className={cn(
              "rounded-lg px-3 py-2 transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex items-center justify-center gap-1.5 text-[13px] font-bold">
              <Icon
                className={cn("size-3.5", active && "text-primary")}
                aria-hidden
              />
              {label}
            </span>
            <span className="mt-0.5 block text-[11px] font-medium">
              {done}/{acceptedCount} done
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BusinessAttendanceClient({
  job,
  kind,
  workDate: initialWorkDate,
  applicationIds,
  checkedInCount,
  checkedOutCount,
  acceptedCount,
  dayDoneCount,
  attendanceRecords,
  attendanceRequests,
  missedWorkers = [],
  onReload,
}: {
  job: Job;
  kind: AttendanceKind;
  workDate: string;
  applicationIds: string[];
  checkedInCount: number;
  checkedOutCount: number;
  acceptedCount: number;
  /** Per work_date: freelancers who fully checked out that day */
  dayDoneCount?: Record<string, number>;
  attendanceRecords: AttendanceRecordView[];
  attendanceRequests: AttendanceRequestView[];
  missedWorkers?: MissedWorker[];
  /** Re-fetch attendance data after realtime or review actions. */
  onReload?: () => void;
}) {
  const router = useRouter();
  const dates = useMemo(() => jobWorkDates(job), [job]);
  const [workDate, setWorkDate] = useState(
    initialWorkDate || pickAttendanceDay(dates),
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [rejectTarget, setRejectTarget] =
    useState<AttendanceRequestView | null>(null);
  const [rejectionReason, setRejectionReason] = useState("Not on site");
  const [pending, startTransition] = useTransition();
  const isCheckIn = kind === "check_in";
  const kindLabel = isCheckIn ? "Check-In" : "Check-Out";
  const multi = dates.length > 1;
  const today = localDateISO();
  const isPastDay = workDate < today;
  const isFutureDay = workDate > today;

  const attendanceFilter = useMemo(
    () =>
      applicationIds.length > 0
        ? `application_id=in.(${applicationIds.join(",")})`
        : undefined,
    [applicationIds],
  );

  // Live photos + counts while the owner waits on site (channel only while mounted).
  useRealtimeRefresh({
    channelName: `attendance:${job.id}`,
    table: "attendance_events",
    filter: attendanceFilter,
    enabled: applicationIds.length > 0 && !!onReload,
    onEvent: () => onReload?.(),
  });

  useRealtimeRefresh({
    channelName: `attendance-requests:${job.id}:${kind}:${workDate}`,
    table: "attendance_requests",
    event: "*",
    filter: attendanceFilter,
    enabled: applicationIds.length > 0 && !!onReload,
    onEvent: () => onReload?.(),
  });

  const doneDates = useMemo(() => {
    const set = new Set<string>();
    if (!dayDoneCount) return set;
    for (const [d, n] of Object.entries(dayDoneCount)) {
      if (n >= acceptedCount && acceptedCount > 0) set.add(d);
    }
    return set;
  }, [dayDoneCount, acceptedCount]);

  const allDaysCompleteForPayment =
    acceptedCount > 0 &&
    dates.every((d) => (dayDoneCount?.[d] ?? 0) >= acceptedCount);

  function selectDay(date: string) {
    setWorkDate(date);
    setSelected(new Set());
    router.push(
      `/business/jobs/${job.id}/attendance?kind=${kind}&date=${date}`,
    );
  }

  function selectKind(nextKind: AttendanceKind) {
    if (nextKind === kind) return;
    setSelected(new Set());
    router.push(
      `/business/jobs/${job.id}/attendance?kind=${nextKind}&date=${workDate}`,
    );
  }

  const waitingRequests = attendanceRequests.filter(
    (request) => request.status === "pending",
  );
  const expiredCount = attendanceRequests.filter(
    (request) => request.status === "expired",
  ).length;

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function review(
    requestIds: string[],
    decision: "confirmed" | "rejected",
    reason?: string,
  ) {
    if (requestIds.length === 0) return;
    if (!ensureOnlineForMutation()) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("review_attendance_requests", {
        p_request_ids: requestIds,
        p_decision: decision,
        p_rejection_reason: decision === "rejected" ? reason : null,
      });
      if (error) {
        presentAppError(error, {
          onRetry: () => review(requestIds, decision, reason),
        });
        onReload?.();
        return;
      }
      flashSuccess(
        decision === "confirmed"
          ? `${requestIds.length} ${kindLabel.toLowerCase()} request${requestIds.length === 1 ? "" : "s"} confirmed`
          : `${kindLabel} request declined`,
      );
      setSelected(new Set());
      setRejectTarget(null);
      onReload?.();
    });
  }

  return (
    <PageContent>
      <PageBack href={`/business/jobs/${job.id}/applicants`} />
      <JobHeroCard job={job} workDate={multi ? workDate : undefined} />

      {multi ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Which work day?
          </p>
          <WorkDayChips
            dates={dates}
            value={workDate}
            onChange={selectDay}
            doneDates={doneDates}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {multi ? "Which step for this day?" : "Which step?"}
        </p>
        <AttendanceKindTabs
          value={kind}
          onChange={selectKind}
          checkedInCount={checkedInCount}
          checkedOutCount={checkedOutCount}
          acceptedCount={acceptedCount}
        />
      </div>

      {isPastDay && missedWorkers.length > 0 ? (
        <AttendanceCorrectionPanel workDate={workDate} workers={missedWorkers} />
      ) : null}

      {!isPastDay && !isFutureDay ? (
        <div className="space-y-3">
          <Surface>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold">
                  {kindLabel} requests
                  {multi ? (
                    <span className="ml-1 font-semibold text-muted-foreground">
                      · Day {dates.indexOf(workDate) + 1}/{dates.length}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-xs font-light text-muted-foreground">
                  Freelancers send a live photo and location from their app.
                  Confirm them as they arrive.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                {waitingRequests.length} waiting
              </span>
            </div>

            {waitingRequests.length > 0 ? (
              <div className="mt-4 space-y-3 border-t border-border/70 pt-3">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <Checkbox
                    checked={
                      selected.size === waitingRequests.length &&
                      waitingRequests.length > 0
                    }
                    onCheckedChange={(checked) =>
                      setSelected(
                        checked === true
                          ? new Set(waitingRequests.map((request) => request.id))
                          : new Set(),
                      )
                    }
                  />
                  Select all ({waitingRequests.length})
                </label>
                <SwipeToConfirm
                  label={
                    selected.size === 0
                      ? "Select who has arrived"
                      : `Slide to confirm ${selected.size}`
                  }
                  confirmLabel={`Confirmed ${selected.size}`}
                  disabled={selected.size === 0}
                  loading={pending}
                  onConfirm={() => review(Array.from(selected), "confirmed")}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-muted/40 px-3 py-4 text-center">
                <Shield className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-1.5 text-xs font-semibold">
                  No one is waiting right now
                </p>
                <p className="mt-0.5 text-[11px] font-light text-muted-foreground">
                  New requests appear here automatically.
                </p>
              </div>
            )}
            {expiredCount > 0 ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {expiredCount} expired request{expiredCount === 1 ? "" : "s"}{" "}
                hidden · ask the freelancer to send a new one.
              </p>
            ) : null}
          </Surface>

          {waitingRequests.map((request) => (
            <Surface key={request.id} className="overflow-hidden p-0">
              {request.photoUrl ? (
                <a href={request.photoUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={request.photoUrl}
                    alt={`${request.name} attendance request`}
                    className="aspect-[16/9] w-full object-cover"
                  />
                </a>
              ) : null}
              <div className="space-y-3 p-3.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(request.id)}
                    onCheckedChange={(checked) =>
                      toggleSelected(request.id, checked === true)
                    }
                    aria-label={`Select ${request.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{request.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock3 className="size-3 text-primary" />
                      Requested{" "}
                      {new Date(request.requestedAt).toLocaleTimeString(
                        "en-IN",
                        {
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <MapPin className="size-3 text-primary" />
                      {request.lat != null && request.lng != null
                        ? "Location recorded"
                        : "Location unavailable"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <SwipeToConfirm
                    label={`Slide to confirm ${request.name.split(" ")[0]}`}
                    confirmLabel="Confirmed"
                    loading={pending}
                    onConfirm={() => review([request.id], "confirmed")}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={pending}
                    onClick={() => {
                      setRejectionReason("Not on site");
                      setRejectTarget(request);
                    }}
                  >
                    <X className="size-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      ) : isFutureDay ? (
        <InfoCallout
          title="Scheduled work day"
          icon={<Shield className="size-4" />}
        >
          <p>
            Attendance opens on {workDate}. Requests will appear here when
            freelancers arrive on that day.
          </p>
        </InfoCallout>
      ) : missedWorkers.length === 0 ? (
        <InfoCallout
          title="Day complete"
          icon={<Shield className="size-4" />}
        >
          <p>
            All accepted freelancers have attendance recorded for {workDate}.
          </p>
        </InfoCallout>
      ) : null}

      <AttendanceRecordsSection
        kindLabel="Attendance"
        records={attendanceRecords}
      />

      <InfoCallout
        title={isCheckIn ? "Why Check-In?" : "What happens next?"}
        icon={<Shield className="size-4" />}
      >
        {isCheckIn ? (
          <ul className="list-disc space-y-1 pl-4">
            <li>Confirms the freelancer is on site for this work day</li>
            <li>
              {multi
                ? "Repeat check-in each work day"
                : "Creates a safety & attendance record for both parties"}
            </li>
          </ul>
        ) : (
          <ul className="list-disc space-y-1 pl-4">
            <li>Marks this work day complete for the freelancer</li>
            <li>
              {multi
                ? "Pay once after all work days are done"
                : "Next step: confirm payment for each freelancer"}
            </li>
          </ul>
        )}
      </InfoCallout>

      {isCheckIn && checkedInCount >= acceptedCount && acceptedCount > 0 ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => selectKind("check_out")}
        >
          <LogOut className="size-4" />
          Go to check-out
        </Button>
      ) : null}

      {allDaysCompleteForPayment || job.status === "completed" ? (
        <Button
          className="w-full"
          onClick={() => router.push(`/business/jobs/${job.id}/payment`)}
        >
          Continue to Payment
        </Button>
      ) : null}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setRejectTarget(null);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Reject attendance request?</DialogTitle>
            <DialogDescription>
              {rejectTarget?.name ?? "This freelancer"} can capture a new photo
              and try again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {["Not on site", "Wrong person", "Unclear photo"].map((reason) => (
              <button
                key={reason}
                type="button"
                disabled={pending}
                onClick={() => setRejectionReason(reason)}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                  rejectionReason === reason
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/70"
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !rejectTarget}
              onClick={() => {
                if (rejectTarget) {
                  review([rejectTarget.id], "rejected", rejectionReason);
                }
              }}
            >
              {pending ? "Rejecting…" : "Reject request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContent>
  );
}
