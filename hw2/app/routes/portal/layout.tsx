import { useEffect, useState } from "react";
import { Form, Link, NavLink, Outlet, useLocation } from "react-router";
import type { Route } from "./+types/layout";
import { requireUser } from "../../lib/auth.server";
import { getPortalNavigationForRole } from "../../lib/portal-navigation";

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request) };
}

const roleLabels = {
  student: "學生",
  teacher: "老師",
} as const;

export default function PortalLayout({ loaderData }: Route.ComponentProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="portal-brand-group">
          <button
            aria-controls="portal-navigation"
            aria-expanded={menuOpen}
            aria-label="開啟功能選單"
            className="portal-menu-button"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <Link className="portal-brand" to="/home">
            <span className="portal-brand-mark" aria-hidden="true">S</span>
            <span>
              <strong>校務資訊系統</strong>
              <small>Student Information System</small>
            </span>
          </Link>
        </div>

        <div className="portal-account">
          <div className="portal-identity">
            <span>{roleLabels[loaderData.user.role]}</span>
            <strong>{loaderData.user.username}</strong>
          </div>
          <Form action="/logout" method="post">
            <button className="portal-logout" type="submit">登出</button>
          </Form>
        </div>
      </header>

      <div className="portal-frame">
        <button
          aria-label="關閉功能選單"
          className={`portal-overlay${menuOpen ? " is-visible" : ""}`}
          onClick={() => setMenuOpen(false)}
          type="button"
        />
        <aside
          className={`portal-sidebar${menuOpen ? " is-open" : ""}`}
          id="portal-navigation"
        >
          <div className="portal-sidebar-heading">
            <span>功能選單</span>
            <button aria-label="關閉功能選單" onClick={() => setMenuOpen(false)} type="button">×</button>
          </div>
          <nav aria-label="校務系統功能">
            <NavLink className={({ isActive }) => `portal-nav-home${isActive ? " is-active" : ""}`} to="/home" end>
              <span aria-hidden="true">⌂</span>
              系統首頁
            </NavLink>
            {getPortalNavigationForRole(loaderData.user.role).map((group) => (
              <section className="portal-nav-group" key={group.label}>
                <h2>{group.label}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <NavLink className={({ isActive }) => isActive ? "is-active" : undefined} to={item.path}>
                        <span aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </aside>

        <main className="portal-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
