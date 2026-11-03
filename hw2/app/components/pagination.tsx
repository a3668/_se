import MuiPagination from "@mui/material/Pagination";
import PaginationItem from "@mui/material/PaginationItem";
import { Link } from "react-router";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  getPageHref: (page: number) => string;
  label?: string;
};

export function Pagination({ currentPage, totalPages, getPageHref, label = "帳號列表分頁" }: PaginationProps) {
  if (totalPages <= 1) return null;
  return <MuiPagination className="admin-pagination" aria-label={label} page={currentPage} count={totalPages} color="primary" shape="rounded" size="small"
    renderItem={(item) => item.type.includes("ellipsis") || item.disabled
      ? <PaginationItem {...item} />
      : <PaginationItem {...item} component={Link} to={getPageHref(item.page ?? currentPage)} />} />;
}
