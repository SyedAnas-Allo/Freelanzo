export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserMode = "freelancer" | "business";
export type WorkType = "skilled" | "unskilled";
export type GenderType = "male" | "female" | "other" | "prefer_not_to_say";
export type JobGenderPreference = "male" | "female" | "any";
export type JobStatus =
  | "draft"
  | "live"
  | "fully_staffed"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";
export type ApplicationStatus =
  | "applied"
  | "rejected"
  | "accepted"
  | "cancelled";
export type JobCategory =
  | "hospitality"
  | "event"
  | "promoter"
  | "delivery"
  | "warehouse"
  | "security"
  | "catering"
  | "retail"
  | "corporate"
  | "sports"
  | "talent"
  | "labour"
  | "cleaning"
  | "other";
export type AttendanceKind = "check_in" | "check_out";
export type AttendanceRequestStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "cancelled";
export type PaymentMethod = "cash" | "upi";
export type PaymentStatus = "pending" | "confirmed" | "dispute";
export type BusinessPayClaim = "paid" | "not_paid";
export type FreelancerPayClaim = "received" | "not_received";

export type Profile = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  search_radius_km: number | null;
  gender: GenderType | null;
  date_of_birth: string | null;
  work_type: WorkType | null;
  about: string | null;
  languages: string[] | null;
  skills: string[] | null;
  active_mode: UserMode;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessProfile = {
  id: string;
  owner_id: string;
  business_name: string;
  contact_person: string | null;
  address: string | null;
  description: string | null;
  logo_url: string | null;
  gst_number: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  category: JobCategory;
  skilled: boolean;
  gender_preference: JobGenderPreference;
  headcount: number;
  active_application_count: number;
  job_date: string;
  /** Selected work days (1–15). First day equals job_date. */
  work_dates?: string[] | null;
  start_time: string;
  end_time: string;
  address: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  pay_per_freelancer: number;
  dress_code: string | null;
  instructions: string | null;
  food_allowance_inr: number;
  travel_allowance_inr: number;
  safety_flags: Json;
  status: JobStatus;
  reopen_used: boolean;
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  job_id: string;
  freelancer_id: string;
  status: ApplicationStatus;
  note: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedJob = {
  freelancer_id: string;
  job_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  meta: Json;
  read_at: string | null;
  created_at: string;
};

export type AttendanceOtp = {
  id: string;
  job_id: string;
  kind: AttendanceKind;
  work_date: string;
  code: string;
  expires_at: string;
  created_by: string;
  created_at: string;
};

export type AttendanceEvent = {
  id: string;
  application_id: string;
  kind: AttendanceKind;
  work_date: string;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
  verified_at: string;
  created_at: string;
  source?: "otp" | "manual_correction" | "business_confirmation";
  corrected_by?: string | null;
  correction_reason?: string | null;
  corrected_at?: string | null;
};

export type AttendanceRequest = {
  id: string;
  application_id: string;
  kind: AttendanceKind;
  work_date: string;
  photo_path: string;
  lat: number | null;
  lng: number | null;
  status: AttendanceRequestStatus;
  rejection_reason: string | null;
  requested_at: string;
  expires_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string;
};

export type Payment = {
  id: string;
  application_id: string;
  amount: number | null;
  method: PaymentMethod | null;
  business_claimed: BusinessPayClaim | null;
  freelancer_claimed: FreelancerPayClaim | null;
  status: PaymentStatus;
  complaint: string | null;
  response: string | null;
  created_at: string;
  updated_at: string;
};

export type Rating = {
  id: string;
  application_id: string;
  from_user_id: string;
  to_user_id: string;
  overall: number;
  dimensions: Json;
  comment: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  job_id: string | null;
  application_id: string | null;
  reported_user_id: string | null;
  reason: string;
  details: string | null;
  created_at: string;
};

export type AppFeedbackCategory =
  | "experience"
  | "bug"
  | "feature"
  | "other";

export type AppFeedback = {
  id: string;
  user_id: string;
  overall: number;
  category: AppFeedbackCategory;
  comment: string | null;
  active_mode: UserMode;
  created_at: string;
};

export type JobChatClosedReason =
  | "payments_confirmed"
  | "job_cancelled"
  | "job_expired";

export type JobChatMembershipRole = "business_owner" | "freelancer";

export type JobChat = {
  id: string;
  job_id: string;
  closed_at: string | null;
  closed_reason: JobChatClosedReason | null;
  created_at: string;
};

export type JobChatMembership = {
  id: string;
  chat_id: string;
  user_id: string;
  role: JobChatMembershipRole;
  joined_at: string;
  left_at: string | null;
};

export type JobMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type JobChatRead = {
  chat_id: string;
  user_id: string;
  last_read_at: string;
};

export type JobChatSummary = {
  chat_id: string;
  job_id: string;
  job_title: string;
  business_name: string;
  closed_at: string | null;
  closed_reason: JobChatClosedReason | null;
  can_send: boolean;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type JobChatDetail = {
  chat_id: string;
  job_id: string;
  job_title: string;
  business_name: string;
  closed_at: string | null;
  closed_reason: JobChatClosedReason | null;
  can_send: boolean;
  member_count: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      business_profiles: {
        Row: BusinessProfile;
        Insert: Omit<BusinessProfile, "id" | "created_at" | "updated_at" | "verified"> & {
          id?: string;
          verified?: boolean;
        };
        Update: Partial<BusinessProfile>;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, "id" | "created_at" | "updated_at" | "reopen_used" | "status"> & {
          id?: string;
          status?: JobStatus;
          reopen_used?: boolean;
        };
        Update: Partial<Job>;
        Relationships: [];
      };
      applications: {
        Row: Application;
        Insert: Omit<Application, "id" | "created_at" | "updated_at" | "status" | "note" | "rejection_reason"> & {
          id?: string;
          status?: ApplicationStatus;
          note?: string | null;
          rejection_reason?: string | null;
        };
        Update: Partial<Application>;
        Relationships: [];
      };
      saved_jobs: {
        Row: SavedJob;
        Insert: Omit<SavedJob, "created_at"> & { created_at?: string };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at" | "read_at" | "meta"> & {
          id?: string;
          meta?: Json;
          read_at?: string | null;
        };
        Update: Partial<Notification>;
        Relationships: [];
      };
      attendance_otps: {
        Row: AttendanceOtp;
        Insert: Omit<AttendanceOtp, "id" | "created_at"> & { id?: string };
        Update: Partial<AttendanceOtp>;
        Relationships: [];
      };
      attendance_events: {
        Row: AttendanceEvent;
        Insert: Omit<AttendanceEvent, "id" | "created_at" | "verified_at"> & {
          id?: string;
          verified_at?: string;
        };
        Update: Partial<AttendanceEvent>;
        Relationships: [];
      };
      attendance_requests: {
        Row: AttendanceRequest;
        Insert: Omit<AttendanceRequest, "id" | "requested_at" | "expires_at" | "updated_at" | "status" | "reviewed_at" | "reviewed_by" | "rejection_reason"> & {
          id?: string;
          status?: AttendanceRequestStatus;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: Partial<AttendanceRequest>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "id" | "created_at" | "updated_at" | "status"> & {
          id?: string;
          status?: PaymentStatus;
        };
        Update: Partial<Payment>;
        Relationships: [];
      };
      ratings: {
        Row: Rating;
        Insert: Omit<Rating, "id" | "created_at"> & { id?: string };
        Update: Partial<Rating>;
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: Omit<Report, "id" | "created_at"> & { id?: string };
        Update: Partial<Report>;
        Relationships: [];
      };
      app_feedback: {
        Row: AppFeedback;
        Insert: Omit<AppFeedback, "id" | "created_at"> & { id?: string };
        Update: Partial<AppFeedback>;
        Relationships: [];
      };
      job_chats: {
        Row: JobChat;
        Insert: Omit<JobChat, "id" | "created_at" | "closed_at" | "closed_reason"> & {
          id?: string;
          closed_at?: string | null;
          closed_reason?: JobChatClosedReason | null;
        };
        Update: Partial<JobChat>;
        Relationships: [];
      };
      job_chat_memberships: {
        Row: JobChatMembership;
        Insert: Omit<JobChatMembership, "id" | "joined_at" | "left_at"> & {
          id?: string;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: Partial<JobChatMembership>;
        Relationships: [];
      };
      job_messages: {
        Row: JobMessage;
        Insert: Omit<JobMessage, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<JobMessage>;
        Relationships: [];
      };
      job_chat_reads: {
        Row: JobChatRead;
        Insert: JobChatRead;
        Update: Partial<JobChatRead>;
        Relationships: [];
      };
    };
    Views: {
      freelancer_contacts: {
        Row: {
          application_id: string;
          job_id: string;
          freelancer_id: string;
          status: ApplicationStatus;
          phone: string | null;
          full_name: string | null;
          photo_url: string | null;
          skills: string[] | null;
          work_type: WorkType | null;
          city: string | null;
        };
      };
    };
    Functions: {
      haversine_km: {
        Args: {
          lat1: number;
          lng1: number;
          lat2: number;
          lng2: number;
        };
        Returns: number;
      };
      job_staffing_counts: {
        Args: { p_job_id: string };
        Returns: {
          accepted_count: number;
          headcount: number;
        }[];
      };
      create_notification: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_title: string;
          p_body?: string;
          p_meta?: Json;
        };
        Returns: undefined;
      };
      generate_attendance_otp: {
        Args: {
          p_job_id: string;
          p_kind: AttendanceKind;
          p_work_date?: string | null;
        };
        Returns: AttendanceOtp;
      };
      verify_attendance_otp: {
        Args: {
          p_application_id: string;
          p_kind: AttendanceKind;
          p_code: string;
          p_photo_path?: string | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_work_date?: string | null;
        };
        Returns: AttendanceEvent;
      };
      submit_attendance_request: {
        Args: {
          p_application_id: string;
          p_kind: AttendanceKind;
          p_photo_path: string;
          p_lat?: number | null;
          p_lng?: number | null;
          p_work_date?: string | null;
        };
        Returns: AttendanceRequest;
      };
      review_attendance_requests: {
        Args: {
          p_request_ids: string[];
          p_decision: "confirmed" | "rejected";
          p_rejection_reason?: string | null;
        };
        Returns: AttendanceRequest[];
      };
      correct_attendance: {
        Args: {
          p_application_id: string;
          p_kind: AttendanceKind;
          p_work_date: string;
          p_reason: string;
          p_photo_path?: string | null;
        };
        Returns: AttendanceEvent;
      };
      set_application_status: {
        Args: {
          p_application_id: string;
          p_status: ApplicationStatus;
          p_rejection_reason?: string | null;
        };
        Returns: Application;
      };
      withdraw_application: {
        Args: { p_application_id: string };
        Returns: Application;
      };
      is_job_saved: {
        Args: { p_job_id: string };
        Returns: boolean;
      };
      cancel_job: {
        Args: { p_job_id: string };
        Returns: Job;
      };
      update_job_and_notify_applicants: {
        Args: {
          p_job_id: string;
          p_title: string;
          p_description: string;
          p_category: JobCategory;
          p_skilled: boolean;
          p_gender_preference: JobGenderPreference;
          p_headcount: number;
          p_work_dates: string[];
          p_start_time: string;
          p_end_time: string;
          p_address: string;
          p_area: string;
          p_city: string;
          p_lat: number;
          p_lng: number;
          p_pay_per_freelancer: number;
          p_dress_code: string;
          p_instructions: string;
          p_food_allowance_inr: number;
          p_travel_allowance_inr: number;
        };
        Returns: Job;
      };
      reapply_application: {
        Args: { p_application_id: string };
        Returns: Application;
      };
      upsert_payment_claim: {
        Args: {
          p_application_id: string;
          p_role: string;
          p_claim: string;
          p_amount?: number | null;
          p_method?: PaymentMethod | null;
          p_complaint?: string | null;
          p_response?: string | null;
        };
        Returns: Payment;
      };
      submit_rating: {
        Args: {
          p_application_id: string;
          p_overall: number;
          p_dimensions?: Json;
          p_comment?: string | null;
        };
        Returns: Rating;
      };
      submit_app_feedback: {
        Args: {
          p_overall: number;
          p_category: AppFeedbackCategory;
          p_comment?: string | null;
        };
        Returns: AppFeedback;
      };
      rating_is_visible: {
        Args: { p_application_id: string };
        Returns: boolean;
      };
      list_job_chat_summaries: {
        Args: Record<string, never>;
        Returns: JobChatSummary[];
      };
      job_chat_unread_total: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_job_chat_read: {
        Args: { p_job_id: string };
        Returns: undefined;
      };
      get_job_chat: {
        Args: { p_job_id: string };
        Returns: JobChatDetail[];
      };
    };
    Enums: {
      user_mode: UserMode;
      work_type: WorkType;
      gender_type: GenderType;
      job_status: JobStatus;
      application_status: ApplicationStatus;
      job_category: JobCategory;
      attendance_kind: AttendanceKind;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      business_pay_claim: BusinessPayClaim;
      freelancer_pay_claim: FreelancerPayClaim;
    };
  };
};
