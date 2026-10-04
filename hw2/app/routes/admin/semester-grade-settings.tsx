import { Form, data, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/semester-grade-settings";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_SEMESTER_GRADE_SETTINGS_PATH } from "../../lib/admin-paths";
import { ACTIVE_SEMESTER } from "../../lib/enrollments.server";
import { isSemesterGradeOpen, saveSemesterGradeSettings } from "../../lib/semester-grade-settings.server";

export function meta() {
  return [{ title: "學期成績查詢管理｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return {
    isOpen: isSemesterGradeOpen(ACTIVE_SEMESTER), semester: ACTIVE_SEMESTER,
    saved: new URL(request.url).searchParams.has("saved"),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  if (request.method !== "POST") throw new Response("Method Not Allowed", { status: 405 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  if (form.get("intent") !== "save") throw new Response("Bad Request", { status: 400 });
  const error = saveSemesterGradeSettings(ACTIVE_SEMESTER, form.get("mode"));
  if (error) return data({ error }, { status: 400 });
  return redirect(`${ADMIN_SEMESTER_GRADE_SETTINGS_PATH}?saved=1`);
}

export default function SemesterGradeSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { isOpen, semester, saved } = loaderData;
  const busy = useNavigation().state !== "idle";
  return (
    <main className="admin-main admin-narrow">
      <p className="admin-eyebrow">Semester Grades</p>
      <h1>學期成績查詢管理</h1>
      <p>目前學期：{semester}</p>
      <p>目前狀態：{isOpen ? "全校開放學期成績查詢" : "全校關閉學期成績查詢"}</p>
      {saved && !actionData?.error ? <p role="status">設定已儲存並生效。</p> : null}
      {actionData?.error ? <p className="admin-form-error" role="alert">{actionData.error}</p> : null}
      <Form key={String(isOpen)} className="admin-enrollment-form" method="post">
        <fieldset disabled={busy}>
          <legend>開放方式</legend>
          <div className="admin-enrollment-modes">
            <label><input type="radio" name="mode" value="closed" defaultChecked={!isOpen} />全校關閉學期成績查詢</label>
            <label><input type="radio" name="mode" value="open" defaultChecked={isOpen} />全校開放學期成績查詢</label>
          </div>
          <p className="admin-help">開放後，全校學生可查詢個人已公布的學期成績。關閉時，學期成績查詢頁只顯示關閉提示，歷年成績頁同步隱藏目前學期資料並保留其他學期。既有成績會保留，教師成績登錄及公布功能維持原有方式。</p>
          <button type="submit" name="intent" value="save">儲存設定</button>
        </fieldset>
      </Form>
    </main>
  );
}
