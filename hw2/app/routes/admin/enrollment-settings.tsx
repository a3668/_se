import { useState } from "react";
import { Form, data, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/enrollment-settings";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_ENROLLMENT_SETTINGS_PATH } from "../../lib/admin-paths";
import { ACTIVE_SEMESTER } from "../../lib/enrollments.server";
import { getEnrollmentSettings, saveEnrollmentOpenGrades } from "../../lib/enrollment-settings.server";

export function meta() {
  return [{ title: "加退選管理｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return {
    ...getEnrollmentSettings(ACTIVE_SEMESTER), semester: ACTIVE_SEMESTER,
    saved: new URL(request.url).searchParams.has("saved"),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  if (formData.get("intent") !== "save") throw new Response("Bad Request", { status: 400 });
  const error = saveEnrollmentOpenGrades(ACTIVE_SEMESTER, formData.getAll("grade"));
  if (error) return data({ error }, { status: 400 });
  return redirect(`${ADMIN_ENROLLMENT_SETTINGS_PATH}?saved=1`);
}

function GradeSelection({ grades, openGrades }: { grades: number[]; openGrades: number[] }) {
  const [selected, setSelected] = useState(openGrades);
  const navigation = useNavigation();
  return (
    <Form className="admin-enrollment-form" method="post">
      <fieldset disabled={navigation.state !== "idle"}>
        <legend>開放加退選的學生年級</legend>
        <div className="admin-enrollment-actions">
          <button type="button" onClick={() => setSelected(grades)}>全選</button>
          <button type="button" onClick={() => setSelected([])}>全部取消</button>
        </div>
        <div className="admin-enrollment-grades">
          {grades.map((grade) => (
            <label key={grade}>
              <input type="checkbox" name="grade" value={grade} checked={selected.includes(grade)}
                onChange={(event) => setSelected(event.target.checked
                  ? [...selected, grade] : selected.filter((value) => value !== grade))} />
              {grade} 年級
            </label>
          ))}
        </div>
        {!grades.length ? <p className="admin-help">目前沒有學生年級資料。</p> : null}
        <p className="admin-help">勾選的年級包含所有科系學生，同時開放加選與退選。全部取消並儲存即全部關閉。</p>
        <button type="submit" name="intent" value="save">儲存設定</button>
      </fieldset>
    </Form>
  );
}

export default function EnrollmentSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { grades, openGrades, semester, saved } = loaderData;
  const currentOpenGrades = openGrades.filter((grade) => grades.includes(grade));
  return (
    <main className="admin-main admin-narrow">
      <p className="admin-eyebrow">Course Selection</p>
      <h1>加退選管理</h1>
      <p>目前學期：{semester}</p>
      <p>已儲存狀態：{currentOpenGrades.length ? `開放 ${currentOpenGrades.join("、")} 年級` : "全部關閉"}</p>
      {saved && !actionData?.error ? <p role="status">設定已儲存並生效。</p> : null}
      {actionData?.error ? <p className="admin-form-error" role="alert">{actionData.error}</p> : null}
      <GradeSelection key={JSON.stringify([grades, openGrades])} grades={grades} openGrades={openGrades} />
    </main>
  );
}
