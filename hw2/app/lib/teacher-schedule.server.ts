import { getDatabase } from "./db.server";
import { ACTIVE_SEMESTER } from "./enrollments.server";

export function getTeacherSchedule(teacherUserId: number, semester = ACTIVE_SEMESTER) {
  const lessons = getDatabase().prepare(
    `SELECT o.id AS offeringId, c.course_code AS code, c.name, o.section,
            s.weekday, s.start_period AS startPeriod, s.end_period AS endPeriod,
            s.classroom
     FROM course_offerings o
     JOIN courses c ON c.id = o.course_id
     LEFT JOIN course_schedules s ON s.offering_id = o.id
     WHERE o.teacher_user_id = ? AND o.semester = ?
     ORDER BY c.course_code, o.section, s.weekday, s.start_period`,
  ).all(teacherUserId, semester) as {
    offeringId: number;
    code: string;
    name: string;
    section: string;
    weekday: number | null;
    startPeriod: number | null;
    endPeriod: number | null;
    classroom: string | null;
  }[];
  return { semester, lessons };
}
