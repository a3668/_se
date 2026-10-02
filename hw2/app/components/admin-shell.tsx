import type { ReactNode } from "react";
import { Form } from "react-router";
import { ADMIN_BASE_PATH, ADMIN_LOGOUT_PATH } from "../lib/admin-paths";

export function AdminShell({ children, username }: { children: ReactNode; username?: string }) {
  return (
    <div className="site-layout admin-layout">
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href={`${ADMIN_BASE_PATH}/`} aria-label="管理後台首頁">
            HW2<span>管理後台</span>
          </a>
          <nav className="session-nav" aria-label="管理員功能">
            {username ? (
              <>
                <span className="signed-in-user">已登入：<strong>{username}</strong></span>
                <Form action={ADMIN_LOGOUT_PATH} method="post" reloadDocument>
                  <button className="text-button" type="submit">登出</button>
                </Form>
              </>
            ) : <span>管理員登入</span>}
          </nav>
        </div>
      </header>
      <div className="admin-content">{children}</div>
      <footer className="site-footer">
        <div className="shell">現代軟體工程｜HW2</div>
      </footer>
    </div>
  );
}
