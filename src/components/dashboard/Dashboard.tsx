"use client";

import React, { useState, useCallback, useRef } from "react";
import { useDashboardState } from "@/hooks/useDashboardState";
import { useFilters } from "@/hooks/useFilters";
import { useData } from "@/hooks/useData";
import { Sidebar } from "./Sidebar";
import { DashboardHeader, PublishModal } from "./DashboardHeader";
import { FilterPanel } from "./FilterPanel";
import { WidgetGallery } from "./WidgetGallery";
import { ReportManager } from "./ReportManager";
import { Breadcrumbs } from "./Breadcrumbs";
import { KPIContent } from "./widgets";
import { InsightCards } from "./InsightCards";
import { TrendChart } from "./widgets/TrendChart";
import { PieChartWidget } from "./widgets/PieChartWidget";
import { RegionChart } from "./widgets/RegionChart";
import { ProductChart } from "./widgets/ProductChart";
import { DealerTable } from "./widgets/DealerTable";
import { ChatPanel } from "./ChatPanel";
import {
  AnalyticsView,
  ClaimsView,
  PerformanceView,
  PartnersView,
  SettingsView,
  ProfileView,
} from "./ViewPages";
import { DataManagerView } from "./DataManagerView";
import { FileUp, Loader2, X } from "lucide-react";

import { exportDashboardToPDF, exportToExcel } from "@/lib/ExportManager";

