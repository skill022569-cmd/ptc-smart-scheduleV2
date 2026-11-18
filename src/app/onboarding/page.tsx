import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import OnboardingForm from "./form";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const s = await getSession();
  if (!s) redirect("/login");
  const [u] = await q<{ must_change_password: number; pdpa_consent: number; is_email_verified: number; email: string | null }>(
    "SELECT must_change_password, pdpa_consent, is_email_verified, email FROM users WHERE user_id=?", [s.uid]);
  if (!u) redirect("/api/auth/logout");
  if (s.actor || (!u.must_change_password && u.pdpa_consent && u.is_email_verified)) redirect("/schedule");
  return <OnboardingForm mustChange={!!u.must_change_password} needEmail={!u.is_email_verified} email={u.email ?? ""} />;
}
