import { Clock, MapPin } from "lucide-react";
import {
  attendanceMapsUrl,
  formatAttendanceCoords,
  formatAttendanceDateTime,
} from "@/lib/attendance";
import { cn } from "@/lib/utils";

export type AttendanceRecordView = {
  id: string;
  title: string;
  verifiedAt: string;
  lat: number | null;
  lng: number | null;
  photoUrl?: string | null;
  source?: "otp" | "manual_correction" | null;
};

export function AttendanceRecordCard({
  record,
  className,
}: {
  record: AttendanceRecordView;
  className?: string;
}) {
  const hasLocation =
    record.lat !== null &&
    record.lng !== null &&
    Number.isFinite(record.lat) &&
    Number.isFinite(record.lng);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-muted/20",
        className,
      )}
    >
      {record.photoUrl ? (
        <a
          href={record.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={record.photoUrl}
            alt={`${record.title} attendance photo`}
            className="aspect-[4/3] w-full object-cover"
          />
        </a>
      ) : null}
      <div className="space-y-1.5 px-2.5 py-2.5">
        <p className="truncate text-xs font-semibold text-foreground">
          {record.title}
          {record.source === "manual_correction" ? (
            <span className="ml-1 font-medium text-muted-foreground">
              · corrected
            </span>
          ) : null}
        </p>
        <p className="flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Clock className="mt-0.5 size-3 shrink-0 text-primary" />
          <span>{formatAttendanceDateTime(record.verifiedAt)}</span>
        </p>
        {hasLocation ? (
          <a
            href={attendanceMapsUrl(record.lat!, record.lng!)}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-1.5 text-[11px] font-medium text-primary"
          >
            <MapPin className="mt-0.5 size-3 shrink-0" />
            <span>
              {formatAttendanceCoords(record.lat!, record.lng!)}
              <span className="text-muted-foreground"> · View map</span>
            </span>
          </a>
        ) : (
          <p className="flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
            <MapPin className="mt-0.5 size-3 shrink-0" />
            <span>Location not recorded</span>
          </p>
        )}
      </div>
    </div>
  );
}
