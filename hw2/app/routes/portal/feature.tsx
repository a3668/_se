import { Link } from "react-router";
import type { Route } from "./+types/feature";
import { getPortalNavigationItem } from "../../lib/portal-navigation";

export function loader({ request }: Route.LoaderArgs) {
  const item = getPortalNavigationItem(new URL(request.url).pathname);
  if (!item) throw new Response("Not Found", { status: 404 });
  return { item };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `${data.item.label}｜校務資訊系統` : "找不到頁面｜校務資訊系統" }];
}

export default function PortalFeature({ loaderData }: Route.ComponentProps) {
  return (
    <div className="portal-page portal-feature-page">
      <nav aria-label="麵包屑" className="portal-breadcrumb">
        <Link to="/home">系統首頁</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{loaderData.item.label}</span>
      </nav>
      <section className="portal-feature-card">
        <span className="portal-feature-icon" aria-hidden="true">◇</span>
        <p className="portal-kicker">System Module</p>
        <h1>{loaderData.item.label}</h1>
        <p>此功能目前建置中，後續將逐步開放使用。</p>
        <Link className="portal-back-link" to="/home">返回系統首頁</Link>
      </section>
    </div>
  );
}
