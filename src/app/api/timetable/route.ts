import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { loadTimetable } from "@/lib/timetable";

export async function GET(req: Request) {
  if (!(await apiUser(["admin"]))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  return NextResponse.json(await loadTimetable({ group_id: sp.get("group") ?? undefined, teacher_id: sp.get("teacher") ?? undefined }));
}
