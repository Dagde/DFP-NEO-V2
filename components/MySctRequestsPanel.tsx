import React, { useMemo, useState } from 'react';
import { SctRequest } from '../types';
import { showDarkConfirm } from './DarkMessageModal';

type SctRequestType = 'flight' | 'ftd';

interface MySctRequestsPanelProps {
  requests: SctRequest[];
  currentUserId?: string;
  profileName: string;
  continuationShortLabel: string;
  continuationLongLabel: string;
  onPatchRequest: (id: string, updates: Partial<SctRequest>, type: SctRequestType) => void | Promise<void>;
  onCancelRequest: (id: string, type: SctRequestType) => void | Promise<void>;
}

const normaliseName = (value: unknown): string => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const inferRequestType = (request: SctRequest): SctRequestType => (
  request.requestType === 'ftd' || String(request.event || '').toUpperCase().includes('FTD') ? 'ftd' : 'flight'
);

const formatRequestDate = (value?: string): string => {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
};

const MySctRequestsPanel: React.FC<MySctRequestsPanelProps> = ({
  requests,
  currentUserId,
  profileName,
  continuationShortLabel,
  continuationLongLabel,
  onPatchRequest,
  onCancelRequest,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const myRequests = useMemo(() => {
    const currentId = String(currentUserId || '').trim();
    const profileKey = normaliseName(profileName);
    const reversedProfileKey = normaliseName(profileName.split(/\s+/).reverse().join(', '));
    return requests
      .filter(request => {
        const requestUserId = String(request.userId || '').trim();
        if (currentId && requestUserId) return requestUserId === currentId;
        const requestName = normaliseName(request.name);
        return Boolean(profileKey) && (requestName === profileKey || requestName === reversedProfileKey);
      })
      .sort((a, b) => String(b.dateRequested || '').localeCompare(String(a.dateRequested || '')));
  }, [currentUserId, profileName, requests]);

  const handleCancel = async (request: SctRequest) => {
    const confirmed = await showDarkConfirm(
      `Cancel this ${continuationShortLabel} / currency request?`,
      'Cancel Request',
      'warning'
    );
    if (!confirmed) return;
    await onCancelRequest(request.id, inferRequestType(request));
    if (editingId === request.id) setEditingId(null);
  };

  return (
    <div className="mt-4 rounded-md border border-sky-500/20 bg-gray-950/35">
      <div className="flex items-center justify-between border-b border-sky-500/10 px-3 py-2">
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wide text-sky-100">My {continuationShortLabel} / Currency Requests</h5>
          <p className="mt-0.5 text-[11px] text-gray-400">View, edit or cancel requests lodged by the logged-in user.</p>
        </div>
        <span className="rounded bg-sky-900/50 px-2 py-0.5 text-[11px] font-bold text-sky-200">{myRequests.length}</span>
      </div>
      <div className="max-h-72 overflow-y-auto p-3">
        {myRequests.length === 0 ? (
          <p className="rounded border border-dashed border-gray-700 bg-gray-900/30 px-3 py-4 text-center text-xs italic text-gray-500">
            No lodged {continuationLongLabel.toLowerCase()} requests for this user.
          </p>
        ) : (
          <div className="space-y-2">
            {myRequests.map(request => {
              const isEditing = editingId === request.id;
              const type = inferRequestType(request);
              return (
                <div key={request.id} className="rounded border border-gray-700 bg-gray-900/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{request.event || 'Untitled request'}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                        <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-300">{type === 'ftd' ? 'FTD' : 'Flight'}</span>
                        <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-300">{request.priority || 'Medium'}</span>
                        {request.submitted && <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-emerald-200">Submitted</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setEditingId(isEditing ? null : request.id)} className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[11px] font-semibold text-gray-100 hover:border-sky-400">
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                      <button type="button" onClick={() => handleCancel(request)} className="rounded border border-red-500/40 bg-red-950/40 px-2 py-1 text-[11px] font-semibold text-red-200 hover:border-red-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                    <div><span className="text-gray-500">Currency:</span> {request.currency || 'Not set'}</div>
                    <div><span className="text-gray-500">Expires:</span> {formatRequestDate(request.currencyExpire)}</div>
                    <div><span className="text-gray-500">Requested:</span> {formatRequestDate(request.dateRequested)}</div>
                    <div><span className="text-gray-500">Time:</span> {request.requestedTime || 'Not set'}</div>
                  </div>
                  {isEditing && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-semibold text-gray-400">
                        Priority
                        <select
                          value={request.priority || 'Medium'}
                          onChange={event => onPatchRequest(request.id, { priority: event.target.value as SctRequest['priority'] }, type)}
                          className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-semibold text-gray-400">
                        Requested Time
                        <input
                          type="time"
                          value={request.requestedTime || '15:00'}
                          onChange={event => onPatchRequest(request.id, { requestedTime: event.target.value }, type)}
                          className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-gray-400">
                        Currency Expires
                        <input
                          type="date"
                          value={request.currencyExpire || ''}
                          onChange={event => onPatchRequest(request.id, { currencyExpire: event.target.value }, type)}
                          className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white"
                          style={{ colorScheme: 'dark' }}
                        />
                      </label>
                      <label className="col-span-2 text-[11px] font-semibold text-gray-400">
                        Notes
                        <textarea
                          defaultValue={request.notes || ''}
                          onBlur={event => {
                            if (event.target.value !== (request.notes || '')) {
                              onPatchRequest(request.id, { notes: event.target.value }, type);
                            }
                          }}
                          rows={2}
                          className="mt-1 block w-full resize-y rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySctRequestsPanel;
