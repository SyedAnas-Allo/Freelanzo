"use client";

import { useRouter } from "@/hooks/use-app-router";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AttendanceRecordCard,
  type AttendanceRecordView,
} from "@/components/attendance-record-card";
import { CameraCapture } from "@/components/camera-capture";
import { InfoCallout } from "@/components/info-callout";
import { JobHeroCard } from "@/components/job-hero-card";
import { PageContent } from "@/components/layout/page-content";
import { NumberedStepper } from "@/components/numbered-stepper";
import { OtpDigitInput } from "@/components/otp-digit-row";
import { PageBack } from "@/components/page-back";
import { PaymentResponsibilityCallout } from "@/components/payment-responsibility-callout";
import { SosCallout } from "@/components/sos-callout";
import { WorkDayChips } from "@/components/work-day-chips";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { completedWorkDates } from "@/lib/attendance-days";
import { createClient } from "@/lib/supabase/client";
import { jobWorkDates, localDateISO } from "@/lib/work-dates";
import type { AttendanceKind, Job } from "@/types/database";

export function FreelancerAttendanceClient({
  job,
  applicationId,
  kind,
  workDate: initialWorkDate,
  alreadyDone,
  dayEvents,
  recordedEvent,
}: {
  job: Job;
  applicationId: string;
  kind: AttendanceKind;
  workDate: string;
  alreadyDone: boolean;
  dayEvents?: { kind: string; work_date: string }[];
  recordedEvent?: AttendanceRecordView | null;
}) {
  const router = useRouter();
  const backHref = `/freelancer/jobs/${job.id}`;
  const dates = useMemo(() => jobWorkDates(job), [job]);
  const [workDate, setWorkDate] = useState(initialWorkDate);
  const [code, setCode] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const isCheckIn = kind === "check_in";
  const multi = dates.length > 1;
  const today = localDateISO();
  const isPastDay = workDate < today;
  const isFutureDay = workDate > today;

  const doneDates = useMemo(
    () => completedWorkDates(dates, dayEvents ?? []),
    [dates, dayEvents],
  );

  function selectDay(date: string) {
    setWorkDate(date);
    setCode("");
    setPhoto(null);
    const path = isCheckIn ? "check-in" : "check-out";
    router.push(`/freelancer/jobs/${job.id}/${path}?date=${date}`);
  }

  function submit() {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit OTP from the business");
      return;
    }
    if (!photo) {
      toast.error("Capture a live photo to continue");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in again");
        return;
      }

      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        toast.message("Location unavailable — continuing without GPS");
      }

      const path = `${user.id}/${job.id}/${kind}-${workDate}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: true });
      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }

      const { error } = await supabase.rpc("verify_attendance_otp", {
        p_application_id: applicationId,
        p_kind: kind,
        p_code: code,
        p_photo_path: path,
        p_lat: lat,
        p_lng: lng,
        p_work_date: workDate,
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        isCheckIn
          ? lat != null
            ? "Checked in — time and location recorded"
            : "Checked in — time recorded (location unavailable)"
          : lat != null
            ? "Checked out — time and location recorded"
            : "Checked out — time recorded (location unavailable)",
      );

      if (isCheckIn) {
        router.push(`/freelancer/jobs/${job.id}`);
      } else {
        const remaining = dates.filter((d) => {
          if (d === workDate) return false;
          return !doneDates.has(d);
        });
        if (remaining.length === 0 && dates.every((d) => d === workDate || doneDates.has(d))) {
          router.push(`/freelancer/jobs/${job.id}/payment`);
        } else {
          router.push(`/freelancer/jobs/${job.id}`);
        }
      }
      router.refresh();
    });
  }

  if (alreadyDone) {
    return (
      <PageContent>
        <PageBack href={backHref} />
        <JobHeroCard job={job} workDate={multi ? workDate : undefined} />
        <SosCallout />
        {multi ? (
          <WorkDayChips
            dates={dates}
            value={workDate}
            onChange={selectDay}
            doneDates={doneDates}
          />
        ) : null}
        <InfoCallout title={isCheckIn ? "Already checked in" : "Already checked out"}>
          <p>
            {isCheckIn
              ? multi
                ? "You already checked in for this day. Pick another day above if needed."
                : "You have already completed check-in for this gig."
              : multi
                ? "You already checked out for this day."
                : "You have already completed check-out. Confirm payment next."}
          </p>
        </InfoCallout>
        {recordedEvent ? (
          <AttendanceRecordCard record={recordedEvent} />
        ) : null}
        <Button
          className="w-full"
          onClick={() =>
            router.push(
              isCheckIn
                ? `/freelancer/jobs/${job.id}/check-out?date=${workDate}`
                : doneDates.size >= dates.length
                  ? `/freelancer/jobs/${job.id}/payment`
                  : `/freelancer/jobs/${job.id}`,
            )
          }
        >
          Continue
        </Button>
        {!isCheckIn ? <PaymentResponsibilityCallout /> : null}
      </PageContent>
    );
  }

  if (isPastDay) {
    return (
      <PageContent>
        <PageBack href={backHref} />
        <JobHeroCard job={job} workDate={multi ? workDate : undefined} />
        <SosCallout />
        {multi ? (
          <WorkDayChips
            dates={dates}
            value={workDate}
            onChange={selectDay}
            doneDates={doneDates}
          />
        ) : null}
        <InfoCallout title="Missed attendance">
          <p>
            OTP {isCheckIn ? "check-in" : "check-out"} for {workDate} is closed.
            Ask the business to record a correction if you were present.
          </p>
        </InfoCallout>
        <Button className="w-full" onClick={() => router.push(`/freelancer/jobs/${job.id}`)}>
          Back to gig
        </Button>
      </PageContent>
    );
  }

  if (isFutureDay) {
    return (
      <PageContent>
        <PageBack href={backHref} />
        <JobHeroCard job={job} workDate={multi ? workDate : undefined} />
        <SosCallout />
        {multi ? (
          <WorkDayChips
            dates={dates}
            value={workDate}
            onChange={selectDay}
            doneDates={doneDates}
          />
        ) : null}
        <InfoCallout title="Scheduled">
          <p>
            {isCheckIn ? "Check-in" : "Check-out"} opens on {workDate}. Come back
            that day with the business OTP.
          </p>
        </InfoCallout>
        <Button className="w-full" onClick={() => router.push(`/freelancer/jobs/${job.id}`)}>
          Back to gig
        </Button>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageBack href={backHref} />
      <JobHeroCard job={job} workDate={multi ? workDate : undefined} />
      <SosCallout />

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

      <Surface>
        <h2 className="text-sm font-extrabold">
          {isCheckIn ? "Check-In" : "Check-Out"}
          {multi ? (
            <span className="ml-1 font-semibold text-muted-foreground">
              · Day {dates.indexOf(workDate) + 1}/{dates.length}
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          Ask the business for the {isCheckIn ? "login" : "logout"} OTP, then capture
          a live photo.
        </p>
        <div className="mt-4">
          <NumberedStepper
            steps={[
              {
                title: "Enter OTP",
                description: (
                  <OtpDigitInput value={code} onChange={setCode} disabled={pending} />
                ),
              },
              {
                title: "Capture photo",
                description: (
                  <CameraCapture
                    value={photo}
                    onChange={setPhoto}
                    label={
                      isCheckIn ? "Capture check-in photo" : "Capture check-out photo"
                    }
                  />
                ),
              },
            ]}
          />
        </div>
      </Surface>

      <Button
        className="w-full"
        disabled={pending || code.length !== 6 || !photo}
        onClick={submit}
      >
        {pending ? "Verifying…" : isCheckIn ? "Complete Check-In" : "Complete Check-Out"}
      </Button>
      {!isCheckIn ? <PaymentResponsibilityCallout /> : null}
    </PageContent>
  );
}
