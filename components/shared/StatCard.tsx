import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description }) => (
  <div className="flex flex-col rounded-lg border border-cyan-500/20 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h3>
    <p className="mt-2 whitespace-nowrap text-2xl font-bold text-white">{value}</p>
    {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
  </div>
);

export default StatCard;
