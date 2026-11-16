import { requireUser } from "@/lib/auth";
import Chat from "./Chat";

export default async function AssistantPage() {
  const s = await requireUser();
  return <Chat role={s.role} />;
}
