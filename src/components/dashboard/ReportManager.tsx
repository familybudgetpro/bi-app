import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Plus, X, Layout, MoreHorizontal, Pencil } from "lucide-react";
import { useDashboardState } from "@/hooks/useDashboardState";
// import { GridLayout } from "./GridLayout"; // Replaced with dynamic below
import { WidgetCard } from "./widgets/WidgetCard";

const GridLayout = dynamic(
  () => import("./GridLayout").then((mod) => mod.GridLayout),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center text-muted-foreground">
        Loading Layout...
      </div>
    ),
  },
);

// Widget Registry (Mapping types to render logic)
// In a real app, this might be dynamic. For now, we pass a render prop or similar.
interface ReportManagerProps {
  isEditing: boolean;
  dashboardState: ReturnType<typeof useDashboardState>;
  renderWidget: (type: string, config?: any) => React.ReactNode;
}

export function ReportManager({
  isEditing,
  dashboardState,
  renderWidget,
}: ReportManagerProps) {
  const {
    pages,
    activePageId,
    setActivePageId,
    addPage,
    renamePage,
    removePage,
    updatePageLayout,
    removeWidgetFromPage,
  } = dashboardState;
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState("");

  const activePage = pages.find((p) => p.id === activePageId);

  const startRenaming = (pageId: string, currentTitle: string) => {
    setEditingTitleId(pageId);
    setTempTitle(currentTitle);
  };

  const finishRenaming = () => {
    if (editingTitleId && tempTitle.trim()) {
      renamePage(editingTitleId, tempTitle);
    }
    setEditingTitleId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Pages Tab Bar */}
      <div className="flex items-center gap-1 px-4 border-b border-border bg-muted/20 shrink-0 h-10 overflow-x-auto scrollbar-none">
        {pages.map((page) => (
          <div
            key={page.id}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all ${
              activePageId === page.id
                ? "bg-background text-primary border-t-2 border-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => setActivePageId(page.id)}
          >
            {editingTitleId === page.id ? (
              <input
                autoFocus
                className="bg-transparent border-none outline-none w-24"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={finishRenaming}
                onKeyDown={(e) => e.key === "Enter" && finishRenaming()}
              />
            ) : (
              <span
                onDoubleClick={() =>
                  isEditing && startRenaming(page.id, page.title)
                }
              >
                {page.title}
              </span>
            )}

            {isEditing && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRenaming(page.id, page.title);
                  }}
                  className="hover:text-primary"
                >
                  <Pencil size={10} />
                </button>
                {pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePage(page.id);
                    }}
                    className="hover:text-destructive"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {isEditing && (
          <button
            onClick={() => addPage("New Page")}
            className="ml-1 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Canvas Area */}
      <div
        id="report-canvas"
        className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/10 p-4 relative scrollbar-thin scrollbar-thumb-muted-foreground/20"
      >
        {activePage && (
          <GridLayout
            key={activePage.id} // Force remount on page switch for correct RGL init
            widgets={activePage.widgets}
            layouts={activePage.layouts}
            isEditing={isEditing}
            onLayoutChange={(l) => updatePageLayout(activePage.id, l)}
          >
            {activePage.widgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                id={widget.id}
                title={widget.title}
                isEditing={isEditing}
                onRemove={() => removeWidgetFromPage(activePage.id, widget.id)}
                className="h-full"
              >
                {renderWidget(widget.type, widget.config)}
              </WidgetCard>
            ))}
          </GridLayout>
        )}

        {activePage?.widgets.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <Layout size={48} className="mb-4" />
            <p>Empty Page</p>
            {isEditing && (
              <p className="text-xs">Drag widgets here from the gallery</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
