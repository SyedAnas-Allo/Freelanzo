import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addressParticipant,
  chatClosedLabel,
  chatComposerDisabledReason,
  filterChatSummaries,
  filterMentionCandidates,
  formatChatDayLabel,
  formatChatTime,
  getMentionQuery,
  insertMention,
  jobChatHref,
  mergeChatMessages,
  mapJobMessage,
  mentionToken,
  parseMessageParts,
  sameChatDay,
  type ChatParticipant,
} from "@/lib/chat";
import type { JobChatSummary, JobMessage } from "@/types/database";

const sam: ChatParticipant = {
  userId: "u2",
  name: "Sam Patel",
  photoUrl: null,
  role: "freelancer",
  isActive: true,
  isMe: false,
};

const biz: ChatParticipant = {
  userId: "u1",
  name: "Cafe Owner",
  photoUrl: null,
  role: "business_owner",
  isActive: true,
  isMe: true,
};

describe("chat helpers", () => {
  it("builds job chat hrefs", () => {
    assert.equal(jobChatHref("abc"), "/messages/abc");
  });

  it("labels closed reasons", () => {
    assert.equal(
      chatClosedLabel("payments_confirmed"),
      "Chat closed after payment",
    );
    assert.equal(chatClosedLabel("job_cancelled"), "Chat closed — gig cancelled");
  });

  it("disables composer when closed or not allowed", () => {
    assert.equal(
      chatComposerDisabledReason({
        can_send: true,
        closed_at: null,
        closed_reason: null,
      }),
      null,
    );
    assert.match(
      chatComposerDisabledReason({
        can_send: false,
        closed_at: "2026-07-31T00:00:00Z",
        closed_reason: "payments_confirmed",
      }) ?? "",
      /payment/i,
    );
    assert.match(
      chatComposerDisabledReason({
        can_send: false,
        closed_at: null,
        closed_reason: null,
      }) ?? "",
      /no longer send/i,
    );
  });

  it("maps and merges messages without duplicates", () => {
    const row: JobMessage = {
      id: "1",
      chat_id: "c1",
      sender_id: "u1",
      body: "hello",
      created_at: "2026-07-31T10:00:00Z",
    };
    const mapped = mapJobMessage(row, "u1", "Me");
    assert.equal(mapped.isMine, true);

    const merged = mergeChatMessages(
      [
        mapped,
        {
          id: "local-1",
          senderId: "u1",
          body: "pending",
          createdAt: "2026-07-31T10:01:00Z",
          isMine: true,
          senderName: null,
        },
      ],
      [
        {
          id: "1",
          senderId: "u1",
          body: "hello updated",
          createdAt: "2026-07-31T10:00:00Z",
          isMine: true,
          senderName: "Me",
        },
        {
          id: "2",
          senderId: "u2",
          body: "hi",
          createdAt: "2026-07-31T10:02:00Z",
          isMine: false,
          senderName: "Sam",
        },
      ],
    );

    assert.equal(merged.length, 3);
    assert.equal(merged[0]?.body, "hello updated");
    assert.equal(merged[2]?.id, "2");
  });

  it("filters summaries by query", () => {
    const rows: JobChatSummary[] = [
      {
        chat_id: "1",
        job_id: "j1",
        job_title: "Restaurant Staff",
        business_name: "Cafe One",
        closed_at: null,
        closed_reason: null,
        can_send: true,
        last_message_body: "See you at 9",
        last_message_at: "2026-07-31T10:00:00Z",
        unread_count: 1,
      },
      {
        chat_id: "2",
        job_id: "j2",
        job_title: "Warehouse Helper",
        business_name: "Logi Co",
        closed_at: null,
        closed_reason: null,
        can_send: true,
        last_message_body: null,
        last_message_at: null,
        unread_count: 0,
      },
    ];
    assert.equal(filterChatSummaries(rows, "cafe").length, 1);
    assert.equal(filterChatSummaries(rows, "warehouse").length, 1);
    assert.equal(filterChatSummaries(rows, "  ").length, 2);
  });

  it("formats chat timestamps", () => {
    const now = new Date();
    assert.match(formatChatTime(now.toISOString()), /\d/);
    assert.equal(formatChatTime(null), "");
  });

  it("detects and inserts @mentions", () => {
    assert.deepEqual(getMentionQuery("Hey @Sa", 7), { start: 4, query: "Sa" });
    assert.equal(getMentionQuery("Hey @Sa there", 7)?.query, "Sa");
    assert.equal(getMentionQuery("Hey Sam", 7), null);

    const inserted = insertMention("Hey @Sa", 7, sam);
    assert.equal(inserted.text, "Hey @Sam Patel ");
    assert.equal(inserted.cursor, "Hey @Sam Patel ".length);

    assert.equal(mentionToken(sam), "@Sam Patel");
    assert.equal(addressParticipant("", sam), "@Sam Patel ");
    assert.equal(addressParticipant("on site", sam), "@Sam Patel on site");
  });

  it("filters mention candidates and parses highlighted parts", () => {
    const hits = filterMentionCandidates([sam, biz], "sam", "u1");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.userId, "u2");

    const parts = parseMessageParts("Hi @Sam Patel — see you", [sam, biz]);
    assert.deepEqual(parts, [
      { type: "text", value: "Hi " },
      { type: "mention", value: "@Sam Patel", userId: "u2" },
      { type: "text", value: " — see you" },
    ]);
  });

  it("groups messages by day", () => {
    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    const evening = new Date();
    evening.setHours(21, 0, 0, 0);
    const prior = new Date(morning);
    prior.setDate(prior.getDate() - 1);

    assert.equal(sameChatDay(morning.toISOString(), evening.toISOString()), true);
    assert.equal(sameChatDay(prior.toISOString(), morning.toISOString()), false);
    assert.equal(formatChatDayLabel(morning.toISOString()), "Today");
  });
});
