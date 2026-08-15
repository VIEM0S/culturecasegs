import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMoney } from "./utils.js";

// ── Tooltip recharts custom ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border2)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <p style={{ color: "var(--text2)", marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 700 }}>
          {money ? fmtMoney(p.value) : `${p.value} vente(s)`}
        </p>
      ))}
    </div>
  );
}

// ── Graphique CA 30 jours — isolé dans son propre chunk ──────────────────────
// recharts pèse ~350 Ko à lui seul. Le charger en lazy() depuis Dashboard.jsx
// permet d'afficher les stats principales (cards, alertes, top produits)
// immédiatement, sans attendre ce chunk sur les connexions lentes.
function RevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--success)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--text2)" }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(data.length / 6)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--text2)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          width={36}
        />
        <Tooltip content={<ChartTooltip money />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--success)"
          strokeWidth={2}
          fill="url(#gradCA)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default RevenueChart;
