import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { PostJobForm } from "./_components/post-job-form";

export default async function PostJobPage() {
  const { business } = await getSessionProfile();
  if (!business) {
    redirect(
      `/business/setup?returnTo=${encodeURIComponent("/business/jobs/new")}`,
    );
  }

  return <PostJobForm />;
}
