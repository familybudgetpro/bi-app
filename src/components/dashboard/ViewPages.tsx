"use client";

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  PieChart,
  Users,
  DollarSign,
  Shield,
  Activity,
  Target,
  Award,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { useData } from "@/hooks/useData";

// ─── Shared Components ──────────────────────────────────

const MetricCard = React.memo(function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = "primary",
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-600",
    green:
      "from-green-500/10 to-green-500/5 border-green-500/20 text-green-600",
    amber:
      "from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-600",
    red: "from-red-500/10 to-red-500/5 border-red-500/20 text-red-600",
    purple:
      "from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-600",
    emerald:
      "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-600",
  };

  return (
    <div
      className={`bg-linear-to-br ${colorMap[color] || colorMap.primary} border rounded-xl p-4 flex items-center gap-4`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/50 shadow-sm ${colorMap[color]?.split(" ").pop()}`}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {label}
        </p>
        <p className="text-lg font-bold text-foreground">{value}</p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
});

const InsightCard = React.memo(function InsightCard({
  title,
  value,
  change,
  positive = true,
}: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
        {title}
      </p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {change && (
        <div
          className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${positive ? "text-green-600" : "text-red-500"}`}
        >
          {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
});

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

const ProgressBar = React.memo(function ProgressBar({
  value,
  max,
  color = "bg-primary",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

// ─── Analytics View ──────────────────────────────────────

export const AnalyticsView = React.memo(function AnalyticsView({
  data,
}: {
  data: ReturnType<typeof useData>;
}) {
  const k = data.kpis;
  if (!k) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No data loaded
      </div>
    );
  }

  const topDealer = data.salesDealers[0];
  const topProduct = data.salesProducts[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" id="analytics-view">
      <SectionTitle
        title="Analytics Overview"
        subtitle="Key metrics and performance indicators"
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Gross Premium"
          value={fmt(k.totalPremium)}
          subtitle={`${k.totalPolicies.toLocaleString()} policies`}
          icon={DollarSign}
          color="primary"
        />
        <MetricCard
          label="Risk Premium"
          value={fmt(k.totalRiskPremium)}
          subtitle={`Avg: ${fmt(k.avgPremium)}`}
          icon={Shield}
          color="green"
        />
        <MetricCard
          label="Total Claims"
          value={fmt(k.totalClaimsAmount)}
          subtitle={`${k.totalClaims} claims`}
          icon={AlertTriangle}
          color="amber"
        />
        <MetricCard
          label="Loss Ratio"
          value={`${k.lossRatio}%`}
          subtitle={`Claim Rate: ${k.claimRate}%`}
          icon={Percent}
          color={k.lossRatio > 60 ? "red" : "green"}
        />
      </div>

      {/* Monthly Trend Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            Monthly Trend
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Period
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Premium
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Risk Premium
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Policies
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.salesMonthly.slice(0, 12).map((m, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-semibold">{m.period}</td>
                  <td className="p-3 text-right font-mono">{fmt(m.premium)}</td>
                  <td className="p-3 text-right font-mono">
                    {fmt(m.riskPremium)}
                  </td>
                  <td className="p-3 text-right">
                    {m.policies.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <InsightCard
          title="Top Dealer"
          value={topDealer?.dealer || "—"}
          change={`${fmt(topDealer?.premium || 0)} premium`}
          positive
        />
        <InsightCard
          title="Top Product"
          value={topProduct?.product || "—"}
          change={`${topProduct?.count || 0} policies`}
          positive
        />
        <InsightCard
          title="Avg Claim Cost"
          value={fmt(k.avgClaimCost)}
          change={`${k.policiesWithClaims} policies with claims`}
          positive={k.avgClaimCost < k.avgPremium}
        />
      </div>
    </div>
  );
});

// ─── Claims View ───────────────────────────────────────

export const ClaimsView = React.memo(function ClaimsView({
  data,
}: {
  data: ReturnType<typeof useData>;
}) {
  const k = data.kpis;
  if (!k) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No data loaded
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" id="claims-view">
      <SectionTitle
        title="Claims Analysis"
        subtitle="Claim statuses, parts analysis, and trends"
      />

      {/* Claims KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Claims"
          value={k.totalClaims.toLocaleString()}
          subtitle={`${k.claimRate}% of policies`}
          icon={AlertTriangle}
          color="amber"
        />
        <MetricCard
          label="Claims Amount"
          value={fmt(k.totalClaimsAmount)}
          subtitle="Total authorized"
          icon={DollarSign}
          color="red"
        />
        <MetricCard
          label="Avg Claim Cost"
          value={fmt(k.avgClaimCost)}
          icon={Target}
          color="purple"
        />
        <MetricCard
          label="Loss Ratio"
          value={`${k.lossRatio}%`}
          icon={Percent}
          color={k.lossRatio > 60 ? "red" : "green"}
        />
      </div>

      {/* Claim Status Breakdown */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <PieChart size={16} className="text-primary" />
            Claim Status Breakdown
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {data.claimStatuses.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs font-semibold flex-1">{s.status}</span>
              <span className="text-xs text-muted-foreground">
                {s.count} claims
              </span>
              <span className="text-xs font-bold font-mono">
                {fmt(s.totalAmount)}
              </span>
              <div className="w-24">
                <ProgressBar
                  value={s.count}
                  max={k.totalClaims}
                  color={`bg-[${s.color}]`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parts Analysis */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            Parts Analysis
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Part Type
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Claims
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Total Cost
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Avg Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.claimParts.map((p, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-semibold">{p.partType}</td>
                  <td className="p-3 text-right">{p.count}</td>
                  <td className="p-3 text-right font-mono">
                    {fmt(p.totalAmount)}
                  </td>
                  <td className="p-3 text-right font-mono text-muted-foreground">
                    {fmt(p.avgCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Claims */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-foreground">Recent Claims</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Policy No
                </th>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Dealer
                </th>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Make
                </th>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Status
                </th>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Part
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.recentClaims.slice(0, 25).map((claim, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-semibold">
                    {String(claim["Policy No"] || "")}
                  </td>
                  <td className="p-3">{String(claim["Dealer"] || "")}</td>
                  <td className="p-3">{String(claim["Make"] || "")}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        claim["Claim Status"] === "Approved"
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : claim["Claim Status"] === "Rejected"
                            ? "bg-red-500/10 text-red-600 border-red-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}
                    >
                      {String(claim["Claim Status"] || "")}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {String(claim["Part Name"] || "")}
                  </td>
                  <td className="p-3 text-right font-bold font-mono">
                    {Number(claim["Total Auth Amount"] || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

// ─── Performance View ──────────────────────────────────

export const PerformanceView = React.memo(function PerformanceView({
  data,
}: {
  data: ReturnType<typeof useData>;
}) {
  const k = data.kpis;
  if (!k) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No data loaded
      </div>
    );
  }

  const corr = data.correlations;
  const maxPremium = Math.max(...data.salesDealers.map((d) => d.premium), 1);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" id="performance-view">
      <SectionTitle
        title="Performance & Correlations"
        subtitle="Dealer, product, and vehicle analysis with claim correlations"
      />

      {/* Dealer Performance */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Award size={16} className="text-primary" />
            Dealer Performance
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-bold text-muted-foreground">
                  Dealer
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Premium
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Policies
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Claims
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Claim Rate
                </th>
                <th className="p-3 text-right font-bold text-muted-foreground">
                  Loss Ratio
                </th>
                <th className="p-3 font-bold text-muted-foreground w-32">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.salesDealers.map((d, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-semibold">{d.dealer}</td>
                  <td className="p-3 text-right font-mono">{fmt(d.premium)}</td>
                  <td className="p-3 text-right">
                    {d.policies.toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    {(d.claimsCount || 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={`${(d.claimRate || 0) > 15 ? "text-red-500" : "text-green-600"} font-semibold`}
                    >
                      {(d.claimRate || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={`${(d.lossRatio || 0) > 60 ? "text-red-500" : "text-green-600"} font-semibold`}
                    >
                      {(d.lossRatio || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3">
                    <ProgressBar value={d.premium} max={maxPremium} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correlation Tables */}
      {corr.byMake && corr.byMake.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Target size={16} className="text-primary" />
              Vehicle Make — Claim Correlation
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-bold text-muted-foreground">
                    Make
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Policies
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    With Claims
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Total Premium
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Claims Amount
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Claim Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {corr.byMake.slice(0, 15).map((m, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-semibold">{m.make}</td>
                    <td className="p-3 text-right">{m.policies}</td>
                    <td className="p-3 text-right">{m.withClaims}</td>
                    <td className="p-3 text-right font-mono">
                      {fmt(m.totalPremium)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(m.totalClaimAmount)}
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`font-semibold ${m.claimRate > 15 ? "text-red-500" : "text-green-600"}`}
                      >
                        {m.claimRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Year Trend Correlation */}
      {corr.byYear && corr.byYear.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              Yearly Claim Trend
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-bold text-muted-foreground">
                    Year
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Policies
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    With Claims
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Claim Rate
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Premium
                  </th>
                  <th className="p-3 text-right font-bold text-muted-foreground">
                    Claims Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {corr.byYear.map((y, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-semibold">{y.year}</td>
                    <td className="p-3 text-right">{y.policies}</td>
                    <td className="p-3 text-right">{y.withClaims}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`font-semibold ${y.claimRate > 15 ? "text-red-500" : "text-green-600"}`}
                      >
                        {y.claimRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(y.totalPremium)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(y.totalClaimAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Partners View ─────────────────────────────────────

export const PartnersView = React.memo(function PartnersView({
  data,
}: {
  data: ReturnType<typeof useData>;
}) {
  const k = data.kpis;
  if (!k) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No data loaded
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" id="partners-view">
      <SectionTitle
        title="Dealer Partners"
        subtitle="Partner performance and distribution"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Total Dealers"
          value={k.uniqueDealers.toString()}
          icon={Users}
          color="primary"
        />
        <MetricCard
          label="Avg Premium/Dealer"
          value={fmt(k.totalPremium / Math.max(k.uniqueDealers, 1))}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          label="Vehicle Makes"
          value={k.uniqueMakes.toString()}
          icon={Activity}
          color="purple"
        />
      </div>

      {/* Dealer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.salesDealers.map((dealer, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-linear-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center text-primary font-bold text-sm">
                {dealer.dealer.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {dealer.dealer}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {dealer.policies.toLocaleString()} policies
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground text-[10px]">Premium</p>
                <p className="font-bold font-mono">{fmt(dealer.premium)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Claims</p>
                <p className="font-bold font-mono">
                  {(dealer.claimsCount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Claim Rate</p>
                <p
                  className={`font-bold ${(dealer.claimRate || 0) > 15 ? "text-red-500" : "text-green-600"}`}
                >
                  {(dealer.claimRate || 0).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">Loss Ratio</p>
                <p
                  className={`font-bold ${(dealer.lossRatio || 0) > 60 ? "text-red-500" : "text-green-600"}`}
                >
                  {(dealer.lossRatio || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Settings View ─────────────────────────────────────

export const SettingsView = React.memo(function SettingsView() {
  return (
    <div className="flex-1 overflow-y-auto p-6" id="settings-view">
      <SectionTitle title="Settings" subtitle="Dashboard configuration" />
      <div className="max-w-2xl space-y-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-bold text-foreground mb-3">Appearance</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">
                  Toggle dark/light theme
                </p>
              </div>
              <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-bold text-foreground mb-3">Data</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-Load on Startup</p>
                <p className="text-xs text-muted-foreground">
                  Automatically load the default Excel file
                </p>
              </div>
              <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Gemini AI</p>
                <p className="text-xs text-muted-foreground">
                  AI-powered data analysis assistant
                </p>
              </div>
              <span className="text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
                Connected
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-bold text-foreground mb-3">API</h3>
          <p className="text-xs text-muted-foreground">
            Backend:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
              http://localhost:8000
            </code>
          </p>
        </div>
      </div>
    </div>
  );
});

const ProfileField = React.memo(function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
});

// ─── Profile View ──────────────────────────────────────

export const ProfileView = React.memo(function ProfileView() {
  return (
    <div className="flex-1 overflow-y-auto p-6" id="profile-view">
      <SectionTitle title="My Profile" />
      <div className="max-w-2xl">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-linear-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
              MA
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Muhsin Admin
              </h3>
              <p className="text-sm text-muted-foreground">
                admin@clarity-bi.ae
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <ProfileField label="Role" value="Administrator" />
            <ProfileField label="Department" value="Data Analytics" />
            <ProfileField label="Timezone" value="GMT+4 (Dubai)" />
            <ProfileField label="Language" value="English" />
          </div>
        </div>
      </div>
    </div>
  );
});
