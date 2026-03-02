import React from 'react';
import { Trainee } from '../../types';

interface AvailabilityCardProps {
  title: string;
  trainees: Trainee[];
  color: string;
  bgColor: string;
  borderColor: string;
  hoverBgColor?: string;
  hoverBorderColor?: string;
  courseColors?: { [key: string]: string };
}

const AvailabilityCard: React.FC<AvailabilityCardProps> = ({ 
  title, 
  trainees, 
  color, 
  bgColor, 
  borderColor, 
  hoverBgColor = '', 
  hoverBorderColor = '', 
  courseColors = {} 
}) => {
  return (
    <div className={`${bgColor} ${hoverBgColor} ${borderColor} ${hoverBorderColor} rounded-lg p-4 border transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-lg font-semibold ${color} transition-colors`}>{title}</h3>
        <span className={`text-sm font-medium ${color} bg-gray-700/50 px-2 py-1 rounded-full`}>
          {trainees.length}
        </span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {trainees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm italic">No trainees in this category</p>
          </div>
        ) : (
          trainees.map(trainee => (
            <div 
              key={trainee.id} 
              className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md hover:bg-gray-600/60 transition-all duration-200 ease-in-out group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div 
                  className={`w-4 h-4 rounded-full transition-all duration-200 group-hover:scale-125 ${
                    courseColors[trainee.course] 
                      ? `border-2 border-gray-300` 
                      : `${color.replace('text-', 'bg-')}`
                  }`}
                  style={courseColors[trainee.course] ? { backgroundColor: courseColors[trainee.course] } : {}}
                ></div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium group-hover:text-gray-100 transition-colors">
                    {trainee.name}
                  </p>
                  <p className="text-gray-400 text-xs group-hover:text-gray-300 transition-colors">
                    {trainee.course} • {trainee.rank}
                  </p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AvailabilityCard;