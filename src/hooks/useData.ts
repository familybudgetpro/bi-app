"use client";
import { useState, useMemo, useCallback, useEffect } from "react";

const API_BASE = ""; // Relative paths for Vercel/Production

// ─── Types ──────────────────────────────────────────────

export interface UploadedFile {
  name: string;
  salesRows: number;
  claimsRows: number;
}

export interface KPIs {
  totalPremium: number;
  totalRiskPremium: number;
  totalClaimsAmount: number;
  totalPolicies: number;
  totalClaims: number;
  claimRate: number;
  lossRatio: number;
  avgClaimCost: number;
  avgPremium: number;
  policiesWithClaims: number;
  uniqueDealers: number;
  uniqueMakes: number;
}

export interface FilterOptions {
  dealers: string[];
  products: string[];
  years: number[];
  months: number[];
  makes: string[];
  countries: string[];
  coverages: string[];
  vehicleTypes: string[];
  bodyTypes: string[];
  claimStatuses: string[];
  partTypes: string[];
  minDate?: string;
  maxDate?: string;
}

export interface Filters {
  dealer?: string;
  product?: string;
  year?: string;
  month?: string;
  make?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  claim_status?: string;
  [key: string]: string | undefined;
}

export interface SalesMonthly {
  Year: number;
  Month: number;
  period: string;
  premium: number;
  riskPremium: number;
  policies: number;
}

export interface DealerPerf {
  dealer: string;
  premium: number;
  riskPremium: number;
  policies: number;
  claimsCount?: number;
  totalClaimAmount?: number;
  lossRatio?: number;
  claimRate?: number;
}

export interface ProductMix {
  product: string;
  premium: number;
  riskPremium: number;
  count: number;
}

export interface VehicleMix {
  make: string;
  premium: number;
  count: number;
}

export interface ClaimStatus {
  status: string;
  count: number;
  totalAmount: number;
  color: string;
}

export interface PartAnalysis {
  partType: string;
  count: number;
  totalAmount: number;
  avgCost: number;
}

export interface Correlations {
  byDealer?: Array<{
    dealer: string;
    policies: number;
    withClaims: number;
    totalPremium: number;
    totalClaimAmount: number;
    claimRate: number;
    lossRatio?: number;
  }>;
  byProduct?: Array<{
    product: string;
    policies: number;
    withClaims: number;
    totalPremium: number;
    totalClaimAmount: number;
    claimRate: number;
    lossRatio?: number;
  }>;
  byMake?: Array<{
    make: string;
    policies: number;
    withClaims: number;
    totalPremium: number;
    totalClaimAmount: number;
    claimRate: number;
  }>;
  byYear?: Array<{
    year: number;
    policies: number;
    withClaims: number;
    totalPremium: number;
    totalClaimAmount: number;
    claimRate: number;
  }>;
}

export interface Insight {
  type: "warning" | "danger" | "success" | "info" | "forecast";
  title: string;
  description: string;
  metric: string;
  trend: "up" | "down" | "neutral";
}

export interface ValidationResult {
  status: "valid" | "warning" | "error";
  issues: { type: string; message: string }[];
}

