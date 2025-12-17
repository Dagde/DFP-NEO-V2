
import React, { useState, useEffect, useMemo } from 'react';
import { SyllabusItemDetail } from '../types';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';

interface SyllabusViewProps {
  syllabusDetails: SyllabusItemDetail[];
  onBack: () => void;
  initialSelectedId?: string;
  onUpdateItem: (item: SyllabusItemDetail) => void;
}

// Reusable components for view mode
const DetailCard: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`bg-gray-700/50 p-3 rounded-lg ${className}`}>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <div className="mt-1 text-md font-semibold text-white">{value}</div>
    </div>
);

const DetailList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div>
        <h3 className="text-md font-semibold text-sky-400 mb-2">{title}</h3>
        <div className="bg-gray-700/50 p-3 rounded-lg text-sm text-gray-300">
            {items && items.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside">
                    {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            ) : (
                <p className="italic text-gray-500">None</p>
            )}
        </div>
    </div>
);

// Reusable components for edit mode
const EditableField: React.FC<{ label: string; value: string | number; onChange: (value: string | number) => void; type?: string; step?: number; }> = ({ label, value, onChange, type = 'text', step }) => (
    <div className="bg-gray-700/50 p-3 rounded-lg">
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <input
            type={type}
            step={step}
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
        />
    </div>
);

const EditableList: React.FC<{ title: string; items: string[]; onChange: (items: string[]) => void; }> = ({ title, items, onChange }) => (
    <div>
        <h3 className="text-md font-semibold text-sky-400 mb-2">{title}</h3>
        <textarea
            value={(items || []).join('\n')}
            onChange={(e) => onChange(e.target.value.split('\n'))}
            rows={4}
            className="block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
            placeholder="One item per line"
        />
    </div>
);


