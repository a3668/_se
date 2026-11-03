import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { StatusChip, PageHeading, StatusMessage, TableContainer, DataTable, TableHead, TableRow, TableCell, TableBody, InputControl, ActionButton, EmptyState } from "../../components/ui";
import { Form, Link, useNavigation } from "react-router";
import type { ReactNode } from "react";
import type { StudentOffering } from "../../lib/enrollments.server";

const weekdays = ["", "一", "二", "三", "四", "五", "六", "日"];

export function formatSchedules(offering: StudentOffering) {
  return offering.schedules.length
    ? offering.schedules.map((item) => `週${weekdays[item.weekday]} ${item.startPeriod}–${item.endPeriod} 節 · ${item.classroom}`)
    : ["時段未定"];
}

type Props = {
  title: string;
  description: string;
  offerings: StudentOffering[];
  mode: "add" | "drop" | "result";
  error?: string;
  message?: string;
  searchControls?: ReactNode;
  paginationControls?: ReactNode;
  emptyMessage?: string;
  enrollmentOpen?: boolean;
  semester?: string;
};

export function StudentCourseList({ title, description, offerings, mode, error, message, searchControls, paginationControls, emptyMessage, enrollmentOpen = false, semester = "115-1" }: Props) {
  const busy = useNavigation().state !== "idle";
  const closed = mode !== "result" && !enrollmentOpen;
  return (
    <div className="portal-page course-catalog-page">
      <nav aria-label="麵包屑" className="portal-breadcrumb">
        <Link to="/home">系統首頁</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
      </nav>
      <PageHeading title={title} context={`${semester} · 選課作業`} description={description} />
      <Tabs value={mode} className="student-course-tabs" aria-label="選課功能" variant="scrollable" scrollButtons="auto">
        <Tab component={Link} to="/course/add" value="add" label="加選" aria-current={mode === "add" ? "page" : undefined} />
        <Tab component={Link} to="/course/drop" value="drop" label="退選" aria-current={mode === "drop" ? "page" : undefined} />
        <Tab component={Link} to="/course/result" value="result" label="選課結果" aria-current={mode === "result" ? "page" : undefined} />
        <Tab component={Link} to="/query/my-schedule" value="schedule" label="我的課表" />
      </Tabs>
      {!closed ? searchControls : <StatusMessage className="student-course-message" role="status">目前未開放你的年級加退選，仍可查看選課結果與課表。</StatusMessage>}
      {error ? <StatusMessage className="student-course-message is-error" role="alert">{error}</StatusMessage> : null}
      {message ? <StatusMessage className="student-course-message" role="status" severity="success">{message}</StatusMessage> : null}
      {!closed && offerings.length ? (
        <TableContainer className="course-catalog-table-wrap">
          <DataTable className="course-catalog-table">
            <TableHead><TableRow>
              <TableCell component="th" scope="col">課程</TableCell><TableCell component="th" scope="col">年級／類別</TableCell><TableCell component="th" scope="col">學分</TableCell>
              <TableCell component="th" scope="col">教師／時段</TableCell><TableCell component="th" scope="col">名額</TableCell><TableCell component="th" scope="col">狀態</TableCell>
            </TableRow></TableHead>
            <TableBody>{offerings.map((offering) => {
              const status = offering.selected ? "已選" : offering.withdrawn ? "已停修" : offering.enrolledCount >= offering.capacity ? "額滿"
                : !offering.schedules.length ? "時段未定" : offering.conflict ? "時段衝突" : "可加選";
              return (
                <TableRow key={offering.id}>
                  <TableCell><strong>{offering.name}</strong><small>{offering.code} · {offering.section} 班</small></TableCell>
                  <TableCell>{offering.grade} 年級 · {offering.category === "required" ? "必修" : "選修"}</TableCell>
                  <TableCell>{offering.credits}</TableCell>
                  <TableCell>{offering.teacherName}{formatSchedules(offering).map((schedule) => <small key={schedule}>{schedule}</small>)}</TableCell>
                  <TableCell>{offering.enrolledCount} / {offering.capacity}</TableCell>
                  <TableCell>{mode === "add" && !offering.selected && status === "可加選" ? (
                    <Form method="post"><InputControl type="hidden" name="offeringId" value={offering.id} /><ActionButton className="student-course-button" type="submit" disabled={!enrollmentOpen || busy}>加選</ActionButton></Form>
                  ) : mode === "drop" && offering.dropBlockedReason ? <span>{offering.dropBlockedReason}</span> : mode === "drop" ? (
                    <Form method="post"><InputControl type="hidden" name="offeringId" value={offering.id} /><ActionButton className="student-course-button" type="submit" disabled={!enrollmentOpen || busy}>退選</ActionButton></Form>
                  ) : <StatusChip label={status} />}</TableCell>
                </TableRow>
              );
            })}</TableBody>
          </DataTable>
        </TableContainer>
      ) : !closed ? <EmptyState className="course-catalog-empty">{emptyMessage ?? (mode === "add" ? "目前沒有可查詢的課程。" : "目前沒有已選課程。")}</EmptyState> : null}
      {!closed ? paginationControls : null}
    </div>
  );
}
