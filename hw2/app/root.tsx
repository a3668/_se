import {
  Form,
  isRouteErrorResponse,
  Links,
  Link,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import { getCurrentUser } from "./lib/auth.server";
import "./app.css";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { user };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  const rootData = useRouteLoaderData<typeof loader>("root");
  const user = rootData?.user;

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" to="/" aria-label="回到首頁">
          HW2
          <span>Local Login</span>
        </Link>
        <nav className="session-nav" aria-label="會員功能">
          {user ? (
            <>
              <span className="signed-in-user">
                已登入：<strong>{user.username}</strong>
              </span>
              <Form action="/logout" method="post">
                <button className="text-button" type="submit">
                  登出
                </button>
              </Form>
            </>
          ) : (
            <Link className="login-link" to="/login">
              登入
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="site-layout">
      <SiteHeader />
      <div className="site-content">
        <Outlet />
      </div>
      <footer className="site-footer">
        <div className="shell">現代軟體工程｜HW2</div>
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = status === 404 ? "找不到這個頁面。" : "網站暫時無法處理此要求。";

  return (
    <main className="error-page shell">
      <p className="eyebrow">Error {status}</p>
      <h1>{message}</h1>
      <Link className="primary-link" to="/">
        回到首頁
      </Link>
    </main>
  );
}
