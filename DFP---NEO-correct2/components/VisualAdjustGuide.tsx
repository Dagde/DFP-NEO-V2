import React, { useState, useEffect, useRef } from 'react';
import { ScheduleEvent } from '../types';

interface VisualAdjustGuideProps {
    event: ScheduleEvent;
    onTimeChange: (startTime: number, endTime: number) => void;
    scheduleStartHour?: number;
    scheduleEndHour?: number;
    pixelsPerHour?: number;
    totalWidth?: number;
}

export const VisualAdjustGuide: React.FC<VisualAdjustGuideProps> = ({
    event,
    onTimeChange,
    scheduleStartHour = 0,
    scheduleEndHour = 24,
    pixelsPerHour = 200,
    totalWidth
}) => {
    console.log('VisualAdjustGuide rendered with event:', event);
    console.log('pixelsPerHour:', pixelsPerHour);
    
    const [isDraggingStart, setIsDraggingStart] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);
    const [currentStartTime, setCurrentStartTime] = useState(event.startTime);
    const [currentEndTime, setCurrentEndTime] = useState(event.startTime + event.duration);
    const containerRef = useRef<HTMLDivElement>(null);

    const scheduleHours = scheduleEndHour - scheduleStartHour;
    
    // Calculate pixel position from time
    const timeToPixels = (time: number): number => {
        const relativeTime = time - scheduleStartHour;
        return relativeTime * pixelsPerHour;
    };

    // Calculate time from pixel position
    const pixelsToTime = (pixels: number): number => {
        const relativeTime = pixels / pixelsPerHour;
        const time = scheduleStartHour + relativeTime;
        // Round to nearest 5 minutes (5/60 = 0.0833... hours, so multiply by 12)
        return Math.round(time * 12) / 12;
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
    
    console.log('Guide positions - startX:', startX, 'endX:', endX);
    console.log('Current times - start:', currentStartTime, 'end:', currentEndTime);

    return (
        <div 
            ref={containerRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 100 }}
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