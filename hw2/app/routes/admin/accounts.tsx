import { Form, Link, redirect } from "react-router";
import { Pagination } from "../../components/pagination";
import type { Route } from "./+types/accounts";
import { requireAdmin } from "../../lib/admin-auth.server";
import { accountLabel, accountPath } from "../../lib/admin-accounts";
import { listAccountPage, requireAccountKind } from "../../lib/admin-accounts.server";

export function meta() {
  return [{ title: "帳號管理｜HW2" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const kind = requireAccountKind(params.kind);
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const department = searchParams.get("department")?.trim().slice(0, 100) ?? "";
  const grade = kind === "students" ? searchParams.get("grade")?.trim() ?? "" : "";
  const pageValue = searchParams.get("page");
  const parsedPage = Number(pageValue);
  const requestedPage = pageValue !== null && /^[1-9]\d*$/.test(pageValue)
    && Number.isSafeInteger(parsedPage) ? parsedPage : 1;
  const filters = { query, department, grade };
  const result = listAccountPage(kind, filters, requestedPage);
  if (pageValue !== null && (String(result.pagination.currentPage) !== pageValue || requestedPage === 1)) {
    return redirect(getPageHref(accountPath(kind), filters, result.pagination.currentPage));
  }
  return { kind, ...filters, ...result };
}

function getPageHref(basePath: string, filters: { query: string; department: string; grade: string }, page: number) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.department) params.set("department", filters.department);
  if (filters.grade) params.set("grade", filters.grade);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${basePath}?${params}` : basePath;
}

export default function Accounts({ loaderData }: Route.ComponentProps) {
  const { kind, query, department, grade, accounts, departments, grades, pagination } = loaderData;
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
      <Form key={JSON.stringify([kind, query, department, grade])} className="admin-search" method="get" action={basePath}>
        <label htmlFor="account-search">搜尋{kind === "students" ? "學號" : "教師編號"}或姓名</label>
        <div>
          <input id="account-search" name="q" defaultValue={query} maxLength={100} />
          <label className="admin-filter" htmlFor="account-department">
            科系
            <select id="account-department" name="department" defaultValue={department}>
              <option value="">全部科系</option>
              {department && !departments.includes(department) ? <option value={department}>{department}</option> : null}
              {departments.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          {kind === "students" ? (
            <label className="admin-filter" htmlFor="account-grade">
              年級
              <select id="account-grade" name="grade" defaultValue={grade}>
                <option value="">全部年級</option>
                {grade && !grades.some((value) => String(value) === grade) ? <option value={grade}>{grade} 年級</option> : null}
                {grades.map((value) => <option key={value} value={value}>{value} 年級</option>)}
              </select>
            </label>
          ) : null}
          <button type="submit">搜尋</button>
          {query || department || grade ? <Link to={basePath}>清除</Link> : null}
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
                  <td><Link to={`${basePath}/${account.user_id}${getPageHref(basePath, { query, department, grade }, pagination.currentPage).slice(basePath.length)}`}>查看</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="admin-empty">{query || department || grade ? "找不到符合條件的資料。" : `目前沒有${label}資料。`}</p>}
      <p className="admin-help admin-pagination-summary">共 {pagination.totalItems} 筆，第 {pagination.currentPage} / {pagination.totalPages} 頁</p>
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        getPageHref={(page) => getPageHref(basePath, { query, department, grade }, page)}
      />
    </main>
  );
}
