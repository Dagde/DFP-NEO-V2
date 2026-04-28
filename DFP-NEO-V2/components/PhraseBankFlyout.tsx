
import React, { useState } from 'react';
import { PhraseBank } from '../types';

interface PhraseBankFlyoutProps {
  onClose: () => void;
  phraseBank: PhraseBank;
  onUpdatePhraseBank: (newBank: PhraseBank) => void;
  initialDimension?: 'Airmanship' | 'Preparation' | 'Technique';
}

const PhraseBankFlyout: React.FC<PhraseBankFlyoutProps> = ({ onClose, phraseBank, onUpdatePhraseBank, initialDimension = 'Airmanship' }) => {
    const [activeMainTab, setActiveMainTab] = useState<'Core Dimensions' | 'Elements'>('Core Dimensions');
    const [activeDimension, setActiveDimension] = useState<'Airmanship' | 'Preparation' | 'Technique'>(initialDimension);
    
    const handlePhraseChange = (dimension: string, grade: number, index: number, value: string) => {
        onUpdatePhraseBank({
            ...phraseBank,
            [dimension]: {
                ...phraseBank[dimension],
                [grade]: phraseBank[dimension][grade].map((p, i) => i === index ? value : p)
            }
        });
    };

    const handleAddPhrase = (dimension: string, grade: number) => {
        onUpdatePhraseBank({
            ...phraseBank,
            [dimension]: {
                ...phraseBank[dimension],
                [grade]: [...phraseBank[dimension][grade], '']
            }
        });
    };

    const handleDeletePhrase = (dimension: string, grade: number, index: number) => {
        onUpdatePhraseBank({
            ...phraseBank,
            [dimension]: {
                ...phraseBank[dimension],
                [grade]: phraseBank[dimension][grade].filter((_, i) => i !== index)
            }
        });
    };

    const getGradeColor = (grade: number) => {
        if (grade >= 4) return 'border-green-500/30 bg-green-900/10';
        if (grade >= 2) return 'border-yellow-500/30 bg-yellow-900/10';
        return 'border-red-500/30 bg-red-900/10';
    };

    const getGradeLabel = (grade: number) => {
        switch(grade) {
            case 5: return '5 - Excellent';
            case 4: return '4 - High Satisfactory';
            case 3: return '3 - Satisfactory';
            case 2: return '2 - Low Satisfactory';
            case 1: return '1 - Marginal';
            case 0: return '0 - Unsatisfactory';
            default: return String(grade);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl border border-gray-700 flex flex-col h-[85vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-white">PT-051 Setup</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Main Navigation */}
                <div className="flex border-b border-gray-700 bg-gray-900/30 shrink-0">
                    <button
                        onClick={() => setActiveMainTab('Core Dimensions')}
                        className={`flex-1 py-3 text-lg font-semibold text-center border-b-4 transition-colors ${
                            activeMainTab === 'Core Dimensions' 
                                ? 'border-sky-500 text-sky-400 bg-gray-800' 
                                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                        }`}
                    >
                        Core Dimensions
                    </button>
                    <button
                        onClick={() => setActiveMainTab('Elements')}
                        className={`flex-1 py-3 text-lg font-semibold text-center border-b-4 transition-colors ${
                            activeMainTab === 'Elements' 
                                ? 'border-sky-500 text-sky-400 bg-gray-800' 
                                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                        }`}
                    >
                        Elements
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    {activeMainTab === 'Core Dimensions' ? (
                        <>
                            {/* Sidebar for Dimensions */}
                            <div className="w-48 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
                                {['Airmanship', 'Preparation', 'Technique'].map((dim) => (
                                    <button
                                        key={dim}
                                        onClick={() => setActiveDimension(dim as any)}
                                        className={`text-left px-4 py-3 border-l-4 transition-colors font-medium ${
                                            activeDimension === dim
                                                ? 'border-sky-500 bg-gray-700 text-white'
                                                : 'border-transparent text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                                        }`}
                                    >
                                        {dim}
                                    </button>
                                ))}
                            </div>

                            {/* Editable List Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900">
                                <div className="mb-4">
                                    <h3 className="text-2xl font-bold text-sky-400">{activeDimension}</h3>
                                    <p className="text-gray-400 text-sm">Define standardized phrases for each grade level.</p>
                                </div>
                                {[5, 4, 3, 2, 1, 0].map(grade => (
                                    <div key={grade} className={`border rounded-lg overflow-hidden ${getGradeColor(grade)}`}>
                                        <div className="px-4 py-2 font-bold text-sm border-b border-gray-700/30 flex justify-between items-center">
                                            <span className="text-white opacity-90">{getGradeLabel(grade)}</span>
                                            <button 
                                                onClick={() => handleAddPhrase(activeDimension, grade)}
                                                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors border border-gray-600"
                                            >
                                                + Add Phrase
                                            </button>
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {phraseBank[activeDimension]?.[grade]?.map((phrase, idx) => (
                                                <div key={idx} className="flex items-start space-x-2 group">
                                                    <textarea
                                                        value={phrase}
                                                        onChange={(e) => handlePhraseChange(activeDimension, grade, idx, e.target.value)}
                                                        rows={1}
                                                        className="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-sm text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none overflow-hidden"
                                                        style={{ minHeight: '38px', height: 'auto' }}
                                                        onInput={(e) => {
                                                            e.currentTarget.style.height = 'auto';
                                                            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={() => handleDeletePhrase(activeDimension, grade, idx)}
                                                        className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete phrase"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                            {(!phraseBank[activeDimension]?.[grade] || phraseBank[activeDimension][grade].length === 0) && (
                                                <p className="text-xs text-gray-500 italic pl-1">No phrases defined.</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 italic p-10 bg-gray-900">
                            <div>
                                <p className="text-lg mb-2">Element Setup</p>
                                <p className="text-sm">Configuration for individual flight elements will be available here.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-6 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PhraseBankFlyout;
