


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


-- skipped for hosted: CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






-- skipped for hosted: CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE SCHEMA IF NOT EXISTS "private";




COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";






-- skipped for hosted: CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






-- skipped for hosted: CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."application_status" AS ENUM (
    'applied',
    'rejected',
    'accepted',
    'cancelled'
);




CREATE TYPE "public"."attendance_kind" AS ENUM (
    'check_in',
    'check_out'
);




CREATE TYPE "public"."attendance_source" AS ENUM (
    'otp',
    'manual_correction'
);




CREATE TYPE "public"."business_pay_claim" AS ENUM (
    'paid',
    'not_paid'
);




CREATE TYPE "public"."freelancer_pay_claim" AS ENUM (
    'received',
    'not_received'
);




CREATE TYPE "public"."gender_type" AS ENUM (
    'male',
    'female',
    'other',
    'prefer_not_to_say'
);




CREATE TYPE "public"."job_category" AS ENUM (
    'hospitality',
    'event',
    'promoter',
    'delivery',
    'warehouse',
    'security',
    'other',
    'catering',
    'retail',
    'office',
    'sports',
    'talent',
    'student_jobs',
    'labour',
    'cleaning'
);




CREATE TYPE "public"."job_status" AS ENUM (
    'draft',
    'live',
    'fully_staffed',
    'confirmed',
    'cancelled',
    'expired',
    'in_progress',
    'completed'
);




CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'upi'
);




CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'confirmed',
    'dispute'
);




CREATE TYPE "public"."user_mode" AS ENUM (
    'freelancer',
    'business'
);




CREATE TYPE "public"."work_type" AS ENUM (
    'skilled',
    'unskilled'
);




CREATE OR REPLACE FUNCTION "private"."application_is_schedule_active"("p_status" "public"."application_status") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select p_status in ('applied', 'accepted');
$$;