const DetailView: React.FC<{ 
    item: SyllabusItemDetail; 
    isEditing: boolean;
    editedItem: SyllabusItemDetail | null;
    onItemChange: (newItem: SyllabusItemDetail) => void;
}> = ({ item, isEditing, editedItem, onItemChange }) => {
    
    const getDisplayType = (syllabusItem: SyllabusItemDetail): 'Flight' | 'FTD' | 'CPT' | 'Ground' => {
        if (syllabusItem.type === 'Flight') return 'Flight';
        if (syllabusItem.type === 'FTD') return 'FTD';
        if (syllabusItem.type === 'Ground School') {
            if (syllabusItem.code.includes('CPT')) return 'CPT';
            return 'Ground';
        }
        return 'Flight'; // Fallback
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!editedItem) return;
        const newDisplayType = e.target.value;
        let newType: SyllabusItemDetail['type'] = 'Flight';
        
        if (newDisplayType === 'FTD') newType = 'FTD';
        if (newDisplayType === 'CPT' || newDisplayType === 'Ground') newType = 'Ground School';
        
        onItemChange({ ...editedItem, type: newType });
    };

    const handleFieldChange = (field: keyof SyllabusItemDetail, value: any) => {
        if (!editedItem) return;
        onItemChange({ ...editedItem, [field]: value });
    };

    const currentItem = isEditing ? editedItem : item;
    if (!currentItem) return null;

    return (
    <div className="space-y-6">
        <div>
            {isEditing ? (
                <EditableField label="Code" value={currentItem.code} onChange={(val) => handleFieldChange('code', val)} />
            ) : (
                <h2 className="text-3xl font-bold text-white">{item.code}</h2>
            )}
             {isEditing ? (
                <div className="mt-2">
                    <EditableField label="Event Description" value={currentItem.eventDescription} onChange={(val) => handleFieldChange('eventDescription', val)} />
                </div>
            ) : (
                <p className="text-lg text-gray-400 mt-1">{item.eventDescription}</p>
            )}
        </div>
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Core Details</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
                {isEditing ? (
                    <>
                        <EditableField label="Phase" value={currentItem.phase} onChange={(val) => handleFieldChange('phase', val)} />
                        <EditableField label="Module" value={currentItem.module} onChange={(val) => handleFieldChange('module', val)} />
                        <div className="bg-gray-700/50 p-3 rounded-lg">
                             <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Day/Night</label>
                             <select
                                value={currentItem.dayNight}
                                onChange={(e) => handleFieldChange('dayNight', e.target.value as 'Day' | 'Night' | 'Day/Night')}
                                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                            >
                                <option>Day</option>
                                <option>Night</option>
                                <option>Day/Night</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/50 p-3 rounded-lg">
                             <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Type</label>
                             <select
                                value={getDisplayType(currentItem)}
                                onChange={handleTypeChange}
                                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                            >
                                <option>Flight</option>
                                <option>FTD</option>
                                <option>CPT</option>
                                <option>Ground</option>
                            </select>
                        </div>
                        <EditableField label="Total Event Hours" value={currentItem.totalEventHours} onChange={(val) => handleFieldChange('totalEventHours', val)} type="number" step={0.1}/>
                        <EditableField label="Flight/Sim Hours" value={currentItem.flightOrSimHours} onChange={(val) => handleFieldChange('flightOrSimHours', val)} type="number" step={0.1}/>
                        <div className="bg-gray-700/50 p-3 rounded-lg">
                             <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Dual/Solo</label>
                             <select
                                value={currentItem.sortieType || 'Dual'}
                                onChange={(e) => handleFieldChange('sortieType', e.target.value as 'Dual' | 'Solo')}
                                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                            >
                                <option>Dual</option>
                                <option>Solo</option>
                            </select>
                        </div>
                        <EditableField 
                            label="Pre-Flight Time (mins)" 
                            value={Math.round(currentItem.preFlightTime * 60)} 
                            onChange={(val) => handleFieldChange('preFlightTime', Number(val) / 60)} 
                            type="number" 
                            step={1}
                        />
                        <EditableField 
                            label="Post-Flight Time (mins)" 
                            value={Math.round(currentItem.postFlightTime * 60)} 
                            onChange={(val) => handleFieldChange('postFlightTime', Number(val) / 60)} 
                            type="number" 
                            step={1}
                        />
                    </>
                ) : (
                    <>
                        <DetailCard label="Phase" value={item.phase} />
                        <DetailCard label="Module" value={item.module} />
                        <DetailCard label="Day/Night" value={item.dayNight} />
                        <DetailCard label="Type" value={getDisplayType(item)} />
                        <DetailCard label="Total Event Hours" value={<>{item.totalEventHours.toFixed(1)} <span className="text-sm font-normal">hrs</span></>} />
                        <DetailCard label="Flight/Sim Hours" value={<>{item.flightOrSimHours.toFixed(1)} <span className="text-sm font-normal">hrs</span></>} />
                        <DetailCard label="Dual/Solo" value={item.sortieType || 'Dual'} />
                        <DetailCard label="Pre-Flight Time" value={<>{Math.round(item.preFlightTime * 60)} <span className="text-sm font-normal">mins</span></>} />
                        <DetailCard label="Post-Flight Time" value={<>{Math.round(item.postFlightTime * 60)} <span className="text-sm font-normal">mins</span></>} />
                    </>
                )}
            </div>
        </fieldset>
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Prerequisites</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                {isEditing ? (
                    <>
                        <EditableList title="Ground School" items={currentItem.prerequisitesGround} onChange={(val) => handleFieldChange('prerequisitesGround', val)} />
                        <EditableList title="Sim/Flying" items={currentItem.prerequisitesFlying} onChange={(val) => handleFieldChange('prerequisitesFlying', val)} />
                    </>
                ) : (
                    <>
                        <DetailList title="Ground School" items={item.prerequisitesGround} />
                        <DetailList title="Sim/Flying" items={item.prerequisitesFlying} />
                    </>
                )}
            </div>
        </fieldset>

        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Event Breakdown</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                 {isEditing ? (
                    <>
                        <EditableList title="Methods of Delivery" items={currentItem.methodOfDelivery} onChange={(val) => handleFieldChange('methodOfDelivery', val)} />
                        <EditableList title="Methods of Assessment" items={currentItem.methodOfAssessment} onChange={(val) => handleFieldChange('methodOfAssessment', val)} />
                        <EditableList title="Event Details (Common)" items={currentItem.eventDetailsCommon} onChange={(val) => handleFieldChange('eventDetailsCommon', val)} />
                        <EditableList title="Event Details (Sortie)" items={currentItem.eventDetailsSortie} onChange={(val) => handleFieldChange('eventDetailsSortie', val)} />
                    </>
                ) : (
                    <>
                        <DetailList title="Methods of Delivery" items={item.methodOfDelivery} />
                        <DetailList title="Methods of Assessment" items={item.methodOfAssessment} />
                        <DetailList title="Event Details (Common)" items={item.eventDetailsCommon} />
                        <DetailList title="Event Details (Sortie)" items={item.eventDetailsSortie} />
                    </>
                 )}
            </div>
        </fieldset>

         <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Resources</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                 {isEditing ? (
                    <>
                        <EditableList title="Physical Resources" items={currentItem.resourcesPhysical} onChange={(val) => handleFieldChange('resourcesPhysical', val)} />
                        <EditableList title="Human Resources" items={currentItem.resourcesHuman} onChange={(val) => handleFieldChange('resourcesHuman', val)} />
                    </>
                 ) : (
                    <>
                        <DetailList title="Physical Resources" items={item.resourcesPhysical} />
                        <DetailList title="Human Resources" items={item.resourcesHuman} />
                    </>
                 )}
            </div>
        </fieldset>
    </div>
    );
};