export interface RawDataResult {
  rows: Record<string, unknown>[];
  columns: string[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface ChatResponse {
  response: string;
  actions?: { navigate?: string; filters?: Record<string, string> } | null;
  suggestions: string[];
  aiAvailable: boolean;
}

// ─── Helper ───────────────────────────────────────────────

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v && v !== "All" && v !== "") {
      params.set(k, v);
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  throw new Error(`Expected JSON but received: ${text.slice(0, 100)}...`);
}

// ─── Hook ────────────────────────────────────────────────

export function useData(filters: Filters = {}) {
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  // Core data state
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    dealers: [],
    products: [],
    years: [],
    months: [],
    makes: [],
    countries: [],
    coverages: [],
    vehicleTypes: [],
    bodyTypes: [],
    claimStatuses: [],
    partTypes: [],
  });
  const [salesMonthly, setSalesMonthly] = useState<SalesMonthly[]>([]);
  const [salesDealers, setSalesDealers] = useState<DealerPerf[]>([]);
  const [salesProducts, setSalesProducts] = useState<ProductMix[]>([]);
  const [salesVehicles, setSalesVehicles] = useState<VehicleMix[]>([]);
  const [claimStatuses, setClaimStatuses] = useState<ClaimStatus[]>([]);
  const [claimParts, setClaimParts] = useState<PartAnalysis[]>([]);
  const [claimTrends, setClaimTrends] = useState<SalesMonthly[]>([]);
  const [recentClaims, setRecentClaims] = useState<Record<string, unknown>[]>(
    [],
  );
  const [correlations, setCorrelations] = useState<Correlations>({});
  const [insights, setInsights] = useState<Insight[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);

  // ─── Check status on mount ──────────────────────────────

  const checkStatus = useCallback(async () => {
    try {
      const status = await apiFetch<{
        dataLoaded: boolean;
        salesRows: number;
        claimsRows: number;
        aiAvailable: boolean;
        pendingChanges: number;
      }>("/api/status");

      setDataLoaded(status.dataLoaded);
      setAiAvailable(status.aiAvailable);
      setPendingChanges(status.pendingChanges);

      if (status.dataLoaded) {
        setUploadedFile({
          name: "Sales&ClaimsData.xls",
          salesRows: status.salesRows,
          claimsRows: status.claimsRows,
        });
      }
      return status.dataLoaded;
    } catch {
      setDataLoaded(false);
      return false;
    }
  }, []);

  // ─── Fetch all data ─────────────────────────────────────

  const fetchAllData = useCallback(async (f: Filters = {}) => {
    setIsLoading(true);
    const qs = buildQuery(f);

    try {
      const [
        summaryData,
        filtersData,
        monthlyData,
        dealersData,
        productsData,
        vehiclesData,
        statusData,
        partsData,
        trendsData,
        recentData,
        corrData,
        insightsData,
        validationData,
      ] = await Promise.all([
        apiFetch<KPIs>(`/api/summary${qs}`),
        apiFetch<FilterOptions>("/api/filters"),
        apiFetch<SalesMonthly[]>(`/api/sales/monthly${qs}`),
        apiFetch<DealerPerf[]>(`/api/sales/dealers${qs}`),
        apiFetch<ProductMix[]>(`/api/sales/products${qs}`),
        apiFetch<VehicleMix[]>(`/api/sales/vehicles${qs}`),
        apiFetch<ClaimStatus[]>(`/api/claims/status${qs}`),
        apiFetch<PartAnalysis[]>(`/api/claims/parts${qs}`),
        apiFetch<SalesMonthly[]>(`/api/claims/trends${qs}`),
        apiFetch<Record<string, unknown>[]>(`/api/claims/recent${qs}`),
        apiFetch<Correlations>(`/api/correlations${qs}`),
        apiFetch<Insight[]>(`/api/insights${qs}`),
        apiFetch<ValidationResult>("/api/validate"),
      ]);

      setKpis(summaryData);
      setFilterOptions(filtersData);
      setSalesMonthly(monthlyData);
      setSalesDealers(dealersData);
      setSalesProducts(productsData);
      setSalesVehicles(vehiclesData);
      setClaimStatuses(statusData);
      setClaimParts(partsData);
      setClaimTrends(trendsData);
      setRecentClaims(recentData);
      setCorrelations(corrData);
      setInsights(insightsData);
      setValidation(validationData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Initial load ───────────────────────────────────────

  useEffect(() => {
    (async () => {
      const loaded = await checkStatus();
      if (loaded) {
        await fetchAllData(filters);
      } else {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Re-fetch on filter change ──────────────────────────

  useEffect(() => {
    if (dataLoaded) {
      fetchAllData(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.dealer,
    filters.product,
    filters.year,
    filters.month,
    filters.make,
    filters.date_from,
    filters.date_to,
    filters.search,
    filters.claim_status,
    dataLoaded,
  ]);

  // ─── File upload ────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      setIsLoading(true);
      const file = Array.from(files)[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const result = await apiFetch<{
          success: boolean;
          fileName: string;
          salesRows: number;
          claimsRows: number;
          filterOptions: FilterOptions;
        }>("/api/upload", { method: "POST", body: formData });

        setUploadedFile({
          name: result.fileName,
          salesRows: result.salesRows,
          claimsRows: result.claimsRows,
        });
        setFilterOptions(result.filterOptions);
        setDataLoaded(true);
        await fetchAllData(filters);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchAllData, filters],
  );

  // ─── Raw data (paginated) ──────────────────────────────

  const getRawData = useCallback(
    async (
      table: string,
      page: number = 1,
      limit: number = 100,
      sortBy?: string,
      sortDir?: string,
      extraFilters?: Filters,
    ): Promise<RawDataResult> => {
      const f = { ...filters, ...extraFilters };
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => {
        if (v && v !== "All" && v !== "") params.set(k, v);
      });
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (sortBy) params.set("sort_by", sortBy);
      if (sortDir) params.set("sort_dir", sortDir);

      return apiFetch<RawDataResult>(`/api/data/${table}?${params.toString()}`);
    },
    [filters],
  );

  // ─── Inline editing ────────────────────────────────────

  const updateCell = useCallback(
    async (table: string, rowId: number, column: string, newValue: unknown) => {
      const result = await apiFetch<{ success: boolean; error?: string }>(
        "/api/data/update",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table,
            row_id: rowId,
            column,
            new_value: newValue,
          }),
        },
      );
      if (result.success) {
        setPendingChanges((p) => p + 1);
        // Refresh KPIs
        const qs = buildQuery(filters);
        const newKpis = await apiFetch<KPIs>(`/api/summary${qs}`);
        setKpis(newKpis);
      }
      return result;
    },
    [filters],
  );

  const resetData = useCallback(async () => {
    const result = await apiFetch<{ success: boolean }>("/api/data/reset", {
      method: "POST",
    });
    if (result.success) {
      setPendingChanges(0);
      await fetchAllData(filters);
    }
    return result;
  }, [fetchAllData, filters]);

  const getChangeLog = useCallback(async () => {
    return apiFetch<Array<Record<string, unknown>>>("/api/data/changes");
  }, []);

  // ─── AI Chat ───────────────────────────────────────────

  const sendChatMessage = useCallback(
    async (
      message: string,
      history?: Array<{ role: string; content: string }>,
    ): Promise<ChatResponse> => {
      return apiFetch<ChatResponse>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, filters }),
      });
    },
    [filters],
  );

  const getChatSuggestions = useCallback(async (): Promise<string[]> => {
    try {
      const result = await apiFetch<{ suggestions: string[] }>(
        "/api/chat/suggestions",
      );
      return result.suggestions;
    } catch {
      return [];
    }
  }, []);

  // ─── Export ────────────────────────────────────────────

  const exportData = useCallback(async (table: string) => {
    const res = await fetch(`${API_BASE}/api/export/${table}`);
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}_data.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    // Status
    isLoading,
    dataLoaded,
    uploadedFile,
    aiAvailable,
    pendingChanges,

    // Data
    kpis,
    filterOptions,
    salesMonthly,
    salesDealers,
    salesProducts,
    salesVehicles,
    claimStatuses,
    claimParts,
    claimTrends,
    recentClaims,
    correlations,
    insights,
    validation,

    // Actions
    handleFileUpload,
    fetchAllData,
    getRawData,
    updateCell,
    resetData,
    getChangeLog,
    exportData,

    // AI
    sendChatMessage,
    getChatSuggestions,
  };
}
