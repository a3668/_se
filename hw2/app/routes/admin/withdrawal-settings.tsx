import { Form, data, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/withdrawal-settings";
import { requireAdmin } from "../../lib/admin-auth.server";
import { ADMIN_WITHDRAWAL_SETTINGS_PATH } from "../../lib/admin-paths";
import { ACTIVE_SEMESTER } from "../../lib/enrollments.server";
import { isWithdrawalOpen, saveWithdrawalSettings } from "../../lib/withdrawal-settings.server";

export function meta() {
  return [{ title: "停修管理｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return {
    isOpen: isWithdrawalOpen(ACTIVE_SEMESTER), semester: ACTIVE_SEMESTER,
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
  const error = saveWithdrawalSettings(ACTIVE_SEMESTER, form.get("mode"));
  if (error) return data({ error }, { status: 400 });
  return redirect(`${ADMIN_WITHDRAWAL_SETTINGS_PATH}?saved=1`);
}

export default function WithdrawalSettings({ loaderData, actionData }: Route.ComponentProps) {
  const { isOpen, semester, saved } = loaderData;
  const busy = useNavigation().state !== "idle";
  return (
    <main className="admin-main admin-narrow">
      <p className="admin-eyebrow">Course Withdrawal</p>
      <h1>停修管理</h1>
      <p>目前學期：{semester}</p>
      <p>目前狀態：{isOpen ? "全校開放停修申請" : "全校關閉停修申請"}</p>
      {saved && !actionData?.error ? <p role="status">設定已儲存並生效。</p> : null}
      {actionData?.error ? <p className="admin-form-error" role="alert">{actionData.error}</p> : null}
      <Form key={String(isOpen)} className="admin-enrollment-form" method="post">
        <fieldset disabled={busy}>
          <legend>開放方式</legend>
          <div className="admin-enrollment-modes">
            <label><input type="radio" name="mode" value="closed" defaultChecked={!isOpen} />全校關閉停修申請</label>
            <label><input type="radio" name="mode" value="open" defaultChecked={isOpen} />全校開放停修申請</label>
          </div>
          <p className="admin-help">開放後，全校學生送出停修即生效，不需教師審核，完成後不能自行取消。此設定與加退選開放設定各自獨立。</p>
          <button type="submit" name="intent" value="save">儲存設定</button>
        </fieldset>
      </Form>
    </main>
  );
}
