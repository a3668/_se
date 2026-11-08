import { PageHeading, ActionLink, FilterForm, InputControl, SelectControl, ActionButton, TableContainer, DataTable, TableHead, TableRow, TableCell, TableBody, EmptyState } from "../../components/ui";
import { Link, redirect } from "react-router";
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
  const searched = searchParams.get("search") === "1" || Boolean(query || department || grade);
  const result = listAccountPage(kind, filters, requestedPage, searched);
  if (searched && pageValue !== null && (String(result.pagination.currentPage) !== pageValue || requestedPage === 1)) {
    return redirect(getPageHref(accountPath(kind), filters, result.pagination.currentPage));
  }
  return { kind, ...filters, ...result, searched };
}

function getPageHref(basePath: string, filters: { query: string; department: string; grade: string }, page: number) {
  const params = new URLSearchParams();
  params.set("search", "1");
  if (filters.query) params.set("q", filters.query);
  if (filters.department) params.set("department", filters.department);
  if (filters.grade) params.set("grade", filters.grade);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${basePath}?${params}` : basePath;
}

export default function Accounts({ loaderData }: Route.ComponentProps) {
  const { kind, query, department, grade, accounts, departments, grades, pagination, searched } = loaderData;
  const label = accountLabel(kind);
  const basePath = accountPath(kind);
  return (
    <section className="admin-main">
      <PageHeading context="帳號管理" title={`${label}管理`}
        actions={<ActionLink className="admin-primary-link" to={`${basePath}/new`}>新增{label}</ActionLink>} />
      <FilterForm key={JSON.stringify([kind, query, department, grade])} className="admin-search" method="get" action={basePath}>
        <InputControl type="hidden" name="search" value="1" />
        <label htmlFor="account-search">搜尋{kind === "students" ? "學號" : "教師編號"}或姓名
          <InputControl id="account-search" name="q" defaultValue={query} maxLength={100} placeholder="輸入編號或姓名" />
        </label>
          <label className="admin-filter" htmlFor="account-department">
            科系
            <SelectControl id="account-department" name="department" defaultValue={department}>
              <option value="">全部科系</option>
              {department && !departments.includes(department) ? <option value={department}>{department}</option> : null}
              {departments.map((value) => <option key={value} value={value}>{value}</option>)}
            </SelectControl>
          </label>
          {kind === "students" ? (
            <label className="admin-filter" htmlFor="account-grade">
              年級
              <SelectControl id="account-grade" name="grade" defaultValue={grade}>
                <option value="">全部年級</option>
                {grade && !grades.some((value) => String(value) === grade) ? <option value={grade}>{grade} 年級</option> : null}
                {grades.map((value) => <option key={value} value={value}>{value} 年級</option>)}
              </SelectControl>
            </label>
          ) : null}
          <ActionButton type="submit">搜尋</ActionButton>
          {searched ? <Link to={basePath}>清除</Link> : null}
      </FilterForm>
      {accounts.length ? (
        <TableContainer className="admin-table-wrap">
          <DataTable className="admin-table">
            <TableHead><TableRow>
              <TableCell component="th" scope="col">{kind === "students" ? "學號" : "教師編號"}</TableCell>
              <TableCell component="th" scope="col">姓名</TableCell>
              <TableCell component="th" scope="col">系所</TableCell>
              {kind === "students" ? <TableCell component="th" scope="col">年級</TableCell> : null}
              <TableCell component="th" scope="col">管理</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.user_id}>
                  <TableCell>{account.username}</TableCell>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{account.department}</TableCell>
                  {kind === "students" ? <TableCell>{account.grade}</TableCell> : null}
                  <TableCell><Link to={`${basePath}/${account.user_id}${getPageHref(basePath, { query, department, grade }, pagination.currentPage).slice(basePath.length)}`}>查看</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableContainer>
      ) : <EmptyState className="admin-empty">{searched ? "找不到符合條件的資料。" : `請先查詢${label}。`}</EmptyState>}
      {searched ? <>
      <p className="admin-help admin-pagination-summary">共 {pagination.totalItems} 筆，第 {pagination.currentPage} / {pagination.totalPages} 頁</p>
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        getPageHref={(page) => getPageHref(basePath, { query, department, grade }, page)}
      />
      </> : null}
    </section>
  );
}
