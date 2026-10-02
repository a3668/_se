export type PortalRole = "student" | "teacher";

export type PortalNavigationItem = {
  label: string;
  path: string;
  roles: readonly PortalRole[];
};

export type PortalNavigationGroup = {
  label: string;
  items: PortalNavigationItem[];
};

export const PORTAL_NAVIGATION: PortalNavigationGroup[] = [
  {
    label: "選課作業",
    items: [
      { label: "線上加選作業", path: "/course/add", roles: ["student"] },
      { label: "線上退選作業", path: "/course/drop", roles: ["student"] },
      { label: "選課結果查詢", path: "/course/result", roles: ["student"] },
      { label: "停修申請", path: "/course/withdraw", roles: ["student"] },
      { label: "通識選課初選作業", path: "/course/general", roles: ["student"] },
    ],
  },
  {
    label: "查詢",
    items: [
      { label: "學期成績查詢", path: "/query/semester-grades", roles: ["student"] },
      { label: "學生期中預警查詢", path: "/query/midterm-alert", roles: ["student"] },
      { label: "歷年成績查詢", path: "/query/history-grades", roles: ["student"] },
      { label: "選課資料查詢", path: "/query/course-data", roles: ["student"] },
      { label: "課程資料查詢", path: "/query/class-data", roles: ["student", "teacher"] },
      { label: "我的課表", path: "/query/my-schedule", roles: ["student", "teacher"] },
      { label: "教師課表查詢", path: "/query/teacher-schedule", roles: ["student", "teacher"] },
      { label: "教室課表查詢", path: "/query/classroom-schedule", roles: ["student", "teacher"] },
    ],
  },
  {
    label: "學務資訊查詢",
    items: [
      { label: "學生個人缺曠課明細", path: "/student/absence-details", roles: ["student"] },
      { label: "學生個人獎懲狀況", path: "/student/reward-punishment", roles: ["student"] },
      { label: "兵役申請查詢", path: "/student/military-service", roles: ["student"] },
    ],
  },
  {
    label: "登錄",
    items: [
      { label: "教學評量登錄", path: "/entry/teaching-evaluation", roles: ["student"] },
      { label: "問卷調查", path: "/entry/questionnaire", roles: [] },
    ],
  },
];

const portalItems = PORTAL_NAVIGATION.flatMap((group) => group.items);
const portalPrefixes = ["/course/", "/query/", "/student/", "/entry/"];

export function getPortalNavigationItem(pathname: string) {
  return portalItems.find((item) => item.path === pathname) ?? null;
}

export function canAccessPortalItem(item: PortalNavigationItem, role: PortalRole) {
  return item.roles.includes(role);
}

export function canAccessPortalPath(pathname: string, role: PortalRole) {
  const item = getPortalNavigationItem(pathname);
  return item !== null && canAccessPortalItem(item, role);
}

export function getPortalNavigationForRole(role: PortalRole) {
  return PORTAL_NAVIGATION
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPortalItem(item, role)),
    }))
    .filter((group) => group.items.length > 0);
}

export function isPortalPath(pathname: string) {
  return pathname === "/home" || portalPrefixes.some((prefix) => pathname.startsWith(prefix));
}
