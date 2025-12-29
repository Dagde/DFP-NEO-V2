import React, { useState, useEffect, useRef } from 'react';
import { ScheduleEvent } from '../types';

interface VisualAdjustGuideProps {
    event: ScheduleEvent;
    onTimeChange: (startTime: number, endTime: number) => void;
    scheduleStartHour?: number;
    scheduleEndHour?: number;
}

export const VisualAdjustGuide: React.FC<VisualAdjustGuideProps> = ({
    event,
    onTimeChange,
    scheduleStartHour = 0,
    scheduleEndHour = 24
}) => {
    const [isDraggingStart, setIsDraggingStart] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);
    const [currentStartTime, setCurrentStartTime] = useState(event.startTime);
    const [currentEndTime, setCurrentEndTime] = useState(event.startTime + event.duration);
    const containerRef = useRef<HTMLDivElement>(null);

    const scheduleHours = scheduleEndHour - scheduleStartHour;
    
    // Calculate pixel position from time
    const timeToPixels = (time: number): number => {
        if (!containerRef.current) return 0;
        const containerWidth = containerRef.current.offsetWidth;
        const relativeTime = time - scheduleStartHour;
        return (relativeTime / scheduleHours) * containerWidth;
    };

    // Calculate time from pixel position
    const pixelsToTime = (pixels: number): number => {
        if (!containerRef.current) return scheduleStartHour;
        const containerWidth = containerRef.current.offsetWidth;
        const relativeTime = (pixels / containerWidth) * scheduleHours;
        const time = scheduleStartHour + relativeTime;
        // Round to nearest 0.25 (15 minutes)
        return Math.round(time * 4) / 4;
    };

    const handleMouseDown = (isStart: boolean) => (e: React.MouseEvent) => {
        e.preventDefault();
        if (isStart) {
            setIsDraggingStart(true);
        } else {
            setIsDraggingEnd(true);
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current || (!isDraggingStart && !isDraggingEnd)) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newTime = pixelsToTime(x);

        if (isDraggingStart) {
            // Don't allow start time to go past end time
            if (newTime < currentEndTime) {
                setCurrentStartTime(newTime);
                onTimeChange(newTime, currentEndTime);
            }
        } else if (isDraggingEnd) {
            // Don't allow end time to go before start time
            if (newTime > currentStartTime) {
                setCurrentEndTime(newTime);
                onTimeChange(currentStartTime, newTime);
            }
        }
    };

    const handleMouseUp = () => {
        setIsDraggingStart(false);
        setIsDraggingEnd(false);
    };

    useEffect(() => {
        if (isDraggingStart || isDraggingEnd) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDraggingStart, isDraggingEnd, currentStartTime, currentEndTime]);

    const startX = timeToPixels(currentStartTime);
    const endX = timeToPixels(currentEndTime);

    return (
        <div 
            ref={containerRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1000 }}
        >
            {/* Start time vertical line */}
            <div
                className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-blue-500 pointer-events-auto cursor-ew-resize"
                style={{ left: `${startX}px` }}
                onMouseDown={handleMouseDown(true)}
            >
                {/* Drag handle at top */}
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-500 rounded-full cursor-ew-resize" />
                {/* Drag handle at bottom */}
                <div className="absolute -bottom-1 -left-2 w-4 h-4 bg-blue-500 rounded-full cursor-ew-resize" />
            </div>

            {/* End time vertical line */}
            <div
                className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-red-500 pointer-events-auto cursor-ew-resize"
                style={{ left: `${endX}px` }}
                onMouseDown={handleMouseDown(false)}
            >
                {/* Drag handle at top */}
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-red-500 rounded-full cursor-ew-resize" />
                {/* Drag handle at bottom */}
                <div className="absolute -bottom-1 -left-2 w-4 h-4 bg-red-500 rounded-full cursor-ew-resize" />
            </div>

            {/* Shaded area between lines */}
            <div
                className="absolute top-0 bottom-0 bg-purple-500/20 pointer-events-none"
                style={{
                    left: `${startX}px`,
                    width: `${endX - startX}px`
                }}
            />
        </div>
    );
};