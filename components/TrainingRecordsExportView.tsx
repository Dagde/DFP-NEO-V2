import React, { useState, useMemo } from 'react';
import { Trainee, Instructor, ScheduleEvent, Course, Score } from '../types';

interface TrainingRecordsExportViewProps {
    traineesData: Trainee[];
    instructorsData: Instructor[];
    events: ScheduleEvent[];
    courses: Course[];
    scores: Map<string, Score[]>;
    publishedSchedules: Record<string, ScheduleEvent[]>;
}

type RecordType = 'all' | 'trainees' | 'staff' | 'events';
type TimePeriod = 'all-time' | 'single-date' | 'date-range';
type OutputFormat = 'pdf' | 'excel' | 'csv';
type EventType = 'Flight' | 'FTD' | 'CPT' | 'Ground';
type StatusFilter = 'all' | 'completed' | 'cancelled';
type RemedialFilter = 'all' | 'yes' | 'no';

interface ExportTemplate {
    name: string;
    recordType: RecordType;
    timePeriod: TimePeriod;
    singleDate: string;
    startDate: string;
    endDate: string;
    outputFormat: OutputFormat;
    selectedTrainees: string[];
    selectedStaff: string[];
    selectedCourses: string[];
    selectedEventTypes: EventType[];
    statusFilter: StatusFilter;
    remedialFilter: RemedialFilter;
}

