import { Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "../root";

export function meta() {
  return [
    { title: "HW2｜本機登入示範" },
    {
      name: "description",
      content: "以 React Router 與本機 SQLite 製作的登入狀態示範。",
    },
  ];
}

export default function Home() {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const user = rootData?.user;

  return (
    <main className="home-page shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">React Router · SQLite</p>
          <h1>HW2 本機登入示範</h1>
          <p className="hero-description">
            學生與老師使用本機 SQLite 帳號登入；管理員使用獨立登入入口。
          </p>
          {user ? (
            <div className="status-card is-signed-in">
              <span className="status-dot" aria-hidden="true" />
              <div>
                <span>目前登入帳號</span>
                <strong>{user.username}</strong>
              </div>
            </div>
          ) : (
            <div className="hero-actions">
              <Link className="primary-link" to="/login">
                前往登入
              </Link>
              <span>目前尚未登入</span>
            </div>
          )}
        </div>
        <aside className="feature-panel" aria-label="作業功能">
          <p>包含功能</p>
          <ol>
            <li><span>01</span> 本機帳號驗證</li>
            <li><span>02</span> Cookie session</li>
            <li><span>03</span> 登入狀態顯示</li>
          </ol>
        </aside>
      </section>
    </main>
  );
}
