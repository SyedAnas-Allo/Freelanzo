"use client";

import {
  parseMessageParts,
  type ChatParticipant,
} from "@/lib/chat";
import { cn } from "@/lib/utils";

export function ChatMessageBody({
  body,
  participants,
  isMine,
  className,
}: {
  body: string;
  participants: ChatParticipant[];
  isMine?: boolean;
  className?: string;
}) {
  const parts = parseMessageParts(body, participants);

  return (
    <p
      className={cn(
        "wrap-break-word whitespace-pre-wrap font-light leading-relaxed",
        className,
      )}
    >
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <span
            key={`${part.userId}-${index}`}
            className={cn(
              "rounded px-0.5 font-semibold",
              isMine
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {part.value}
          </span>
        ) : (
          <span key={`t-${index}`}>{part.value}</span>
        ),
      )}
    </p>
  );
}
