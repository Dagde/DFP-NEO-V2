import React from 'react';
import { CurrencyDefinition } from '../types';

interface CurrencySetupFlyoutProps {
  onClose: () => void;
  allCurrencies: CurrencyDefinition[];
  visibleCurrencies: Set<string>;
  onVisibilityChange: (newSet: Set<string>) => void;
  personName: string;
}

export const CurrencySetupFlyout: React.FC<CurrencySetupFlyoutProps> = ({ onClose, allCurrencies, visibleCurrencies, onVisibilityChange, personName }) => {
    const handleToggle = (currencyName: string) => {
        const newSet = new Set(visibleCurrencies);
        if (newSet.has(currencyName)) {
            newSet.delete(currencyName);
        } else {
            newSet.add(currencyName);
        }
        onVisibilityChange(newSet);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700 flex flex-col h-auto max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Currency Visibility for {personName}</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300">Close</button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <p className="text-sm text-gray-400 mb-4">Select which currencies are visible on the main currency view for this person.</p>
                    <ul className="space-y-2">
                        {allCurrencies.map(currency => (
                            <li key={currency.id}>
                                <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={visibleCurrencies.has(currency.name)}
                                        onChange={() => handleToggle(currency.name)}
                                        className="h-4 w-4 accent-sky-500 bg-gray-600"
                                    />
                                    <span className="text-sm text-gray-300">{currency.name}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700">Done</button>
                </div>
            </div>
        </div>
    );
};