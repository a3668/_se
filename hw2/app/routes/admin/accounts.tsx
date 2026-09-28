import { Form, Link } from "react-router";
import type { Route } from "./+types/accounts";
import { requireAdmin } from "../../lib/admin-auth.server";
import { accountLabel, accountPath } from "../../lib/admin-accounts";
import { listAccounts, requireAccountKind } from "../../lib/admin-accounts.server";

export function meta() {
  return [{ title: "帳號管理｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const kind = requireAccountKind(params.kind);
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  return { kind, query, accounts: listAccounts(kind, query) };
}

export default function Accounts({ loaderData }: Route.ComponentProps) {
  const { kind, query, accounts } = loaderData;
  const label = accountLabel(kind);
  const basePath = accountPath(kind);
  return (
    <main className="admin-main">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Account Management</p>
          <h1>{label}管理</h1>
        </div>
        <Link className="admin-primary-link" to={`${basePath}/new`}>新增{label}</Link>
      </div>
      <Form className="admin-search" method="get">
        <label htmlFor="account-search">搜尋{kind === "students" ? "學號" : "教師編號"}或姓名</label>
        <div>
          <input id="account-search" name="q" defaultValue={query} maxLength={100} />
          <button type="submit">搜尋</button>
          {query ? <Link to={basePath}>清除</Link> : null}
        </div>
      </Form>
      {accounts.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th scope="col">{kind === "students" ? "學號" : "教師編號"}</th>
              <th scope="col">姓名</th>
              <th scope="col">系所</th>
              {kind === "students" ? <th scope="col">年級</th> : null}
              <th scope="col">管理</th>
            </tr></thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.user_id}>
                  <td>{account.username}</td>
                  <td>{account.name}</td>
                  <td>{account.department}</td>
                  {kind === "students" ? <td>{account.grade}</td> : null}
                  <td><Link to={`${basePath}/${account.user_id}`}>編輯</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="admin-empty">{query ? "找不到符合條件的資料。" : `目前沒有${label}資料。`}</p>}
    </main>
  );
}
