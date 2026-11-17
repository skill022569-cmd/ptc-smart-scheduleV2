// Buildings: ids/names used by room search (e.g. /map?q=AUTO) and for the seed data's first pin positions.
export const BUILDINGS = [
  { id: "ADM", name: "อาคารอำนวยการ", x: 40, y: 8, w: 22, h: 12 },
  { id: "B1", name: "อาคารเรียนรวม 1", x: 8, y: 30, w: 22, h: 14 },
  { id: "B2", name: "อาคารเรียนรวม 2", x: 70, y: 30, w: 22, h: 14 },
  { id: "AUTO", name: "อาคารช่างยนต์", x: 8, y: 58, w: 18, h: 14 },
  { id: "ELEC", name: "อาคารช่างไฟฟ้ากำลัง", x: 30, y: 58, w: 18, h: 14 },
  { id: "ELEX", name: "อาคารช่างอิเล็กทรอนิกส์", x: 52, y: 58, w: 18, h: 14 },
  { id: "MECH", name: "อาคารช่างกลโรงงาน", x: 74, y: 58, w: 18, h: 14 },
  { id: "BUS", name: "อาคารพาณิชยกรรม", x: 36, y: 34, w: 26, h: 12 },
  { id: "CAF", name: "โรงอาหาร", x: 40, y: 82, w: 18, h: 10 },
];

// Real satellite map (Google Maps embed) used as the campus map background. Room pins are % of this fixed view.
export const MAP_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1187.9828075274136!2d103.9920678595868!3d16.299004708627553!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x313d694555555555%3A0xca6368615ba4782c!2z4Lin4Li04LiX4Lii4Liy4Lil4Lix4Lii4LiB4Liy4Lij4Lit4Liy4LiK4Li14Lie4LmC4Lie4LiZ4LiX4Lit4LiH!5e1!3m2!1sth!2sth!4v1794820402572!5m2!1sth!2sth";
export const MAP_DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1&destination=16.299005,103.992068";
