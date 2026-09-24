import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/login";
import {
  createAdminSession,
  getAdminIdentity,
  requireAdminConfig,
  verifyAdminCredentials,
} from "../../lib/admin-auth.server";
import { ADMIN_BASE_PATH } from "../../lib/admin-paths";

export function meta() {
  return [
    { title: "管理員登入｜HW2" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAdminConfig();
  if (await getAdminIdentity(request)) throw redirect(ADMIN_BASE_PATH);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  requireAdminConfig();
  const formData = await request.formData();
  const valid = await verifyAdminCredentials(
    formData.get("username"),
    formData.get("password"),
  );

  if (!valid) {
    return data({ error: "帳號或密碼錯誤，請重新輸入。" }, { status: 401 });
  }

  return redirect(ADMIN_BASE_PATH, {
    headers: { "Set-Cookie": await createAdminSession(request) },
  });
}

export default function AdminLogin({ actionData }: Route.ComponentProps) {
  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card">
        <p className="admin-eyebrow">HW2 · Administration</p>
        <h1>管理員登入</h1>
        <p>請輸入管理員帳號與密碼。</p>
        <Form className="admin-auth-form" method="post" reloadDocument>
          <label>
            <span>管理員帳號</span>
            <input autoComplete="username" autoFocus maxLength={30} name="username" required />
          </label>
          <label>
            <span>密碼</span>
            <input autoComplete="current-password" maxLength={128} name="password" required type="password" />
          </label>
          {actionData?.error ? <p className="admin-form-error" role="alert">{actionData.error}</p> : null}
          <button type="submit">登入後台</button>
        </Form>
      </section>
    </main>
  );
}
