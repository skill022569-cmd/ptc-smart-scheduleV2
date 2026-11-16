import { q } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseJson } from "@/lib/timetable";
import CampusMap, { type MapRoom } from "./CampusMap";

export const dynamic = "force-dynamic";

export default async function MapPage({ searchParams }: { searchParams: Promise<{ room?: string; q?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const rooms = (await q<{ room_id: string; building_name: string; floor: number; room_type: string; department: string | null; map_coordinates: unknown }>(
    "SELECT room_id, building_name, floor, room_type, department, map_coordinates FROM classrooms ORDER BY room_id",
  )).map<MapRoom>((r) => ({ ...r, coords: parseJson<{ x: number; y: number } | null>(r.map_coordinates, null) }));
  return <CampusMap rooms={rooms} initial={sp.room ?? sp.q ?? ""} isAdmin={s?.role === "admin"} />;
}
