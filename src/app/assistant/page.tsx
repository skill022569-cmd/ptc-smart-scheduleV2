import { requireUser } from "@/lib/auth";
import Chat from "./Chat";

export default async function AssistantPage() {
  const s = await requireUser();
  // The session token's issue time changes on every login: a new login gets a new, empty chat.
  const iat = (s as { iat?: number }).iat ?? 0;
  return <Chat role={s.role} storageKey={`${s.uid}:${iat}`} />;
}
