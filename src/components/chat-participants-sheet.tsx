"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialLink } from "@/components/dial-link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  chatRoleLabel,
  participantInitials,
  type ChatParticipant,
} from "@/lib/chat";
import { AtSign, Phone } from "lucide-react";

export function ChatParticipantsSheet({
  open,
  onOpenChange,
  participants,
  canAddress,
  callLocked = false,
  onAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ChatParticipant[];
  canAddress: boolean;
  /** Same window as ContactActionBar — Call stays visible but disabled. */
  callLocked?: boolean;
  onAddress: (participant: ChatParticipant) => void;
}) {
  const active = participants.filter((p) => p.isActive);
  const former = participants.filter((p) => !p.isActive);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-left text-lg font-extrabold">
            Participants
          </SheetTitle>
          <SheetDescription className="text-left">
            {active.length} active
            {former.length > 0 ? ` · ${former.length} left` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1 px-4 pb-2">
          {active.map((p) => (
            <ParticipantRow
              key={p.userId}
              participant={p}
              canAddress={canAddress && !p.isMe}
              callLocked={callLocked}
              onAddress={() => {
                onAddress(p);
                onOpenChange(false);
              }}
            />
          ))}
        </div>

        {former.length > 0 ? (
          <div className="border-t border-border/60 px-4 pt-3 pb-2">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              No longer in chat
            </p>
            <div className="space-y-1 opacity-70">
              {former.map((p) => (
                <ParticipantRow
                  key={p.userId}
                  participant={p}
                  canAddress={false}
                  callLocked={callLocked}
                />
              ))}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ParticipantRow({
  participant,
  canAddress,
  callLocked,
  onAddress,
}: {
  participant: ChatParticipant;
  canAddress: boolean;
  callLocked: boolean;
  onAddress?: () => void;
}) {
  const showCall = participant.isActive && !participant.isMe;
  const canCall = showCall && Boolean(participant.phone) && !callLocked;

  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2">
      <Avatar className="size-10">
        <AvatarImage
          src={participant.photoUrl ?? undefined}
          alt={participant.name}
        />
        <AvatarFallback className="bg-secondary text-xs font-bold text-primary">
          {participantInitials(participant.name) || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-bold">
            {participant.name}
            {participant.isMe ? " (you)" : ""}
          </p>
          <Badge variant="secondary" size="sm" className="shrink-0">
            {chatRoleLabel(participant.role)}
          </Badge>
        </div>
        {!participant.isActive ? (
          <p className="text-[11px] font-light text-muted-foreground">Left</p>
        ) : null}
      </div>
      {showCall ? (
        canCall ? (
          <DialLink
            phone={participant.phone!}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label={`Call ${participant.name}`}
          >
            <Phone className="size-3.5" />
            Call
          </DialLink>
        ) : (
          <span
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground opacity-50"
            aria-disabled="true"
            title={
              callLocked
                ? "Number locked after gig ended"
                : "Phone number unavailable"
            }
          >
            <Phone className="size-3.5" />
            Call
          </span>
        )
      ) : null}
      {canAddress && onAddress ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 px-2"
          onClick={onAddress}
        >
          <AtSign className="size-3.5" />
          Address
        </Button>
      ) : null}
    </div>
  );
}
