'use client';

// Authentication removed - app loads independently
// Authentication is now handled by DFP-NEO-Website

export default function FlightSchoolPage() {
  // No authentication check - load app directly
  return (
    <div className="min-h-screen bg-black">
      <iframe
        src="/flight-school-app/index-v2.html"
        className="w-full h-screen border-0"
        title="DFP-NEO Flight School"
      />
    </div>
  );
}