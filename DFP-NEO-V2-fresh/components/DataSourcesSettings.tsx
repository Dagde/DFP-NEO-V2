import React, { useState, useEffect } from 'react';

interface DataSourceSettings {
  staff: boolean;
  trainee: boolean;
}

interface DataSourcesSettingsProps {
  onShowSuccess: (message: string) => void;
  onSettingsChanged?: () => void;
}

const DataSourcesSettings: React.FC<DataSourcesSettingsProps> = ({ onShowSuccess, onSettingsChanged }) => {
  const [settings, setSettings] = useState<DataSourceSettings>({
    staff: true,
    trainee: true,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dataSourceSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          staff: parsed.staff !== false,
          trainee: parsed.trainee !== false,
        });
      }
    } catch (e) {
      console.warn('Could not read dataSourceSettings from localStorage');
    }
  }, []);

  const handleToggle = (key: keyof DataSourceSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);

    try {
      localStorage.setItem('dataSourceSettings', JSON.stringify(newSettings));
      const label = key === 'staff' ? 'Staff MockData' : 'Trainee MockData';
      const state = newSettings[key] ? 'enabled' : 'disabled';
      onShowSuccess(`${label} ${state}. Reload the app to apply changes.`);
      if (onSettingsChanged) onSettingsChanged();
    } catch (e) {
      console.error('Could not save dataSourceSettings to localStorage');
    }
  };

  const Toggle: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        enabled ? 'bg-sky-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-800/80 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-sky-400">Data Sources</h3>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Control whether MockData is merged with real database records. Changes take effect on next app reload.
          </p>
        </div>

        <div className="p-6 space-y-6">

          {/* Staff MockData Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-700/40 rounded-lg border border-gray-600">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-sky-900/50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">Staff MockData</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {settings.staff
                      ? 'Mock staff records are merged with database staff'
                      : 'Only real database staff records are shown'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 ml-4">
              <span className={`text-xs font-medium ${settings.staff ? 'text-sky-400' : 'text-gray-500'}`}>
                {settings.staff ? 'ON' : 'OFF'}
              </span>
              <Toggle enabled={settings.staff} onToggle={() => handleToggle('staff')} />
            </div>
          </div>

          {/* Trainee MockData Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-700/40 rounded-lg border border-gray-600">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold">Trainee MockData</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {settings.trainee
                      ? 'Mock trainee records are merged with database trainees'
                      : 'Only real database trainee records are shown'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 ml-4">
              <span className={`text-xs font-medium ${settings.trainee ? 'text-indigo-400' : 'text-gray-500'}`}>
                {settings.trainee ? 'ON' : 'OFF'}
              </span>
              <Toggle enabled={settings.trainee} onToggle={() => handleToggle('trainee')} />
            </div>
          </div>

          {/* Info box */}
          <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-amber-300 text-sm font-semibold">Reload Required</p>
                <p className="text-amber-400/80 text-xs mt-1">
                  After toggling, reload the app (refresh the page) for changes to take effect. 
                  MockData OFF shows only real database records. MockData ON merges database + generated mock records.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DataSourcesSettings;