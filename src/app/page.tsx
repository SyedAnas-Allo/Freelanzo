import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export default async function HomePage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  // Middleware sends users without a session role pick to /continue.
  if (profile?.active_mode === "business") redirect("/business");
  redirect("/freelancer");
}
