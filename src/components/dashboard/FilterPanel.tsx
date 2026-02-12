"use client";

import React from "react";
import { Filter, X, Calendar, Search, Check } from "lucide-react";
import type { FilterOptions } from "@/hooks/useData";

interface FilterPanelProps {
  show: boolean;
  onClose: () => void;
  staged: Record<string, string>;
  setStagedFilter: (key: string, value: string) => void;
  clearAllFilters: () => void;
  applyFilters: () => void;
  stagedFilterCount: number;
  hasUnappliedChanges: boolean;
  filterOptions: FilterOptions;
  onUploadClick: () => void;
}

export function FilterPanel({
  show,
  onClose,
  staged,
  setStagedFilter,
  clearAllFilters,
  applyFilters,
  stagedFilterCount,
  hasUnappliedChanges,
  filterOptions,
}: FilterPanelProps) {
  if (!show) return null;

  const handleApply = () => {
    applyFilters();
    onClose();
  };

  return (
    <aside className="absolute top-0 left-0 bottom-0 w-72 bg-card border-r border-border flex flex-col shrink-0 shadow-2xl animate-in slide-in-from-left-4 duration-300 z-40">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-primary" />
          <span className="text-sm font-bold text-foreground">Filters</span>
          {stagedFilterCount > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
              {stagedFilterCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {stagedFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-[10px] text-destructive hover:underline font-medium mr-2"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Search */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            <Search size={10} className="inline mr-1" />
            Search
          </label>
          <input
            type="text"
            value={staged.search || ""}
            onChange={(e) => setStagedFilter("search", e.target.value)}
            placeholder="Search across all fields..."
            className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            <Calendar size={10} className="inline mr-1" />
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[9px] text-muted-foreground">From</span>
              <input
                type="date"
                value={staged.date_from || ""}
                onChange={(e) => setStagedFilter("date_from", e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-muted/30 border border-border rounded-lg outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground">To</span>
              <input
                type="date"
                value={staged.date_to || ""}
                onChange={(e) => setStagedFilter("date_to", e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-muted/30 border border-border rounded-lg outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Dealer */}
        <FilterSelect
          label="Dealer"
          value={staged.dealer || "All"}
          options={filterOptions.dealers}
          onChange={(v) => setStagedFilter("dealer", v)}
        />

        {/* Product */}
        <FilterSelect
          label="Product"
          value={staged.product || "All"}
          options={filterOptions.products}
          onChange={(v) => setStagedFilter("product", v)}
        />

        {/* Year */}
        <FilterSelect
          label="Year"
          value={staged.year || "All"}
          options={filterOptions.years.map(String)}
          onChange={(v) => setStagedFilter("year", v)}
        />

        {/* Month */}
        <FilterSelect
          label="Month"
          value={staged.month || "All"}
          options={filterOptions.months.map((m) => ({
            value: String(m),
            label:
              [
                "",
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ][m] || String(m),
          }))}
          onChange={(v) => setStagedFilter("month", v)}
        />

        {/* Vehicle Make */}
        <FilterSelect
          label="Vehicle Make"
          value={staged.make || "All"}
          options={filterOptions.makes}
          onChange={(v) => setStagedFilter("make", v)}
        />

        {/* Claim Status */}
        <FilterSelect
          label="Claim Status"
          value={staged.claim_status || "All"}
          options={filterOptions.claimStatuses}
          onChange={(v) => setStagedFilter("claim_status", v)}
        />
      </div>

      {/* Apply Button */}
      <div className="p-4 border-t border-border bg-muted/10 space-y-2">
        <button
          onClick={handleApply}
          disabled={!hasUnappliedChanges}
          className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
            hasUnappliedChanges
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          <Check size={14} />
          Apply Filters
          {hasUnappliedChanges && (
            <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
          )}
        </button>
        {stagedFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="w-full py-2 rounded-xl text-xs font-medium text-destructive bg-destructive/5 hover:bg-destructive/10 border border-destructive/20 transition-colors"
          >
            Reset All Filters
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── Reusable Filter Select ─────────────────────────────

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[] | { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
      >
        <option value="All">All {label}s</option>
        {options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}
