export type PortalNavigationItem = {
  label: string;
  path: string;
};

export type PortalNavigationGroup = {
  label: string;
  items: PortalNavigationItem[];
};

export const PORTAL_NAVIGATION: PortalNavigationGroup[] = [
  {
    label: "選課作業",
    items: [
      { label: "線上加選作業", path: "/course/add" },
      { label: "線上退選作業", path: "/course/drop" },
      { label: "選課結果查詢", path: "/course/result" },
      { label: "停修申請", path: "/course/withdraw" },
      { label: "通識選課初選作業", path: "/course/general" },
    ],
  },
  {
    label: "查詢",
    items: [
      { label: "學期成績查詢", path: "/query/semester-grades" },
      { label: "學生期中預警查詢", path: "/query/midterm-alert" },
      { label: "歷年成績查詢", path: "/query/history-grades" },
      { label: "選課資料查詢", path: "/query/course-data" },
      { label: "課程資料查詢", path: "/query/class-data" },
      { label: "我的課表", path: "/query/my-schedule" },
      { label: "教師課表查詢", path: "/query/teacher-schedule" },
      { label: "教室課表查詢", path: "/query/classroom-schedule" },
    ],
  },
  {
    label: "學務資訊查詢",
    items: [
      { label: "學生個人缺曠課明細", path: "/student/absence-details" },
      { label: "學生個人獎懲狀況", path: "/student/reward-punishment" },
      { label: "兵役申請查詢", path: "/student/military-service" },
    ],
  },
  {
    label: "登錄",
    items: [
      { label: "教學評量登錄", path: "/entry/teaching-evaluation" },
      { label: "問卷調查", path: "/entry/questionnaire" },
    ],
  },
];

const portalItems = PORTAL_NAVIGATION.flatMap((group) => group.items);
const portalPrefixes = ["/course/", "/query/", "/student/", "/entry/"];

export function getPortalNavigationItem(pathname: string) {
  return portalItems.find((item) => item.path === pathname) ?? null;
}

export function isPortalPath(pathname: string) {
  return pathname === "/home" || portalPrefixes.some((prefix) => pathname.startsWith(prefix));
}
