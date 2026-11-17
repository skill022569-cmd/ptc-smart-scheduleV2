# PTC Smart Schedule — ระบบจัดตารางเรียน-ตารางสอน วิทยาลัยการอาชีพโพนทอง

Next.js (Vercel) + TiDB Cloud (Vector Search)

| ส่วน | สิ่งที่ทำได้ |
|---|---|
| 🔐 เข้าสู่ระบบ | แยกปุ่มนักเรียน/บุคลากร · บุคลากรยืนยัน **OTP 6 หลักทางอีเมล** (เก็บใน `otp_logs` แบบ **TiDB TTL 5 นาที**) · ล็อกบัญชี 15 นาทีเมื่อรหัสผ่าน/OTP ผิด 5 ครั้ง · แจ้งเตือนทางอีเมลเมื่อเข้าจากอุปกรณ์ใหม่ (บันทึก `audit_logs`, TTL 1 ปี) |
| 🛡️ PDPA | Pop-up ยอมรับนโยบาย (เก็บเวอร์ชัน + เวลา) · ปิดบังอีเมล `te***@…` · ส่งออกข้อมูลตัวเอง (JSON) · ลบบัญชี · TLS ไป TiDB Cloud (Encryption at rest เป็นค่าเริ่มต้นของ TiDB Cloud) |
| 🎓 นักเรียน | ตารางแบบการ์ด (รหัสวิชา ชื่อวิชา ครู ห้อง) · เปลี่ยนสี (เก็บเป็น JSON ใน `users.ui_theme`) · บันทึกเป็น PNG · รหัสผ่านเริ่มต้น = รหัสนักศึกษา (บังคับเปลี่ยนครั้งแรก) |
| 👩‍🏫 ครู | ตารางสอน + รายชื่อนักเรียน · ล็อกเวลาไม่สะดวกสอน (JSON array) · แถบเตือนสีแดงเมื่อคาบมาชนเวลาที่ล็อก (เช็กทุก 30 วินาที) |
| ⚙️ ฝ่ายวิชาการ | ข้อมูลหลัก (วิชา ครู ห้อง กลุ่ม หลักสูตร นักเรียน + นำเข้า CSV ประกาศ ฐานความรู้ AI) · **AI จัดตารางทั้งวิทยาลัย** · ลากวางปรับตาราง (Transaction + Unique Key กันชน 100%) · จุดกู้คืน (snapshot ก่อนรัน AI) · ส่งออก CSV/Excel · จัดการบัญชี/ปลดล็อก |
| 🗺️ แผนที่ | ค้นหาห้อง/อาคาร/แผนก ไฮไลต์ตำแหน่ง · แอดมินคลิกปักหมุดห้องบนแผนที่ |
| 🤖 ถาม AI | **TiDB Vector Search ล้วน ไม่มีค่าใช้จ่าย**: ตารางเรียนทุกคาบถูกแปลงเป็นประโยคภาษาไทยเก็บใน `kb_docs` (อัปเดตอัตโนมัติทุกครั้งที่รัน AI/ย้อนเวอร์ชัน/ลากย้าย) รวมกับเอกสารระเบียบ · TiDB แปลงคำถามเป็นเวกเตอร์ด้วย `EMBED_TEXT` แล้วค้นด้วย `VEC_EMBED_COSINE_DISTANCE` · กรองวัน ("วันนี้", "พรุ่งนี้", ชื่อวัน) และ "ตารางของฉัน" ก่อนจัดอันดับ · แนบปุ่ม [ดูตำแหน่งห้องบนแผนที่] |

ตัวจัดตาราง (`src/lib/scheduler.ts`): ห้อง/ครู/กลุ่มไม่ชนกัน · วิชาปฏิบัติใช้ห้องตรงประเภทและแผนก · วิชาปฏิบัติเรียนต่อเนื่องเป็นบล็อก · ไม่คร่อมพักเที่ยง (คาบ 5) · เคารพเวลาที่ครูล็อก · ไม่เกินชั่วโมงสอนสูงสุด · กระจายภาระตลอดสัปดาห์ · วิชาที่วางไม่ได้จะแจ้งพร้อมเหตุผล

---

## 🚀 Deploy (ทำครั้งเดียว)

### 1) สร้างฐานข้อมูล TiDB Cloud
1. สมัคร <https://tidbcloud.com> → **Create Cluster → Starter** → Cloud Provider **AWS**, Region **Singapore (ap-southeast-1)**
   (Auto Embedding/Vector Search แบบฟรีมีเฉพาะ Starter บน AWS)
2. กด **Connect** → เลือก *Node.js* → **Generate Password** → จดค่า host / user / password

