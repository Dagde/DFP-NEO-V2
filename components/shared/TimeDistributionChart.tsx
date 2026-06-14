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
  
  const chartMaxHeight = 180;

  return (
    <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
      <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Time Distribution</h2>
        <p className="mt-1 text-sm text-slate-400">
          Uniformity Score: <span className="font-semibold text-cyan-300">{(timeDistribution.uniformityScore * 100).toFixed(0)}%</span>
        </p>
      </div>
      <div className="px-5 py-5">
        <div className="relative flex h-56 items-end justify-start gap-2">
          {hours.map((hour) => {
            const count = eventsByHour.get(hour) || 0;
            const heightPx = maxEvents > 0 ? Math.max(28, (count / maxEvents) * chartMaxHeight) : 0;

            return (
              <div key={hour} className="flex h-full min-w-[40px] flex-1 flex-col items-center justify-end">
                <div
                  className="flex w-full items-start justify-center rounded-t bg-cyan-500 transition-all hover:bg-cyan-400"
                  style={{ height: `${heightPx}px` }}
                  title={`${hour.toString().padStart(2, '0')}:00 - ${count} events`}
                >
                  <div className="pt-1 text-xs font-semibold text-white">{count}</div>
                </div>
                <div className="mt-2 text-xs text-slate-400">{hour.toString().padStart(2, '0')}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimeDistributionChart;
