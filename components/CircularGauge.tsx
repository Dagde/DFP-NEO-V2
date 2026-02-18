import React from 'react';

interface CircularGaugeProps {
    value: number;
    maxValue?: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
}

const CircularGauge: React.FC<CircularGaugeProps> = ({
    value,
    maxValue = 100,
    size = 80,
    strokeWidth = 8,
    label
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min((value / maxValue) * 100, 100);
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#374151"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                    />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">{value.toFixed(1)}</span>
                </div>
            </div>
            {label && (
                <span className="text-gray-400 text-xs mt-2 text-center">{label}</span>
            )}
        </div>
    );
};

export default CircularGauge;