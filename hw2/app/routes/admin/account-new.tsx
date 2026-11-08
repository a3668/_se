import { data, redirect } from "react-router";
import { PageHeading } from "../../components/ui";
import type { Route } from "./+types/account-new";
import { requireAdmin } from "../../lib/admin-auth.server";
import { accountLabel, accountPath } from "../../lib/admin-accounts";
import type { AccountFields } from "../../lib/admin-accounts";
import { createAccount, fieldsFromForm, requireAccountKind } from "../../lib/admin-accounts.server";
import { AccountForm } from "./account-form";

const emptyFields: AccountFields = { username: "", name: "", birthDate: "", department: "", grade: "" };

export function meta() {
  return [{ title: "新增帳號｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  return { kind: requireAccountKind(params.kind) };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const kind = requireAccountKind(params.kind);
  const formData = await request.formData();
  if (formData.get("intent") !== "save") throw new Response("Bad Request", { status: 400 });
  const fields = fieldsFromForm(formData);
  const result = await createAccount(kind, fields);
  if (result.error) return data({ error: result.error, fields }, { status: 400 });
  return redirect(`${accountPath(kind)}/${result.id}?created=1`);
}

export default function AccountNew({ loaderData, actionData }: Route.ComponentProps) {
  const kind = loaderData.kind;
  return (
    <section className="admin-main admin-narrow">
      <PageHeading context="帳號管理" title={`新增${accountLabel(kind)}`} />
      <AccountForm kind={kind} creating fields={actionData?.fields ?? emptyFields} error={actionData?.error} />
    </section>
  );
}
