import { getAllRows } from "@/lib/data";
import { getBudgetMap } from "@/lib/budget";
import { sourceStatus } from "@/lib/integrations";
import { Dashboard } from "@/components/Dashboard";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

function SourcePill({ name, live }: { name: string; live: boolean }) {
  return (
    <span className="pill">
      <span className={`dot ${live ? "live" : "mock"}`} />
      {name}
    </span>
  );
}

export default async function DashboardPage() {
  const [rows, budget] = await Promise.all([getAllRows(), getBudgetMap()]);
  const status = sourceStatus();

  const lastCaptured = rows.reduce<string | null>((max, r) => (!max || r.capturedAt > max ? r.capturedAt : max), null);
  const lastLabel = lastCaptured ? new Date(lastCaptured).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="ll-wrap">
      <header className="topbar">
        <div className="brand">
          <div className="mark">B</div>
          <div>
            <h1>Bubetti · Overblik</h1>
            <div className="sub">Omsætning, dækningsbidrag &amp; annoncespend — automatisk to gange om måneden</div>
          </div>
        </div>
        <div className="meta">
          <div className="pills">
            <SourcePill name="Shopify" live={status.shopify} />
            <SourcePill name="Google Ads" live={status.google} />
            <SourcePill name="Meta" live={status.meta} />
          </div>
          <div className="updated">Sidst opdateret <b>{lastLabel}</b> · pull den 1. &amp; 16.</div>
          <LogoutButton />
        </div>
      </header>

      <Dashboard rows={rows} status={status} budget={budget} />
    </div>
  );
}
