import React, { useState, useRef } from "react";
import { MoreVertical, X, Image, FileText, Move } from "lucide-react";
import { exportDashboardToPDF } from "@/lib/ExportManager";

interface WidgetCardProps {
  id: string;
  title: string;
  children: React.ReactNode;
  isEditing: boolean;
  onRemove?: () => void;
  className?: string;
}

export function WidgetCard({
  id,
  title,
  children,
  isEditing,
  onRemove,
  className = "",
}: WidgetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExport = (type: "pdf" | "image") => {
    if (cardRef.current) {
      exportDashboardToPDF(
        cardRef.current,
        `Widget-${title.replace(/\s+/g, "-")}`,
      );
    }
    setMenuOpen(false);
  };

  return (
    <div
      ref={cardRef}
      className={`bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden transition-shadow hover:shadow-md ${className}`}
    >
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/10">
        <h3 className="font-semibold text-sm text-foreground truncate">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <div
                className="drag-handle cursor-move p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors border border-dashed border-border/50"
                title="Drag to reposition"
              >
                <Move size={14} />
              </div>
              <button
                onClick={onRemove}
                className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground transition-colors"
                title="Remove Widget"
              >
                <X size={14} />
              </button>
            </>
          )}
          {!isEditing && (
            <button
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreVertical size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-0 bg-background/40">
        <div className="absolute inset-0 p-3">{children}</div>

        {/* Export Menu Overlay */}
        {menuOpen && (
          <div className="absolute top-0 right-0 m-2 w-32 bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in-95">
            <button
              onClick={() => handleExport("pdf")}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted text-popover-foreground flex items-center gap-2"
            >
              <FileText size={12} /> Save as PDF
            </button>
            <button
              onClick={() => handleExport("image")}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted text-popover-foreground flex items-center gap-2"
            >
              <Image size={12} /> Save as Image
            </button>
          </div>
        )}

        {menuOpen && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
