
import React, { useState } from 'react';
import { PhraseBank } from '../types';

interface ScoringMatrixFlyoutProps {
  onClose: () => void;
  phraseBank: PhraseBank;
  onUpdatePhraseBank: (newBank: PhraseBank) => void;
  initialTab?: 'Airmanship' | 'Preparation' | 'Technique' | 'Elements';
}

const INITIAL_ELEMENTS_LIST = [
    'Generic Flying Elements',
    'Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks',
    'Stationary', 'Visual', 'Effects of Control', 'Trimming', 'Straight and Level',
    'Level medium Turn', 'Level Steep turn', 'Visual - Initial & Pitch', 'Landing',
    'Crosswind', 'Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'
];

// Sub-component for the Add Element Flyout
const AddElementFlyout: React.FC<{
    onClose: () => void;
    onSave: (name: string) => void;
}> = ({ onClose, onSave }) => {
    const [name, setName] = useState('');

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Add New Flight Element</h2>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="element-name" className="block text-sm font-medium text-gray-400">Element Name</label>
                        <input
                            id="element-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                    <button onClick={handleSave} disabled={!name.trim()} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

// Sub-component for the Delete Element Flyout
const DeleteElementFlyout: React.FC<{
    onClose: () => void;
    onDelete: (elementsToDelete: Set<string>) => void;
    flightElements: string[];
}> = ({ onClose, onDelete, flightElements }) => {
    const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());

    const toggleSelection = (element: string) => {
        const newSet = new Set(selectedToDelete);
        if (newSet.has(element)) {
            newSet.delete(element);
        } else {
            newSet.add(element);
        }
        setSelectedToDelete(newSet);
    };

    const handleDelete = () => {
        if (selectedToDelete.size === 0) {
            alert("Please select at least one element to delete.");
            return;
        }
        onDelete(selectedToDelete);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Delete Flight Elements</h2>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {flightElements.length > 0 ? (
                        <ul className="space-y-2">
                            {flightElements.map(element => (
                                <li key={element}>
                                    <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedToDelete.has(element)}
                                            onChange={() => toggleSelection(element)}
                                            className="h-4 w-4 accent-red-500 bg-gray-600"
                                        />
                                        <span className="text-sm text-gray-300">{element}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-center italic">No elements to delete.</p>
                    )}
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                    <button onClick={handleDelete} disabled={selectedToDelete.size === 0} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Delete Selected
                    </button>
                </div>
            </div>
        </div>
    );
};


const ScoringMatrixFlyout: React.FC<ScoringMatrixFlyoutProps> = ({ onClose, phraseBank, onUpdatePhraseBank, initialTab = 'Airmanship' }) => {
    const [activeTab, setActiveTab] = useState<'Airmanship' | 'Preparation' | 'Technique' | 'Elements'>(initialTab);
    const [showAddElementFlyout, setShowAddElementFlyout] = useState(false);
    const [showDeleteElementFlyout, setShowDeleteElementFlyout] = useState(false);
    
    // Convert static list to state to allow adding new elements
    const [flightElements, setFlightElements] = useState<string[]>(() => {
        const customElements = Object.keys(phraseBank).filter(key => 
            !['Airmanship', 'Preparation', 'Technique'].includes(key) && !INITIAL_ELEMENTS_LIST.includes(key)
        );
        return [...INITIAL_ELEMENTS_LIST, ...customElements];
    });

    const [selectedElement, setSelectedElement] = useState<string>(flightElements[0]);

    const currentDimension = activeTab === 'Elements' ? selectedElement : activeTab;

    const handlePhraseChange = (grade: number, index: number, value: string) => {
        const currentPhrases = (phraseBank && phraseBank[currentDimension]) || {};
        const gradePhrases = currentPhrases[grade] || [];
        
        const newGradePhrases = [...gradePhrases];
        newGradePhrases[index] = value;

        onUpdatePhraseBank({
            ...phraseBank,
            [currentDimension]: {
                ...currentPhrases,
                [grade]: newGradePhrases
            }
        });
    };

    const handleAddPhrase = (grade: number) => {
        const currentPhrases = (phraseBank && phraseBank[currentDimension]) || {};
        const gradePhrases = currentPhrases[grade] || [];

        onUpdatePhraseBank({
            ...phraseBank,
            [currentDimension]: {
                ...currentPhrases,
                [grade]: [...gradePhrases, '']
            }
        });
    };

    const handleDeletePhrase = (grade: number, index: number) => {
        const currentPhrases = (phraseBank && phraseBank[currentDimension]) || {};
        const gradePhrases = currentPhrases[grade] || [];

        onUpdatePhraseBank({
            ...phraseBank,
            [currentDimension]: {
                ...currentPhrases,
                [grade]: gradePhrases.filter((_, i) => i !== index)
            }
        });
    };
    
    const handleAddElement = () => {
        setShowAddElementFlyout(true);
    };

    const handleSaveNewElement = (newElementName: string) => {
        if (flightElements.includes(newElementName)) {
            alert("An element with this name already exists.");
            return;
        }
        
        // Update the list of elements
        setFlightElements(prev => [...prev, newElementName]);

        // Add an entry for the new element to the phrase bank
        onUpdatePhraseBank({
            ...phraseBank,
            [newElementName]: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] }
        });

        // Select the newly added element
        setSelectedElement(newElementName);
        
        // Close the flyout
        setShowAddElementFlyout(false);
    };

    const handleDeleteElements = (elementsToDelete: Set<string>) => {
        // Update flight elements list
        const newFlightElements = flightElements.filter(el => !elementsToDelete.has(el));
        setFlightElements(newFlightElements);

        // Update phrase bank
        const newPhraseBank = { ...phraseBank };
        elementsToDelete.forEach(el => {
            delete newPhraseBank[el];
        });
        onUpdatePhraseBank(newPhraseBank);
        
        // If the currently selected element was deleted, select the first one in the new list
        if (elementsToDelete.has(selectedElement)) {
            setSelectedElement(newFlightElements[0] || 'Generic Flying Elements');
        }

        setShowDeleteElementFlyout(false);
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
                    <h2 className="text-xl font-bold text-white">Scoring Matrix Setup</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Main Navigation */}
                <div className="flex border-b border-gray-700 bg-gray-900/30 shrink-0">
                    {['Airmanship', 'Preparation', 'Technique', 'Elements'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 py-3 text-lg font-semibold text-center border-b-4 transition-colors ${
                                activeTab === tab
                                    ? 'border-sky-500 text-sky-400 bg-gray-800' 
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    {activeTab === 'Elements' && (
                        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 overflow-y-auto">
                            <div className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-900/50 flex justify-between items-center">
                                <span>Flight Elements</span>
                                <div className="flex space-x-1">
                                    <button 
                                        onClick={() => setShowDeleteElementFlyout(true)}
                                        className="p-1 rounded-full bg-gray-700 hover:bg-gray-600"
                                        title="Delete flight element(s)"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button 
                                        onClick={handleAddElement}
                                        className="p-1 rounded-full bg-gray-700 hover:bg-gray-600"
                                        title="Add new flight element"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {flightElements.map((el) => (
                                <button
                                    key={el}
                                    onClick={() => setSelectedElement(el)}
                                    className={`text-left px-4 py-3 border-l-4 transition-colors font-medium text-sm ${
                                        selectedElement === el
                                            ? 'border-sky-500 bg-gray-700 text-white'
                                            : 'border-transparent text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                                    }`}
                                >
                                    {el}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Editable List Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900">
                        <div className="mb-4">
                            <h3 className="text-2xl font-bold text-sky-400">{currentDimension}</h3>
                            <p className="text-gray-400 text-sm">Define standardized phrases for each grade level.</p>
                        </div>
                        
                        {[5, 4, 3, 2, 1, 0].map(grade => (
                            <div key={grade} className={`border rounded-lg overflow-hidden ${getGradeColor(grade)}`}>
                                <div className="px-4 py-2 font-bold text-sm border-b border-gray-700/30 flex justify-between items-center">
                                    <span className="text-white opacity-90">{getGradeLabel(grade)}</span>
                                    <button 
                                        onClick={() => handleAddPhrase(grade)}
                                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors border border-gray-600"
                                    >
                                        + Add Phrase
                                    </button>
                                </div>
                                <div className="p-4 space-y-2">
                                    {(phraseBank && phraseBank[currentDimension] && phraseBank[currentDimension][grade]) ? (
                                        phraseBank[currentDimension][grade].map((phrase, idx) => (
                                            <div key={idx} className="flex items-start space-x-2 group">
                                                <textarea
                                                    value={phrase}
                                                    onChange={(e) => handlePhraseChange(grade, idx, e.target.value)}
                                                    rows={1}
                                                    className="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-sm text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none overflow-hidden"
                                                    style={{ minHeight: '38px', height: 'auto' }}
                                                    onInput={(e) => {
                                                        const target = e.currentTarget;
                                                        target.style.height = 'auto';
                                                        target.style.height = `${target.scrollHeight}px`;
                                                    }}
                                                />
                                                <button 
                                                    onClick={() => handleDeletePhrase(grade, idx)}
                                                    className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete phrase"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-500 italic pl-1">No phrases defined.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-6 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md">
                        Done
                    </button>
                </div>
                {showAddElementFlyout && (
                    <AddElementFlyout
                        onClose={() => setShowAddElementFlyout(false)}
                        onSave={handleSaveNewElement}
                    />
                )}
                {showDeleteElementFlyout && (
                    <DeleteElementFlyout
                        onClose={() => setShowDeleteElementFlyout(false)}
                        onDelete={handleDeleteElements}
                        flightElements={flightElements}
                    />
                )}
            </div>
        </div>
    );
};

export default ScoringMatrixFlyout;
