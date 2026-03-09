import React, { useState, useEffect } from 'react';

interface DataSourceSettings {
  staff: boolean;      // Staff MockData ON/OFF
  trainee: boolean;    // Trainee MockData ON/OFF
  staffDb: boolean;    // Staff Database ON/OFF
  traineeDb: boolean;  // Trainee Database ON/OFF
}

interface DataSourcesSettingsProps {
  onShowSuccess: (message: string) => void;
  onSettingsChanged?: () => void;
}

const DataSourcesSettings: React.FC<DataSourcesSettingsProps> = ({ onShowSuccess, onSettingsChanged }) => {
  const [settings, setSettings] = useState<DataSourceSettings>({
    staff: true,
    trainee: true,
    staffDb: true,
    traineeDb: true,
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
          staffDb: parsed.staffDb !== false,
          traineeDb: parsed.traineeDb !== false,
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
      const labels: Record<keyof DataSourceSettings, string> = {
        staff: 'Staff MockData',
        trainee: 'Trainee MockData',
        staffDb: 'Staff Database',
        traineeDb: 'Trainee Database',
      };
      const state = newSettings[key] ? 'enabled' : 'disabled';
      onShowSuccess(`${labels[key]} ${state}. Reload the app to apply changes.`);
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

  const ToggleRow: React.FC<{
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    iconBg: string;
    iconColor: string;
    labelColor: string;
    icon: React.ReactNode;
  }> = ({ label, description, enabled, onToggle, iconBg, iconColor, labelColor, icon }) => (
    <div className="flex items-center justify-between p-4 bg-gray-700/40 rounded-lg border border-gray-600">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${iconColor}`} viewBox="0 0 20 20" fill="currentColor">
              {icon}
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold">{label}</p>
            <p className="text-gray-400 text-xs mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3 ml-4">
        <span className={`text-xs font-medium ${enabled ? labelColor : 'text-gray-500'}`}>
          {enabled ? 'ON' : 'OFF'}
        </span>
        <Toggle enabled={enabled} onToggle={onToggle} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-800/80 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-sky-400">Data Sources</h3>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Control which data sources are active. Changes take effect on next app reload.
          </p>
        </div>

        <div className="p-6 space-y-6">

          {/* Section: Database */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Database Records</p>
            <div className="space-y-3">

              <ToggleRow
                label="Staff Database"
                description={settings.staffDb ? 'Real staff records are loaded from the database' : 'Database staff records are skipped — MockData only'}
                enabled={settings.staffDb}
                onToggle={() => handleToggle('staffDb')}
                iconBg="bg-green-900/50"
                iconColor="text-green-400"
                labelColor="text-green-400"
                icon={<path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />}
              />

              <ToggleRow
                label="Trainee Database"
                description={settings.traineeDb ? 'Real trainee records are loaded from the database' : 'Database trainee records are skipped — MockData only'}
                enabled={settings.traineeDb}
                onToggle={() => handleToggle('traineeDb')}
                iconBg="bg-teal-900/50"
                iconColor="text-teal-400"
                labelColor="text-teal-400"
                icon={<path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />}
              />

            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700" />

          {/* Section: MockData */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">MockData</p>
            <div className="space-y-3">

              <ToggleRow
                label="Staff MockData"
                description={settings.staff ? 'Mock staff records are merged with database staff' : 'Mock staff records are excluded'}
                enabled={settings.staff}
                onToggle={() => handleToggle('staff')}
                iconBg="bg-sky-900/50"
                iconColor="text-sky-400"
                labelColor="text-sky-400"
                icon={<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />}
              />

              <ToggleRow
                label="Trainee MockData"
                description={settings.trainee ? 'Mock trainee records are merged with database trainees' : 'Mock trainee records are excluded'}
                enabled={settings.trainee}
                onToggle={() => handleToggle('trainee')}
                iconBg="bg-indigo-900/50"
                iconColor="text-indigo-400"
                labelColor="text-indigo-400"
                icon={<path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />}
              />

            </div>
          </div>

          {/* Current state summary */}
          <div className="p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Current Configuration</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${settings.staffDb ? 'bg-green-400' : 'bg-gray-600'}`} />
                <span className="text-gray-300">Staff DB: <span className={settings.staffDb ? 'text-green-400' : 'text-gray-500'}>{settings.staffDb ? 'ON' : 'OFF'}</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${settings.traineeDb ? 'bg-teal-400' : 'bg-gray-600'}`} />
                <span className="text-gray-300">Trainee DB: <span className={settings.traineeDb ? 'text-teal-400' : 'text-gray-500'}>{settings.traineeDb ? 'ON' : 'OFF'}</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${settings.staff ? 'bg-sky-400' : 'bg-gray-600'}`} />
                <span className="text-gray-300">Staff Mock: <span className={settings.staff ? 'text-sky-400' : 'text-gray-500'}>{settings.staff ? 'ON' : 'OFF'}</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${settings.trainee ? 'bg-indigo-400' : 'bg-gray-600'}`} />
                <span className="text-gray-300">Trainee Mock: <span className={settings.trainee ? 'text-indigo-400' : 'text-gray-500'}>{settings.trainee ? 'ON' : 'OFF'}</span></span>
              </div>
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
                  To use MockData only: turn DB OFF and MockData ON. To use Database only: turn MockData OFF and DB ON.
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