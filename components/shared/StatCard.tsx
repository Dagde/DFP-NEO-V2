import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description }) => (
  <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 flex flex-col">
    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
    <p className="mt-2 text-4xl font-bold text-white">{value}</p>
    {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
  </div>
);

export default StatCard;