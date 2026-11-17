-- PTC Smart Schedule — TiDB schema (runs on TiDB Cloud and local TiDB).
-- Cloud-only extras (TiFlash replicas, auto-embedding column) live in scripts/migrate.ts.

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT AUTO_RANDOM PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  email VARCHAR(255) NULL UNIQUE,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  role ENUM('student','teacher','admin') NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  pdpa_consent BOOLEAN NOT NULL DEFAULT FALSE,
  pdpa_version VARCHAR(16) NULL,
  consent_at DATETIME NULL,
  ui_theme JSON NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  known_devices JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OTP rows expire after 5 minutes (TiDB TTL). The app also checks created_at, since TTL jobs run periodically.
CREATE TABLE IF NOT EXISTS otp_logs (
  otp_id BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id BIGINT NOT NULL,
  target_email VARCHAR(255) NOT NULL,
  otp_code CHAR(64) NOT NULL, -- sha256 of the 6-digit code, never the code itself
  purpose ENUM('2FA_LOGIN','RESET_PASSWORD') NOT NULL,
  device_info VARCHAR(512) NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_user (user_id, created_at)
) TTL = created_at + INTERVAL 5 MINUTE;

-- Security audit trail, kept 1 year then removed by TTL.
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id BIGINT NULL,
  event VARCHAR(48) NOT NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  detail JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_user (user_id, created_at)
) TTL = created_at + INTERVAL 1 YEAR;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
  subject_id VARCHAR(20) PRIMARY KEY,
  subject_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NULL, -- NULL = วิชาสามัญ ใช้ร่วมทุกแผนก
  credits INT NOT NULL DEFAULT 1,
  theory_hours INT NOT NULL DEFAULT 0,
  lab_hours INT NOT NULL DEFAULT 0,
  required_room_type VARCHAR(50) NOT NULL DEFAULT 'ปกติ',
  KEY idx_subject_room_type (required_room_type)
);

CREATE TABLE IF NOT EXISTS teachers (
  teacher_id VARCHAR(20) PRIMARY KEY,
  user_id BIGINT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  max_hours_per_week INT NOT NULL DEFAULT 24,
  unavailable_slots JSON NULL -- [{"day":1,"period":3}, ...]
);

CREATE TABLE IF NOT EXISTS classrooms (
  room_id VARCHAR(20) PRIMARY KEY,
  building_name VARCHAR(100) NOT NULL,
  floor INT NOT NULL DEFAULT 1,
  room_type VARCHAR(50) NOT NULL DEFAULT 'ปกติ', -- ปกติ / Lab / โรงฝึกงาน
  department VARCHAR(100) NULL, -- ห้องเฉพาะแผนก (NULL = ใช้ร่วม)
  capacity INT NOT NULL DEFAULT 40,
  map_coordinates JSON NULL -- {"x":12.5,"y":40} เป็น % ของภาพแผนที่
);

CREATE TABLE IF NOT EXISTS student_groups (
  group_id VARCHAR(20) PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  year_level VARCHAR(20) NOT NULL,
  size INT NOT NULL DEFAULT 35
);

CREATE TABLE IF NOT EXISTS students (
  student_id VARCHAR(20) PRIMARY KEY,
  user_id BIGINT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  year_level VARCHAR(20) NOT NULL,
  group_id VARCHAR(20) NOT NULL,
  KEY idx_student_group (group_id)
);

-- Which group studies which subject with which teacher: the scheduler's input.
CREATE TABLE IF NOT EXISTS course_offerings (
  offering_id BIGINT AUTO_RANDOM PRIMARY KEY,
  group_id VARCHAR(20) NOT NULL,
  subject_id VARCHAR(20) NOT NULL,
  teacher_id VARCHAR(20) NOT NULL,
  UNIQUE KEY uq_offering (group_id, subject_id)
);

-- One row = one period. The unique keys make double-booking impossible at the database level.
CREATE TABLE IF NOT EXISTS timetable (
  schedule_id BIGINT AUTO_RANDOM PRIMARY KEY,
  academic_year INT NOT NULL,
  semester INT NOT NULL,
  day_of_week TINYINT NOT NULL,
  period_slot TINYINT NOT NULL,
  subject_id VARCHAR(20) NOT NULL,
  teacher_id VARCHAR(20) NOT NULL,
  room_id VARCHAR(20) NOT NULL,
  group_id VARCHAR(20) NOT NULL,
  version_tag VARCHAR(40) NULL,
  UNIQUE KEY uq_room_slot (academic_year, semester, day_of_week, period_slot, room_id),
  UNIQUE KEY uq_teacher_slot (academic_year, semester, day_of_week, period_slot, teacher_id),
  UNIQUE KEY uq_group_slot (academic_year, semester, day_of_week, period_slot, group_id)
);

-- App-level snapshots so a timetable can be rolled back from the web UI.
CREATE TABLE IF NOT EXISTS timetable_snapshots (
  snapshot_id BIGINT AUTO_RANDOM PRIMARY KEY,
  academic_year INT NOT NULL,
  semester INT NOT NULL,
  label VARCHAR(255) NOT NULL,
  row_count INT NOT NULL,
  rows_json JSON NOT NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Problem reports sent from the Q&A page; reviewed in the admin "รายงานปัญหา" tab.
CREATE TABLE IF NOT EXISTS bug_reports (
  report_id BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id BIGINT NULL,
  category VARCHAR(32) NOT NULL,
  detail TEXT NOT NULL,
  page_url VARCHAR(255) NULL,
  user_agent VARCHAR(512) NULL,
  app_version VARCHAR(40) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_report_status (status, created_at)
);

-- Staff directory / org chart. One row = one person in one position (a teacher may also head a work unit).
CREATE TABLE IF NOT EXISTS staff (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  position VARCHAR(150) NOT NULL,     -- e.g. หัวหน้างานทะเบียน, ครูผู้สอน
  rank_title VARCHAR(100) NULL,       -- ตำแหน่งทางราชการ e.g. ครู คศ.2
  division VARCHAR(100) NOT NULL,     -- ผู้บริหารสถานศึกษา / ฝ่าย... / แผนกวิชา
  unit VARCHAR(150) NULL,             -- งาน or แผนกวิชา
  sort_order INT NOT NULL DEFAULT 100
);
