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
  if (await getCurrentUser(request)) throw redirect("/");
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

  return redirect("/", {
    headers: {
      "Set-Cookie": await createUserSession(request, user.id),
    },
  });
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="auth-page shell">
      <section className="auth-card">
        <p className="eyebrow">Student & Teacher sign in</p>
        <h1>學生／老師登入</h1>
        <p className="auth-intro">輸入既有帳號，登入成功後會回到首頁。</p>

        <Form className="auth-form" method="post">
          <label>
            <span>帳號</span>
            <input
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
            <input
              autoComplete="current-password"
              maxLength={128}
              name="password"
              required
              type="password"
            />
          </label>
          {actionData?.error ? (
            <p className="form-error" role="alert">
              {actionData.error}
            </p>
          ) : null}
          <button className="submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "登入中…" : "登入"}
          </button>
        </Form>
      </section>
    </main>
  );
}
