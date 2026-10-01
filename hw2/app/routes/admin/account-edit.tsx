import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/account-edit";
import { requireAdmin } from "../../lib/admin-auth.server";
import { accountLabel, accountPath, accountListSearch } from "../../lib/admin-accounts";
import type { AccountFields } from "../../lib/admin-accounts";
import { fieldsFromForm, getAccount, parseAccountId, requireAccountKind, resetAccountPassword, updateAccount } from "../../lib/admin-accounts.server";
import { AccountForm } from "./account-form";

export function meta() {
  return [{ title: "編輯帳號｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const kind = requireAccountKind(params.kind);
  const id = parseAccountId(params.userId);
  const account = getAccount(kind, id);
  if (!account) throw new Response("Not Found", { status: 404 });
  const url = new URL(request.url);
  return { kind, account, listSearch: accountListSearch(kind, url.search), notice: url.searchParams.has("created") ? "帳號已新增。" : url.searchParams.has("saved") ? "資料已儲存。" : url.searchParams.has("reset") ? "密碼已重設，原有登入已失效。" : null };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const kind = requireAccountKind(params.kind);
  const id = parseAccountId(params.userId);
  if (!getAccount(kind, id)) throw new Response("Not Found", { status: 404 });
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "reset") {
    const result = await resetAccountPassword(kind, id);
    if (result.error) return data({ error: result.error, fields: null }, { status: 409 });
    return redirect(`?reset=1`);
  }
  if (intent !== "save") throw new Response("Bad Request", { status: 400 });
  const fields = fieldsFromForm(formData);
  const result = updateAccount(kind, id, fields);
  if (result.error) return data({ error: result.error, fields }, { status: 400 });
  const search = new URLSearchParams(accountListSearch(kind, new URL(request.url).search));
  search.set("saved", "1");
  return redirect(`${accountPath(kind)}/${id}?${search}`);
}

export default function AccountEdit({ loaderData, actionData }: Route.ComponentProps) {
  const { kind, account, notice, listSearch } = loaderData;
  const fields: AccountFields = {
    ...(actionData?.fields ?? {
      name: account.name,
      birthDate: account.birth_date,
      department: account.department,
      grade: account.grade === null ? "" : String(account.grade),
    }),
    username: account.username,
  };
  return (
    <main className="admin-main admin-narrow">
      <p className="admin-eyebrow">Account Management</p>
      <h1>編輯{accountLabel(kind)}</h1>
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      <AccountForm key={JSON.stringify(fields)} kind={kind} creating={false} backHref={`${accountPath(kind)}/${account.user_id}${listSearch}`} backLabel="返回資料" fields={fields} error={actionData?.fields ? actionData.error : undefined} />
      <section className="admin-reset">
        <h2>重設密碼</h2>
        <p>重設為目前生日八碼（YYYYMMDD），並使這個帳號的所有登入失效。</p>
        {actionData?.fields === null && actionData.error ? <p className="admin-form-error" role="alert">{actionData.error}</p> : null}
        <Form method="post" onSubmit={(event) => { if (!window.confirm("確定要重設密碼並登出此帳號所有裝置？")) event.preventDefault(); }}>
          <button type="submit" name="intent" value="reset">重設密碼</button>
        </Form>
      </section>
    </main>
  );
}
