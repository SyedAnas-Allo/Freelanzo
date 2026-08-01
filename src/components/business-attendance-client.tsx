"use client";

import { useRouter } from "@/hooks/use-app-router";
import { useMemo, useState, useTransition } from "react";
import { Camera, Shield } from "lucide-react";
import { toast } from "sonner";
import { InfoCallout } from "@/components/info-callout";
import {
  AttendanceRecordCard,
  type AttendanceRecordView,
} from "@/components/attendance-record-card";
import { AttendanceCorrectionPanel } from "@/components/attendance-correction-panel";
import { JobHeroCard } from "@/components/job-hero-card";
import { PageContent } from "@/components/layout/page-content";
import { NumberedStepper } from "@/components/numbered-stepper";
import { OtpCountdown, OtpDigitDisplay } from "@/components/otp-digit-row";
import { PageBack } from "@/components/page-back";
import { WorkDayChips } from "@/components/work-day-chips";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { createClient } from "@/lib/supabase/client";
import {
  jobWorkDates,
  localDateISO,
  pickAttendanceDay,
} from "@/lib/work-dates";
import type { AttendanceKind, AttendanceOtp, Job } from "@/types/database";

type MissedWorker = {
  applicationId: string;
  name: string;
  needs: AttendanceKind;
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

export function BusinessAttendanceClient({
  job,
  kind,
  workDate: initialWorkDate,
  initialOtp,
  applicationIds,
  checkedInCount,
  checkedOutCount,
  acceptedCount,
  dayDoneCount,
  attendanceRecords,
  missedWorkers = [],
  onReload,
}: {
  job: Job;
  kind: AttendanceKind;
  workDate: string;
  initialOtp: AttendanceOtp | null;
  applicationIds: string[];
  checkedInCount: number;
  checkedOutCount: number;
  acceptedCount: number;
  /** Per work_date: freelancers who fully checked out that day */
  dayDoneCount?: Record<string, number>;
  attendanceRecords: AttendanceRecordView[];
  missedWorkers?: MissedWorker[];
  /** Re-fetch attendance data (realtime + after OTP generate). */
  onReload?: () => void;
}) {
  const router = useRouter();
  const dates = useMemo(() => jobWorkDates(job), [job]);
  const [workDate, setWorkDate] = useState(
    initialWorkDate || pickAttendanceDay(dates),
  );
  const [otp, setOtp] = useState(initialOtp);
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
    setOtp(null);
    router.push(
      `/business/jobs/${job.id}/attendance?kind=${kind}&date=${date}`,
    );
  }

  function generate() {
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("generate_attendance_otp", {
        p_job_id: job.id,
        p_kind: kind,
        p_work_date: workDate,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setOtp(data as AttendanceOtp);
      toast.success(`${isCheckIn ? "Check-in" : "Check-out"} OTP generated`);
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

      {isPastDay && missedWorkers.length > 0 ? (
        <AttendanceCorrectionPanel workDate={workDate} workers={missedWorkers} />
      ) : null}

      {!isPastDay && !isFutureDay ? (
        <Surface>
          <h2 className="text-sm font-extrabold">
            {kindLabel} Process
            {multi ? (
              <span className="ml-1 font-semibold text-muted-foreground">
                · Day {dates.indexOf(workDate) + 1}/{dates.length}
              </span>
            ) : null}
          </h2>
          <div className="mt-4">
            <NumberedStepper
              steps={[
                {
                  title: `Share ${kindLabel} OTP`,
                  description: (
                    <div className="space-y-3">
                      {otp && otp.work_date === workDate ? (
                        <>
                          <OtpDigitDisplay code={otp.code} />
                          <OtpCountdown expiresAt={otp.expires_at} />
                        </>
                      ) : (
                        <p className="text-xs font-light text-muted-foreground">
                          Generate a 6-digit OTP for freelancers on site
                          {multi ? " this day" : ""}.
                        </p>
                      )}
                      <Button
                        type="button"
                        onClick={generate}
                        disabled={pending}
                        className="w-full"
                      >
                        {otp && otp.work_date === workDate
                          ? "Regenerate OTP"
                          : "Generate OTP"}
                      </Button>
                    </div>
                  ),
                },
                {
                  title: "Ask Freelancer to Enter OTP",
                  icon: <Shield className="size-4" />,
                  description: (
                    <p className="text-xs font-light text-muted-foreground">
                      Freelancers enter this code in their app to verify
                      attendance.
                    </p>
                  ),
                },
                {
                  title: `${kindLabel} evidence`,
                  icon: <Camera className="size-4" />,
                  description: (
                    <p className="text-xs font-light text-muted-foreground">
                      Live photo, time, and GPS are saved when freelancers
                      submit. See all records for this day below.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </Surface>
      ) : isFutureDay ? (
        <InfoCallout
          title="Scheduled work day"
          icon={<Shield className="size-4" />}
        >
          <p>
            OTP check-in opens on {workDate}. Come back on that day to generate
            codes.
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

      <div className="rounded-xl border border-border/70 bg-card p-4 text-sm">
        <p className="font-bold">
          Attendance{multi ? " this day" : ""}
        </p>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          Checked in {checkedInCount}/{acceptedCount} · Checked out{" "}
          {checkedOutCount}/{acceptedCount}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={isCheckIn ? "default" : "outline"}
          className="w-full"
          onClick={() =>
            router.push(
              `/business/jobs/${job.id}/attendance?kind=check_in&date=${workDate}`,
            )
          }
        >
          Check-In
        </Button>
        <Button
          variant={!isCheckIn ? "default" : "outline"}
          className="w-full"
          onClick={() =>
            router.push(
              `/business/jobs/${job.id}/attendance?kind=check_out&date=${workDate}`,
            )
          }
        >
          Check-Out
        </Button>
      </div>

      {allDaysCompleteForPayment || job.status === "completed" ? (
        <Button
          className="w-full"
          onClick={() => router.push(`/business/jobs/${job.id}/payment`)}
        >
          Continue to Payment
        </Button>
      ) : null}
    </PageContent>
  );
}
