import { Link } from "react-router";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  getPageHref: (page: number) => string;
  label?: string;
};

export function Pagination({ currentPage, totalPages, getPageHref, label = "帳號列表分頁" }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 3
      ? [1, 2, 3, 4, totalPages]
      : currentPage >= totalPages - 2
        ? [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  return (
    <nav className="admin-pagination" aria-label={label}>
      {currentPage > 1 ? <Link to={getPageHref(currentPage - 1)}>上一頁</Link>
        : <span aria-disabled="true">上一頁</span>}
      {pages.map((page, index) => (
        <span className="admin-pagination-item" key={page}>
          {index > 0 && page - pages[index - 1] > 1 ? <span aria-hidden="true">…</span> : null}
          {page === currentPage ? <span aria-current="page">{page}</span>
            : <Link aria-label={`第 ${page} 頁`} to={getPageHref(page)}>{page}</Link>}
        </span>
      ))}
      {currentPage < totalPages ? <Link to={getPageHref(currentPage + 1)}>下一頁</Link>
        : <span aria-disabled="true">下一頁</span>}
    </nav>
  );
}
