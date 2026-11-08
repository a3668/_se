import RadioGroup from "@mui/material/RadioGroup";
import { PageHeading, FormPanel, InputControl, ActionButton, StatusMessage } from "../../components/ui";
import { useState } from "react";
import { data, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/enrollment-settings";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_ENROLLMENT_SETTINGS_PATH } from "../../lib/admin-paths";
import { getActiveSemester, withCurrentSemester } from "../../lib/semester-settings.server";
import { getEnrollmentSettings, saveEnrollmentOpenGrades } from "../../lib/enrollment-settings.server";

export function meta() {
  return [{ title: "加退選管理｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const semester = getActiveSemester();
  return {
    ...getEnrollmentSettings(semester), semester,
    saved: new URL(request.url).searchParams.has("saved"),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  if (request.method !== "POST") throw new Response("Method Not Allowed", { status: 405 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new Response("Forbidden", { status: 403 });
  const formData = await request.formData();
  if (formData.get("intent") !== "save") throw new Response("Bad Request", { status: 400 });
  const error = withCurrentSemester(formData.get("originalSemester"), (semester) => saveEnrollmentOpenGrades(semester, formData.get("mode"), formData.getAll("grade")));
  if (error) return data({ error }, { status: 400 });
  return redirect(`${ADMIN_ENROLLMENT_SETTINGS_PATH}?saved=1`);
}

function GradeSelection({ grades, openGrades, semester }: { grades: number[]; openGrades: number[]; semester: string }) {
  const [selected, setSelected] = useState(openGrades);
  const [mode, setMode] = useState<"closed" | "all" | "selected">(
    !openGrades.length ? "closed" : grades.length && grades.every((grade) => openGrades.includes(grade)) ? "all" : "selected",
  );
  const navigation = useNavigation();
  return (
    <FormPanel className="admin-enrollment-form" method="post">
      <InputControl type="hidden" name="originalSemester" value={semester} />
      <fieldset disabled={navigation.state !== "idle"}>
        <legend>開放方式</legend>
        <RadioGroup className="admin-enrollment-modes" name="mode" value={mode}>
          <label><InputControl type="radio" name="mode" value="closed" checked={mode === "closed"} onChange={() => setMode("closed")} />全校關閉</label>
          <label><InputControl type="radio" name="mode" value="all" checked={mode === "all"} disabled={!grades.length} onChange={() => setMode("all")} />全年級開放</label>
          <label><InputControl type="radio" name="mode" value="selected" checked={mode === "selected"} disabled={!grades.length} onChange={() => setMode("selected")} />指定年級開放</label>
        </RadioGroup>
        {mode === "selected" ? <div className="admin-enrollment-grades" role="group" aria-label="開放加退選的學生年級">
          {grades.map((grade) => (
            <label key={grade}>
              <InputControl type="checkbox" name="grade" value={grade} checked={selected.includes(grade)}
                onChange={(event) => setSelected(event.target.checked
                  ? [...selected, grade] : selected.filter((value) => value !== grade))} />
              {grade} 年級
            </label>
          ))}
        </div> : null}
        {!grades.length ? <p className="admin-help">目前沒有學生年級資料。</p> : null}
        <p className="admin-help">{mode === "closed" ? "儲存後，全校學生都無法加選或退選。"
          : mode === "all" ? "儲存後，目前所有學生年級皆可加選與退選。"
          : "請至少選擇一個年級，涵蓋該年級所有科系學生，同時開放加選與退選。"}</p>
        <ActionButton type="submit" name="intent" value="save">儲存設定</ActionButton>
      </fieldset>
    </FormPanel>
  );
}

export default function EnrollmentSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { grades, openGrades, semester, saved } = loaderData;
  const currentOpenGrades = openGrades.filter((grade) => grades.includes(grade));
  return (
    <section className="admin-main admin-narrow">
      <PageHeading context="校務作業設定" title="加退選管理" />
      <p>目前學期：{semester}</p>
      <p>目前狀態：{!currentOpenGrades.length ? "全校關閉" : currentOpenGrades.length === grades.length ? "全年級開放" : `開放 ${currentOpenGrades.join("、")} 年級`}</p>
      {saved && !actionData?.error ? <StatusMessage role="status" severity="success">設定已儲存並生效。</StatusMessage> : null}
      {actionData?.error ? <StatusMessage className="admin-form-error" role="alert">{actionData.error}</StatusMessage> : null}
      <GradeSelection semester={semester} key={JSON.stringify([semester, grades, openGrades])} grades={grades} openGrades={openGrades} />
    </section>
  );
}
