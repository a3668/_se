import { InputControl, StatusMessage, ActionButton } from "../components/ui";
import { AuthLayout } from "../components/auth-layout";
import { data, Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import {
  createUserSession,
  getCurrentUser,
  verifyCredentials,
} from "../lib/auth.server";

export function meta() {
  return [
    { title: "學生與老師登入｜HW2" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getCurrentUser(request)) throw redirect("/home");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const user = await verifyCredentials(
    formData.get("username"),
    formData.get("password"),
  );

  if (!user) {
    return data(
      { error: "帳號或密碼錯誤，請重新輸入。" },
      { status: 401 },
    );
  }

  return redirect("/home", {
    headers: {
      "Set-Cookie": await createUserSession(request, user.id),
    },
  });
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthLayout>
        <p className="eyebrow">歡迎回來</p>
        <h1>登入校務資訊系統</h1>
        <p className="auth-intro">學生與教師請使用既有帳號登入。</p>

        <Form className="auth-form" method="post">
          <label>
            <span>帳號</span>
            <InputControl
              autoComplete="username"
              autoFocus
              maxLength={30}
              name="username"
              required
              type="text"
            />
          </label>
          <label>
            <span>密碼</span>
            <InputControl
              autoComplete="current-password"
              maxLength={128}
              name="password"
              required
              type="password"
            />
          </label>
          {actionData?.error ? (
            <StatusMessage className="form-error" role="alert">
              {actionData.error}
            </StatusMessage>
          ) : null}
          <ActionButton className="submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "登入中…" : "登入"}
          </ActionButton>
        </Form>
      </AuthLayout>
  );
}
