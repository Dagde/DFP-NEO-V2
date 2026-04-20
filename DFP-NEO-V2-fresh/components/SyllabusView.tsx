import { useSystemFreeze } from '../hooks/useSystemFreeze';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SyllabusItemDetail } from '../types';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { createSyllabusItem, updateSyllabusItem, retireSyllabusItem } from '../lib/syllabusService';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';

interface SyllabusViewProps {
  syllabusDetails: SyllabusItemDetail[];
  onBack: () => void;
  initialSelectedId?: string;
  onUpdateItem: (item: SyllabusItemDetail) => void;
  onAddItem?: (item: SyllabusItemDetail) => void;
}

// Reusable components for view mode
const DetailCard: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`bg-gray-700/50 p-1 rounded-lg ${className}`}>
        <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <div className="mt-0.5 text-[10px] font-semibold text-white">{value}</div>
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
    onDeleteEvent?: (item: SyllabusItemDetail) => void;
}> = ({ item, isEditing, editedItem, onItemChange, onDeleteEvent }) => {
    
    const getDisplayType = (syllabusItem: SyllabusItemDetail): 'Flight' | 'FTD' | 'CPT' | 'Ground' | 'Academics' => {
        if (syllabusItem.type === 'Flight') return 'Flight';
        if (syllabusItem.type === 'FTD') return 'FTD';
        if (syllabusItem.type === 'Academics') return 'Academics';
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
        if (newDisplayType === 'Academics') newType = 'Academics';
        
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
        
        <fieldset className="p-3 border border-gray-700 rounded-lg">
            <legend className="px-2 text-xs font-semibold text-gray-300">Core Details</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                {isEditing ? (
                    <>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                             <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Dual/Solo</label>
                             <select
                                value={currentItem.sortieType || 'Dual'}
                                onChange={(e) => handleFieldChange('sortieType', e.target.value as 'Dual' | 'Solo')}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            >
                                <option>Dual</option>
                                <option>Solo</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                             <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Day/Night</label>
                             <select
                                value={currentItem.dayNight}
                                onChange={(e) => handleFieldChange('dayNight', e.target.value as 'Day' | 'Night' | 'Day/Night')}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            >
                                <option>Day</option>
                                <option>Night</option>
                                <option>Day/Night</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                             <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Type</label>
                             <select
                                value={getDisplayType(currentItem)}
                                onChange={handleTypeChange}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            >
                                <option>Flight</option>
                                <option>FTD</option>
                                <option>CPT</option>
                                <option>Ground</option>
                                <option>Academics</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                               <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Cct Only</label>
                               <select
                                  value={currentItem.cctOnly || (currentItem.code === 'BGF10' ? 'YES' : 'NO')}
                                  onChange={(e) => handleFieldChange('cctOnly', e.target.value as 'YES' | 'NO')}
                                  className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                              >
                                  <option>NO</option>
                                  <option>YES</option>
                              </select>
                           </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                               <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">TWR DI Reqd</label>
                               <select
                                  value={currentItem.twrDiReqd || (currentItem.code === 'BGF11' || currentItem.code === 'BGF18' ? 'YES' : 'NO')}
                                  onChange={(e) => handleFieldChange('twrDiReqd', e.target.value as 'YES' | 'NO')}
                                  className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                              >
                                  <option>NO</option>
                                  <option>YES</option>
                              </select>
                           </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Total Event Hrs</label>
                            <input
                                type="number"
                                step="0.1"
                                value={currentItem.totalEventHours}
                                onChange={(e) => handleFieldChange('totalEventHours', parseFloat(e.target.value) || 0)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Flight/Sim Hrs</label>
                            <input
                                type="number"
                                step="0.1"
                                value={currentItem.flightOrSimHours}
                                onChange={(e) => handleFieldChange('flightOrSimHours', parseFloat(e.target.value) || 0)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Pre-Flight (min)</label>
                            <input
                                type="number"
                                step="1"
                                value={Math.round(currentItem.preFlightTime * 60)}
                                onChange={(e) => handleFieldChange('preFlightTime', Number(e.target.value) / 60)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Post-Flight (min)</label>
                            <input
                                type="number"
                                step="1"
                                value={Math.round(currentItem.postFlightTime * 60)}
                                onChange={(e) => handleFieldChange('postFlightTime', Number(e.target.value) / 60)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Code</label>
                            <input
                                type="text"
                                value={currentItem.code}
                                onChange={(e) => handleFieldChange('code', e.target.value)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Course</label>
                            <input
                                type="text"
                                value={(currentItem.courses || []).join(', ')}
                                onChange={(e) => handleFieldChange('courses', e.target.value.split(', ').filter(c => c.trim()))}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                                placeholder="Enter courses separated by commas"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Phase</label>
                            <input
                                type="text"
                                value={currentItem.phase}
                                onChange={(e) => handleFieldChange('phase', e.target.value)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Module</label>
                            <input
                                type="text"
                                value={currentItem.module}
                                onChange={(e) => handleFieldChange('module', e.target.value)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <DetailCard label="Dual/Solo" value={item.sortieType || 'Dual'} />
                        <DetailCard label="Day/Night" value={item.dayNight} />
                        <DetailCard label="Type" value={getDisplayType(item)} />
                        <DetailCard label="Cct Only" value={item.cctOnly || (item.code === 'BGF10' ? 'YES' : 'NO')} />
                        <DetailCard label="TWR DI Reqd" value={item.twrDiReqd || (item.code === 'BGF11' || item.code === 'BGF18' ? 'YES' : 'NO')} />
                        <DetailCard label="Total Event Hrs" value={<>{item.totalEventHours.toFixed(1)} <span className="text-[10px] font-normal">hrs</span></>} />
                        <DetailCard label="Flight/Sim Hrs" value={<>{item.flightOrSimHours.toFixed(1)} <span className="text-[10px] font-normal">hrs</span></>} />
                        <DetailCard label="Pre-Flight" value={<>{Math.round(item.preFlightTime * 60)} <span className="text-[10px] font-normal">min</span></>} />
                        <DetailCard label="Post-Flight" value={<>{Math.round(item.postFlightTime * 60)} <span className="text-[10px] font-normal">min</span></>} />
                        <DetailCard label="Code" value={item.code} />
                        <DetailCard label="Course" value={(item.courses || []).join(", ") || "None"} />
                        <DetailCard label="Phase" value={item.phase} />
                        <DetailCard label="Module" value={item.module} />
                    </>
                )}
            </div>
        </fieldset>
           <fieldset className="p-4 border border-gray-700 rounded-lg">
               <legend className="px-2 text-sm font-semibold text-gray-300">Event Description</legend>
               <div className="mt-2">
                   {isEditing ? (
                       <EditableField label="Event Description" value={currentItem.eventDescription} onChange={(val) => handleFieldChange('eventDescription', val)} />
                   ) : (
                       <p className="text-gray-300 p-3 bg-gray-700/30 rounded-lg">{item.eventDescription || 'No description provided'}</p>
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

        {isEditing && onDeleteEvent && (
            <div className="pt-4 border-t border-gray-700 mt-2 flex justify-end">
                <button
                    onClick={() => onDeleteEvent(item)}
                    style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none' }}
                    className="px-4 py-2 text-[11px] font-semibold rounded-md hover:opacity-90 transition-opacity"
                >
                    🗑 Delete This Event
                </button>
            </div>
        )}
    </div>
    );
};

const STATIC_COURSE_LMPS = ['BPC+IPC', 'FIC', 'OFI', 'WSO', 'FIC(I)', 'PLT CONV', 'QFI CONV', 'PLT Refresh', 'Staff CAT'];

const SyllabusView: React.FC<SyllabusViewProps> = ({ syllabusDetails, onBack, initialSelectedId, onUpdateItem, onAddItem }) => {
    const { isFrozen } = useSystemFreeze();
  const [selectedItem, setSelectedItem] = useState<SyllabusItemDetail | null>(null);
  const [hoveredItem, setHoveredItem] = useState<SyllabusItemDetail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState<SyllabusItemDetail | null>(null);
  const [selectedCourseType, setSelectedCourseType] = useState<string>('BPC+IPC');
  const [editingCourseTitle, setEditingCourseTitle] = useState<string>('');

  // Dynamic course list: union of static list + any courses found in active syllabusDetails
  const courseLMPs = useMemo(() => {
    const fromSyllabus = new Set<string>();
    syllabusDetails.filter(item => item.isActive !== false).forEach(item => {
      (item.courses || []).forEach(c => { if (c) fromSyllabus.add(c); });
    });
    const all = new Set([...STATIC_COURSE_LMPS, ...Array.from(fromSyllabus)]);
    return Array.from(all).sort();
  }, [syllabusDetails]);

  // Map from course code → full display title (uses module field of first item in that course)
  const courseTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    syllabusDetails.filter(item => item.isActive !== false).forEach(item => {
      (item.courses || []).forEach(c => {
        if (c && !map[c] && item.module && item.module !== c) {
          map[c] = item.module;
        }
      });
    });
    return map;
  }, [syllabusDetails]);

  // Helper: get display title for a course code
  const getCourseTitle = (code: string) => courseTitleMap[code] || code;

  // Add Course modal state
  const [showAddLMPModal, setShowAddLMPModal] = useState(false);
  const [newLMPName, setNewLMPName] = useState('');       // full course title e.g. "Basic Flying Course"
  const [newLMPCourseType, setNewLMPCourseType] = useState<'Flight Training' | 'Academic Training'>('Flight Training');

  // Delete Course modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Bulk Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created: number; skipped: number; errors: any[]; message: string } | null>(null);

  // Delete Event modal state
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [deleteEventItem, setDeleteEventItem] = useState<SyllabusItemDetail | null>(null);
  const [deleteEventPassword, setDeleteEventPassword] = useState('');
  const [deleteEventError, setDeleteEventError] = useState('');
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filter items based on selected course type (exclude inactive/deleted items)
  const filteredSyllabusDetails = useMemo(() => {
      return syllabusDetails.filter(item => {
          if (item.isActive === false) return false;
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

  // Select first item by default when syllabusDetails or selectedCourseType changes
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
        // Default: select the first item in the filtered list
        if (filteredSyllabusDetails.length > 0 && !selectedItem) {
            setSelectedItem(filteredSyllabusDetails[0]);
        } else if (selectedItem) {
             const updated = syllabusDetails.find(item => item.code === selectedItem.code);
             if (updated) setSelectedItem(updated);
        }
    }
  }, [initialSelectedId, syllabusDetails, selectedItem, selectedCourseType, filteredSyllabusDetails]);

  // Reset selection when course type changes (select first item of new course)
  useEffect(() => {
    if (filteredSyllabusDetails.length > 0) {
        setSelectedItem(filteredSyllabusDetails[0]);
        setIsEditing(false);
    } else {
        setSelectedItem(null);
    }
  }, [selectedCourseType]);

  const handleEdit = () => {
      setEditingCourseTitle(getCourseTitle(selectedCourseType));
      if (selectedItem) {
          setEditedItem(JSON.parse(JSON.stringify(selectedItem)));
      }
      setIsEditing(true);
  };

  const handleSave = async () => {
      setIsSaving(true);
      try {
          // Save the selected event item if one is being edited
          if (editedItem) {
              const isNew = editedItem.id.startsWith('new-');
              let savedItem: SyllabusItemDetail;
              if (isNew) {
                  const { id: _tmpId, ...itemWithoutTmpId } = editedItem;
                  savedItem = await createSyllabusItem(itemWithoutTmpId, 'New LMP event created via Master LMP editor');
              } else {
                  savedItem = await updateSyllabusItem(editedItem.id, editedItem, 'Updated via Master LMP editor');
              }
              // Detect changes for audit
              const changes: string[] = [];
              if (selectedItem && selectedItem.preFlightTime !== editedItem.preFlightTime) {
                  changes.push(`Pre-flight time: ${Math.round(selectedItem.preFlightTime * 60)} min to ${Math.round(editedItem.preFlightTime * 60)} min`);
              }
              if (selectedItem && selectedItem.postFlightTime !== editedItem.postFlightTime) {
                  changes.push(`Post-flight time: ${Math.round(selectedItem.postFlightTime * 60)} min to ${Math.round(editedItem.postFlightTime * 60)} min`);
              }
              if (changes.length > 0) {
                  logAudit({ action: 'Edit', description: `Updated LMP item ${savedItem.code}`, changes: changes.join(', '), page: 'Master LMP' });
              }
              onUpdateItem(savedItem);
              setSelectedItem(savedItem);
          }

          // If the course title was changed, update the module field on ALL items in this course
          const currentTitle = getCourseTitle(selectedCourseType);
          const newTitle = editingCourseTitle.trim();
          if (newTitle && newTitle !== currentTitle) {
              const courseItems = syllabusDetails.filter(item =>
                  item.isActive !== false && (item.courses || []).includes(selectedCourseType)
              );
              await Promise.all(courseItems.map(item =>
                  updateSyllabusItem(item.id, { ...item, module: newTitle }, 'Course title renamed')
              ));
              // Update local state for all items
              courseItems.forEach(item => onUpdateItem({ ...item, module: newTitle }));
              logAudit({ action: 'Edit', description: `Renamed course: ${selectedCourseType}`, changes: `Title: "${currentTitle}" renamed to "${newTitle}"`, page: 'Master LMP' });
          }

          setIsEditing(false);
          setEditedItem(null);
          setEditingCourseTitle('');
      } catch (err: any) {
          alert(`Save failed: ${err.message}`);
      } finally {
          setIsSaving(false);
      }
  };

  const handleCancel = () => {
      setIsEditing(false);
      setEditedItem(null);
      setEditingCourseTitle('');
  };

  const handleDeleteCourse = async () => {
      if (!deletePassword) { setDeleteError('Please enter your password.'); return; }
      setIsDeleting(true);
      setDeleteError('');
      try {
          // Verify password first - get session token from localStorage
          const sessionToken = localStorage.getItem('dfp_session_token') || '';
          const verifyResp = await fetch('/api/auth/verify-password', {
              method: 'POST',
              credentials: 'include',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({ password: deletePassword }),
          });
          const verifyData = await verifyResp.json();
          if (!verifyData.valid) {
              setDeleteError('Incorrect password. Please try again.');
              setIsDeleting(false);
              return;
          }
          // Retire all items for this course
          // Include any item that belongs to this course (even if it also belongs to others)
          const itemsToDelete = syllabusDetails.filter(item =>
              (item.courses || []).includes(selectedCourseType)
          );
          console.log(`🗑️ Deleting ${itemsToDelete.length} items for course: ${selectedCourseType}`, itemsToDelete.map(i => i.id));
          
          if (itemsToDelete.length === 0) {
              // Course exists in dropdown but has no items — just remove from UI
              console.warn(`⚠️ No items found for course ${selectedCourseType} in syllabusDetails (${syllabusDetails.length} total items)`);
          } else {
              await Promise.all(itemsToDelete.map(item =>
                  retireSyllabusItem(item.id, `Course deleted: ${selectedCourseType}`)
              ));
          }
          logAudit({ action: 'Delete', description: `Deleted course: ${selectedCourseType}`, changes: `${itemsToDelete.length} items retired`, page: 'Master LMP' });
          // Remove from local state by marking isActive: false
          itemsToDelete.forEach(item => onUpdateItem({ ...item, isActive: false } as any));
          setShowDeleteModal(false);
          setDeletePassword('');
          setSelectedItem(null);
          // Switch to first available course (excluding the deleted one)
          const remaining = STATIC_COURSE_LMPS.filter(c => c !== selectedCourseType);
          setSelectedCourseType(remaining[0] || 'BPC+IPC');
      } catch (err: any) {
          setDeleteError(`Failed to delete: ${err.message}`);
      } finally {
          setIsDeleting(false);
      }
  };

  const handleBulkUpload = async () => {
      if (!uploadFile) { alert('Please select a file first.'); return; }
      setIsUploading(true);
      setUploadResult(null);
      try {
          const formData = new FormData();
          formData.append('file', uploadFile);
          // Pass the current course code so uploads go into the selected course
          formData.append('courseCode', selectedCourseType);
          const resp = await fetch('/api/syllabus/bulk-upload', {
              method: 'POST',
              body: formData,
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || 'Upload failed');
          setUploadResult(data);
          // Reload syllabus data by triggering a page reload after short delay
          if (data.created > 0) {
              setTimeout(() => window.location.reload(), 2000);
          }
      } catch (err: any) {
          alert(`❌ Upload failed: ${err.message}`);
      } finally {
          setIsUploading(false);
      }
  };

  const handleDeleteEventRequest = (item: SyllabusItemDetail) => {
      setDeleteEventItem(item);
      setDeleteEventPassword('');
      setDeleteEventError('');
      setShowDeleteEventModal(true);
  };

  const handleDeleteEventConfirm = async () => {
      if (!deleteEventItem) return;
      if (!deleteEventPassword) { setDeleteEventError('Please enter your password.'); return; }
      setIsDeletingEvent(true);
      setDeleteEventError('');
      try {
          // Verify password
          const sessionToken = localStorage.getItem('dfp_session_token') || '';
          const verifyResp = await fetch('/api/auth/verify-password', {
              method: 'POST',
              credentials: 'include',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({ password: deleteEventPassword }),
          });
          const verifyData = await verifyResp.json();
          if (!verifyData.valid) {
              setDeleteEventError('Incorrect password. Please try again.');
              setIsDeletingEvent(false);
              return;
          }
          // Hard delete the event
          const deleteResp = await fetch(`/api/syllabus/${deleteEventItem.id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ changeReason: `Event deleted by user` }),
          });
          if (!deleteResp.ok) {
              const err = await deleteResp.json();
              throw new Error(err.error || 'Failed to delete event');
          }
          logAudit({ action: 'Delete', description: `Deleted event: ${deleteEventItem.code} - ${deleteEventItem.eventDescription}`, changes: `Event removed from course: ${selectedCourseType}`, page: 'Master LMP' });
          // Remove from local state
          onUpdateItem({ ...deleteEventItem, isActive: false } as any);
          setShowDeleteEventModal(false);
          setDeleteEventItem(null);
          setDeleteEventPassword('');
          setSelectedItem(null);
          setEditedItem(null);
          setIsEditing(false);
      } catch (err: any) {
          setDeleteEventError(`Failed to delete: ${err.message}`);
      } finally {
          setIsDeletingEvent(false);
      }
  };

  const handleAddLMP = () => {
      // Open the Add Course modal
      setNewLMPName('');
      setNewLMPCourseType('Flight Training');
      setShowAddLMPModal(true);
  };

  const handleAddLMPSave = async () => {
      if (!newLMPName.trim()) { alert('Please enter a course title.'); return; }
      // Auto-generate a course code from the title:
      // Take first letter of each word, uppercase, max 8 chars — e.g. "Basic Flying Course" → "BFC"
      const words = newLMPName.trim().split(/\s+/);
      const autoCode = words.length === 1
          ? newLMPName.trim().toUpperCase().slice(0, 8)
          : words.map(w => w[0].toUpperCase()).join('').slice(0, 8);
      // Build the new course/LMP item with basics filled in
      const newItem: SyllabusItemDetail = {
          id: `new-lmp-${Date.now()}`,
          code: autoCode,
          phase: autoCode,
          module: newLMPName.trim(),
          dayNight: 'Day',
          eventDescription: newLMPName.trim(),
          prerequisites: [],
          prerequisitesGround: [],
          prerequisitesFlying: [],
          eventDetailsCommon: [],
          eventDetailsSortie: [],
          totalEventHours: 0,
          flightOrSimHours: 0,
          duration: 1,
          preFlightTime: 0,
          postFlightTime: 0,
          type: newLMPCourseType === 'Academic Training' ? 'Academics' : 'Ground School',
          methodOfDelivery: [],
          methodOfAssessment: [],
          resourcesPhysical: [],
          resourcesHuman: [],
          location: '',
          courses: [autoCode],
          lmpType: 'Master LMP',
      };
      setShowAddLMPModal(false);
      try {
          // Persist the new course/LMP skeleton to the database
          const { id: _tmpId, ...itemWithoutTmpId } = newItem;
          const savedItem = await createSyllabusItem(itemWithoutTmpId, `New course created: ${newLMPName.trim()}`);
          if (onAddItem) onAddItem(savedItem);
          // Switch to the new course and immediately enter edit mode
          // Use the actual code returned by server (may differ from autoCode if duplicate was resolved)
          const actualCode = savedItem.code || autoCode;
          setSelectedCourseType(actualCode);
          setSelectedItem(savedItem);
          setEditedItem(JSON.parse(JSON.stringify(savedItem)));
          setIsEditing(true);
          logAudit({ action: 'Create', description: `Created new course: ${savedItem.code}`, changes: `Course type: ${newLMPCourseType}`, page: 'Master LMP' });
      } catch (err: any) {
          alert(`❌ Failed to create course: ${err.message}`);
      }
  };

  const handleAddEvent = () => {
      // Create a blank new item pre-filled for the currently selected course
      const newItem: SyllabusItemDetail = {
          id: `new-${Date.now()}`,
          code: '',
          phase: '',
          module: '',
          dayNight: 'Day',
          eventDescription: '',
          prerequisites: [],
          prerequisitesGround: [],
          prerequisitesFlying: [],
          eventDetailsCommon: [],
          eventDetailsSortie: [],
          totalEventHours: 0,
          flightOrSimHours: 0,
          duration: 1,
          preFlightTime: 0,
          postFlightTime: 0,
          type: 'Ground School',
          methodOfDelivery: [],
          methodOfAssessment: [],
          resourcesPhysical: [],
          resourcesHuman: [],
          location: '',
          courses: [selectedCourseType],
          lmpType: 'Master LMP',
      };
      // Add optimistically to UI, then persist to DB
      if (onAddItem) onAddItem(newItem);
      setSelectedItem(newItem);
      setEditedItem(JSON.parse(JSON.stringify(newItem)));
      setIsEditing(true);
      // Persist to DB in background (save will finalize with real DB id)
      createSyllabusItem({ ...newItem, id: undefined }, 'New event added via Master LMP editor')
          .then(saved => { if (onAddItem) onAddItem(saved); setSelectedItem(saved); setEditedItem(JSON.parse(JSON.stringify(saved))); })
          .catch(err => console.warn('Could not pre-create event in DB:', err));
  };

  return (
    <>
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-white">Master LMP: {isEditing ? (
              <input
                  type="text"
                  value={editingCourseTitle}
                  onChange={e => setEditingCourseTitle(e.target.value)}
                  className="text-sky-400 bg-transparent border-b border-sky-400 outline-none text-2xl font-bold w-72 focus:border-sky-300"
                  placeholder="Course title..."
                  title="Edit course title"
              />
          ) : (
              <span className="text-sky-400">{getCourseTitle(selectedCourseType)}</span>
          )}</h1>
          <p className="text-sm text-gray-400">{isEditing ? 'Editing course title — changes apply to all events in this course' : 'Learning Management Package Details'}</p>
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
                    {courseLMPs.map(c => <option key={c} value={c}>{getCourseTitle(c)}</option>)}
                </select>
            </div>

            <div className="w-px h-8 bg-gray-600 mx-2"></div>

            {isEditing ? (
                <div className="flex items-center gap-[1px]">
                    <button onClick={handleAddEvent} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">Add Event</button>
                    <button onClick={handleSave} disabled={isSaving} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black disabled:opacity-60">{isSaving ? 'Saving…' : 'Save'}</button>
                    <button onClick={handleCancel} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">Cancel</button>
                </div>
            ) : (
                <div className="flex items-center gap-[1px]">
                    <AuditButton pageName="Master LMP" />
                    <button onClick={handleAddLMP} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">Add Course</button>
                    <button onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true); }} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500 disabled:opacity-50 disabled:cursor-not-allowed">Del Course</button>
                    <button onClick={() => { setUploadFile(null); setUploadResult(null); setShowUploadModal(true); }} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black disabled:opacity-50 disabled:cursor-not-allowed">Upload</button>
                    <button onClick={handleEdit} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">Edit</button>
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Column: List with 3 Columns */}
        <div className="w-1/4 border-r border-gray-700 overflow-hidden flex flex-col">
          {/* Sticky Header Row */}
          <div className="flex-shrink-0 flex gap-0 bg-gray-900">
            <div className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider p-2 border-b border-gray-700 border-r border-gray-700 text-center w-12 flex-shrink-0">Phase</div>
            <div className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider p-2 border-b border-gray-700 border-r border-gray-700 text-center w-[68px] flex-shrink-0">Module</div>
            <div className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider p-2 border-b border-gray-700 flex-1 whitespace-nowrap overflow-hidden">Event</div>
          </div>
          
          {/* Scrollable Data Rows */}
          <div className="flex-1 overflow-y-auto">
            {filteredSyllabusDetails.map((item, index) => {
              const totalItems = filteredSyllabusDetails.length;
              const midPoint = Math.ceil(totalItems / 2);
              const phaseNum = index < midPoint ? 1 : 2;
              const moduleNum = Math.floor((index * 12) / totalItems) + 1;
              const actualModule = Math.min(moduleNum, 12);

              return (
              <div key={item.id} className="flex gap-0">
                <button
                  onClick={() => {
                      if (!isEditing) {
                          setSelectedItem(item);
                      }
                  }}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                  disabled={isEditing}
                  className={`text-center p-2 transition-colors text-sm border-r border-gray-700 w-12 flex-shrink-0 ${
                      selectedItem?.id === item.id && !isEditing ? 'bg-sky-700 text-white font-semibold' : 'text-gray-300'
                  } ${isEditing ? 'cursor-not-allowed text-gray-500' : 'hover:bg-gray-700/50'}`}
                >
                  {phaseNum}
                </button>
                <button
                  onClick={() => {
                      if (!isEditing) {
                          setSelectedItem(item);
                      }
                  }}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                  disabled={isEditing}
                  className={`text-center p-2 transition-colors text-sm border-r border-gray-700 w-[68px] flex-shrink-0 ${
                      selectedItem?.id === item.id && !isEditing ? 'bg-sky-700 text-white font-semibold' : 'text-gray-300'
                  } ${isEditing ? 'cursor-not-allowed text-gray-500' : 'hover:bg-gray-700/50'}`}
                >
                  {actualModule}
                </button>
                <button
                  onClick={() => {
                      if (!isEditing) {
                          setSelectedItem(item);
                      }
                  }}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                  disabled={isEditing}
                  className={`text-left p-2 transition-colors text-sm flex-1 whitespace-nowrap overflow-hidden text-ellipsis ${
                      selectedItem?.id === item.id && !isEditing ? 'bg-sky-700 text-white font-semibold' : 'text-gray-300'
                  } ${isEditing ? 'cursor-not-allowed text-gray-500' : 'hover:bg-gray-700/50'}`}
                >
                  {item.code}
                </button>
              </div>
            );})}
            {filteredSyllabusDetails.length === 0 && (
                <div className="p-4 text-center text-gray-500 italic text-sm">No events found for this syllabus.</div>
            )}
          </div>
        </div>

        {/* Right Column: Detail View */}
        <div className="w-3/4 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto">
            {(hoveredItem || selectedItem) ? (
                <DetailView 
                    item={hoveredItem || selectedItem}
                    isEditing={isEditing}
                    editedItem={editedItem}
                    onItemChange={setEditedItem}
                    onDeleteEvent={handleDeleteEventRequest}
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

    {/* ── Add LMP Basics Modal ── */}
    {showAddLMPModal && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowAddLMPModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 12,
                    padding: 28, width: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    Add Course
                </h2>
                <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 20 }}>
                    A course code will be auto-generated from the title.
                </p>

                {/* Course Title */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Course Title *
                    </label>
                    <input
                        type="text"
                        value={newLMPName}
                        onChange={e => setNewLMPName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddLMPSave()}
                        placeholder="e.g. Basic Flying Course"
                        autoFocus
                        style={{ width: '100%', backgroundColor: '#111827', border: '1px solid #4b5563',
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    />
                    {newLMPName.trim() && (
                        <p style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                            Auto-generated code: <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                                {newLMPName.trim().split(/\s+/).length === 1
                                    ? newLMPName.trim().toUpperCase().slice(0, 8)
                                    : newLMPName.trim().split(/\s+/).map((w: string) => w[0].toUpperCase()).join('').slice(0, 8)}
                            </span>
                        </p>
                    )}
                </div>

                {/* Course Type */}
                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Course Type
                    </label>
                    <select
                        value={newLMPCourseType}
                        onChange={e => setNewLMPCourseType(e.target.value as 'Flight Training' | 'Academic Training')}
                        style={{ width: '100%', backgroundColor: '#111827', border: '1px solid #4b5563',
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    >
                        <option value="Flight Training">Flight Training</option>
                        <option value="Academic Training">Academic Training</option>
                    </select>
                    <p style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                        {newLMPCourseType === 'Academic Training'
                            ? 'Academic Training: theory/classroom instruction delivered prior to the flying phase.'
                            : 'Flight Training: airborne, simulator and associated ground events during the flying phase.'}
                    </p>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        onClick={() => setShowAddLMPModal(false)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAddLMPSave}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    )}

    {/* ── Delete Course Confirmation Modal ── */}
    {showDeleteModal && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)', zIndex: 10001,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowDeleteModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #ef4444', borderRadius: 12,
                    padding: 28, width: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                    ⚠️ Delete Course: {getCourseTitle(selectedCourseType)}
                </h2>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, lineHeight: 1.6 }}>
                    This will permanently retire <strong style={{ color: '#f9fafb' }}>all events</strong> in the <strong style={{ color: '#f9fafb' }}>{getCourseTitle(selectedCourseType)}</strong> course from the database.
                    This action cannot be undone. Enter your password to confirm.
                </p>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Your Password *
                    </label>
                    <input
                        type="password"
                        value={deletePassword}
                        onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleDeleteCourse()}
                        placeholder="Enter your password to confirm"
                        autoFocus
                        style={{ width: '100%', backgroundColor: '#111827', border: `1px solid ${deleteError ? '#ef4444' : '#4b5563'}`,
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    />
                    {deleteError && (
                        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{deleteError}</p>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        onClick={() => setShowDeleteModal(false)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteCourse}
                        disabled={isDeleting}
                        className="w-[72px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500 disabled:opacity-60"
                    >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    )}
    {/* Delete Event Modal */}
    {showDeleteEventModal && deleteEventItem && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)', zIndex: 10002,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !isDeletingEvent && setShowDeleteEventModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #ef4444', borderRadius: 12,
                    padding: 28, width: 440, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                    🗑 Delete Event
                </h2>
                <p style={{ fontSize: 13, color: '#d1d5db', marginBottom: 4 }}>
                    <strong>{deleteEventItem.code}</strong> — {deleteEventItem.eventDescription}
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, lineHeight: 1.6 }}>
                    This will permanently remove this event from the database. This action cannot be undone. Enter your password to confirm.
                </p>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Your Password *
                    </label>
                    <input
                        type="password"
                        value={deleteEventPassword}
                        onChange={e => { setDeleteEventPassword(e.target.value); setDeleteEventError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleDeleteEventConfirm()}
                        autoFocus
                        placeholder="Enter your login password"
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, backgroundColor: '#111827',
                            border: `1px solid ${deleteEventError ? '#ef4444' : '#374151'}`, borderRadius: 6,
                            color: '#f9fafb', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {deleteEventError && (
                        <p style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>{deleteEventError}</p>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        onClick={() => setShowDeleteEventModal(false)}
                        disabled={isDeletingEvent}
                        style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                            backgroundColor: '#374151', color: '#d1d5db', border: 'none', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteEventConfirm}
                        disabled={isDeletingEvent}
                        style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                            backgroundColor: '#dc2626', color: '#ffffff', border: 'none',
                            cursor: isDeletingEvent ? 'not-allowed' : 'pointer', opacity: isDeletingEvent ? 0.6 : 1 }}
                    >
                        {isDeletingEvent ? 'Deleting…' : 'Delete Event'}
                    </button>
                </div>
            </div>
        </div>
    )}

    {/* Bulk Upload Modal */}
    {showUploadModal && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)', zIndex: 10001,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !isUploading && setShowUploadModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #38bdf8', borderRadius: 12,
                    padding: 28, width: 480, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
                    📤 Bulk Upload LMP Events
                </h2>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, lineHeight: 1.6 }}>
                    Upload an Excel (.xlsx) file to populate <strong style={{ color: '#f9fafb' }}>{getCourseTitle(selectedCourseType)}</strong> with LMP events.
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
                    The spreadsheet must have a sheet named <strong style={{ color: '#d1d5db' }}>Syllabus_LMP</strong> with columns: Code, Course, Type, Event description, Event Details - Sortie, Total Event Hours, Method/s of Delivery, Resources Required (Human). Optional columns: Phase, Module, Day/Night, Dual/Solo, prerequisites, Event Details - Common, Flight or Sim Hours, Method/s of Assessment, Resources Required (physical).
                </p>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Select Excel File (.xlsx)
                    </label>
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadResult(null); }}
                        style={{ display: 'block', width: '100%', fontSize: 13, color: '#f9fafb',
                            backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px' }}
                    />
                </div>

                {uploadFile && !uploadResult && (
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                        Selected: <strong style={{ color: '#d1d5db' }}>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </p>
                )}

                {uploadResult && (
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: uploadResult.errors.length > 0 ? '#1c1917' : '#052e16',
                        border: `1px solid ${uploadResult.errors.length > 0 ? '#78350f' : '#166534'}`, borderRadius: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: uploadResult.errors.length > 0 ? '#fbbf24' : '#4ade80', marginBottom: 4 }}>
                            {uploadResult.message}
                        </p>
                        <p style={{ fontSize: 11, color: '#9ca3af' }}>
                            ✅ {uploadResult.created} created &nbsp;|&nbsp; ⏭ {uploadResult.skipped} skipped
                            {uploadResult.errors.length > 0 && <span style={{ color: '#f87171' }}> &nbsp;|&nbsp; ❌ {uploadResult.errors.length} errors</span>}
                        </p>
                        {uploadResult.errors.length > 0 && (
                            <div style={{ marginTop: 8, maxHeight: 100, overflowY: 'auto' }}>
                                {uploadResult.errors.map((e: any, i: number) => (
                                    <p key={i} style={{ fontSize: 10, color: '#f87171' }}>Row {e.row}: {e.error}</p>
                                ))}
                            </div>
                        )}
                        {uploadResult.created > 0 && (
                            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Page will reload automatically…</p>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button
                        onClick={() => setShowUploadModal(false)}
                        disabled={isUploading}
                        style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                            backgroundColor: '#374151', color: '#d1d5db', border: 'none', cursor: 'pointer' }}
                    >
                        {uploadResult?.created ? 'Close' : 'Cancel'}
                    </button>
                    {!uploadResult && (
                        <button
                            onClick={handleBulkUpload}
                            disabled={!uploadFile || isUploading}
                            style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                                backgroundColor: uploadFile && !isUploading ? '#0284c7' : '#1e3a5f',
                                color: '#fff', border: 'none', cursor: uploadFile && !isUploading ? 'pointer' : 'not-allowed' }}
                        >
                            {isUploading ? 'Uploading…' : '📤 Upload & Import'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default SyllabusView;
