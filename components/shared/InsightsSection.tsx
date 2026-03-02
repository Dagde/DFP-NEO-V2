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
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-sky-400 mb-4">Insights & Recommendations</h2>
      <div className="space-y-4">
        {insights.map((insight, index) => {
          const bgColor = insight.type === 'success' ? 'bg-green-900/20 border-green-700' :
                         insight.type === 'warning' ? 'bg-amber-900/20 border-amber-700' :
                         insight.type === 'error' ? 'bg-red-900/20 border-red-700' :
                         'bg-blue-900/20 border-blue-700';
          
          const textColor = insight.type === 'success' ? 'text-green-400' :
                           insight.type === 'warning' ? 'text-amber-400' :
                           insight.type === 'error' ? 'text-red-400' :
                           'text-blue-400';
          
          const icon = insight.type === 'success' ? '✓' :
                      insight.type === 'warning' ? '⚠' :
                      insight.type === 'error' ? '✗' : 'ℹ';
          
          return (
            <div key={index} className={`border rounded-lg p-4 ${bgColor}`}>
              <h4 className={`font-semibold mb-2 flex items-center ${textColor}`}>
                <span className="mr-2">{icon}</span> {insight.message}
              </h4>
              {insight.recommendation && (
                <p className="text-gray-300 text-sm">
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