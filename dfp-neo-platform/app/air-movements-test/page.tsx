export default function AirMovementsTestPage() {
  return (
    <div className="min-h-screen bg-black">
      <iframe
        src="/flight-school-app/index-v2.html?setupTest=air-movements&resetSetupTest=1"
        className="w-full h-screen border-0"
        title="DFP-NEO Air Movements Test"
      />
    </div>
  );
}