### 2) สร้างตารางและข้อมูลตัวอย่าง (รันจากเครื่องคุณ ต้องมี Node.js 20+)
```bash
git clone https://github.com/skill022569-cmd/ptc-smart-scheduleV2.git
```
```bash
cd ptc-smart-scheduleV2 && npm install
```
```bash
cp .env.example .env.local
```
แก้ `.env.local` ใส่ค่าจริง (อย่างน้อย `DATABASE_URL`, `SESSION_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_TEACHER_EMAIL`) แล้วรัน:
```bash
npm run db:migrate
```
```bash
npm run db:seed -- --yes
```
คำสั่ง seed **ลบข้อมูลเดิมทั้งหมด** แล้วใส่ข้อมูลจำลอง 6 แผนก/30 กลุ่ม/33 ครู/30 ห้อง พร้อมรัน AI จัดตาราง
และพิมพ์ **รหัสผ่านบัญชีทดสอบ (admin, teacher, นักเรียน 6921001)** ออกมาครั้งเดียว — จดไว้

### 3) Deploy บน Vercel
1. <https://vercel.com/new> → Import repo `ptc-smart-scheduleV2` (Framework: Next.js อัตโนมัติ)
2. **Environment Variables**: คัดลอกทุกค่าจาก `.env.local` (ยกเว้น `SEED_*`)
3. Deploy — ฟังก์ชันตั้งไว้ที่ region `sin1` (สิงคโปร์) ให้ใกล้ TiDB

### ค่า env สำคัญ
| ชื่อ | คำอธิบาย |
|---|---|
| `DATABASE_URL` | `mysql://<prefix>.root:<pass>@<host>:4000/ptc_schedule` |
| `SESSION_SECRET` | สุ่มยาว ≥ 32 ตัว (`openssl rand -base64 48`) |
| `SMTP_*` | SMTP สำหรับส่ง OTP เช่น Brevo (`smtp-relay.brevo.com:587`) · `SMTP_FROM` ต้องเป็นอีเมลผู้ส่งที่ยืนยันแล้ว |
| `TIDB_AUTO_EMBEDDING` | `true` บน TiDB Cloud Starter (AWS) — ถ้าไม่เปิด (เช่น dev ในเครื่อง) ระบบค้นแบบเทียบตัวอักษรแทน |
| `SKIP_OTP_USERNAMES` | ชั่วคราว: ชื่อผู้ใช้ที่ข้าม OTP เช่น `admin` — ลบออกก่อนใช้งานจริง |

---

## 💻 พัฒนาบนเครื่อง (ไม่ต้องใช้ cloud)
```bash
docker run -d --name tidb -p 4000:4000 pingcap/tidb:v8.5.1
```
`.env.local`:
```
DATABASE_URL=mysql://root:@127.0.0.1:4000/ptc_schedule
DB_SSL=false
SESSION_SECRET=dev-only-secret-change-me-0123456789abcdef
```
```bash
npm run db:migrate && npm run db:seed -- --yes && npm run dev
```
ถ้าไม่ได้ตั้ง SMTP ในโหมด dev รหัส OTP จะแสดงในเทอร์มินัล (`[DEV MAIL]`) · ทดสอบ: `npm test` · สร้างดัชนีถาม-ตอบใหม่: `npm run db:sync-qa`

## 🗂️ โครงสร้าง
```
db/schema.sql            ตารางทั้งหมด (AUTO_RANDOM, JSON, TTL, Composite Unique Key กันตารางชน)
scripts/migrate.ts       สร้างตาราง + kb_docs (vector) + TiFlash + บัญชีอ่านอย่างเดียว
scripts/seed.ts          ข้อมูลจำลอง + บัญชีทดสอบ
src/lib/scheduler.ts     AI Auto-Scheduler (pure function, มี unit test)
src/lib/timetable.ts     รัน/บันทึกตาราง, snapshot, ย้อนกลับ
src/lib/ai.ts            ถาม-ตอบด้วย TiDB Vector Search (ประโยคตารางสร้างใน timetable.ts → syncTimetableDocs)
src/lib/auth.ts, login.ts  session, OTP, lockout, alerts
src/app/…                หน้าเว็บ + API
src/lib/campus.ts        แผนที่ดาวเทียม Google Maps (MAP_EMBED_URL) — แอดมินปักหมุดห้องได้ที่หน้าแผนที่
```

## หมายเหตุ / สิ่งที่ยังไม่ได้ทำในรอบนี้
- Dashboard กราฟสถิติ (TiFlash) และ Auto-Backup ไป S3/GCS ยังไม่ได้ทำ — TiDB Cloud Starter มี automatic backup + PITR ในหน้า Console อยู่แล้ว
- ย้อนตารางใช้ snapshot ระดับแอป (ไม่ใช้ `FLASHBACK CLUSTER` ซึ่ง Starter ไม่รองรับ)
- ปุ่มลบบัญชีของผู้ใช้ไม่ลบ `audit_logs` ทันที (เก็บตามกฎหมาย แล้ว TTL ลบเมื่อครบ 1 ปี)
- repo นี้เป็น Public: อย่า commit `.env.local` (ถูก `.gitignore` ไว้แล้ว)
