import RadioGroup from "@mui/material/RadioGroup";
import { PageHeading, StatusMessage, FormPanel, InputControl, ActionButton } from "../../components/ui";
import { data, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/midterm-alert-settings";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_MIDTERM_ALERT_SETTINGS_PATH } from "../../lib/admin-paths";
import { getActiveSemester, withCurrentSemester } from "../../lib/semester-settings.server";
import { isMidtermAlertOpen, saveMidtermAlertSettings } from "../../lib/midterm-alert-settings.server";

export function meta() {
  return [{ title: "期中預警管理｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const semester = getActiveSemester();
  return {
    isOpen: isMidtermAlertOpen(semester), semester,
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
  const error = withCurrentSemester(form.get("originalSemester"), (semester) => saveMidtermAlertSettings(semester, form.get("mode")));
  if (error) return data({ error }, { status: 400 });
  return redirect(`${ADMIN_MIDTERM_ALERT_SETTINGS_PATH}?saved=1`);
}

export default function MidtermAlertSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { isOpen, semester, saved } = loaderData;
  const busy = useNavigation().state !== "idle";
  return (
    <section className="admin-main admin-narrow">
      <PageHeading context="校務作業設定" title="期中預警管理" />
      <p>目前學期：{semester}</p>
      <p>目前狀態：{isOpen ? "全校開放期中預警" : "全校關閉期中預警"}</p>
      {saved && !actionData?.error ? <StatusMessage role="status" severity="success">設定已儲存並生效。</StatusMessage> : null}
      {actionData?.error ? <StatusMessage className="admin-form-error" role="alert">{actionData.error}</StatusMessage> : null}
      <FormPanel key={String(isOpen)} className="admin-enrollment-form" method="post">
        <InputControl type="hidden" name="originalSemester" value={semester} />
        <fieldset disabled={busy}>
          <legend>開放方式</legend>
          <RadioGroup className="admin-enrollment-modes" name="mode" defaultValue={isOpen ? "open" : "closed"}>
            <label><InputControl type="radio" name="mode" value="closed" />全校關閉期中預警</label>
            <label><InputControl type="radio" name="mode" value="open" />全校開放期中預警</label>
          </RadioGroup>
          <p className="admin-help">開放後，教師可登錄或解除目前學期授課課程的期中預警，學生可查詢個人預警。關閉時，教師登錄與學生查詢功能一併關閉，既有紀錄會保留。此設定與加退選、停修及通識初選開關各自獨立。</p>
          <ActionButton type="submit" name="intent" value="save">儲存設定</ActionButton>
        </fieldset>
      </FormPanel>
    </section>
  );
}
