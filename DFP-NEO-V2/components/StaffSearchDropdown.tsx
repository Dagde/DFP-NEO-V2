import React, { useState, useMemo, useEffect, useRef } from 'react';

interface StaffMember {
  name: string;
  rank: string;
  unit?: string;
}

interface StaffSearchDropdownProps {
  staff: StaffMember[];
  selectedStaff?: string;
  onSelect: (staffName: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const StaffSearchDropdown: React.FC<StaffSearchDropdownProps> = ({
  staff,
  selectedStaff,
  onSelect,
  placeholder = "Search staff...",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Group staff by unit
  const staffByUnit = useMemo(() => {
    const grouped = staff.reduce((acc, person) => {
      const unit = person.unit || 'Unassigned';
      if (!acc[unit]) {
        acc[unit] = [];
      }
      acc[unit].push(person);
      return acc;
    }, {} as Record<string, StaffMember[]>);

    // Sort units: 1FTS, CFS, 2FTS first, then alphabetically
    const unitOrder = ['1FTS', 'CFS', '2FTS'];
    const sortedUnits = Object.keys(grouped).sort((a, b) => {
      const aIndex = unitOrder.indexOf(a);
      const bIndex = unitOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    // Sort staff within each unit by rank then name
    Object.keys(grouped).forEach(unit => {
      grouped[unit].sort((a, b) => {
        if (a.rank !== b.rank) return a.rank.localeCompare(b.rank);
        return a.name.localeCompare(b.name);
      });
    });

    return sortedUnits.reduce((acc, unit) => {
      acc[unit] = grouped[unit];
      return acc;
    }, {} as Record<string, StaffMember[]>);
  }, [staff]);

  // Filter staff based on search term
  const filteredStaffByUnit = useMemo(() => {
    if (!searchTerm) return staffByUnit;

    const filtered = {} as Record<string, StaffMember[]>;
    Object.entries(staffByUnit).forEach(([unit, members]) => {
      const filteredMembers = members.filter(person =>
        person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.rank.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (person.unit && person.unit.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      if (filteredMembers.length > 0) {
        filtered[unit] = filteredMembers;
      }
    });
    return filtered;
  }, [staffByUnit, searchTerm]);

  const displayValue = selectedStaff || '';

  const handleSelect = (staffName: string) => {
    onSelect(staffName);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-left px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed ${!selectedStaff && !defaultName ? 'text-gray-400' : ''}`}
      >
        {displayValue || placeholder}
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-gray-600">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {Object.entries(filteredStaffByUnit).map(([unit, members]) => (
              <div key={unit}>
                <div className="px-3 py-1 bg-gray-900 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {unit}
                </div>
                {members.map((person) => (
                  <button
                    key={person.name}
                    type="button"
                    onClick={() => handleSelect(person.name)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
                  >
                    <span className="font-medium">{person.rank}</span> {person.name}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(filteredStaffByUnit).length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No staff found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffSearchDropdown;