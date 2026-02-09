import { useState, useCallback } from "react";

export interface Widget {
  id: string;
  type: string;
  title: string;
  grid: { x: number; y: number; w: number; h: number };
  config?: any;
}

export interface ReportPage {
  id: string;
  title: string;
  widgets: Widget[];
  layouts: any; // RGL layouts object
}

const defaultWidgetsPage1: Widget[] = [
  // Row 1: KPI Cards
  {
    id: "kpi-premium",
    type: "kpi-premium",
    title: "Total Premium",
    grid: { x: 0, y: 0, w: 3, h: 4 },
  },
  {
    id: "kpi-loss",
    type: "kpi-loss",
    title: "Loss Ratio",
    grid: { x: 3, y: 0, w: 3, h: 4 },
  },
  {
    id: "kpi-claims",
    type: "kpi-claims",
    title: "Total Claims",
    grid: { x: 6, y: 0, w: 3, h: 4 },
  },
  {
    id: "kpi-policies",
    type: "kpi-policies",
    title: "Policies Sold",
    grid: { x: 9, y: 0, w: 3, h: 4 },
  },
  // Row 2: Main Charts
  {
    id: "chart-trend",
    type: "chart-trend",
    title: "Premium vs Claims Trend",
    grid: { x: 0, y: 4, w: 6, h: 12 },
  },
  {
    id: "chart-pie",
    type: "chart-pie",
    title: "Claims by Type",
    grid: { x: 6, y: 4, w: 3, h: 12 },
  },
  {
    id: "chart-region",
    type: "chart-region",
    title: "Performance by Region",
    grid: { x: 9, y: 4, w: 3, h: 12 },
  },
  // Row 3: Product Distribution
  {
    id: "chart-bar-new",
    type: "chart-products",
    title: "Product Distribution",
    grid: { x: 0, y: 16, w: 6, h: 10 },
  },
];

const defaultWidgetsPage2: Widget[] = [
  {
    id: "chart-region-p2",
    type: "chart-region",
    title: "Regional Performance",
    grid: { x: 0, y: 0, w: 12, h: 12 },
  },
  {
    id: "table-dealers-p2",
    type: "table-dealers",
    title: "Dealer Performance Data",
    grid: { x: 0, y: 12, w: 12, h: 12 },
  },
];

const defaultWidgetsPage3: Widget[] = [
  {
    id: "kpi-loss-p3",
    type: "kpi-loss",
    title: "Overall Loss Ratio",
    grid: { x: 0, y: 0, w: 6, h: 4 },
  },
  {
    id: "kpi-claims-p3",
    type: "kpi-claims",
    title: "Total Claims Value",
    grid: { x: 6, y: 0, w: 6, h: 4 },
  },
  {
    id: "chart-pie-p3",
    type: "chart-pie",
    title: "Claims Segmentation",
    grid: { x: 0, y: 4, w: 12, h: 12 },
  },
  {
    id: "list-claims-p3",
    type: "list-claims",
    title: "Recent Large Claims",
    grid: { x: 0, y: 16, w: 12, h: 10 },
  },
];

const defaultWidgetsPage4: Widget[] = [
  {
    id: "kpi-loss-p4",
    type: "kpi-loss",
    title: "Portfolio Risk Level",
    grid: { x: 0, y: 0, w: 6, h: 4 },
  },
  {
    id: "chart-pie-p4",
    type: "chart-pie",
    title: "High Risk Claims by Category",
    grid: { x: 0, y: 4, w: 6, h: 12 },
  },
  {
    id: "chart-trend-p4",
    type: "chart-trend",
    title: "Loss Ratio Volatility",
    grid: { x: 6, y: 0, w: 6, h: 16 },
  },
];

const defaultWidgetsPage5: Widget[] = [
  {
    id: "table-dealers-p5",
    type: "table-dealers",
    title: "Dealer Performance Ranking",
    grid: { x: 0, y: 0, w: 12, h: 14 },
  },
  {
    id: "chart-region-p5",
    type: "chart-region",
    title: "Regional Dealer Distribution",
    grid: { x: 0, y: 14, w: 12, h: 10 },
  },
];

const defaultPages: ReportPage[] = [
  {
    id: "p1",
    title: "Executive Overview",
    widgets: defaultWidgetsPage1,
    layouts: { lg: defaultWidgetsPage1.map((w) => ({ i: w.id, ...w.grid })) },
  },
  {
    id: "p2",
    title: "Market Trends",
    widgets: defaultWidgetsPage2,
    layouts: { lg: defaultWidgetsPage2.map((w) => ({ i: w.id, ...w.grid })) },
  },
  {
    id: "p3",
    title: "Claims Deep Dive",
    widgets: defaultWidgetsPage3,
    layouts: { lg: defaultWidgetsPage3.map((w) => ({ i: w.id, ...w.grid })) },
  },
  {
    id: "p4",
    title: "Risk Analysis",
    widgets: defaultWidgetsPage4,
    layouts: { lg: defaultWidgetsPage4.map((w) => ({ i: w.id, ...w.grid })) },
  },
  {
    id: "p5",
    title: "Dealer Performance",
    widgets: defaultWidgetsPage5,
    layouts: { lg: defaultWidgetsPage5.map((w) => ({ i: w.id, ...w.grid })) },
  },
];

export function useDashboardState() {
  const [pages, setPages] = useState<ReportPage[]>(defaultPages);
  const [activePageId, setActivePageId] = useState<string>("p1");

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  const addPage = useCallback((title: string) => {
    const newPageId = `p${Date.now()}`;
    setPages((prev) => [
      ...prev,
      { id: newPageId, title, widgets: [], layouts: { lg: [] } },
    ]);
    setActivePageId(newPageId);
  }, []);

  const renamePage = useCallback((pageId: string, newTitle: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title: newTitle } : p)),
    );
  }, []);

  const removePage = useCallback(
    (pageId: string) => {
      setPages((prev) => {
        if (prev.length <= 1) return prev; // Don't delete last page
        const newPages = prev.filter((p) => p.id !== pageId);
        if (activePageId === pageId) setActivePageId(newPages[0].id);
        return newPages;
      });
    },
    [activePageId],
  );

  const addWidgetToPage = useCallback(
    (pageId: string, widgetType: string, title?: string) => {
      setPages((prev) =>
        prev.map((p) => {
          if (p.id !== pageId) return p;
          const newWidget: Widget = {
            id: `${widgetType}-${Date.now()}`,
            type: widgetType,
            title: title || "New Widget",
            grid: { x: 0, y: Infinity, w: 4, h: 6 }, // RGL handles auto-placement
          };
          return {
            ...p,
            widgets: [...p.widgets, newWidget],
            layouts: {
              ...p.layouts,
              lg: [
                ...(p.layouts.lg || []),
                { i: newWidget.id, ...newWidget.grid },
              ],
            },
          };
        }),
      );
    },
    [],
  );

  const removeWidgetFromPage = useCallback(
    (pageId: string, widgetId: string) => {
      setPages((prev) =>
        prev.map((p) => {
          if (p.id !== pageId) return p;
          return {
            ...p,
            widgets: p.widgets.filter((w) => w.id !== widgetId),
            layouts: {
              ...p.layouts,
              lg: p.layouts.lg.filter((l: any) => l.i !== widgetId),
            },
          };
        }),
      );
    },
    [],
  );

  const updatePageLayout = useCallback((pageId: string, newLayout: any[]) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          layouts: { ...p.layouts, lg: newLayout },
          widgets: p.widgets.map((w) => {
            const match = newLayout.find((l: any) => l.i === w.id);
            return match
              ? {
                  ...w,
                  grid: { x: match.x, y: match.y, w: match.w, h: match.h },
                }
              : w;
          }),
        };
      }),
    );
  }, []);

  return {
    pages,
    activePageId,
    setActivePageId,
    activePage,
    addPage,
    renamePage,
    removePage,
    addWidgetToPage,
    removeWidgetFromPage,
    updatePageLayout,
  };
}
