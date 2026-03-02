import React from 'react';

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  title: string;
}

const PieChart: React.FC<PieChartProps> = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-sky-400 mb-4">{title}</h2>
        <p className="text-gray-400 text-center py-8">No data available</p>
      </div>
    );
  }
  
  let currentAngle = -90; // Start from top
  const segments = data.map(item => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const segment = {
      ...item,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + angle
    };
    currentAngle += angle;
    return segment;
  });
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-sky-400 mb-4">{title}</h2>
      <div className="flex items-center justify-center gap-8">
        {/* Pie Chart SVG */}
        <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
          {segments.map((segment, index) => {
            const startAngle = (segment.startAngle * Math.PI) / 180;
            const endAngle = (segment.endAngle * Math.PI) / 180;
            const x1 = 100 + 90 * Math.cos(startAngle);
            const y1 = 100 + 90 * Math.sin(startAngle);
            const x2 = 100 + 90 * Math.cos(endAngle);
            const y2 = 100 + 90 * Math.sin(endAngle);
            const largeArc = segment.percentage > 50 ? 1 : 0;
            
            return (
              <g key={index}>
                <path
                  d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={segment.color}
                  stroke="#1f2937"
                  strokeWidth="2"
                  className="hover:opacity-80 transition-opacity"
                >
                  <title>{`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}</title>
                </path>
              </g>
            );
          })}
        </svg>
        
        {/* Legend */}
        <div className="space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-gray-300">
                {segment.label}: <span className="font-semibold text-white">{segment.value}</span>
                <span className="text-gray-500 ml-1">({segment.percentage.toFixed(1)}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChart;