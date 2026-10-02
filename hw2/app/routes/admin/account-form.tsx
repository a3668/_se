import { Form, Link } from "react-router";
import type { AccountFields, AccountKind } from "../../lib/admin-accounts";
import { accountLabel, accountPath } from "../../lib/admin-accounts";

type Props = {
  kind: AccountKind;
  fields: AccountFields;
  creating: boolean;
  error?: string;
  backHref?: string;
  backLabel?: string;
};

export function AccountForm({ kind, fields, creating, error, backHref, backLabel }: Props) {
  const label = accountLabel(kind);
  return (
    <Form className="admin-account-form" method="post">
      <label>
        <span>{kind === "students" ? "學號" : "教師編號"}</span>
        {creating ? (
          <input name="username" defaultValue={fields.username} maxLength={kind === "students" ? 9 : 30} pattern={kind === "students" ? "S[0-9]{8}" : "[A-Za-z0-9]{1,30}"} required />
        ) : (
          <input value={fields.username} readOnly aria-readonly="true" />
        )}
      </label>
      <label>
        <span>姓名</span>
        <input name="name" defaultValue={fields.name} maxLength={100} required />
      </label>
      <label>
        <span>生日</span>
        <input name="birthDate" defaultValue={fields.birthDate} type="date" required />
      </label>
      <label>
        <span>系所</span>
        <input name="department" defaultValue={fields.department} maxLength={100} required />
      </label>
      {kind === "students" ? (
        <label>
          <span>年級</span>
          <input name="grade" defaultValue={fields.grade} type="number" min={1} step={1} required />
        </label>
      ) : null}
      {creating ? <p className="admin-help">{label}初始密碼為生日八碼（YYYYMMDD）。</p> : null}
      {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
      <div className="admin-actions">
        <button type="submit" name="intent" value="save">{creating ? `新增${label}` : "儲存資料"}</button>
        <Link to={backHref ?? accountPath(kind)}>{backLabel ?? "返回列表"}</Link>
      </div>
    </Form>
  );
}
