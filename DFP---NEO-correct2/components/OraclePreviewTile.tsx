import React from 'react';

interface OraclePreviewTileProps {
    startTime: number;
    duration: number;
    resourceId: string;
    instructorAvailable: boolean;
    traineeAvailable: boolean;
    pixelsPerHour: number;
    rowHeight: number;
    row: number;
    startHour: number;
}

const OraclePreviewTile: React.FC<OraclePreviewTileProps> = ({
    startTime,
    duration,
    instructorAvailable,
    traineeAvailable,
    pixelsPerHour,
    rowHeight,
    row,
    startHour
}) => {
    // Standard pre/post flight times for visualization
    const preFlightTime = 1.0;
    const postFlightTime = 0.5;

    const tileWidth = duration * pixelsPerHour;
    const preBarWidth = preFlightTime * pixelsPerHour;
    const postBarWidth = postFlightTime * pixelsPerHour;

    const tileStyle: React.CSSProperties = {
        left: `${(startTime - startHour) * pixelsPerHour}px`,
        top: `${row * rowHeight}px`,
        width: `${tileWidth}px`,
        height: `${rowHeight - 4}px`,
        marginTop: '2px',
    };

    return (
        <div style={tileStyle} className="absolute z-50 pointer-events-none">
            {/* Main Tile Body */}
            <div className="relative w-full h-full bg-sky-500/50 border-2 border-dashed border-sky-300 rounded-sm flex flex-col items-center justify-center p-1 shadow-lg">
                <div className={`w-full text-center rounded px-1 py-0.5 mb-0.5 ${instructorAvailable ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                    <span className="text-white text-xs font-bold tracking-wider">INSTRUCTOR</span>
                </div>
                <div className={`w-full text-center rounded px-1 py-0.5 ${traineeAvailable ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                    <span className="text-white text-xs font-bold tracking-wider">TRAINEE</span>
                </div>
            </div>

            {/* Turnaround Bars */}
            <div
                className="absolute top-1/2 -translate-y-1/2 h-1 bg-sky-300/40"
                style={{
                    left: `-${preBarWidth}px`,
                    width: `${preBarWidth}px`,
                }}
            />
            <div
                className="absolute top-1/2 -translate-y-1/2 h-1 bg-sky-300/40"
                style={{
                    right: `-${postBarWidth}px`,
                    width: `${postBarWidth}px`,
                }}
            />
        </div>
    );
};

export default OraclePreviewTile;