const COURSE_MASTER_LMPS = ['BPC+IPC', 'FIC', 'OFI', 'WSO', 'FIC(I)', 'PLT CONV', 'QFI CONV', 'PLT Refresh', 'Staff CAT'];

const SyllabusView: React.FC<SyllabusViewProps> = ({ syllabusDetails, onBack, initialSelectedId, onUpdateItem }) => {
  const [selectedItem, setSelectedItem] = useState<SyllabusItemDetail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState<SyllabusItemDetail | null>(null);
  const [selectedCourseType, setSelectedCourseType] = useState<string>('BPC+IPC');

  // Filter items based on selected course type
  const filteredSyllabusDetails = useMemo(() => {
      return syllabusDetails.filter(item => {
          // If no courses array defined, assume it belongs to BPC+IPC (legacy behavior)
          if (!item.courses || item.courses.length === 0) {
              return selectedCourseType === 'BPC+IPC';
          }
          return item.courses.includes(selectedCourseType);
      });
  }, [syllabusDetails, selectedCourseType]);

    // Log view on component mount
    useEffect(() => {
        logAudit({
            action: 'View',
            description: 'Viewed Master LMP page',
            changes: `Viewing ${selectedCourseType} syllabus`,
            page: 'Master LMP'
        });
    }, []);

  useEffect(() => {
    if (initialSelectedId) {
      const itemToSelect = syllabusDetails.find(item => item.code === initialSelectedId);
      if (itemToSelect) {
          setSelectedItem(itemToSelect);
          // If navigating directly, ensure we are on a course type that contains this item
          if (itemToSelect.courses && itemToSelect.courses.length > 0) {
              if (!itemToSelect.courses.includes(selectedCourseType)) {
                  setSelectedCourseType(itemToSelect.courses[0]);
              }
          }
      }
    } else {
        if (selectedItem) {
             const updated = syllabusDetails.find(item => item.code === selectedItem.code);
             if (updated) setSelectedItem(updated);
        }
    }
  }, [initialSelectedId, syllabusDetails, selectedItem, selectedCourseType]);

  const handleEdit = () => {
    if (selectedItem) {
        setEditedItem(JSON.parse(JSON.stringify(selectedItem)));
        setIsEditing(true);
    }
  };

  const handleSave = () => {
      if (editedItem) {
             // Detect changes
             const changes: string[] = [];
             if (selectedItem.preFlightTime !== editedItem.preFlightTime) {
                 changes.push(`Pre-flight time: ${Math.round(selectedItem.preFlightTime * 60)} minutes → ${Math.round(editedItem.preFlightTime * 60)} minutes`);
             }
             if (selectedItem.postFlightTime !== editedItem.postFlightTime) {
                 changes.push(`Post-flight time: ${Math.round(selectedItem.postFlightTime * 60)} minutes → ${Math.round(editedItem.postFlightTime * 60)} minutes`);
             }
             
             if (changes.length > 0) {
                 logAudit({
                     action: 'Edit',
                     description: `Updated LMP item ${editedItem.code}`,
                     changes: changes.join(', '),
                     page: 'Master LMP'
                 });
             }
          onUpdateItem(editedItem);
          setSelectedItem(editedItem);
      }
      setIsEditing(false);
      setEditedItem(null);
  };

  const handleCancel = () => {
      setIsEditing(false);
      setEditedItem(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-white">Master LMP: <span className="text-sky-400">{selectedCourseType}</span></h1>
          <p className="text-sm text-gray-400">Learning Management Package Details</p>
        </div>
        
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-700 p-1 rounded-md">
                <label htmlFor="course-select" className="text-xs text-gray-300 font-medium pl-2">Syllabus:</label>
                <select 
                    id="course-select"
                    value={selectedCourseType}
                    onChange={(e) => {
                        setSelectedCourseType(e.target.value);
                        setSelectedItem(null); // Clear selection when switching list
                    }}
                    className="bg-gray-800 text-white text-sm border-none rounded focus:ring-sky-500 cursor-pointer py-1 pl-2 pr-8"
                >
                    {COURSE_MASTER_LMPS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="w-px h-8 bg-gray-600 mx-2"></div>

            {isEditing ? (
                <div className="flex space-x-3">
                    <button onClick={handleSave} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">Save</button>
                    <button onClick={handleCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-semibold">Cancel</button>
                </div>
            ) : (
                <div className="flex space-x-3">
                    <button onClick={handleEdit} disabled={!selectedItem} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 shadow-md text-white rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Edit</button>
                    <button onClick={onBack} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 shadow-md text-white rounded-md text-sm font-semibold">
                        &larr; Back
                    </button>
                       <AuditButton pageName="Master LMP" />
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Column: List */}
        <div className="w-1/4 border-r border-gray-700 overflow-y-auto">
          <ul className="p-2 space-y-1">
            {filteredSyllabusDetails.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => {
                      if (!isEditing) {
                          setSelectedItem(item);
                      }
                  }}
                  disabled={isEditing}
                  className={`w-full text-left p-2 rounded-md transition-colors text-sm ${
                      selectedItem?.id === item.id && !isEditing ? 'bg-sky-700 text-white font-semibold' : 'text-gray-300'
                  } ${isEditing ? 'cursor-not-allowed text-gray-500' : 'hover:bg-gray-700/50'}`}
                >
                  {item.code}
                </button>
              </li>
            ))}
            {filteredSyllabusDetails.length === 0 && (
                <li className="p-4 text-center text-gray-500 italic text-sm">No events found for this syllabus.</li>
            )}
          </ul>
        </div>

        {/* Right Column: Detail View */}
        <div className="w-3/4 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto">
            {selectedItem ? (
                <DetailView 
                    item={selectedItem}
                    isEditing={isEditing}
                    editedItem={editedItem}
                    onItemChange={setEditedItem}
                />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 italic">Select an item from the list to view its details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyllabusView;
