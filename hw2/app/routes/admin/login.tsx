import { InputControl, StatusMessage, ActionButton } from "../../components/ui";
import { AuthLayout } from "../../components/auth-layout";
import { data, Form, redirect } from "react-router";
import { useState } from "react";
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
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout admin>
          <p className="eyebrow">管理員專區</p>
          <h1>登入管理後台</h1>
          <p className="auth-intro">請輸入管理員帳號與密碼。</p>
          <Form className="auth-form" method="post" reloadDocument onSubmit={() => setBusy(true)}>
            <label>
              <span>管理員帳號</span>
              <InputControl autoComplete="username" autoFocus maxLength={30} name="username" required />
            </label>
            <label>
              <span>密碼</span>
              <InputControl autoComplete="current-password" maxLength={128} name="password" required type="password" />
            </label>
            {actionData?.error ? <StatusMessage className="form-error" role="alert">{actionData.error}</StatusMessage> : null}
            <ActionButton className="submit-button" type="submit" disabled={busy}>{busy ? "登入中…" : "登入後台"}</ActionButton>
          </Form>
    </AuthLayout>
  );
}
