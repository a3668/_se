import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Form, Link, NavLink, useLocation } from "react-router";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";

export type NavigationGroup = { label: string; items: { label: string; path: string }[] };

function NavigationIcon({ path }: { path: string }) {
  if (path.includes("schedule")) return <CalendarMonthOutlined fontSize="small" />;
  if (path.includes("settings")) return <TuneOutlined fontSize="small" />;
  if (/students|teachers/.test(path)) return <ManageAccountsOutlined fontSize="small" />;
  if (/course|class-data/.test(path)) return <MenuBookOutlined fontSize="small" />;
  return <AssignmentOutlined fontSize="small" />;
}

export function AppShell({ children, username, roleLabel, groups, homePath = "/home", logoutPath = "/logout", reloadLogout = false }: {
  children: ReactNode;
  username: string;
  roleLabel: string;
  groups: NavigationGroup[];
  homePath?: string;
  logoutPath?: string;
  reloadLogout?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const desktop = useMediaQuery("(min-width: 1000px)");
  useEffect(() => { setOpen(false); }, [location.pathname, desktop]);
  const currentLabel = groups.flatMap((group) => group.items)
    .filter((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]?.label ?? "系統首頁";

  const navigation = <>
    <div className="app-sidebar-brand">
      <Link to={homePath} className="app-brand"><span className="app-brand-mark"><SchoolOutlined /></span><span><strong>校務資訊系統</strong><small>Campus Portal</small></span></Link>
      <IconButton aria-label="關閉功能選單" onClick={() => setOpen(false)} sx={{ display: { xs: "inline-flex", lg: "none" } }}><CloseOutlined /></IconButton>
    </div>
    <Box component="nav" aria-label={`${roleLabel}功能選單`} className="app-navigation">
      <List disablePadding>
        <ListItemButton component={NavLink} to={homePath} end className="app-nav-item">
          <ListItemIcon><DashboardOutlined fontSize="small" /></ListItemIcon><ListItemText primary="系統首頁" />
        </ListItemButton>
      </List>
      {groups.map((group) => <section className="app-nav-group" key={group.label}>
        <Typography component="h2" variant="overline" className="app-nav-label">{group.label}</Typography>
        <List disablePadding>{group.items.map((item) => <ListItemButton component={NavLink} to={item.path} key={item.path} className="app-nav-item">
          <ListItemIcon><NavigationIcon path={item.path} /></ListItemIcon><ListItemText primary={item.label} />
        </ListItemButton>)}</List>
      </section>)}
    </Box>
    <div className="app-sidebar-footer"><span className="app-status-dot" />{roleLabel}工作空間<small>HW2</small></div>
  </>;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳至主要內容</a>
    <Drawer variant="permanent" sx={{ display: { xs: "none", lg: "block" }, "& .MuiDrawer-paper": { width: 248, boxSizing: "border-box" } }}>{navigation}</Drawer>
    <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} sx={{ display: { xs: "block", lg: "none" }, "& .MuiDrawer-paper": { width: "min(300px, 88vw)" } }}>{navigation}</Drawer>
    <AppBar position="fixed" color="inherit" elevation={0} className="app-topbar" sx={{ width: { lg: "calc(100% - 248px)" }, ml: { lg: "248px" }, borderBottom: "1px solid", borderColor: "divider" }}>
      <Toolbar sx={{ minHeight: "64px !important", gap: 1.5 }}>
        <IconButton aria-label="開啟功能選單" aria-expanded={open} onClick={() => setOpen(true)} edge="start" sx={{ display: { lg: "none" } }}><MenuOutlined /></IconButton>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 650 }} noWrap>{currentLabel}</Typography>
        <Chip label={roleLabel} variant="outlined" sx={{ display: { xs: "none", sm: "inline-flex" } }} />
        <Avatar sx={{ width: 30, height: 30, fontSize: 13, bgcolor: "primary.light", color: "primary.main" }}>{username.slice(0, 1).toUpperCase()}</Avatar>
        <Typography variant="body2" sx={{ maxWidth: 150, display: { xs: "none", sm: "block" } }} noWrap>{username}</Typography>
        <Form action={logoutPath} method="post" reloadDocument={reloadLogout}><Button type="submit" color="secondary" startIcon={<LogoutOutlined fontSize="small" />} sx={{ minWidth: 0 }}>登出</Button></Form>
      </Toolbar>
    </AppBar>
    <Box id="main-content" component="main" className="app-main" sx={{ ml: { lg: "248px" } }} tabIndex={-1}>{children}</Box>
  </div>;
}
