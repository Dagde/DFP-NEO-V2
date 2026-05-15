import React from 'react';

interface Insight {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  recommendation?: string;
}

interface InsightsSectionProps {
  insights: Insight[];
}

const InsightsSection: React.FC<InsightsSectionProps> = ({ insights }) => {
  return (
    <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
      <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Insights & Recommendations</h2>
      </div>
      <div className="space-y-4 p-5">
        {insights.map((insight, index) => {
          const bgColor = insight.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/40' :
                         insight.type === 'warning' ? 'bg-amber-500/10 border-amber-500/40' :
                         insight.type === 'error' ? 'bg-red-500/10 border-red-500/40' :
                         'bg-cyan-500/10 border-cyan-500/40';
          
          const textColor = insight.type === 'success' ? 'text-emerald-300' :
                           insight.type === 'warning' ? 'text-amber-300' :
                           insight.type === 'error' ? 'text-red-300' :
                           'text-cyan-300';
          
          const icon = insight.type === 'success' ? '✓' :
                      insight.type === 'warning' ? '⚠' :
                      insight.type === 'error' ? '✗' : 'ℹ';
          
          return (
            <div key={index} className={`border rounded-lg p-4 ${bgColor}`}>
              <h4 className={`font-semibold mb-2 flex items-center ${textColor}`}>
                <span className="mr-2">{icon}</span> {insight.message}
              </h4>
              {insight.recommendation && (
                <p className="text-slate-300 text-sm">
                  <strong>Recommendation:</strong> {insight.recommendation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InsightsSection;
