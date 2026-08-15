"use client";

import { useRouter } from "@/hooks/use-app-router";
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Clock3, ShieldCheck } from "lucide-react";
import {
  AttendanceRecordCard,
  type AttendanceRecordView,
} from "@/components/attendance-record-card";
import { CameraCapture } from "@/components/camera-capture";
import { InfoCallout } from "@/components/info-callout";
import { JobHeroCard } from "@/components/job-hero-card";
import { PageContent } from "@/components/layout/page-content";
import { PageBack } from "@/components/page-back";
import { PaymentResponsibilityCallout } from "@/components/payment-responsibility-callout";
import { SosCallout } from "@/components/sos-callout";
import { SwipeToConfirm } from "@/components/swipe-to-confirm";
import { WorkDayChips } from "@/components/work-day-chips";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { completedWorkDates } from "@/lib/attendance-days";
import {
  ensureOnlineForMutation,
  flashInfo,
  flashSuccess,
  flashValidation,
  presentAppError,
} from "@/lib/flash-message";
import { createClient } from "@/lib/supabase/client";
import { jobWorkDates, localDateISO } from "@/lib/work-dates";
import type { AttendanceKind, AttendanceRequest, Job } from "@/types/database";

export function FreelancerAttendanceClient({
  job,
  applicationId,
  kind,
  workDate: initialWorkDate,
  alreadyDone,
  dayEvents,
  recordedEvent,
  initialRequest = null,
}: {
  job: Job;
  applicationId: string;
  kind: AttendanceKind;
  workDate: string;
  alreadyDone: boolean;
  dayEvents?: { kind: string; work_date: string }[];
  recordedEvent?: AttendanceRecordView | null;
  initialRequest?: AttendanceRequest | null;
}) {
  const router = useRouter();
  const backHref = `/freelancer/jobs/${job.id}`;
  const dates = useMemo(() => jobWorkDates(job), [job]);
  const [workDate, setWorkDate] = useState(initialWorkDate);
  const [photo, setPhoto] = useState<File | null>(null);
  const [request, setRequest] = useState<AttendanceRequest | null>(
    initialRequest,
  );
  const [liveDayEvents, setLiveDayEvents] = useState(dayEvents ?? []);
  const [pending, startTransition] = useTransition();
  const isCheckIn = kind === "check_in";
  const multi = dates.length > 1;
  const today = localDateISO();
  const isPastDay = workDate < today;
  const isFutureDay = workDate > today;

  const refreshRequest = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("attendance_requests")
      .select("*")
      .eq("application_id", applicationId)
      .eq("kind", kind)
      .eq("work_date", workDate)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latest = (data as AttendanceRequest | null) ?? null;
    if (latest?.status === "confirmed") {
      const { data: events, error: eventsError } = await supabase
        .from("attendance_events")
        .select("kind, work_date")
        .eq("application_id", applicationId);
      if (eventsError) return;
      setLiveDayEvents(events ?? []);
    }
    setRequest(
      latest?.status === "pending" &&
        new Date(latest.expires_at).getTime() <= Date.now()
        ? { ...latest, status: "expired" }
        : latest,
    );
  }, [applicationId, kind, workDate]);

  useRealtimeRefresh({
    channelName: `attendance-request:${applicationId}:${kind}:${workDate}`,
    table: "attendance_requests",
    event: "*",
    filter: `application_id=eq.${applicationId}`,
    onEvent: () => {
      void refreshRequest();
    },
  });

  const doneDates = useMemo(
    () => completedWorkDates(dates, liveDayEvents),
    [dates, liveDayEvents],
  );

  function selectDay(date: string) {
    setWorkDate(date);
    setRequest(null);
    setPhoto(null);
    const path = isCheckIn ? "check-in" : "check-out";
    router.push(`/freelancer/jobs/${job.id}/${path}?date=${date}`);
  }

  function submit() {
    if (!photo) {
      flashValidation("Capture a live photo to continue");
      return;
    }
    if (!ensureOnlineForMutation()) return;

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        presentAppError(new Error("Not authenticated"));
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
        flashInfo("Location unavailable — continuing without GPS");
      }

      const path = `${user.id}/${job.id}/${kind}-${workDate}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: true });
      if (uploadError) {
        presentAppError(uploadError, {
          op: "upload",
          onRetry: () => submit(),
        });
        return;
      }

      const { data, error } = await supabase.rpc("submit_attendance_request", {
        p_application_id: applicationId,
        p_kind: kind,
        p_photo_path: path,
        p_lat: lat,
        p_lng: lng,
        p_work_date: workDate,
      });
      if (error) {
        await supabase.storage.from("attendance-photos").remove([path]);
        presentAppError(error, { onRetry: () => submit() });
        return;
      }

      const submitted = data as AttendanceRequest;
      if (submitted.photo_path !== path) {
        await supabase.storage.from("attendance-photos").remove([path]);
      }
      setRequest(submitted);
      setPhoto(null);
      flashSuccess(
        `${isCheckIn ? "Check-in" : "Check-out"} request sent to the business`,
      );
    });
  }

  const requestStatus = request?.status;

  if (alreadyDone || requestStatus === "confirmed") {
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
        <InfoCallout
          title={isCheckIn ? "Check-in confirmed" : "Check-out confirmed"}
          icon={<ShieldCheck className="size-4" />}
        >
          <p>
            {isCheckIn
              ? "The business confirmed that you are on site."
              : "The business confirmed that you finished this work day."}
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
                ? `/freelancer/jobs/${job.id}`
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
            {isCheckIn ? "Check-in" : "Check-out"} requests for {workDate} are
            closed. Ask the business to record a correction if you were present.
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
            that day when you are on site.
          </p>
        </InfoCallout>
        <Button className="w-full" onClick={() => router.push(`/freelancer/jobs/${job.id}`)}>
          Back to gig
        </Button>
      </PageContent>
    );
  }

  if (requestStatus === "pending") {
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
        <Surface className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock3 className="size-6" />
          </span>
          <h2 className="mt-3 text-base font-extrabold">
            Waiting for the business
          </h2>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            Your {isCheckIn ? "check-in" : "check-out"} request was sent. Stay
            nearby until the business confirms it.
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            This page updates automatically.
          </p>
        </Surface>
        <Button variant="outline" onClick={() => void refreshRequest()}>
          Refresh status
        </Button>
        {!isCheckIn ? <PaymentResponsibilityCallout /> : null}
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

      {requestStatus === "rejected" ? (
        <InfoCallout title="Please send a new request">
          <p>
            The business declined the previous request
            {request?.rejection_reason
              ? `: ${request.rejection_reason}`
              : ". Talk to the business if you need help"}
            .
          </p>
        </InfoCallout>
      ) : requestStatus === "expired" ? (
        <InfoCallout title="Request expired">
          <p>
            The business did not confirm in time. Capture a new photo when you
            are together and send the request again.
          </p>
        </InfoCallout>
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
          Capture a live photo on site, then tell the business you are{" "}
          {isCheckIn ? "here" : "leaving"}. They will confirm your attendance.
        </p>
        <div className="mt-4">
          <CameraCapture
            value={photo}
            onChange={setPhoto}
            label={
              isCheckIn ? "Capture check-in photo" : "Capture check-out photo"
            }
          />
        </div>
      </Surface>

      <SwipeToConfirm
        label={
          !photo
            ? "Capture a photo first"
            : isCheckIn
              ? "Slide to say I’m here"
              : "Slide to say I’m leaving"
        }
        confirmLabel={isCheckIn ? "I’m here" : "I’m leaving"}
        disabled={!photo}
        loading={pending}
        onConfirm={submit}
      />
      {!isCheckIn ? <PaymentResponsibilityCallout /> : null}
    </PageContent>
  );
}