const TrainingRecordsExportView: React.FC<TrainingRecordsExportViewProps> = ({
    traineesData,
    instructorsData,
    events,
    courses,
    scores,
    publishedSchedules
}) => {
    // Core export settings
    const [recordType, setRecordType] = useState<RecordType>('all');
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('all-time');
    const [singleDate, setSingleDate] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('pdf');

    // Optional filters
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
    const [selectedEventTypes, setSelectedEventTypes] = useState<EventType[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [remedialFilter, setRemedialFilter] = useState<RemedialFilter>('all');

    // Template management
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [savedTemplates, setSavedTemplates] = useState<ExportTemplate[]>([]);

    // Format date as dd MMM yy
    const formatDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = date.toLocaleString('en-GB', { month: 'short' });
        const year = String(date.getFullYear()).slice(-2);
        return `${day} ${month} ${year}`;
    };

    // Get all events from published schedules
    const allEvents = useMemo(() => {
        return Object.values(publishedSchedules).flat();
    }, [publishedSchedules]);

    // Filter events based on current settings
    const filteredEvents = useMemo(() => {
        let filtered = [...allEvents];

        // Time period filter
        if (timePeriod === 'single-date' && singleDate) {
            filtered = filtered.filter(e => e.date === singleDate);
        } else if (timePeriod === 'date-range' && startDate && endDate) {
            filtered = filtered.filter(e => e.date >= startDate && e.date <= endDate);
        }

        // Event type filter
        if (selectedEventTypes.length > 0) {
            filtered = filtered.filter(e => selectedEventTypes.includes(e.type as EventType));
        }

        // Status filter
        if (statusFilter === 'completed') {
            filtered = filtered.filter(e => !e.isCancelled);
        } else if (statusFilter === 'cancelled') {
            filtered = filtered.filter(e => e.isCancelled);
        }

        // Remedial filter
        if (remedialFilter === 'yes') {
            filtered = filtered.filter(e => e.isRemedial);
        } else if (remedialFilter === 'no') {
            filtered = filtered.filter(e => !e.isRemedial);
        }

        // People filter
        if (selectedTrainees.length > 0) {
            filtered = filtered.filter(e => 
                e.student && selectedTrainees.includes(e.student) ||
                e.pilot && selectedTrainees.includes(e.pilot)
            );
        }
        if (selectedStaff.length > 0) {
            filtered = filtered.filter(e => 
                e.instructor && selectedStaff.includes(e.instructor)
            );
        }

        // Course filter
        if (selectedCourses.length > 0) {
            const courseTrainees = traineesData.filter(t => selectedCourses.includes(t.course));
            const traineeNames = courseTrainees.map(t => t.name);
            filtered = filtered.filter(e => 
                (e.student && traineeNames.includes(e.student)) ||
                (e.pilot && traineeNames.includes(e.pilot))
            );
        }

        return filtered;
    }, [allEvents, timePeriod, singleDate, startDate, endDate, selectedEventTypes, 
        statusFilter, remedialFilter, selectedTrainees, selectedStaff, selectedCourses, traineesData]);

    // Calculate filtered data based on record type
    const filteredData = useMemo(() => {
        if (recordType === 'events') {
            return { events: filteredEvents, trainees: [], staff: [] };
        }

        const eventTrainees = new Set<string>();
        const eventStaff = new Set<string>();

        filteredEvents.forEach(e => {
            if (e.student) eventTrainees.add(e.student);
            if (e.pilot) eventTrainees.add(e.pilot);
            if (e.instructor) eventStaff.add(e.instructor);
        });

        let trainees = traineesData.filter(t => eventTrainees.has(t.name));
        let staff = instructorsData.filter(i => eventStaff.has(i.name));

        if (recordType === 'trainees') {
            return { events: filteredEvents, trainees, staff: [] };
        } else if (recordType === 'staff') {
            return { events: filteredEvents, trainees: [], staff };
        } else {
            return { events: filteredEvents, trainees, staff };
        }
    }, [recordType, filteredEvents, traineesData, instructorsData]);

    // Calculate record count
    const recordCount = useMemo(() => {
        let count = 0;
        if (recordType === 'all' || recordType === 'trainees') count += filteredData.trainees.length;
        if (recordType === 'all' || recordType === 'staff') count += filteredData.staff.length;
        if (recordType === 'all' || recordType === 'events') count += filteredData.events.length;
        return count;
    }, [recordType, filteredData]);

    // Estimate file size (rough approximation)
    const estimatedSize = useMemo(() => {
        const bytesPerRecord = outputFormat === 'pdf' ? 5000 : outputFormat === 'excel' ? 2000 : 500;
        const totalBytes = recordCount * bytesPerRecord;
        if (totalBytes < 1024) return `${totalBytes} B`;
        if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
        return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }, [recordCount, outputFormat]);

    // Check if export is large
    const isLargeExport = recordCount > 1000;

    // Get time period description
    const getTimePeriodDescription = () => {
        if (timePeriod === 'all-time') return 'All time';
        if (timePeriod === 'single-date' && singleDate) return formatDate(singleDate);
        if (timePeriod === 'date-range' && startDate && endDate) {
            return `${formatDate(startDate)} to ${formatDate(endDate)}`;
        }
        return 'Not specified';
    };

    // Get record type description
    const getRecordTypeDescription = () => {
        if (recordType === 'all') return 'All records (Trainees, Staff, Events)';
        if (recordType === 'trainees') return 'Trainee records';
        if (recordType === 'staff') return 'Staff records';
        return 'Event records';
    };

    // Handle export
    const handleExport = () => {
        console.log('Exporting:', {
            recordType,
            timePeriod,
            outputFormat,
            recordCount,
            data: filteredData
        });
        // TODO: Implement actual export logic
        alert(`Export initiated!\n\nFormat: ${outputFormat.toUpperCase()}\nRecords: ${recordCount}\nSize: ${estimatedSize}`);
    };

    // Handle save template
    const handleSaveTemplate = () => {
        if (!templateName.trim()) {
            alert('Please enter a template name');
            return;
        }

        const template: ExportTemplate = {
            name: templateName,
            recordType,
            timePeriod,
            singleDate,
            startDate,
            endDate,
            outputFormat,
            selectedTrainees,
            selectedStaff,
            selectedCourses,
            selectedEventTypes,
            statusFilter,
            remedialFilter
        };

        setSavedTemplates([...savedTemplates, template]);
        setTemplateName('');
        alert(`Template "${template.name}" saved successfully!`);
    };

    // Handle load template
    const handleLoadTemplate = (template: ExportTemplate) => {
        setRecordType(template.recordType);
        setTimePeriod(template.timePeriod);
        setSingleDate(template.singleDate);
        setStartDate(template.startDate);
        setEndDate(template.endDate);
        setOutputFormat(template.outputFormat);
        setSelectedTrainees(template.selectedTrainees);
        setSelectedStaff(template.selectedStaff);
        setSelectedCourses(template.selectedCourses);
        setSelectedEventTypes(template.selectedEventTypes);
        setStatusFilter(template.statusFilter);
        setRemedialFilter(template.remedialFilter);
        setShowTemplates(false);
    };

    return (
        <div className="h-full overflow-auto bg-gray-900 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h1 className="text-2xl font-bold text-white mb-2">Export Training Records</h1>
                    <p className="text-gray-400">
                        Export PT051 training records for printing or official record keeping.
                        Select your options below and preview before exporting.
                    </p>
                </div>

                {/* Question 1: What records? */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">What records do you want to export?</h2>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'all'}
                                onChange={() => setRecordType('all')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">All records (Trainees, Staff, and Events)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'trainees'}
                                onChange={() => setRecordType('trainees')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Trainee records only</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'staff'}
                                onChange={() => setRecordType('staff')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Staff records only</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={recordType === 'events'}
                                onChange={() => setRecordType('events')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Event records only</span>
                        </label>
                    </div>
                </div>

                {/* Question 2: Time period? */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">For what period?</h2>
                    <div className="space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={timePeriod === 'all-time'}
                                onChange={() => setTimePeriod('all-time')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">All time</span>
                        </label>
                        
                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    checked={timePeriod === 'single-date'}
                                    onChange={() => setTimePeriod('single-date')}
                                    className="w-4 h-4 text-sky-500"
                                />
                                <span className="text-gray-200">Single date</span>
                            </label>
                            {timePeriod === 'single-date' && (
                                <input
                                    type="date"
                                    value={singleDate}
                                    onChange={(e) => setSingleDate(e.target.value)}
                                    className="ml-7 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                />
                            )}
                        </div>

                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer mb-2">
                                <input
                                    type="radio"
                                    checked={timePeriod === 'date-range'}
                                    onChange={() => setTimePeriod('date-range')}
                                    className="w-4 h-4 text-sky-500"
                                />
                                <span className="text-gray-200">Date range</span>
                            </label>
                            {timePeriod === 'date-range' && (
                                <div className="ml-7 flex items-center space-x-3">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        placeholder="Start date"
                                    />
                                    <span className="text-gray-400">to</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        placeholder="End date"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Question 3: Output format */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">What format?</h2>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'pdf'}
                                onChange={() => setOutputFormat('pdf')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">PDF (recommended for printing and filing)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'excel'}
                                onChange={() => setOutputFormat('excel')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">Excel (for further analysis)</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                checked={outputFormat === 'csv'}
                                onChange={() => setOutputFormat('csv')}
                                className="w-4 h-4 text-sky-500"
                            />
                            <span className="text-gray-200">CSV (for data import)</span>
                        </label>
                    </div>
                </div>

                {/* Optional filters */}
                <div className="bg-gray-800 rounded-lg border border-gray-700">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full p-6 flex items-center justify-between text-left"
                    >
                        <h2 className="text-lg font-semibold text-white">
                            Do you want to narrow it down? <span className="text-gray-500 text-sm font-normal">(optional)</span>
                        </h2>
                        <span className="text-gray-400">{showFilters ? '▼' : '▶'}</span>
                    </button>
                    
                    {showFilters && (
                        <div className="px-6 pb-6 space-y-6 border-t border-gray-700 pt-6">
                            {/* Event types */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Event Types</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['Flight', 'FTD', 'CPT', 'Ground'] as EventType[]).map(type => (
                                        <label key={type} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedEventTypes.includes(type)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedEventTypes([...selectedEventTypes, type]);
                                                    } else {
                                                        setSelectedEventTypes(selectedEventTypes.filter(t => t !== type));
                                                    }
                                                }}
                                                className="w-4 h-4 text-sky-500"
                                            />
                                            <span className="text-gray-200">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Status</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'all'}
                                            onChange={() => setStatusFilter('all')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">All</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'completed'}
                                            onChange={() => setStatusFilter('completed')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Completed only</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={statusFilter === 'cancelled'}
                                            onChange={() => setStatusFilter('cancelled')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Cancelled only</span>
                                    </label>
                                </div>
                            </div>

                            {/* Remedial */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Remedial</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'all'}
                                            onChange={() => setRemedialFilter('all')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">All</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'yes'}
                                            onChange={() => setRemedialFilter('yes')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Remedial only</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={remedialFilter === 'no'}
                                            onChange={() => setRemedialFilter('no')}
                                            className="w-4 h-4 text-sky-500"
                                        />
                                        <span className="text-gray-200">Non-remedial only</span>
                                    </label>
                                </div>
                            </div>

                            {/* Courses */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Courses</h3>
                                <select
                                    multiple
                                    value={selectedCourses}
                                    onChange={(e) => {
                                        const options = Array.from(e.target.selectedOptions, option => option.value);
                                        setSelectedCourses(options);
                                    }}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                    size={5}
                                >
                                    {courses.map(course => (
                                        <option key={course.name} value={course.name}>
                                            {course.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                            </div>

                            {/* Specific trainees */}
                            {(recordType === 'all' || recordType === 'trainees') && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-3">Specific Trainees</h3>
                                    <select
                                        multiple
                                        value={selectedTrainees}
                                        onChange={(e) => {
                                            const options = Array.from(e.target.selectedOptions, option => option.value);
                                            setSelectedTrainees(options);
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        size={5}
                                    >
                                        {traineesData.map(trainee => (
                                            <option key={trainee.name} value={trainee.name}>
                                                {trainee.rank} {trainee.name} ({trainee.course})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                </div>
                            )}

                            {/* Specific staff */}
                            {(recordType === 'all' || recordType === 'staff') && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-3">Specific Staff</h3>
                                    <select
                                        multiple
                                        value={selectedStaff}
                                        onChange={(e) => {
                                            const options = Array.from(e.target.selectedOptions, option => option.value);
                                            setSelectedStaff(options);
                                        }}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                        size={5}
                                    >
                                        {instructorsData.map(instructor => (
                                            <option key={instructor.name} value={instructor.name}>
                                                {instructor.rank} {instructor.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Export Summary */}
                <div className="bg-sky-900/30 rounded-lg p-6 border border-sky-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Export Summary</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-400">Record Type:</span>
                            <p className="text-white font-medium">{getRecordTypeDescription()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Time Period:</span>
                            <p className="text-white font-medium">{getTimePeriodDescription()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Output Format:</span>
                            <p className="text-white font-medium">{outputFormat.toUpperCase()}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Estimated Size:</span>
                            <p className="text-white font-medium">{estimatedSize}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-sky-700">
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold text-white">Total Records:</span>
                            <span className="text-2xl font-bold text-sky-400">{recordCount}</span>
                        </div>
                        {isLargeExport && (
                            <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
                                <p className="text-yellow-200 text-sm">
                                    ⚠️ Large export ({recordCount} records). This may take a few moments to generate.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview Table */}
                {recordCount > 0 && (
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-lg font-semibold text-white mb-4">Preview (first 5 records)</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-gray-700 text-gray-300">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Event</th>
                                        <th className="px-4 py-2">Trainee</th>
                                        <th className="px-4 py-2">Instructor</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.events.slice(0, 5).map((event, idx) => (
                                        <tr key={idx} className="border-b border-gray-700">
                                            <td className="px-4 py-2 text-gray-300">{formatDate(event.date)}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.type}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.flightNumber}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.student || event.pilot || '-'}</td>
                                            <td className="px-4 py-2 text-gray-300">{event.instructor || '-'}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    event.isCancelled ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'
                                                }`}>
                                                    {event.isCancelled ? 'Cancelled' : 'Completed'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredData.events.length > 5 && (
                                <p className="text-gray-500 text-sm mt-2">
                                    ... and {filteredData.events.length - 5} more records
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleExport}
                                disabled={recordCount === 0}
                                className={`px-6 py-3 rounded font-semibold ${
                                    recordCount === 0
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-sky-600 hover:bg-sky-700 text-white'
                                }`}
                            >
                                Export {outputFormat.toUpperCase()}
                            </button>
                            <button
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded"
                            >
                                Templates
                            </button>
                        </div>
                        {recordCount === 0 && (
                            <p className="text-yellow-400 text-sm">
                                No records match your criteria. Please adjust your filters.
                            </p>
                        )}
                    </div>

                    {/* Template Management */}
                    {showTemplates && (
                        <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-2">Save Current Settings as Template</h3>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="Template name"
                                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                                    />
                                    <button
                                        onClick={handleSaveTemplate}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            {savedTemplates.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-2">Saved Templates</h3>
                                    <div className="space-y-2">
                                        {savedTemplates.map((template, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                                                <span className="text-white">{template.name}</span>
                                                <button
                                                    onClick={() => handleLoadTemplate(template)}
                                                    className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm"
                                                >
                                                    Load
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrainingRecordsExportView;