import { ActionLink } from "./components/ui";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./theme";
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
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = status === 404 ? "找不到這個頁面。" : status === 403 ? "你沒有此功能的存取權限。" : status === 400 ? "查詢條件或資料格式無效。" : "網站暫時無法處理此要求。";

  return (
    <main className="error-page shell">
      <p className="eyebrow">Error {status}</p>
      <h1>{message}</h1>
      <ActionLink className="primary-link" to="/">
        回到首頁
      </ActionLink>
    </main>
  );
}
