import { data, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/semester-settings";
import { PageHeading, StatusMessage, FormPanel, InputControl, SelectControl, ActionButton } from "../../components/ui";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_SEMESTER_SETTINGS_PATH } from "../../lib/admin-paths";
import { getActiveSemester, getOfferingSemesters, saveActiveSemester } from "../../lib/semester-settings.server";

export function meta() {
  return [{ title: "目前學期設定｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return { semester: getActiveSemester(), semesters: getOfferingSemesters(), saved: new URL(request.url).searchParams.has("saved") };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  if (request.method !== "POST") throw new Response("Method Not Allowed", { status: 405 });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  if (form.get("intent") !== "save") throw new Response("Bad Request", { status: 400 });
  const error = saveActiveSemester(form.get("originalSemester"), form.get("semester"));
  if (error) return data({ error }, { status: 400 });
  return redirect(`${ADMIN_SEMESTER_SETTINGS_PATH}?saved=1`);
}

export default function SemesterSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { semester, semesters, saved } = loaderData;
  const busy = useNavigation().state !== "idle";
  return <section className="admin-main admin-narrow">
    <PageHeading context="校務作業設定" title="目前學期設定" />
    <p>目前學期：{semester}</p>
    {saved && !actionData?.error ? <StatusMessage role="status" severity="success">目前學期已儲存並生效。</StatusMessage> : null}
    {actionData?.error ? <StatusMessage className="admin-form-error" role="alert">{actionData.error}</StatusMessage> : null}
    <FormPanel key={semester} className="admin-enrollment-form" method="post">
      <InputControl type="hidden" name="originalSemester" value={semester} />
      <fieldset disabled={busy || !semesters.length}>
        <legend>全系統目前學期</legend>
        <label>學期<SelectControl name="semester" defaultValue={semesters.includes(semester) ? semester : ""} required>
          {!semesters.includes(semester) ? <option value="" disabled>請選擇已有開課資料的學期</option> : null}
          {semesters.map((value) => <option key={value} value={value}>{value}</option>)}
        </SelectControl></label>
        <p className="admin-help">儲存後立即套用於全系統。加退選與各項作業開關依學期獨立保存，新學期預設關閉；切回舊學期會沿用該學期的設定。既有課程、選課、成績與申請紀錄會保留。</p>
        <ActionButton type="submit" name="intent" value="save">儲存設定</ActionButton>
      </fieldset>
    </FormPanel>
  </section>;
}
