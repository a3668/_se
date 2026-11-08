import { Link } from "react-router";
import Paper from "@mui/material/Paper";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import { ADMIN_NAVIGATION } from "../../lib/admin-navigation";
import { PageHeading } from "../../components/ui";

export function meta() {
  return [{ title: "管理後台｜校務資訊系統" }, { name: "robots", content: "noindex, nofollow" }];
}

export default function AdminHome() {
  return <section className="dashboard-page admin-home">
    <PageHeading title="管理工作台" context="校務資訊系統 · 管理員" description="管理學生與教師資料，集中處理校務作業設定。" actions={<Chip label="管理員專區" color="primary" variant="outlined" />} />
    {ADMIN_NAVIGATION.map((group, index) => <section className="dashboard-section" key={group.label}>
      <div className="section-heading"><div><h2>{group.label}</h2><p>{index === 0 ? "維護校務系統的帳號與基本資料" : "調整各項校務功能的開放方式"}</p></div></div>
      <div className="admin-shortcut-grid">{group.items.map((item) => <Paper variant="outlined" key={item.path}>
        <CardActionArea component={Link} to={item.path} className="admin-shortcut-card"><span className="quick-link-icon">{index === 0 ? <ManageAccountsOutlined /> : <TuneOutlined />}</span><div><h3>{item.label}</h3><p>{item.description}</p></div><ArrowForwardOutlined fontSize="small" /></CardActionArea>
      </Paper>)}</div>
    </section>)}
  </section>;
}
