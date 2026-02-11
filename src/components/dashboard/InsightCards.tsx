import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  TrendingUp,
  Info,
  CheckCircle2,
} from "lucide-react";

interface Insight {
  type: "warning" | "danger" | "success" | "info" | "forecast";
  title: string;
  description: string;
  metric: string;
  trend: "up" | "down" | "neutral";
}

interface InsightCardsProps {
  insights: Insight[];
  isLoading: boolean;
}

export function InsightCards({ insights, isLoading }: InsightCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-muted/20 rounded-xl border border-border/50"
          />
        ))}
      </div>
    );
  }

  if (!insights || insights.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="text-amber-500" size={20} />;
      case "danger":
        return <AlertTriangle className="text-red-500" size={20} />;
      case "success":
        return <CheckCircle2 className="text-green-500" size={20} />;
      case "forecast":
        return <TrendingUp className="text-blue-500" size={20} />;
      default:
        return <Info className="text-blue-400" size={20} />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "warning":
        return "bg-amber-500/10 border-amber-500/20";
      case "danger":
        return "bg-red-500/10 border-red-500/20";
      case "success":
        return "bg-green-500/10 border-green-500/20";
      case "forecast":
        return "bg-blue-500/10 border-blue-500/20";
      default:
        return "bg-card border-border";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {insights.map((insight, idx) => (
        <div
          key={idx}
          className={`p-4 rounded-xl border flex flex-col justify-between ${getBgColor(insight.type)} transition-all hover:shadow-md`}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              {getIcon(insight.type)}
              <h3 className="font-semibold text-sm opacity-90">
                {insight.title}
              </h3>
            </div>
            {insight.trend !== "neutral" && (
              <div
                className={`flex items-center text-xs font-bold ${insight.trend === "up" ? "text-green-600" : "text-red-500"}`}
              >
                {insight.trend === "up" ? (
                  <ArrowUp size={14} />
                ) : (
                  <ArrowDown size={14} />
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-2xl font-bold mb-1">{insight.metric}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {insight.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
