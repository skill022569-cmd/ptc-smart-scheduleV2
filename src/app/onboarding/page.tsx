import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import OnboardingForm from "./form";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const s = await getSession();
  if (!s) redirect("/login");
  const [u] = await q<{ must_change_password: number; pdpa_consent: number }>(
    "SELECT must_change_password, pdpa_consent FROM users WHERE user_id=?", [s.uid]);
  if (!u) redirect("/api/auth/logout");
  if (!u.must_change_password && u.pdpa_consent) redirect("/schedule");
  return <OnboardingForm mustChange={!!u.must_change_password} />;
}