CREATE OR REPLACE FUNCTION "private"."clear_application_schedule_slots"("p_application_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  delete from private.application_schedule_slots
  where application_id = p_application_id;
$$;




CREATE OR REPLACE FUNCTION "private"."close_job_chat"("p_job_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.job_chats
  set closed_at = coalesce(closed_at, now()),
      closed_reason = coalesce(closed_reason, p_reason)
  where job_id = p_job_id
    and closed_at is null;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."close_job_chat_membership"("p_chat_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- clock_timestamp() advances within a transaction so prior messages
  -- (default now()/transaction_timestamp) stay inside the membership window.
  update public.job_chat_memberships
  set left_at = clock_timestamp()
  where chat_id = p_chat_id
    and user_id = p_user_id
    and left_at is null;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."create_application_schedule_slots"("p_application_id" "uuid", "p_freelancer_id" "uuid", "p_job_id" "uuid", "p_for_accept" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_job public.jobs;
  v_dates date[];
  v_date date;
begin
  select * into v_job from public.jobs where id = p_job_id;
  if v_job is null then
    raise exception 'Job not found';
  end if;

  -- Terminal jobs must not reserve schedule.
  if v_job.status in ('cancelled', 'expired', 'completed') then
    raise exception 'This job is no longer accepting applications';
  end if;

  v_dates := coalesce(
    nullif(v_job.work_dates, '{}'::date[]),
    array[v_job.job_date]
  );

  begin
    foreach v_date in array v_dates loop
      insert into private.application_schedule_slots (
        application_id,
        freelancer_id,
        job_id,
        work_date,
        time_range
      ) values (
        p_application_id,
        p_freelancer_id,
        p_job_id,
        v_date,
        private.job_occurrence_range(v_date, v_job.start_time, v_job.end_time)
      );
    end loop;
  exception
    when exclusion_violation then
      if p_for_accept then
        raise exception using
          errcode = 'check_violation',
          message = 'Applicant is unavailable for these work times';
      else
        raise exception using
          errcode = 'check_violation',
          message = 'You''ve already accepted another overlapping job. Withdraw it first.';
      end if;
  end;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."enforce_application_eligibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job public.jobs;
  v_profile public.profiles;
  v_age integer;
  v_entering_applied boolean := false;
begin
  if tg_op = 'INSERT' then
    v_entering_applied := new.status = 'applied';
  elsif tg_op = 'UPDATE' then
    v_entering_applied :=
      new.status = 'applied'
      and old.status is distinct from 'applied';
  end if;

  if not v_entering_applied then
    return new;
  end if;

  select * into v_job from public.jobs where id = new.job_id;
  if v_job is null then
    raise exception 'Job not found';
  end if;

  select * into v_profile from public.profiles where id = new.freelancer_id;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  if v_profile.date_of_birth is not null then
    v_age := date_part(
      'year',
      age(current_date, v_profile.date_of_birth)
    )::integer;
    if v_age < 18 then
      raise exception using
        message = 'APPLICATION_ELIGIBILITY: You must be 18 or older to apply for gigs. You can still browse and update your profile.';
    end if;
  end if;

  if v_job.gender_preference in ('male', 'female')
     and v_profile.gender is not null
     and v_profile.gender::text is distinct from v_job.gender_preference then
    raise exception using
      message = format(
        'APPLICATION_ELIGIBILITY: This gig prefers %s applicants. Update your profile gender if it is incorrect, or look for other gigs.',
        v_job.gender_preference
      );
  end if;

  if v_job.skilled
     and coalesce(v_profile.work_type, 'unskilled'::public.work_type) <> 'skilled' then
    raise exception using
      message = 'APPLICATION_ELIGIBILITY: This gig needs skilled workers. Update your work type to Skilled in your profile if that fits you.';
  end if;

  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."ensure_job_chat"("p_job_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_chat_id uuid;
  v_owner_id uuid;
begin
  select c.id into v_chat_id from public.job_chats c where c.job_id = p_job_id;
  if v_chat_id is not null then
    return v_chat_id;
  end if;

  insert into public.job_chats (job_id)
  values (p_job_id)
  returning id into v_chat_id;

  select b.owner_id into v_owner_id
  from public.jobs j
  join public.business_profiles b on b.id = j.business_id
  where j.id = p_job_id;

  if v_owner_id is not null then
    perform private.open_job_chat_membership(
      v_chat_id,
      v_owner_id,
      'business_owner'
    );
  end if;

  return v_chat_id;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."expire_finished_jobs"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.jobs j
  set status = 'expired'
  where j.status = 'live'
    and statement_timestamp() >= private.job_application_deadline(
      j.job_date,
      j.work_dates,
      j.start_time,
      j.end_time
    );
$$;




CREATE OR REPLACE FUNCTION "private"."freeze_job_schedule_after_applications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.work_dates is distinct from old.work_dates
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.job_date is distinct from old.job_date then
    if exists (
      select 1
      from public.applications a
      where a.job_id = old.id
        and a.status in ('applied', 'accepted')
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Cannot change schedule after freelancers have applied';
    end if;
  end if;
  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."job_application_deadline"("p_job_date" "date", "p_work_dates" "date"[], "p_start_time" time without time zone, "p_end_time" time without time zone) RETURNS timestamp with time zone
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select (
    (
      coalesce(
        p_work_dates[cardinality(p_work_dates)],
        p_job_date
      ) + p_end_time
      + case
          when p_end_time <= p_start_time then interval '1 day'
          else interval '0 days'
        end
    ) at time zone 'Asia/Kolkata'
  );
$$;




CREATE OR REPLACE FUNCTION "private"."job_occurrence_range"("p_work_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) RETURNS "tstzrange"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select tstzrange(
    ((p_work_date + p_start_time) at time zone 'Asia/Kolkata'),
    (
      (
        p_work_date
        + p_end_time
        + case
            when p_end_time <= p_start_time then interval '1 day'
            else interval '0 days'
          end
      ) at time zone 'Asia/Kolkata'
    ),
    '[)'
  );
$$;




CREATE OR REPLACE FUNCTION "private"."maintain_job_application_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_increment boolean := false;
  v_decrement boolean := false;
  v_updated_job_id uuid;
begin
  if tg_op = 'INSERT' then
    v_increment := new.status in ('applied', 'accepted');
  elsif tg_op = 'UPDATE' then
    v_increment :=
      old.status not in ('applied', 'accepted')
      and new.status in ('applied', 'accepted');
    v_decrement :=
      old.status in ('applied', 'accepted')
      and new.status not in ('applied', 'accepted');
  elsif tg_op = 'DELETE' then
    v_decrement := old.status in ('applied', 'accepted');
  end if;

  if v_increment then
    update public.jobs j
    set active_application_count = j.active_application_count + 1
    where j.id = new.job_id
      and j.status = 'live'
      and j.active_application_count < (2 * j.headcount)
      and statement_timestamp() < private.job_application_deadline(
        j.job_date,
        j.work_dates,
        j.start_time,
        j.end_time
      )
    returning j.id into v_updated_job_id;

    if v_updated_job_id is null then
      raise exception using
        errcode = 'check_violation',
        message = 'This job is no longer accepting applications';
    end if;
  elsif v_decrement then
    update public.jobs
    set active_application_count = greatest(active_application_count - 1, 0)
    where id = old.job_id;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."open_job_chat_membership"("p_chat_id" "uuid", "p_user_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (
    select 1
    from public.job_chat_memberships m
    where m.chat_id = p_chat_id
      and m.user_id = p_user_id
      and m.left_at is null
  ) then
    return;
  end if;

  insert into public.job_chat_memberships (chat_id, user_id, role)
  values (p_chat_id, p_user_id, p_role);
end;
$$;




CREATE OR REPLACE FUNCTION "private"."refresh_job_chat_closure"("p_job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job_status public.job_status;
  v_accepted integer;
  v_confirmed integer;
begin
  select status into v_job_status from public.jobs where id = p_job_id;
  if v_job_status is null then
    return;
  end if;

  if v_job_status = 'cancelled' then
    perform private.close_job_chat(p_job_id, 'job_cancelled');
    return;
  end if;

  if v_job_status = 'expired' then
    perform private.close_job_chat(p_job_id, 'job_expired');
    return;
  end if;

  select count(*)::integer into v_accepted
  from public.applications
  where job_id = p_job_id and status = 'accepted';

  if v_accepted = 0 then
    return;
  end if;

  select count(*)::integer into v_confirmed
  from public.applications a
  join public.payments p on p.application_id = a.id
  where a.job_id = p_job_id
    and a.status = 'accepted'
    and p.status = 'confirmed';

  if v_confirmed = v_accepted then
    perform private.close_job_chat(p_job_id, 'payments_confirmed');
  end if;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."release_job_schedule_slots"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.status in ('cancelled', 'expired', 'completed')
     and old.status is distinct from new.status then
    delete from private.application_schedule_slots
    where job_id = new.id;
  end if;
  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."reopen_job_chat_if_needed"("p_job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_reason text;
begin
  select closed_reason into v_reason
  from public.job_chats
  where job_id = p_job_id;

  -- Only reopen when the previous close was payment-based and hiring continues.
  if v_reason = 'payments_confirmed' then
    update public.job_chats
    set closed_at = null,
        closed_reason = null
    where job_id = p_job_id;
  end if;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."sync_application_schedule_slots"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_was_active boolean;
  v_is_active boolean;
  v_for_accept boolean := false;
begin
  if tg_op = 'DELETE' then
    perform private.clear_application_schedule_slots(old.id);
    return old;
  end if;

  v_was_active := case
    when tg_op = 'INSERT' then false
    else private.application_is_schedule_active(old.status)
  end;
  v_is_active := private.application_is_schedule_active(new.status);

  if v_was_active and not v_is_active then
    perform private.clear_application_schedule_slots(new.id);
  elsif not v_was_active and v_is_active then
    v_for_accept := new.status = 'accepted';
    perform private.clear_application_schedule_slots(new.id);
    perform private.create_application_schedule_slots(
      new.id,
      new.freelancer_id,
      new.job_id,
      v_for_accept
    );
  end if;

  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."sync_job_chat_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_chat_id uuid;
  v_was_accepted boolean;
  v_is_accepted boolean;
begin
  if tg_op = 'DELETE' then
    select id into v_chat_id from public.job_chats where job_id = old.job_id;
    if v_chat_id is not null then
      perform private.close_job_chat_membership(v_chat_id, old.freelancer_id);
      perform private.refresh_job_chat_closure(old.job_id);
    end if;
    return old;
  end if;

  v_was_accepted := tg_op = 'UPDATE' and old.status = 'accepted';
  v_is_accepted := new.status = 'accepted';

  if v_is_accepted and not v_was_accepted then
    v_chat_id := private.ensure_job_chat(new.job_id);
    perform private.reopen_job_chat_if_needed(new.job_id);
    perform private.open_job_chat_membership(
      v_chat_id,
      new.freelancer_id,
      'freelancer'
    );
  elsif v_was_accepted and not v_is_accepted then
    select id into v_chat_id from public.job_chats where job_id = new.job_id;
    if v_chat_id is not null then
      perform private.close_job_chat_membership(v_chat_id, new.freelancer_id);
    end if;
  end if;

  perform private.refresh_job_chat_closure(new.job_id);
  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."sync_job_chat_on_job_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status is distinct from old.status then
    perform private.refresh_job_chat_closure(new.id);
  end if;
  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "private"."sync_job_chat_on_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job_id uuid;
begin
  select a.job_id into v_job_id
  from public.applications a
  where a.id = new.application_id;

  if v_job_id is not null then
    perform private.refresh_job_chat_closure(v_job_id);
  end if;
  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."application_attendance_complete"("p_application_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_days integer;
  v_outs integer;
begin
  select * into v_app from public.applications where id = p_application_id;
  if v_app is null then return false; end if;
  select * into v_job from public.jobs where id = v_app.job_id;
  v_days := greatest(1, cardinality(v_job.work_dates));

  select count(*)::integer into v_outs
  from public.attendance_events
  where application_id = p_application_id
    and kind = 'check_out'
    and work_date = any (v_job.work_dates);

  -- Also require matching check-ins
  if v_outs < v_days then return false; end if;

  return (
    select count(*)::integer
    from public.attendance_events
    where application_id = p_application_id
      and kind = 'check_in'
      and work_date = any (v_job.work_dates)
  ) >= v_days;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."applications_after_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.refresh_job_staffing_status(coalesce(new.job_id, old.job_id));
  return coalesce(new, old);
end;
$$;




CREATE OR REPLACE FUNCTION "public"."available_job_ids"("p_job_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("job_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select j.id
  from public.jobs j
  where auth.uid() is not null
    and j.status = 'live'
    and (p_job_id is null or j.id = p_job_id)
    and j.active_application_count < (2 * j.headcount)
    and statement_timestamp() < private.job_application_deadline(
      j.job_date,
      j.work_dates,
      j.start_time,
      j.end_time
    );
$$;




CREATE OR REPLACE FUNCTION "public"."can_read_job_message"("p_chat_id" "uuid", "p_created_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.job_chats c
    join public.jobs j on j.id = c.job_id
    join public.business_profiles b on b.id = j.business_id
    where c.id = p_chat_id
      and b.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.job_chat_memberships m
    where m.chat_id = p_chat_id
      and m.user_id = (select auth.uid())
      and m.joined_at <= p_created_at
      and (m.left_at is null or p_created_at < m.left_at)
  );
$$;




CREATE OR REPLACE FUNCTION "public"."can_send_job_message"("p_chat_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.job_chats c
    join public.job_chat_memberships m on m.chat_id = c.id
    where c.id = p_chat_id
      and c.closed_at is null
      and m.user_id = (select auth.uid())
      and m.left_at is null
  );
$$;



SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "public"."job_category" DEFAULT 'other'::"public"."job_category" NOT NULL,
    "skilled" boolean DEFAULT false NOT NULL,
    "headcount" integer NOT NULL,
    "job_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "address" "text" NOT NULL,
    "area" "text",
    "city" "text" NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "pay_per_freelancer" integer NOT NULL,
    "dress_code" "text",
    "instructions" "text",
    "safety_flags" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "public"."job_status" DEFAULT 'draft'::"public"."job_status" NOT NULL,
    "reopen_used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "food_allowance_inr" integer DEFAULT 0 NOT NULL,
    "travel_allowance_inr" integer DEFAULT 0 NOT NULL,
    "work_dates" "date"[] DEFAULT '{}'::"date"[] NOT NULL,
    "gender_preference" "text" DEFAULT 'any'::"text" NOT NULL,
    "active_application_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "jobs_active_application_count_nonnegative" CHECK (("active_application_count" >= 0)),
    CONSTRAINT "jobs_food_allowance_inr_check" CHECK (("food_allowance_inr" >= 0)),
    CONSTRAINT "jobs_gender_preference_check" CHECK (("gender_preference" = ANY (ARRAY['male'::"text", 'female'::"text", 'any'::"text"]))),
    CONSTRAINT "jobs_headcount_check" CHECK (("headcount" > 0)),
    CONSTRAINT "jobs_location_coordinates_check" CHECK (((("lat" >= ('-90'::integer)::double precision) AND ("lat" <= (90)::double precision)) AND (("lng" >= ('-180'::integer)::double precision) AND ("lng" <= (180)::double precision)))),
    CONSTRAINT "jobs_pay_per_freelancer_check" CHECK (("pay_per_freelancer" >= 0)),
    CONSTRAINT "jobs_travel_allowance_inr_check" CHECK (("travel_allowance_inr" >= 0)),
    CONSTRAINT "jobs_work_dates_valid" CHECK (((("cardinality"("work_dates") >= 1) AND ("cardinality"("work_dates") <= 15)) AND ("work_dates"[1] = "job_date") AND ("work_dates"["cardinality"("work_dates")] <= ("work_dates"[1] + 14))))
);




COMMENT ON COLUMN "public"."jobs"."food_allowance_inr" IS 'Extra ₹ for food included in day payout; 0 = none';



COMMENT ON COLUMN "public"."jobs"."travel_allowance_inr" IS 'Extra ₹ for travel included in day payout; 0 = none';



COMMENT ON COLUMN "public"."jobs"."work_dates" IS 'Selected work days (1–15). First day is job_date; last day must be within 15 calendar days of first.';



COMMENT ON COLUMN "public"."jobs"."active_application_count" IS 'Applications currently in applied or accepted state. Maintained by database triggers.';



CREATE OR REPLACE FUNCTION "public"."cancel_job"("p_job_id" "uuid") RETURNS "public"."jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job public.jobs;
  v_freelancer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job is null then
    raise exception 'Job not found';
  end if;

  if not public.is_job_business_owner(p_job_id) then
    raise exception 'Only business owner can cancel this job';
  end if;

  if v_job.status not in ('live', 'fully_staffed', 'confirmed', 'in_progress') then
    raise exception 'Only active gigs can be cancelled';
  end if;

  update public.jobs
    set status = 'cancelled'
    where id = p_job_id
  returning * into v_job;

  for v_freelancer_id in
    select distinct a.freelancer_id
    from public.applications a
    where a.job_id = p_job_id
      and a.status in ('applied', 'accepted')
  loop
    perform public.create_notification(
      v_freelancer_id,
      'job_cancelled',
      'Gig cancelled',
      'A gig you applied to was cancelled by the business.',
      jsonb_build_object('job_id', p_job_id)
    );
  end loop;

  return v_job;
end;
$$;




CREATE TABLE IF NOT EXISTS "public"."attendance_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "kind" "public"."attendance_kind" NOT NULL,
    "photo_path" "text",
    "lat" double precision,
    "lng" double precision,
    "verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_date" "date" NOT NULL,
    "source" "public"."attendance_source" DEFAULT 'otp'::"public"."attendance_source" NOT NULL,
    "corrected_by" "uuid",
    "correction_reason" "text",
    "corrected_at" timestamp with time zone
);




CREATE OR REPLACE FUNCTION "public"."correct_attendance"("p_application_id" "uuid", "p_kind" "public"."attendance_kind", "p_work_date" "date", "p_reason" "text", "p_photo_path" "text" DEFAULT NULL::"text") RETURNS "public"."attendance_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_event public.attendance_events;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_needed integer;
  v_done integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Correction reason is required (min 5 characters)';
  end if;

  select * into v_app from public.applications where id = p_application_id;
  if v_app is null or v_app.status <> 'accepted' then
    raise exception 'Invalid application';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if not public.is_job_business_owner(v_job.id) then
    raise exception 'Only business owner can correct attendance';
  end if;
  if not public.job_allows_attendance(v_job) and v_job.status <> 'completed' then
    raise exception 'Cannot correct attendance for this job status';
  end if;

  if not (p_work_date = any (v_job.work_dates)) then
    raise exception 'Selected day is not a work day for this job';
  end if;
  if p_work_date >= v_today then
    raise exception 'Manual correction is only for past work days. Use OTP for today.';
  end if;

  if exists (
    select 1 from public.attendance_events
    where application_id = p_application_id
      and kind = p_kind
      and work_date = p_work_date
  ) then
    raise exception 'This attendance event already exists';
  end if;

  if p_kind = 'check_out' then
    if not exists (
      select 1 from public.attendance_events
      where application_id = p_application_id
        and kind = 'check_in'
        and work_date = p_work_date
    ) then
      raise exception 'Correct check-in first for this day';
    end if;
  end if;

  insert into public.attendance_events (
    application_id, kind, work_date, photo_path,
    source, corrected_by, correction_reason, corrected_at
  ) values (
    p_application_id, p_kind, p_work_date, p_photo_path,
    'manual_correction', auth.uid(), trim(p_reason), now()
  )
  returning * into v_event;

  if p_kind = 'check_in' then
    update public.jobs
      set status = 'in_progress'
      where id = v_app.job_id
        and status in ('live', 'fully_staffed', 'confirmed');
  else
    select (
      (select count(*)::integer from public.applications
       where job_id = v_app.job_id and status = 'accepted')
      * greatest(1, cardinality(v_job.work_dates))
    ) into v_needed;

    select count(*)::integer into v_done
    from public.attendance_events e
    join public.applications a on a.id = e.application_id
    where a.job_id = v_app.job_id
      and a.status = 'accepted'
      and e.kind = 'check_out'
      and e.work_date = any (v_job.work_dates);

    if v_needed > 0 and v_done >= v_needed then
      update public.jobs set status = 'completed' where id = v_app.job_id;
    end if;
  end if;

  perform public.create_notification(
    v_app.freelancer_id,
    'attendance_correction',
    'Attendance corrected',
    'Business recorded a missed ' || replace(p_kind::text, '_', '-') ||
      ' for ' || v_job.title || ' (' || to_char(p_work_date, 'DD Mon') || ')',
    jsonb_build_object(
      'job_id', v_job.id,
      'application_id', p_application_id,
      'work_date', p_work_date,
      'kind', p_kind
    )
  );

  return v_event;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text" DEFAULT NULL::"text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications (user_id, type, title, body, meta)
  values (p_user_id, p_type, p_title, p_body, p_meta);
end;
$$;




CREATE TABLE IF NOT EXISTS "public"."attendance_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "kind" "public"."attendance_kind" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_date" "date" NOT NULL
);




CREATE OR REPLACE FUNCTION "public"."generate_attendance_otp"("p_job_id" "uuid", "p_kind" "public"."attendance_kind", "p_work_date" "date" DEFAULT NULL::"date") RETURNS "public"."attendance_otps"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_code text;
  v_row public.attendance_otps;
  v_job public.jobs;
  v_date date;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_job_business_owner(p_job_id) then
    raise exception 'Only business owner can generate OTP';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job is null then
    raise exception 'Job not found';
  end if;
  if not public.job_allows_attendance(v_job) then
    raise exception 'Attendance is not available for this job status';
  end if;

  v_date := coalesce(p_work_date, v_today);
  if not (v_date = any (v_job.work_dates)) then
    raise exception 'Selected day is not a work day for this job';
  end if;
  if v_date > v_today then
    raise exception 'Cannot generate OTP for a future work day';
  end if;

  if not exists (
    select 1 from public.applications
    where job_id = p_job_id and status = 'accepted'
  ) then
    raise exception 'No accepted freelancers yet';
  end if;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.attendance_otps (job_id, kind, work_date, code, expires_at, created_by)
  values (p_job_id, p_kind, v_date, v_code, now() + interval '15 minutes', auth.uid())
  on conflict (job_id, kind, work_date) do update
    set code = excluded.code,
        expires_at = excluded.expires_at,
        created_by = excluded.created_by,
        created_at = now()
  returning * into v_row;

  return v_row;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."get_job_chat"("p_job_id" "uuid") RETURNS TABLE("chat_id" "uuid", "job_id" "uuid", "job_title" "text", "business_name" "text", "closed_at" timestamp with time zone, "closed_reason" "text", "can_send" boolean, "member_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    c.id as chat_id,
    c.job_id,
    j.title as job_title,
    b.business_name,
    c.closed_at,
    c.closed_reason,
    public.can_send_job_message(c.id) as can_send,
    (
      select count(*)::integer
      from public.job_chat_memberships m
      where m.chat_id = c.id and m.left_at is null
    ) as member_count
  from public.job_chats c
  join public.jobs j on j.id = c.job_id
  join public.business_profiles b on b.id = j.business_id
  where c.job_id = p_job_id
    and public.is_job_chat_member(c.id);
end;
$$;




CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, email, phone, photo_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.phone,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select 6371 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;




CREATE OR REPLACE FUNCTION "public"."is_accepted_freelancer_on_job"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.applications a
    where a.job_id = p_job_id
      and a.freelancer_id = auth.uid()
      and a.status = 'accepted'
  );
$$;




CREATE OR REPLACE FUNCTION "public"."is_job_applicant"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.applications a
    where a.job_id = p_job_id
      and a.freelancer_id = (select auth.uid())
  );
$$;




CREATE OR REPLACE FUNCTION "public"."is_job_business_owner"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.jobs j
    join public.business_profiles b on b.id = j.business_id
    where j.id = p_job_id and b.owner_id = auth.uid()
  );
$$;




CREATE OR REPLACE FUNCTION "public"."is_job_chat_member"("p_chat_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.job_chat_memberships m
    where m.chat_id = p_chat_id
      and m.user_id = (select auth.uid())
  );
$$;




CREATE OR REPLACE FUNCTION "public"."is_work_date_today"("p_date" "date") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select p_date = (timezone('Asia/Kolkata', now()))::date;
$$;




CREATE OR REPLACE FUNCTION "public"."job_allows_attendance"("p_job" "public"."jobs") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select p_job.status in ('live', 'fully_staffed', 'confirmed', 'in_progress');
$$;




CREATE OR REPLACE FUNCTION "public"."job_chat_unread_total"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
begin
  if v_uid is null then
    return 0;
  end if;

  select coalesce(sum(s.unread_count), 0)::integer into v_total
  from public.list_job_chat_summaries() s;

  return v_total;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."job_day_total"("p_job" "public"."jobs") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select p_job.pay_per_freelancer
    + coalesce(p_job.food_allowance_inr, 0)
    + coalesce(p_job.travel_allowance_inr, 0);
$$;




CREATE OR REPLACE FUNCTION "public"."job_engagement_total"("p_job" "public"."jobs") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select public.job_day_total(p_job)
    * greatest(1, coalesce(cardinality(p_job.work_dates), 1));
$$;




CREATE OR REPLACE FUNCTION "public"."job_staffing_counts"("p_job_id" "uuid") RETURNS TABLE("accepted_count" integer, "headcount" integer)
    LANGUAGE "sql" STABLE
    AS $$
  select
    (select count(*)::integer from public.applications a
      where a.job_id = p_job_id and a.status = 'accepted'),
    (select j.headcount from public.jobs j where j.id = p_job_id);
$$;




CREATE OR REPLACE FUNCTION "public"."list_job_chat_summaries"() RETURNS TABLE("chat_id" "uuid", "job_id" "uuid", "job_title" "text", "business_name" "text", "closed_at" timestamp with time zone, "closed_reason" "text", "can_send" boolean, "last_message_body" "text", "last_message_at" timestamp with time zone, "unread_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with my_chats as (
    select distinct m.chat_id
    from public.job_chat_memberships m
    where m.user_id = v_uid
  ),
  visible_messages as (
    select jm.*
    from public.job_messages jm
    join my_chats mc on mc.chat_id = jm.chat_id
    where public.can_read_job_message(jm.chat_id, jm.created_at)
  ),
  latest as (
    select distinct on (vm.chat_id)
      vm.chat_id,
      vm.body,
      vm.created_at
    from visible_messages vm
    order by vm.chat_id, vm.created_at desc
  ),
  unread as (
    select
      vm.chat_id,
      count(*)::integer as cnt
    from visible_messages vm
    left join public.job_chat_reads r
      on r.chat_id = vm.chat_id and r.user_id = v_uid
    where vm.sender_id <> v_uid
      and vm.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    group by vm.chat_id
  )
  select
    c.id as chat_id,
    c.job_id,
    j.title as job_title,
    b.business_name,
    c.closed_at,
    c.closed_reason,
    public.can_send_job_message(c.id) as can_send,
    l.body as last_message_body,
    l.created_at as last_message_at,
    coalesce(u.cnt, 0) as unread_count
  from my_chats mc
  join public.job_chats c on c.id = mc.chat_id
  join public.jobs j on j.id = c.job_id
  join public.business_profiles b on b.id = j.business_id
  left join latest l on l.chat_id = c.id
  left join unread u on u.chat_id = c.id
  order by coalesce(l.created_at, c.created_at) desc;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."mark_job_chat_read"("p_job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_chat_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select c.id into v_chat_id
  from public.job_chats c
  where c.job_id = p_job_id;

  if v_chat_id is null or not public.is_job_chat_member(v_chat_id) then
    raise exception 'Chat not found';
  end if;

  insert into public.job_chat_reads (chat_id, user_id, last_read_at)
  values (v_chat_id, v_uid, now())
  on conflict (chat_id, user_id) do update
    set last_read_at = excluded.last_read_at;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."rating_is_visible"("p_application_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    (select count(*) from public.ratings r where r.application_id = p_application_id) >= 2
    or (
      exists (select 1 from public.ratings r where r.application_id = p_application_id)
      and (
        select min(r.created_at) from public.ratings r where r.application_id = p_application_id
      ) < now() - interval '48 hours'
    );
$$;




CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "freelancer_id" "uuid" NOT NULL,
    "status" "public"."application_status" DEFAULT 'applied'::"public"."application_status" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE OR REPLACE FUNCTION "public"."reapply_application"("p_application_id" "uuid") RETURNS "public"."applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if v_app is null then
    raise exception 'Application not found';
  end if;
  if v_app.freelancer_id <> auth.uid() then
    raise exception 'Not your application';
  end if;
  if v_app.status <> 'cancelled' then
    raise exception 'Only withdrawn applications can be reapplied';
  end if;

  -- Capacity/deadline/live checks + overlap slots run via existing triggers.
  update public.applications
    set status = 'applied'
    where id = p_application_id
  returning * into v_app;

  return v_app;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."refresh_job_staffing_status"("p_job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  counts record;
begin
  select * into counts from public.job_staffing_counts(p_job_id);
  if counts.headcount is null then
    return;
  end if;
  if counts.accepted_count >= counts.headcount then
    update public.jobs set status = 'fully_staffed' where id = p_job_id and status = 'live';
  elsif exists (select 1 from public.jobs where id = p_job_id and status = 'fully_staffed') then
    if counts.accepted_count < counts.headcount then
      update public.jobs set status = 'live' where id = p_job_id;
    end if;
  end if;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."set_application_status"("p_application_id" "uuid", "p_status" "public"."application_status") RETURNS "public"."applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_accepted integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'Business may only accept or reject';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if v_app is null then
    raise exception 'Application not found';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id for update;
  if v_job is null then
    raise exception 'Job not found';
  end if;

  if not public.is_job_business_owner(v_job.id) then
    raise exception 'Only business owner can change selection';
  end if;

  if v_job.status not in ('live', 'fully_staffed', 'confirmed') then
    raise exception 'Selection is closed for this job';
  end if;

  if v_app.status = 'cancelled' then
    raise exception 'Cannot change a withdrawn application';
  end if;

  -- Block reject/re-accept after attendance has started for this worker
  if exists (
    select 1 from public.attendance_events e where e.application_id = p_application_id
  ) and p_status <> v_app.status then
    raise exception 'Cannot change selection after attendance has started';
  end if;

  if p_status = 'accepted' and v_app.status <> 'accepted' then
    select count(*)::integer into v_accepted
    from public.applications
    where job_id = v_job.id and status = 'accepted';
    if v_accepted >= v_job.headcount then
      raise exception 'All openings are filled';
    end if;
  end if;

  update public.applications
    set status = p_status
    where id = p_application_id
  returning * into v_app;

  return v_app;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;




CREATE TABLE IF NOT EXISTS "public"."app_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overall" numeric(2,1) NOT NULL,
    "category" "text" NOT NULL,
    "comment" "text",
    "active_mode" "public"."user_mode" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_feedback_category_check" CHECK (("category" = ANY (ARRAY['experience'::"text", 'bug'::"text", 'feature'::"text", 'other'::"text"]))),
    CONSTRAINT "app_feedback_overall_check" CHECK ((("overall" >= (1)::numeric) AND ("overall" <= (5)::numeric)))
);




CREATE OR REPLACE FUNCTION "public"."submit_app_feedback"("p_overall" numeric, "p_category" "text", "p_comment" "text" DEFAULT NULL::"text") RETURNS "public"."app_feedback"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_mode public.user_mode;
  v_comment text;
  v_row public.app_feedback;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_overall is null or p_overall < 1 or p_overall > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  if p_category is null or p_category not in ('experience', 'bug', 'feature', 'other') then
    raise exception 'Invalid category';
  end if;

  v_comment := nullif(trim(coalesce(p_comment, '')), '');

  if p_overall <= 2 and v_comment is null then
    raise exception 'Please add a short note for low ratings';
  end if;

  if exists (
    select 1
    from public.app_feedback
    where user_id = auth.uid()
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'You can only send feedback once every 24 hours';
  end if;

  select active_mode into v_mode
  from public.profiles
  where id = auth.uid();

  if v_mode is null then
    raise exception 'Profile not found';
  end if;

  insert into public.app_feedback (
    user_id, overall, category, comment, active_mode
  ) values (
    auth.uid(), p_overall, p_category, v_comment, v_mode
  )
  returning * into v_row;

  return v_row;
end;
$$;




CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "overall" numeric(2,1) NOT NULL,
    "dimensions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ratings_overall_check" CHECK ((("overall" >= (1)::numeric) AND ("overall" <= (5)::numeric)))
);




CREATE OR REPLACE FUNCTION "public"."submit_rating"("p_application_id" "uuid", "p_overall" numeric, "p_dimensions" "jsonb" DEFAULT '{}'::"jsonb", "p_comment" "text" DEFAULT NULL::"text") RETURNS "public"."ratings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_owner uuid;
  v_to uuid;
  v_pay public.payments;
  v_row public.ratings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_app from public.applications where id = p_application_id;
  if v_app is null or v_app.status <> 'accepted' then
    raise exception 'Invalid application';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  select b.owner_id into v_owner
  from public.business_profiles b where b.id = v_job.business_id;

  if auth.uid() = v_owner then
    v_to := v_app.freelancer_id;
  elsif auth.uid() = v_app.freelancer_id then
    v_to := v_owner;
  else
    raise exception 'Not a party to this application';
  end if;

  select * into v_pay from public.payments where application_id = p_application_id;
  if v_pay is null or v_pay.status <> 'confirmed' then
    raise exception 'Payment must be confirmed before rating';
  end if;

  if exists (
    select 1 from public.ratings
    where application_id = p_application_id and from_user_id = auth.uid()
  ) then
    raise exception 'You already submitted a rating';
  end if;

  insert into public.ratings (
    application_id, from_user_id, to_user_id, overall, dimensions, comment
  ) values (
    p_application_id, auth.uid(), v_to, p_overall, coalesce(p_dimensions, '{}'::jsonb), p_comment
  )
  returning * into v_row;

  perform public.create_notification(
    v_to,
    'rating',
    'New rating',
    'You received a rating for ' || v_job.title,
    jsonb_build_object('job_id', v_job.id, 'application_id', p_application_id)
  );

  return v_row;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."sync_job_date_from_work_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.work_dates is null or cardinality(new.work_dates) = 0 then
    new.work_dates := array[new.job_date];
  else
    new.work_dates := (
      select array_agg(d order by d)
      from (select distinct unnest(new.work_dates) as d) s
    );
    new.job_date := new.work_dates[1];
  end if;
  return new;
end;
$$;




CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "amount" integer,
    "method" "public"."payment_method",
    "business_claimed" "public"."business_pay_claim",
    "freelancer_claimed" "public"."freelancer_pay_claim",
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "complaint" "text",
    "response" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE OR REPLACE FUNCTION "public"."upsert_payment_claim"("p_application_id" "uuid", "p_role" "text", "p_claim" "text", "p_amount" integer DEFAULT NULL::integer, "p_method" "public"."payment_method" DEFAULT NULL::"public"."payment_method", "p_complaint" "text" DEFAULT NULL::"text", "p_response" "text" DEFAULT NULL::"text") RETURNS "public"."payments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_owner uuid;
  v_pay public.payments;
  v_status public.payment_status;
  v_total integer;
  v_rating_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_app from public.applications where id = p_application_id;
  if v_app is null or v_app.status <> 'accepted' then
    raise exception 'Invalid application';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if v_job.status = 'cancelled' then
    raise exception 'Cannot update payment for a cancelled job';
  end if;

  if not public.application_attendance_complete(p_application_id) then
    raise exception 'Attendance must be complete for all work days before payment';
  end if;

  select b.owner_id into v_owner
  from public.business_profiles b where b.id = v_job.business_id;

  v_total := public.job_engagement_total(v_job);

  if p_role = 'business' then
    if auth.uid() <> v_owner then
      raise exception 'Not business owner';
    end if;
  elsif p_role = 'freelancer' then
    if auth.uid() <> v_app.freelancer_id then
      raise exception 'Not freelancer';
    end if;
  else
    raise exception 'Invalid role';
  end if;

  select * into v_pay from public.payments where application_id = p_application_id;

  if v_pay is not null and v_pay.status = 'confirmed' then
    select count(*)::integer into v_rating_count
    from public.ratings where application_id = p_application_id;
    if v_rating_count > 0 then
      raise exception 'Payment is locked after ratings were submitted';
    end if;
    -- Allow re-open only if no ratings yet and both parties explicitly update
    -- Keep confirmed immutable once set unless moving into dispute via mismatch —
    -- still block silent rewrite of confirmed→pending without dispute path.
    raise exception 'Confirmed payment cannot be changed';
  end if;

  insert into public.payments (application_id, amount)
  values (p_application_id, coalesce(p_amount, v_total))
  on conflict (application_id) do nothing;

  if p_role = 'business' then
    update public.payments set
      business_claimed = p_claim::public.business_pay_claim,
      amount = coalesce(p_amount, amount, v_total),
      method = coalesce(p_method, method),
      complaint = coalesce(p_complaint, complaint),
      response = coalesce(p_response, response)
    where application_id = p_application_id;
  else
    update public.payments set
      freelancer_claimed = p_claim::public.freelancer_pay_claim,
      complaint = coalesce(p_complaint, complaint),
      response = coalesce(p_response, response)
    where application_id = p_application_id;
  end if;

  select * into v_pay from public.payments where application_id = p_application_id;

  if v_pay.business_claimed is null or v_pay.freelancer_claimed is null then
    v_status := 'pending';
  elsif v_pay.business_claimed = 'paid' and v_pay.freelancer_claimed = 'received' then
    v_status := 'confirmed';
  elsif v_pay.business_claimed = 'not_paid' and v_pay.freelancer_claimed = 'not_received' then
    v_status := 'pending';
  else
    v_status := 'dispute';
  end if;

  update public.payments set status = v_status where id = v_pay.id
  returning * into v_pay;

  if p_role = 'business' then
    perform public.create_notification(
      v_app.freelancer_id,
      'payment',
      'Payment update',
      'Business updated payment status for ' || v_job.title,
      jsonb_build_object('job_id', v_job.id, 'application_id', p_application_id, 'status', v_status)
    );
  else
    perform public.create_notification(
      v_owner,
      'payment',
      'Payment update',
      'Freelancer updated payment receipt for ' || v_job.title,
      jsonb_build_object('job_id', v_job.id, 'application_id', p_application_id, 'status', v_status)
    );
  end if;

  return v_pay;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."verify_attendance_otp"("p_application_id" "uuid", "p_kind" "public"."attendance_kind", "p_code" "text", "p_photo_path" "text" DEFAULT NULL::"text", "p_lat" double precision DEFAULT NULL::double precision, "p_lng" double precision DEFAULT NULL::double precision, "p_work_date" "date" DEFAULT NULL::"date") RETURNS "public"."attendance_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
  v_otp public.attendance_otps;
  v_event public.attendance_events;
  v_job public.jobs;
  v_owner uuid;
  v_date date;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
  v_needed integer;
  v_done integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_app from public.applications where id = p_application_id;
  if v_app is null then
    raise exception 'Application not found';
  end if;
  if v_app.freelancer_id <> auth.uid() then
    raise exception 'Not your application';
  end if;
  if v_app.status <> 'accepted' then
    raise exception 'Application must be accepted';
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if not public.job_allows_attendance(v_job) then
    raise exception 'Attendance is not available for this job status';
  end if;

  v_date := coalesce(p_work_date, v_today);
  if not (v_date = any (v_job.work_dates)) then
    raise exception 'Selected day is not a work day for this job';
  end if;
  if v_date <> v_today then
    raise exception 'OTP check-in/out is only allowed for today. Ask the business to correct missed days.';
  end if;

  if exists (
    select 1 from public.attendance_events
    where application_id = p_application_id
      and kind = p_kind
      and work_date = v_date
  ) then
    raise exception 'Already recorded for this day';
  end if;

  if p_kind = 'check_out' then
    if not exists (
      select 1 from public.attendance_events
      where application_id = p_application_id
        and kind = 'check_in'
        and work_date = v_date
    ) then
      raise exception 'Check-in required before check-out for this day';
    end if;
  end if;

  select * into v_otp
  from public.attendance_otps
  where job_id = v_app.job_id and kind = p_kind and work_date = v_date;

  if v_otp is null then
    raise exception 'No OTP generated yet for this day';
  end if;
  if v_otp.expires_at < now() then
    raise exception 'OTP expired';
  end if;
  if v_otp.code <> p_code then
    raise exception 'Invalid OTP';
  end if;

  insert into public.attendance_events (
    application_id, kind, work_date, photo_path, lat, lng, source
  ) values (
    p_application_id, p_kind, v_date, p_photo_path, p_lat, p_lng, 'otp'
  )
  returning * into v_event;

  select b.owner_id into v_owner
  from public.business_profiles b where b.id = v_job.business_id;

  if p_kind = 'check_in' then
    update public.jobs
      set status = 'in_progress'
      where id = v_app.job_id
        and status in ('live', 'fully_staffed', 'confirmed');

    perform public.create_notification(
      v_owner,
      'check_in',
      'Freelancer checked in',
      'A freelancer checked in for ' || v_job.title || ' (' || to_char(v_date, 'DD Mon') || ')',
      jsonb_build_object(
        'job_id', v_job.id,
        'application_id', p_application_id,
        'work_date', v_date
      )
    );
  else
    select (
      (select count(*)::integer from public.applications
       where job_id = v_app.job_id and status = 'accepted')
      * greatest(1, cardinality(v_job.work_dates))
    ) into v_needed;

    select count(*)::integer into v_done
    from public.attendance_events e
    join public.applications a on a.id = e.application_id
    where a.job_id = v_app.job_id
      and a.status = 'accepted'
      and e.kind = 'check_out'
      and e.work_date = any (v_job.work_dates);

    if v_needed > 0 and v_done >= v_needed then
      update public.jobs set status = 'completed' where id = v_app.job_id;
    end if;

    perform public.create_notification(
      v_owner,
      'check_out',
      'Freelancer checked out',
      'A freelancer checked out for ' || v_job.title || ' (' || to_char(v_date, 'DD Mon') || ')',
      jsonb_build_object(
        'job_id', v_job.id,
        'application_id', p_application_id,
        'work_date', v_date
      )
    );
  end if;

  return v_event;
end;
$$;




CREATE OR REPLACE FUNCTION "public"."withdraw_application"("p_application_id" "uuid") RETURNS "public"."applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_app public.applications;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if v_app is null then
    raise exception 'Application not found';
  end if;
  if v_app.freelancer_id <> auth.uid() then
    raise exception 'Not your application';
  end if;
  if v_app.status not in ('applied', 'accepted') then
    raise exception 'Only applied or selected applications can be withdrawn';
  end if;

  update public.applications
    set status = 'cancelled'
    where id = p_application_id
  returning * into v_app;

  return v_app;
end;
$$;




CREATE TABLE IF NOT EXISTS "private"."application_schedule_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "freelancer_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "work_date" "date" NOT NULL,
    "time_range" "tstzrange" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."business_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "business_name" "text" NOT NULL,
    "contact_person" "text",
    "address" "text",
    "description" "text",
    "logo_url" "text",
    "gst_number" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "photo_url" "text",
    "phone" "text",
    "email" "text",
    "city" "text",
    "area" "text",
    "lat" double precision,
    "lng" double precision,
    "search_radius_km" integer DEFAULT 10,
    "gender" "public"."gender_type",
    "date_of_birth" "date",
    "work_type" "public"."work_type" DEFAULT 'unskilled'::"public"."work_type",
    "about" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[],
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "active_mode" "public"."user_mode" DEFAULT 'freelancer'::"public"."user_mode",
    "onboarding_complete" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_location_coordinates_check" CHECK (((("lat" IS NULL) AND ("lng" IS NULL)) OR (("lat" IS NOT NULL) AND ("lng" IS NOT NULL) AND (("lat" >= ('-90'::integer)::double precision) AND ("lat" <= (90)::double precision)) AND (("lng" >= ('-180'::integer)::double precision) AND ("lng" <= (180)::double precision))))),
    CONSTRAINT "profiles_search_radius_check" CHECK ((("search_radius_km" IS NULL) OR (("search_radius_km" >= 1) AND ("search_radius_km" <= 100))))
);




CREATE OR REPLACE VIEW "public"."freelancer_contacts" WITH ("security_invoker"='true') AS
 SELECT "a"."id" AS "application_id",
    "a"."job_id",
    "a"."freelancer_id",
    "a"."status",
        CASE
            WHEN (("a"."status" = 'accepted'::"public"."application_status") AND ("j"."status" <> ALL (ARRAY['completed'::"public"."job_status", 'cancelled'::"public"."job_status", 'expired'::"public"."job_status"]))) THEN "p"."phone"
            ELSE NULL::"text"
        END AS "phone",
    "p"."full_name",
    "p"."photo_url",
    "p"."skills",
    "p"."work_type",
    "p"."city"
   FROM (("public"."applications" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "a"."freelancer_id")))
     JOIN "public"."jobs" "j" ON (("j"."id" = "a"."job_id")));




CREATE TABLE IF NOT EXISTS "public"."job_chat_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    CONSTRAINT "job_chat_memberships_interval" CHECK ((("left_at" IS NULL) OR ("left_at" >= "joined_at"))),
    CONSTRAINT "job_chat_memberships_role_check" CHECK (("role" = ANY (ARRAY['business_owner'::"text", 'freelancer'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."job_chat_reads" (
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."job_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "closed_at" timestamp with time zone,
    "closed_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_chats_closed_pair" CHECK (((("closed_at" IS NULL) AND ("closed_reason" IS NULL)) OR (("closed_at" IS NOT NULL) AND ("closed_reason" IS NOT NULL)))),
    CONSTRAINT "job_chats_closed_reason_check" CHECK ((("closed_reason" IS NULL) OR ("closed_reason" = ANY (ARRAY['payments_confirmed'::"text", 'job_cancelled'::"text", 'job_expired'::"text"]))))
);




CREATE TABLE IF NOT EXISTS "public"."job_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_messages_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 2000)))
);




CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "application_id" "uuid",
    "reported_user_id" "uuid",
    "reason" "text" NOT NULL,
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE ONLY "private"."application_schedule_slots"
    ADD CONSTRAINT "application_schedule_slots_application_id_work_date_key" UNIQUE ("application_id", "work_date");



ALTER TABLE ONLY "private"."application_schedule_slots"
    ADD CONSTRAINT "application_schedule_slots_no_overlap" EXCLUDE USING "gist" ("freelancer_id" WITH =, "time_range" WITH &&);



ALTER TABLE ONLY "private"."application_schedule_slots"
    ADD CONSTRAINT "application_schedule_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_feedback"
    ADD CONSTRAINT "app_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_job_id_freelancer_id_key" UNIQUE ("job_id", "freelancer_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_events"
    ADD CONSTRAINT "attendance_events_app_kind_date_key" UNIQUE ("application_id", "kind", "work_date");



ALTER TABLE ONLY "public"."attendance_events"
    ADD CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_otps"
    ADD CONSTRAINT "attendance_otps_job_kind_date_key" UNIQUE ("job_id", "kind", "work_date");



ALTER TABLE ONLY "public"."attendance_otps"
    ADD CONSTRAINT "attendance_otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_profiles"
    ADD CONSTRAINT "business_profiles_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."business_profiles"
    ADD CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_chat_memberships"
    ADD CONSTRAINT "job_chat_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_chat_reads"
    ADD CONSTRAINT "job_chat_reads_pkey" PRIMARY KEY ("chat_id", "user_id");



ALTER TABLE ONLY "public"."job_chats"
    ADD CONSTRAINT "job_chats_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."job_chats"
    ADD CONSTRAINT "job_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_messages"
    ADD CONSTRAINT "job_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_application_id_key" UNIQUE ("application_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_application_id_from_user_id_key" UNIQUE ("application_id", "from_user_id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



CREATE INDEX "application_schedule_slots_freelancer_idx" ON "private"."application_schedule_slots" USING "btree" ("freelancer_id");



CREATE INDEX "application_schedule_slots_job_idx" ON "private"."application_schedule_slots" USING "btree" ("job_id");



CREATE INDEX "app_feedback_created_at_idx" ON "public"."app_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "app_feedback_user_id_idx" ON "public"."app_feedback" USING "btree" ("user_id");



CREATE INDEX "applications_freelancer_idx" ON "public"."applications" USING "btree" ("freelancer_id");



CREATE INDEX "applications_job_idx" ON "public"."applications" USING "btree" ("job_id");



CREATE INDEX "applications_status_idx" ON "public"."applications" USING "btree" ("status");



CREATE INDEX "attendance_events_app_date_idx" ON "public"."attendance_events" USING "btree" ("application_id", "work_date");



CREATE INDEX "attendance_events_app_idx" ON "public"."attendance_events" USING "btree" ("application_id");



CREATE UNIQUE INDEX "job_chat_memberships_active_uidx" ON "public"."job_chat_memberships" USING "btree" ("chat_id", "user_id") WHERE ("left_at" IS NULL);



CREATE INDEX "job_chat_memberships_chat_idx" ON "public"."job_chat_memberships" USING "btree" ("chat_id", "joined_at");



CREATE INDEX "job_chat_memberships_user_idx" ON "public"."job_chat_memberships" USING "btree" ("user_id", "chat_id");



CREATE INDEX "job_messages_chat_created_idx" ON "public"."job_messages" USING "btree" ("chat_id", "created_at" DESC);



CREATE INDEX "job_messages_sender_idx" ON "public"."job_messages" USING "btree" ("sender_id");



CREATE INDEX "jobs_business_idx" ON "public"."jobs" USING "btree" ("business_id");



CREATE INDEX "jobs_date_idx" ON "public"."jobs" USING "btree" ("job_date");



CREATE INDEX "jobs_location_idx" ON "public"."jobs" USING "btree" ("lat", "lng");



CREATE INDEX "jobs_status_idx" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "notifications_user_idx" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "ratings_from_user_idx" ON "public"."ratings" USING "btree" ("from_user_id");



CREATE INDEX "ratings_to_user_idx" ON "public"."ratings" USING "btree" ("to_user_id");



CREATE OR REPLACE TRIGGER "applications_capacity_guard" BEFORE INSERT OR DELETE OR UPDATE OF "status" ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "private"."maintain_job_application_capacity"();



CREATE OR REPLACE TRIGGER "applications_enforce_eligibility" BEFORE INSERT OR UPDATE OF "status", "job_id", "freelancer_id" ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_application_eligibility"();



CREATE OR REPLACE TRIGGER "applications_job_chat_sync" AFTER INSERT OR DELETE OR UPDATE OF "status" ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "private"."sync_job_chat_membership"();



CREATE OR REPLACE TRIGGER "applications_schedule_slots_sync" AFTER INSERT OR DELETE OR UPDATE OF "status" ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "private"."sync_application_schedule_slots"();



CREATE OR REPLACE TRIGGER "applications_staffing_refresh" AFTER INSERT OR DELETE OR UPDATE OF "status" ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."applications_after_change"();



CREATE OR REPLACE TRIGGER "applications_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "business_profiles_updated_at" BEFORE UPDATE ON "public"."business_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "jobs_freeze_schedule_after_applications" BEFORE UPDATE OF "work_dates", "start_time", "end_time", "job_date" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "private"."freeze_job_schedule_after_applications"();



CREATE OR REPLACE TRIGGER "jobs_job_chat_sync" AFTER UPDATE OF "status" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "private"."sync_job_chat_on_job_status"();



CREATE OR REPLACE TRIGGER "jobs_release_schedule_slots" AFTER UPDATE OF "status" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "private"."release_job_schedule_slots"();



CREATE OR REPLACE TRIGGER "jobs_sync_work_dates" BEFORE INSERT OR UPDATE OF "work_dates", "job_date" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_job_date_from_work_dates"();



CREATE OR REPLACE TRIGGER "jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payments_job_chat_sync" AFTER INSERT OR UPDATE OF "status" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "private"."sync_job_chat_on_payment"();



CREATE OR REPLACE TRIGGER "payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "private"."application_schedule_slots"
    ADD CONSTRAINT "application_schedule_slots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "private"."application_schedule_slots"
    ADD CONSTRAINT "application_schedule_slots_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "private"."application_schedule_slots"
    ADD CONSTRAINT "application_schedule_slots_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_feedback"
    ADD CONSTRAINT "app_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_events"
    ADD CONSTRAINT "attendance_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_events"
    ADD CONSTRAINT "attendance_events_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance_otps"
    ADD CONSTRAINT "attendance_otps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_otps"
    ADD CONSTRAINT "attendance_otps_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_profiles"
    ADD CONSTRAINT "business_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_chat_memberships"
    ADD CONSTRAINT "job_chat_memberships_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."job_chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_chat_memberships"
    ADD CONSTRAINT "job_chat_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_chat_reads"
    ADD CONSTRAINT "job_chat_reads_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."job_chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_chat_reads"
    ADD CONSTRAINT "job_chat_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_chats"
    ADD CONSTRAINT "job_chats_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_messages"
    ADD CONSTRAINT "job_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."job_chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_messages"
    ADD CONSTRAINT "job_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."business_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."app_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_feedback_select_own" ON "public"."app_feedback" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applications_insert_freelancer" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK ((("freelancer_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'applied'::"public"."application_status")));



CREATE POLICY "applications_select_parties" ON "public"."applications" FOR SELECT TO "authenticated" USING ((("freelancer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("job_id" IN ( SELECT "j"."id"
   FROM ("public"."jobs" "j"
     JOIN "public"."business_profiles" "b" ON (("b"."id" = "j"."business_id")))
  WHERE ("b"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "applications_update_freelancer_withdraw" ON "public"."applications" FOR UPDATE TO "authenticated" USING ((("freelancer_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['applied'::"public"."application_status", 'accepted'::"public"."application_status"])))) WITH CHECK ((("freelancer_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'cancelled'::"public"."application_status")));



ALTER TABLE "public"."attendance_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_events_select_parties" ON "public"."attendance_events" FOR SELECT TO "authenticated" USING (("application_id" IN ( SELECT "a"."id"
   FROM "public"."applications" "a"
  WHERE (("a"."freelancer_id" = "auth"."uid"()) OR ("a"."job_id" IN ( SELECT "j"."id"
           FROM ("public"."jobs" "j"
             JOIN "public"."business_profiles" "b" ON (("b"."id" = "j"."business_id")))
          WHERE ("b"."owner_id" = "auth"."uid"())))))));



ALTER TABLE "public"."attendance_otps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_insert_own" ON "public"."business_profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



ALTER TABLE "public"."business_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_select_all" ON "public"."business_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "business_update_own" ON "public"."business_profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



ALTER TABLE "public"."job_chat_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_chat_memberships_select_member" ON "public"."job_chat_memberships" FOR SELECT TO "authenticated" USING ("public"."is_job_chat_member"("chat_id"));



ALTER TABLE "public"."job_chat_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_chat_reads_select_own" ON "public"."job_chat_reads" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_job_chat_member"("chat_id")));



CREATE POLICY "job_chat_reads_update_own" ON "public"."job_chat_reads" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_job_chat_member"("chat_id"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_job_chat_member"("chat_id")));



CREATE POLICY "job_chat_reads_upsert_own" ON "public"."job_chat_reads" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_job_chat_member"("chat_id")));



ALTER TABLE "public"."job_chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_chats_select_member" ON "public"."job_chats" FOR SELECT TO "authenticated" USING ("public"."is_job_chat_member"("id"));



ALTER TABLE "public"."job_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_messages_insert_active" ON "public"."job_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."can_send_job_message"("chat_id")));



CREATE POLICY "job_messages_select_visible" ON "public"."job_messages" FOR SELECT TO "authenticated" USING ("public"."can_read_job_message"("chat_id", "created_at"));



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_insert_owner" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK (("business_id" IN ( SELECT "business_profiles"."id"
   FROM "public"."business_profiles"
  WHERE ("business_profiles"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "jobs_select_live_or_owner" ON "public"."jobs" FOR SELECT TO "authenticated" USING ((("status" = ANY (ARRAY['live'::"public"."job_status", 'fully_staffed'::"public"."job_status", 'confirmed'::"public"."job_status", 'in_progress'::"public"."job_status", 'completed'::"public"."job_status"])) OR ("business_id" IN ( SELECT "business_profiles"."id"
   FROM "public"."business_profiles"
  WHERE ("business_profiles"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ( SELECT "public"."is_job_applicant"("jobs"."id") AS "is_job_applicant")));



CREATE POLICY "jobs_update_owner" ON "public"."jobs" FOR UPDATE TO "authenticated" USING (("business_id" IN ( SELECT "business_profiles"."id"
   FROM "public"."business_profiles"
  WHERE ("business_profiles"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("business_id" IN ( SELECT "business_profiles"."id"
   FROM "public"."business_profiles"
  WHERE ("business_profiles"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "otp_select_business" ON "public"."attendance_otps" FOR SELECT TO "authenticated" USING ("public"."is_job_business_owner"("job_id"));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select_parties" ON "public"."payments" FOR SELECT TO "authenticated" USING (("application_id" IN ( SELECT "a"."id"
   FROM "public"."applications" "a"
  WHERE (("a"."freelancer_id" = "auth"."uid"()) OR ("a"."job_id" IN ( SELECT "j"."id"
           FROM ("public"."jobs" "j"
             JOIN "public"."business_profiles" "b" ON (("b"."id" = "j"."business_id")))
          WHERE ("b"."owner_id" = "auth"."uid"())))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_select_authenticated" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ratings_select" ON "public"."ratings" FOR SELECT TO "authenticated" USING ((("from_user_id" = "auth"."uid"()) OR (("to_user_id" = "auth"."uid"()) AND "public"."rating_is_visible"("application_id")) OR "public"."rating_is_visible"("application_id")));



ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_insert_own" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "reports_select_own" ON "public"."reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));







ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."attendance_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."job_messages";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































































































































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "private"."enforce_application_eligibility"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."application_attendance_complete"("p_application_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."applications_after_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."available_job_ids"("p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."available_job_ids"("p_job_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."available_job_ids"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."can_read_job_message"("p_chat_id" "uuid", "p_created_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."can_read_job_message"("p_chat_id" "uuid", "p_created_at" timestamp with time zone) TO "authenticated";



GRANT ALL ON FUNCTION "public"."can_send_job_message"("p_chat_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_send_job_message"("p_chat_id" "uuid") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."jobs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_job"("p_job_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."cancel_job"("p_job_id" "uuid") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_events" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_events" TO "service_role";



GRANT ALL ON FUNCTION "public"."correct_attendance"("p_application_id" "uuid", "p_kind" "public"."attendance_kind", "p_work_date" "date", "p_reason" "text", "p_photo_path" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."correct_attendance"("p_application_id" "uuid", "p_kind" "public"."attendance_kind", "p_work_date" "date", "p_reason" "text", "p_photo_path" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_meta" "jsonb") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_otps" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_otps" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_otps" TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_attendance_otp"("p_job_id" "uuid", "p_kind" "public"."attendance_kind", "p_work_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."generate_attendance_otp"("p_job_id" "uuid", "p_kind" "public"."attendance_kind", "p_work_date" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_job_chat"("p_job_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_job_chat"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_accepted_freelancer_on_job"("p_job_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_accepted_freelancer_on_job"("p_job_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_job_applicant"("p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_job_applicant"("p_job_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_job_applicant"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_job_business_owner"("p_job_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_job_business_owner"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_job_chat_member"("p_chat_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_job_chat_member"("p_chat_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_work_date_today"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."job_allows_attendance"("p_job" "public"."jobs") TO "service_role";



GRANT ALL ON FUNCTION "public"."job_chat_unread_total"() TO "service_role";
GRANT ALL ON FUNCTION "public"."job_chat_unread_total"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."job_day_total"("p_job" "public"."jobs") TO "service_role";



GRANT ALL ON FUNCTION "public"."job_engagement_total"("p_job" "public"."jobs") TO "service_role";
GRANT ALL ON FUNCTION "public"."job_engagement_total"("p_job" "public"."jobs") TO "authenticated";



GRANT ALL ON FUNCTION "public"."job_staffing_counts"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."job_staffing_counts"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_job_chat_summaries"() TO "service_role";
GRANT ALL ON FUNCTION "public"."list_job_chat_summaries"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."mark_job_chat_read"("p_job_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_job_chat_read"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rating_is_visible"("p_application_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."rating_is_visible"("p_application_id" "uuid") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."applications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



REVOKE ALL ON FUNCTION "public"."reapply_application"("p_application_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reapply_application"("p_application_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."reapply_application"("p_application_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."refresh_job_staffing_status"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_application_status"("p_application_id" "uuid", "p_status" "public"."application_status") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_application_status"("p_application_id" "uuid", "p_status" "public"."application_status") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_feedback" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."app_feedback" TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_app_feedback"("p_overall" numeric, "p_category" "text", "p_comment" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_app_feedback"("p_overall" numeric, "p_category" "text", "p_comment" "text") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ratings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_rating"("p_application_id" "uuid", "p_overall" numeric, "p_dimensions" "jsonb", "p_comment" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_rating"("p_application_id" "uuid", "p_overall" numeric, "p_dimensions" "jsonb", "p_comment" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_job_date_from_work_dates"() TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_payment_claim"("p_application_id" "uuid", "p_role" "text", "p_claim" "text", "p_amount" integer, "p_method" "public"."payment_method", "p_complaint" "text", "p_response" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."upsert_payment_claim"("p_application_id" "uuid", "p_role" "text", "p_claim" "text", "p_amount" integer, "p_method" "public"."payment_method", "p_complaint" "text", "p_response" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."verify_attendance_otp"("p_application_id" "uuid", "p_kind" "public"."attendance_kind", "p_code" "text", "p_photo_path" "text", "p_lat" double precision, "p_lng" double precision, "p_work_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."verify_attendance_otp"("p_application_id" "uuid", "p_kind" "public"."attendance_kind", "p_code" "text", "p_photo_path" "text", "p_lat" double precision, "p_lng" double precision, "p_work_date" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."withdraw_application"("p_application_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."withdraw_application"("p_application_id" "uuid") TO "authenticated";
























GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."business_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."business_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."business_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."freelancer_contacts" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."freelancer_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."freelancer_contacts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_chat_memberships" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_chat_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."job_chat_memberships" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_chat_reads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."job_chat_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."job_chat_reads" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_chats" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."job_chats" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."job_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."job_messages" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";









-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
-- skipped for hosted: ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();




-- Ensure attendance photos bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "attendance_photos_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'attendance-photos'::"text"));



CREATE POLICY "attendance_photos_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'attendance-photos'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "attendance_photos_upload" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'attendance-photos'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



