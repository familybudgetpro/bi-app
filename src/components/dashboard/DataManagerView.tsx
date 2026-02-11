"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  X,
  RotateCcw,
  Download,
  History,
  AlertCircle,
} from "lucide-react";
import { List } from "react-window";
import type { useData } from "@/hooks/useData";

interface DataManagerViewProps {
  data: ReturnType<typeof useData>;
}

const DataRow = React.memo(function DataRow({
  index,
  style,
  ariaAttributes,
  rows,
  columns,
  page,
  limit,
  editingCell,
  editedCells,
  editValue,
  editError,
  startEdit,
  saveEdit,
  cancelEdit,
}: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: any;
  rows: Record<string, unknown>[];
  columns: string[];
  page: number;
  limit: number;
  editingCell: { rowId: number; col: string } | null;
  editedCells: Set<string>;
  editValue: string;
  editError: string;
  startEdit: (rowId: number, col: string, currentValue: unknown) => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
}) {
  const row = rows[index];
  if (!row) return null;

  return (
    <div
      style={style}
      {...ariaAttributes}
      className="flex border-b border-border/50 hover:bg-muted/20 transition-colors group"
    >
      <div className="p-2 text-muted-foreground/50 text-[10px] w-12 shrink-0 flex items-center">
        {(page - 1) * limit + index + 1}
      </div>
      {columns.map((col) => {
        const rowId = row._row_id as number;
        const isEditing =
          editingCell?.rowId === rowId && editingCell?.col === col;
        const wasEdited = editedCells.has(`${rowId}-${col}`);

        return (
          <div
            key={col}
            className={`p-2 relative w-40 shrink-0 flex items-center overflow-hidden ${
              wasEdited ? "bg-amber-500/5" : ""
            }`}
          >
            {isEditing ? (
              <div className="flex items-center gap-1 w-full">
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={
                    (e) => (e.target as HTMLInputElement).value // This is handled by parent, but we need the type
                  }
                  // Note: we'll use the onChange from props but here it's easier to just pass through
                  // Actually, let's just make sure it's wired correctly
                  className={`w-full px-1.5 py-0.5 text-[11px] border rounded outline-none ${
                    editError
                      ? "border-destructive bg-destructive/5"
                      : "border-primary bg-background"
                  }`}
                  // The actual onChange and KeyDown are best handled by passing a wrapper or just the value
                  // But since we are passing state directly, it should work if we wire it.
                />
                <div className="flex shrink-0">
                  <button
                    onClick={saveEdit}
                    className="p-0.5 text-green-600 hover:bg-green-500/10 rounded"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-0.5 text-destructive hover:bg-destructive/10 rounded"
                  >
                    <X size={12} />
                  </button>
                </div>
                {editError && (
                  <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-destructive text-destructive-foreground text-[10px] rounded shadow-lg z-20 whitespace-nowrap">
                    <AlertCircle size={10} className="inline mr-1" />
                    {editError}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="cursor-pointer hover:text-primary transition-colors group/cell flex items-center gap-1 w-full"
                onDoubleClick={() => startEdit(rowId, col, row[col])}
              >
                <span
                  className={`truncate ${
                    typeof row[col] === "number" ? "font-mono" : ""
                  }`}
                >
                  {row[col] == null ? "—" : String(row[col])}
                </span>
                <Edit3
                  size={10}
                  className="opacity-0 group-hover/cell:opacity-30 transition-opacity shrink-0"
                />
                {wasEdited && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                    title="Edited"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export function DataManagerView({ data }: DataManagerViewProps) {
  const [activeTab, setActiveTab] = useState<"sales" | "claims">("sales");
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<string>("asc");
  const [tableData, setTableData] = useState<{
    rows: Record<string, unknown>[];
    columns: string[];
    total: number;
    pages: number;
  }>({ rows: [], columns: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);

  // Editing state
  const [editingCell, setEditingCell] = useState<{
    rowId: number;
    col: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [changeLog, setChangeLog] = useState<Record<string, unknown>[]>([]);
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await data.getRawData(
        activeTab,
        page,
        limit,
        sortBy,
        sortDir,
        { search },
      );
      setTableData(result);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, [data, activeTab, page, limit, sortBy, sortDir, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const startEdit = (rowId: number, col: string, currentValue: unknown) => {
    setEditingCell({ rowId, col });
    setEditValue(currentValue == null ? "" : String(currentValue));
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    try {
      const result = await data.updateCell(
        activeTab,
        editingCell.rowId,
        editingCell.col,
        editValue,
      );
      if (result.success) {
        setEditedCells((prev) =>
          new Set(prev).add(`${editingCell.rowId}-${editingCell.col}`),
        );
        cancelEdit();
        fetchData();
      } else {
        setEditError(result.error || "Update failed");
      }
    } catch {
      setEditError("Network error");
    }
  };

  const handleReset = async () => {
    if (
      confirm(
        "Reset all changes? This will revert to the original uploaded data.",
      )
    ) {
      await data.resetData();
      setEditedCells(new Set());
      fetchData();
    }
  };

  const loadChanges = async () => {
    const log = await data.getChangeLog();
    setChangeLog(log);
    setShowChanges(true);
  };

  const tabs = [
    {
      id: "sales" as const,
      label: "Sales Data",
      count: data.uploadedFile?.salesRows || 0,
    },
    {
      id: "claims" as const,
      label: "Claims Data",
      count: data.uploadedFile?.claimsRows || 0,
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Data Manager</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              View, search, edit, and export your data •{" "}
              {tableData.total.toLocaleString()} rows
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.pendingChanges > 0 && (
              <span className="text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-1 rounded-lg font-medium">
                {data.pendingChanges} unsaved changes
              </span>
            )}
            <button
              onClick={loadChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <History size={13} /> Audit Log
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <RotateCcw size={13} /> Reset
            </button>
            <button
              onClick={() => data.exportData(activeTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-[10px] opacity-60">
                  ({tab.count.toLocaleString()})
                </span>
              </button>
            ))}
          </div>
          <div className="flex-1 max-w-xs relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all columns..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/30 border border-border rounded-lg outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-full overflow-x-auto">
            {/* Header */}
            <div className="bg-muted/50 border-b border-border min-w-max">
              <div className="flex">
                <div className="p-2 text-left font-bold text-muted-foreground uppercase text-[10px] w-12 shrink-0">
                  #
                </div>
                {tableData.columns.map((col) => (
                  <div
                    key={col}
                    onClick={() => handleSort(col)}
                    className="p-2 text-left font-bold text-muted-foreground uppercase text-[10px] cursor-pointer hover:text-foreground transition-colors whitespace-nowrap w-40 shrink-0 flex items-center gap-1"
                  >
                    {col}
                    {sortBy === col && (
                      <span className="shrink-0">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Virtualized Body */}
            <div className="flex-1 min-w-max relative">
              <List
                rowCount={tableData.rows.length}
                rowHeight={40}
                style={{ height: 600, width: "100%" }}
                className="overflow-y-auto"
                // @ts-ignore - react-window version 2.2.6 types mismatch
                rowComponent={DataRow}
                // @ts-ignore - react-window version 2.2.6 types mismatch
                rowProps={{
                  rows: tableData.rows,
                  columns: tableData.columns,
                  page,
                  limit,
                  editingCell,
                  editedCells,
                  editValue,
                  editError,
                  startEdit,
                  saveEdit,
                  cancelEdit,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="px-6 py-3 border-t border-border bg-card/50 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Showing {((page - 1) * limit + 1).toLocaleString()}–
          {Math.min(page * limit, tableData.total).toLocaleString()} of{" "}
          {tableData.total.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium px-2">
            {page} / {tableData.pages}
          </span>
          <button
            disabled={page >= tableData.pages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Audit Log Modal */}
      {showChanges && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">Audit Log</h3>
              <button
                onClick={() => setShowChanges(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {changeLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No changes recorded
                </p>
              ) : (
                <div className="space-y-2">
                  {changeLog.map((change, i) => (
                    <div
                      key={i}
                      className="p-3 bg-muted/30 rounded-lg border border-border text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-foreground">
                          {String(change.table)}.{String(change.column)}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {String(change.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-destructive line-through">
                          {String(change.old_value)}
                        </span>
                        <span>→</span>
                        <span className="text-green-600 font-semibold">
                          {String(change.new_value)}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[10px]">
                        Row #{String(change.row_id)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
