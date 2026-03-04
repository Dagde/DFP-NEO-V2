import React from 'react';

const App_debug: React.FC = () => {
  return (
    <div className="bg-gray-800 text-white min-h-screen p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Debug App - Basic Version</h1>
      <div className="max-w-4xl mx-auto">
        <div className="bg-green-600 p-6 rounded-lg mb-6">
          <h2 className="text-2xl mb-4">Status: Working! ✅</h2>
          <p>If you can see this page, the basic React setup is working correctly.</p>
          <p>The issue might be in the main App component or its dependencies.</p>
        </div>
        <div className="bg-blue-600 p-6 rounded-lg">
          <h3 className="text-xl mb-3">Next Steps:</h3>
          <ul className="list-disc list-inside space-y-2">
            <li>Check browser console for JavaScript errors</li>
            <li>Verify all imports are working</li>
            <li>Test with a minimal version of the main App</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default App_debug;