export default function ClarityDashboard() {
  const [activeView, setActiveView] = useState("Report");
  const [isExporting, setIsExporting] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const handleExport = async (type: "pdf" | "excel" = "pdf") => {
    setIsExporting(true);
    try {
      if (type === "excel") {
        // Context-aware export based on active view
        const table = activeView === "Claims" ? "claims" : "sales";
        await data.exportData(table);
      } else {
        await exportDashboardToPDF("#report-canvas", "Clarity-BI-Report");
      }
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  };
  const [showFilters, setShowFilters] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showWidgetGallery, setShowWidgetGallery] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks — staged/applied filters pattern for reduced latency
  const {
    filters,
    staged,
    setStagedFilter,
    applyFilters,
    clearFilter,
    clearAllFilters,
    applyFiltersDirectly,
    stagedFilterCount,
    appliedFilterCount,
    hasUnappliedChanges,
  } = useFilters();

  const dashboardState = useDashboardState();
  const data = useData(filters);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // ─── Initial Load Optimization ─────────────────────────
  const [hasSetInitialDate, setHasSetInitialDate] = useState(false);

  React.useEffect(() => {
    if (
      data.dataLoaded &&
      data.filterOptions.maxDate &&
      !hasSetInitialDate &&
      !filters.date_from
    ) {
      try {
        const max = new Date(data.filterOptions.maxDate);
        const min = new Date(max);
        min.setMonth(min.getMonth() - 6);

        applyFiltersDirectly({
          date_from: min.toISOString().split("T")[0],
        });
        setHasSetInitialDate(true);
      } catch (e) {
        console.error("Failed to set initial date range", e);
      }
    }
  }, [
    data.dataLoaded,
    data.filterOptions,
    hasSetInitialDate,
    filters.date_from,
    applyFiltersDirectly,
  ]);

  // ─── AI Chat ────────────────────────────────────────────

  const handleSendChatMessage = useCallback(
    async (msg: string) => {
      const result = await data.sendChatMessage(msg, []);
      return {
        response: result.response,
        actions: result.actions || null,
        suggestions: result.suggestions || [],
      };
    },
    [data],
  );

  // AI Action Handler — auto-navigate + auto-apply filters
  const handleAiAction = useCallback(
    (action: { navigate?: string; filters?: Record<string, string> }) => {
      if (action.filters && Object.keys(action.filters).length > 0) {
        applyFiltersDirectly(action.filters);
      }
      if (action.navigate) {
        const viewMap: Record<string, string> = {
          report: "Report",
          analytics: "Analytics",
          claims: "Claims",
          performance: "Performance",
          partners: "Partners",
          "data-manager": "Data Manager",
          settings: "Settings",
        };
        const viewName = viewMap[action.navigate] || action.navigate;
        setActiveView(viewName);
      }
    },
    [applyFiltersDirectly],
  );

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    setShowWidgetGallery(!isEditing);
  };

  // Drag & Drop File
  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);
      if (e.dataTransfer.files.length > 0) {
        data.handleFileUpload(e.dataTransfer.files);
      }
    },
    [data],
  );

  // Chart Click Logic (Drill Down) — now applies directly
  const handleChartClick = useCallback(
    (clickData: Record<string, unknown>) => {
      if (clickData.dealer) {
        const val =
          filters.dealer === clickData.dealer
            ? "All"
            : String(clickData.dealer);
        applyFiltersDirectly({ dealer: val });
        setSelectedElement(val === "All" ? null : String(clickData.dealer));
      } else if (clickData.product) {
        const val =
          filters.product === clickData.product
            ? "All"
            : String(clickData.product);
        applyFiltersDirectly({ product: val });
        setSelectedElement(val === "All" ? null : String(clickData.product));
      } else if (clickData.make) {
        const val =
          filters.make === clickData.make ? "All" : String(clickData.make);
        applyFiltersDirectly({ make: val });
        setSelectedElement(val === "All" ? null : String(clickData.make));
      } else if (clickData.name) {
        const val =
          filters.dealer === clickData.name ? "All" : String(clickData.name);
        applyFiltersDirectly({ dealer: val });
        setSelectedElement(val === "All" ? null : String(clickData.name));
      }
    },
    [applyFiltersDirectly, filters],
  );

  // Format helpers
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // ─── Export Helper ─────────────────────────────────────

  const prepareWidgetData = (type: string) => {
    if (!data.kpis) return [];

    switch (type) {
      case "chart-trend":
        return data.salesMonthly.map((d) => ({
          Month: d.period,
          Premium: d.premium,
          Claims: d.riskPremium,
          Policies: d.policies,
        }));
      case "table-dealers":
      case "table":
      case "chart-region": // Region chart uses dealer data
        return data.salesDealers.map((d) => ({
          Dealer: d.dealer,
          Premium: d.premium,
          "Claims Amount": d.totalClaimAmount || 0,
          "Claims Count": d.claimsCount || 0,
          Policies: d.policies,
          "Loss Ratio": d.lossRatio || 0,
          "Claim Rate": d.claimRate || 0,
        }));
      case "chart-products":
      case "chart-bar":
        return data.salesProducts.map((d) => ({
          Product: d.product,
          Policies: d.count,
          Premium: d.premium,
          "Claims Amount": d.riskPremium,
        }));
      case "chart-pie":
        return data.claimStatuses.map((d) => ({
          Status: d.status,
          Count: d.count,
          Amount: d.totalAmount,
        }));
      case "list-claims":
        return data.recentClaims;
      default:
        return [];
    }
  };

  const handleWidgetExport = (type: string, title: string) => {
    const exportData = prepareWidgetData(type);
    if (exportData.length > 0) {
      exportToExcel(exportData, title.replace(/\s+/g, "_"));
    }
  };

  // ─── Render Widget Content ─────────────────────────────

  const renderWidget = (type: string) => {
    if (!type || !data.kpis) return null;

    if (type.startsWith("kpi")) {
      if (type.includes("premium"))
        return (
          <KPIContent
            label="Total Premium"
            value={fmt(data.kpis.totalPremium)}
            change={`${data.kpis.totalPolicies.toLocaleString()} policies`}
            trend="up"
            color="var(--chart-1)"
          />
        );
      if (type.includes("loss"))
        return (
          <KPIContent
            label="Loss Ratio"
            value={`${data.kpis.lossRatio}%`}
            change={`${data.kpis.claimRate}% claim rate`}
            trend={data.kpis.lossRatio > 60 ? "down" : "up"}
            color="var(--chart-2)"
          />
        );
      if (type.includes("claims"))
        return (
          <KPIContent
            label="Total Claims"
            value={fmt(data.kpis.totalClaimsAmount)}
            change={`${data.kpis.totalClaims.toLocaleString()} claims`}
            trend="down"
            color="var(--chart-3)"
          />
        );
      if (type.includes("policies"))
        return (
          <KPIContent
            label="Active Policies"
            value={data.kpis.totalPolicies.toLocaleString()}
            change={`${data.kpis.uniqueDealers} dealers`}
            trend="up"
            color="var(--chart-4)"
          />
        );
      return (
        <KPIContent
          label="Claim Rate"
          value={`${data.kpis.claimRate}%`}
          change={`Avg Cost: ${fmt(data.kpis.avgClaimCost)}`}
          trend="up"
          color="var(--chart-5)"
        />
      );
    }

    // Convert data for widgets — only compute when data exists
    const monthlyForChart =
      data.salesMonthly.length > 0
        ? data.salesMonthly.map((d) => ({
            month: d.period,
            premium: d.premium,
            claims: d.riskPremium,
            policies: d.policies,
          }))
        : [];

    const dealersForTable =
      data.salesDealers.length > 0
        ? data.salesDealers.map((d) => ({
            name: d.dealer,
            dealer: d.dealer,
            premium: d.premium,
            claims: d.totalClaimAmount || 0,
            claimsCount: d.claimsCount || 0,
            policies: d.policies,
            lossRatio: d.lossRatio || 0,
          }))
        : [];

    const productsForChart =
      data.salesProducts.length > 0
        ? data.salesProducts.map((d) => ({
            product: d.product,
            count: d.count,
            premium: d.premium,
            claims: d.riskPremium,
          }))
        : [];

    const claimTypesForPie =
      data.claimStatuses.length > 0
        ? data.claimStatuses.map((d) => ({
            name: d.status,
            value: d.count,
            amount: d.totalAmount,
            color: d.color,
          }))
        : [];

    // Map of type → { check, render }
    switch (type) {
      case "chart-trend":
        if (monthlyForChart.length === 0)
          return <EmptyWidget label="Monthly Trend" />;
        return (
          <TrendChart
            data={monthlyForChart}
            onClick={handleChartClick}
            selectedElement={selectedElement}
          />
        );
      case "chart-pie":
        if (claimTypesForPie.length === 0)
          return <EmptyWidget label="Claim Types" />;
        return (
          <PieChartWidget
            data={claimTypesForPie}
            onClick={handleChartClick}
            selectedElement={selectedElement}
          />
        );
      case "chart-products":
      case "chart-bar":
        if (productsForChart.length === 0)
          return <EmptyWidget label="Products" />;
        return (
          <ProductChart
            data={productsForChart}
            onClick={handleChartClick}
            selectedElement={selectedElement}
          />
        );
      case "chart-region":
        // Region chart now uses dealer data (no region data in this dataset)
        if (dealersForTable.length === 0)
          return <EmptyWidget label="Dealer Performance" />;
        return (
          <RegionChart
            data={dealersForTable}
            onClick={handleChartClick}
            selectedElement={selectedElement}
          />
        );
      case "table-dealers":
      case "table":
        if (dealersForTable.length === 0)
          return <EmptyWidget label="Dealers" />;
        return (
          <DealerTable
            data={dealersForTable}
            onClick={handleChartClick}
            selectedElement={selectedElement}
          />
        );
      case "list-claims":
        if (data.recentClaims.length === 0)
          return <EmptyWidget label="Recent Claims" />;
        return (
          <div className="h-full overflow-auto text-[11px]">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-bold text-muted-foreground uppercase">
                    Policy No
                  </th>
                  <th className="text-left p-2 font-bold text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="text-left p-2 font-bold text-muted-foreground uppercase">
                    Part
                  </th>
                  <th className="text-right p-2 font-bold text-muted-foreground uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentClaims.slice(0, 20).map((claim, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2 font-semibold">
                      {String(claim["Policy No"] || "")}
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                          claim["Claim Status"] === "Approved"
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : claim["Claim Status"] === "Rejected"
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                        }`}
                      >
                        {String(claim["Claim Status"] || "")}
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {String(claim["Part Name"] || "")}
                    </td>
                    <td className="p-2 text-right font-bold">
                      {Number(claim["Total Auth Amount"] || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        if (type.includes("table") && dealersForTable.length > 0)
          return (
            <DealerTable
              data={dealersForTable}
              onClick={handleChartClick}
              selectedElement={selectedElement}
            />
          );
        if (type.includes("bar") && productsForChart.length > 0)
          return (
            <ProductChart
              data={productsForChart}
              onClick={handleChartClick}
              selectedElement={selectedElement}
            />
          );
        return <EmptyWidget label={type} />;
    }
  };

  // ─── Upload Prompt (No data loaded) ────────────────────

  const renderUploadPrompt = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 mx-auto mb-6 bg-linear-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
          <FileUp size={36} className="text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Upload Your Data</h2>
        <p className="text-muted-foreground mb-6">
          Drop an Excel file with Sales and Claims sheets, or click below to
          browse. The file should have a &ldquo;Policy No&rdquo; column to link
          both sheets.
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          Browse Files
        </button>
        <p className="text-xs text-muted-foreground mt-4">
          Supports .xlsx, .xls, .csv
        </p>
      </div>
    </div>
  );

  // ─── View Rendering ────────────────────────────────────

  const renderView = () => {
    if (
      !data.dataLoaded &&
      activeView !== "Settings" &&
      activeView !== "Profile"
    ) {
      return renderUploadPrompt();
    }

    switch (activeView) {
      case "Report":
        return (
          <>
            <Breadcrumbs
              filters={filters}
              clearFilter={(key) => clearFilter(key)}
              clearAll={clearAllFilters}
            />
            <InsightCards insights={data.insights} isLoading={data.isLoading} />
            <ReportManager
              isEditing={isEditing}
              dashboardState={dashboardState}
              renderWidget={renderWidget}
              onExport={handleWidgetExport}
            />
          </>
        );
      case "Analytics":
        return <AnalyticsView data={data} />;
      case "Claims":
        return <ClaimsView data={data} />;
      case "Performance":
        return <PerformanceView data={data} />;
      case "Partners":
        return <PartnersView data={data} />;
      case "Data Manager":
        return <DataManagerView data={data} />;
      case "Settings":
        return <SettingsView />;
      case "Profile":
        return <ProfileView />;
      default:
        return (
          <>
            <Breadcrumbs
              filters={filters}
              clearFilter={(key) => clearFilter(key)}
              clearAll={clearAllFilters}
            />
            <ReportManager
              isEditing={isEditing}
              dashboardState={dashboardState}
              renderWidget={renderWidget}
              onExport={handleWidgetExport}
            />
          </>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden transition-colors duration-300">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xlsx,.xls,.csv"
        multiple
        onChange={(e) =>
          e.target.files && data.handleFileUpload(e.target.files)
        }
      />

      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          isEditing={isEditing}
          setIsEditing={toggleEditMode}
          onUploadClick={() => fileInputRef.current?.click()}
          onExportClick={handleExport}
          isExporting={isExporting}
          onPublishClick={() => setShowPublishModal(true)}
          validation={data.validation}
        />

        <div className="flex-1 flex overflow-hidden relative">
          <FilterPanel
            show={showFilters}
            onClose={() => setShowFilters(false)}
            staged={staged}
            setStagedFilter={setStagedFilter}
            clearAllFilters={clearAllFilters}
            applyFilters={applyFilters}
            stagedFilterCount={stagedFilterCount}
            hasUnappliedChanges={hasUnappliedChanges}
            filterOptions={data.filterOptions}
            onUploadClick={() => fileInputRef.current?.click()}
          />

          <main
            className={`flex-1 overflow-hidden relative flex flex-col ${isDraggingFile ? "bg-primary/5" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
            }}
            onDrop={handleFileDrop}
          >
            {renderView()}

            {/* Drag Overlay */}
            {isDraggingFile && (
              <div className="absolute inset-4 border-2 border-dashed border-primary bg-primary/10 rounded-xl flex items-center justify-center z-50 pointer-events-none">
                <div className="text-center">
                  <FileUp size={64} className="mx-auto text-primary mb-4" />
                  <p className="text-xl font-bold text-primary">
                    Drop to Upload
                  </p>
                </div>
              </div>
            )}
          </main>

          {/* Clarity AI Chat Sidebar */}
          <ChatPanel
            show={showChat}
            onSend={handleSendChatMessage}
            aiAvailable={data.aiAvailable}
            onAiAction={handleAiAction}
          />

          {/* Floating Reset Button */}
          {appliedFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-all z-20 animate-in fade-in slide-in-from-bottom-4 active:scale-95"
            >
              <X size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">
                Reset Filters ({appliedFilterCount})
              </span>
            </button>
          )}
        </div>

        {/* Loading Overlay */}
        {data.isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center">
              <Loader2 size={48} className="animate-spin text-primary mb-4" />
              <p className="text-lg font-semibold text-foreground">
                Analyzing Data...
              </p>
              {data.uploadedFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  {data.uploadedFile.salesRows.toLocaleString()} sales •{" "}
                  {data.uploadedFile.claimsRows.toLocaleString()} claims
                </p>
              )}
            </div>
          </div>
        )}

        {/* Widget Gallery Overlay */}
        {isEditing && showWidgetGallery && (
          <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="w-full max-w-5xl h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Add Widget</h2>
                  <p className="text-muted-foreground">
                    Select a visualization to add to your dashboard
                  </p>
                </div>
                <button
                  onClick={() => setShowWidgetGallery(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <WidgetGallery
                  onSelect={(type, title) => {
                    dashboardState.addWidgetToPage(
                      dashboardState.activePageId,
                      type,
                      title,
                    );
                    setShowWidgetGallery(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
      />

      {isExporting && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="flex flex-col items-center bg-card border border-border rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <Loader2 size={40} className="animate-spin text-primary mb-4" />
            <p className="text-sm font-bold text-foreground">
              Generating PDF...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Capturing full dashboard
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty Widget Placeholder ─────────────────────────

function EmptyWidget({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
      <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
        <Loader2 size={18} className="text-muted-foreground/30" />
      </div>
      <span className="text-[10px] font-medium">No data for {label}</span>
    </div>
  );
}
