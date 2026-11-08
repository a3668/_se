import { ADMIN_SEMESTER_SETTINGS_PATH, ADMIN_ENROLLMENT_SETTINGS_PATH, ADMIN_GENERAL_SELECTION_SETTINGS_PATH, ADMIN_MIDTERM_ALERT_SETTINGS_PATH, ADMIN_SEMESTER_GRADE_SETTINGS_PATH, ADMIN_STUDENTS_PATH, ADMIN_TEACHERS_PATH, ADMIN_WITHDRAWAL_SETTINGS_PATH } from "./admin-paths";

export const ADMIN_NAVIGATION = [
  { label: "帳號管理", items: [
    { label: "學生管理", path: ADMIN_STUDENTS_PATH, description: "查詢、新增與維護學生資料" },
    { label: "教師管理", path: ADMIN_TEACHERS_PATH, description: "維護教師資料與查看授課課表" },
  ] },
  { label: "校務作業設定", items: [
    { label: "目前學期設定", path: ADMIN_SEMESTER_SETTINGS_PATH, description: "設定全系統目前使用的學期" },
    { label: "加退選管理", path: ADMIN_ENROLLMENT_SETTINGS_PATH, description: "設定加退選開放方式與年級" },
    { label: "停修管理", path: ADMIN_WITHDRAWAL_SETTINGS_PATH, description: "設定全校停修申請開放狀態" },
    { label: "通識初選管理", path: ADMIN_GENERAL_SELECTION_SETTINGS_PATH, description: "設定通識初選申請開放狀態" },
    { label: "期中預警管理", path: ADMIN_MIDTERM_ALERT_SETTINGS_PATH, description: "設定教師登錄與學生查詢開關" },
    { label: "學期成績查詢管理", path: ADMIN_SEMESTER_GRADE_SETTINGS_PATH, description: "設定學生學期成績查詢開關" },
  ] },
];
