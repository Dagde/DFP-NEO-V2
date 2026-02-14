import React from 'react';

interface TimeDistribution {
  eventsByHour: Map<number, number>;
  clusteringScore: number;
  uniformityScore: number;
}

interface TimeDistributionChartProps {
  timeDistribution: TimeDistribution;
}

const TimeDistributionChart: React.FC<TimeDistributionChartProps> = ({ timeDistribution }) => {
  // Convert eventsByHour to Map if it's not already (handles serialization)
  const eventsByHour = timeDistribution.eventsByHour instanceof Map 
    ? timeDistribution.eventsByHour 
    : new Map(Object.entries(timeDistribution.eventsByHour as any).map(([k, v]) => [parseInt(k), v as number]));
  
  const maxEvents = Math.max(...Array.from(eventsByHour.values()), 0);
  const hours = Array.from({ length: 24 }, (_, i) => i).filter(hour => eventsByHour.get(hour) && eventsByHour.get(hour)! > 0);
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-sky-400 mb-4">Time Distribution</h2>
      <p className="text-gray-400 mb-4">
        Uniformity Score: <span className="text-sky-400 font-semibold">{(timeDistribution.uniformityScore * 100).toFixed(0)}%</span>
      </p>
      <div className="relative h-64 flex items-end justify-start gap-2 px-4">
        {hours.map((hour) => {
          const count = eventsByHour.get(hour) || 0;
          const heightPercent = maxEvents > 0 ? (count / maxEvents) * 100 : 0;
          const heightPx = maxEvents > 0 ? (count / maxEvents) * 240 : 0; // 240px = h-60
          
          return (
            <div key={hour} className="flex flex-col items-center justify-end flex-1 min-w-[40px]">
              <div 
                className="w-full bg-sky-500 rounded-t transition-all hover:bg-sky-400 flex items-start justify-center"
                style={{ height: `${heightPx}px`, minHeight: '30px' }}
                title={`${hour.toString().padStart(2, '0')}:00 - ${count} events`}
              >
                <div className="text-xs text-white font-semibold pt-1">{count}</div>
              </div>
              <div className="text-xs text-gray-400 mt-1">{hour.toString().padStart(2, '0')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimeDistributionChart;