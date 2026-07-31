import React, { useState } from 'react';
import { CancellationCode, CancellationCodeCategory, CancellationCodeAppliesTo } from '../types';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { handleEditableTextBeforeInput, handleEditableTextKeyDownCapture, stopEditableKeyPropagation } from '../utils/editableKeyEvents';

interface CancellationCodesTableProps {
  codes: CancellationCode[];
  onAddCode: (code: CancellationCode) => void;
  onEditCode: (oldCode: string, newCode: CancellationCode) => void;
  onToggleActive: (code: string) => void;
  onDeleteCode: (code: string) => void;
  canEdit: boolean; // Based on user role
  usedCodes: Set<string>; // Codes that have been used in cancellations
  isLoading?: boolean; // Loading state while fetching from DB
  resourceDisplayNames?: ResourceDisplayNames;
}

const CancellationCodesTable: React.FC<CancellationCodesTableProps> = ({
  codes,
  onAddCode,
  onEditCode,
  onToggleActive,
  onDeleteCode,
  canEdit,
  usedCodes,
  isLoading = false,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [formData, setFormData] = useState<Partial<CancellationCode>>({
    code: '',
    category: 'Aircraft',
    description: '',
    appliesTo: 'Both',
    isActive: true,
  });
  const standardActionButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';

  const handleStartAdd = () => {
    if (!isEditUnlocked) return;
    setFormData({
      code: '',
      category: 'Aircraft',
      description: '',
      appliesTo: 'Both',
      isActive: true,
    });
    setIsAddingNew(true);
    setEditingCode(null);
  };

  const handleStartEdit = (code: CancellationCode) => {
    if (!isEditUnlocked) return;
    setFormData(code);
    setEditingCode(code.code);
    setIsAddingNew(false);
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingCode(null);
    setFormData({
      code: '',
      category: 'Aircraft',
      description: '',
      appliesTo: 'Both',
      isActive: true,
    });
  };

  const handleDelete = (code: string) => {
    if (!isEditUnlocked) return;
    setDeletingCode(code);
  };

  const confirmDelete = () => {
    if (deletingCode) {
      onDeleteCode(deletingCode);
      setDeletingCode(null);
    }
  };

  const cancelDelete = () => {
    setDeletingCode(null);
  };

  const handleSave = () => {
    if (!isEditUnlocked) return;
    if (!formData.code || !formData.description) {
      return;
    }

    const newCode: CancellationCode = {
      code: formData.code.toUpperCase(),
      category: formData.category as CancellationCodeCategory,
      description: formData.description,
      appliesTo: formData.appliesTo as CancellationCodeAppliesTo,
      isActive: formData.isActive ?? true,
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isAddingNew) {
      onAddCode(newCode);
    } else if (editingCode) {
      onEditCode(editingCode, newCode);
    }

    handleCancel();
  };

  const handleToggleEditUnlocked = () => {
    if (isEditUnlocked) {
      handleCancel();
      setDeletingCode(null);
      setIsEditUnlocked(false);
      return;
    }
    setIsEditUnlocked(true);
  };

  const sortedCodes = [...codes].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.code.localeCompare(b.code);
  });
  const deletingCodeHasHistory = deletingCode ? usedCodes.has(deletingCode) : false;

  const formatAppliesToLabel = (value?: CancellationCodeAppliesTo) => {
    if (value === 'FTD') return resourceDisplayNames.ftd;
    if (value === 'Both') return `Flight + ${resourceDisplayNames.ftd}`;
    return 'Flight';
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Cancellation Codes</h2>
          {canEdit && (
            <div className="w-24 h-8 bg-gray-700 rounded animate-pulse" />
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Code</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Category</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Description</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Applies To</th>
                <th className="text-center py-3 px-4 text-gray-300 font-semibold">Status</th>
                {canEdit && <th className="text-center py-3 px-4 text-gray-300 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-gray-700">
                  <td className="py-3 px-4">
                    <div className="w-12 h-4 bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-20 h-4 bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-48 h-4 bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-16 h-4 bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="w-14 h-5 bg-gray-700 rounded animate-pulse mx-auto" />
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4">
                      <div className="flex justify-center space-x-2">
                        <div className="w-10 h-6 bg-gray-700 rounded animate-pulse" />
                        <div className="w-20 h-6 bg-gray-700 rounded animate-pulse" />
                        <div className="w-12 h-6 bg-gray-700 rounded animate-pulse" />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center space-x-2 text-gray-400 text-sm">
          <svg className="animate-spin h-4 w-4 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading cancellation codes from database…</span>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Cancellation Codes</h2>
        {canEdit && (
          <div className="flex items-center gap-[1px]">
            <button
              type="button"
              onClick={handleToggleEditUnlocked}
              className={standardActionButtonClass}
            >
              {isEditUnlocked ? 'Lock' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={handleStartAdd}
              disabled={!isEditUnlocked || isAddingNew || editingCode !== null}
              className={standardActionButtonClass}
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Code</th>
              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Category</th>
              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Description</th>
              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Applies To</th>
              <th className="text-center py-3 px-4 text-gray-300 font-semibold">Status</th>
              {canEdit && <th className="text-center py-3 px-4 text-gray-300 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isAddingNew && (
              <tr className="border-b border-gray-700 bg-gray-700/30">
                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    onBeforeInput={(event) => handleEditableTextBeforeInput(event, (value) => setFormData({ ...formData, code: value.toUpperCase() }), 4)}
                    onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, (value) => setFormData({ ...formData, code: value.toUpperCase() }), 4)}
                    onKeyDown={stopEditableKeyPropagation}
                    maxLength={4}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                    placeholder="CODE"
                  />
                </td>
                <td className="py-3 px-4">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as CancellationCodeCategory })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                  >
                    <option value="Aircraft">Aircraft</option>
                    <option value="Crew">Crew</option>
                    <option value="Program">Program</option>
                    <option value="Weather">Weather</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    onBeforeInput={(event) => handleEditableTextBeforeInput(event, (value) => setFormData({ ...formData, description: value }))}
                    onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, (value) => setFormData({ ...formData, description: value }))}
                    onKeyDown={stopEditableKeyPropagation}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                    placeholder="Description"
                  />
                </td>
                <td className="py-3 px-4">
                  <select
                    value={formData.appliesTo}
                    onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value as CancellationCodeAppliesTo })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                    >
                      <option value="Flight">Flight</option>
                    <option value="FTD">{resourceDisplayNames.ftd}</option>
                    <option value="Both">Flight + {resourceDisplayNames.ftd}</option>
                  </select>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-900/50 text-green-400">
                    Active
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={handleSave}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-xs font-semibold hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {sortedCodes.map((code) => {
              const isEditing = editingCode === code.code;
              const isUsed = usedCodes.has(code.code);

              if (isEditing) {
                return (
                  <tr key={code.code} className="border-b border-gray-700 bg-gray-700/30">
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        onBeforeInput={(event) => handleEditableTextBeforeInput(event, (value) => setFormData({ ...formData, code: value.toUpperCase() }), 4)}
                        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, (value) => setFormData({ ...formData, code: value.toUpperCase() }), 4)}
                        onKeyDown={stopEditableKeyPropagation}
                        maxLength={4}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as CancellationCodeCategory })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                      >
                        <option value="Aircraft">Aircraft</option>
                        <option value="Crew">Crew</option>
                        <option value="Program">Program</option>
                        <option value="Weather">Weather</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        onBeforeInput={(event) => handleEditableTextBeforeInput(event, (value) => setFormData({ ...formData, description: value }))}
                        onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, (value) => setFormData({ ...formData, description: value }))}
                        onKeyDown={stopEditableKeyPropagation}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={formData.appliesTo}
                        onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value as CancellationCodeAppliesTo })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                      >
                        <option value="Flight">Flight</option>
                        <option value="FTD">{resourceDisplayNames.ftd}</option>
                        <option value="Both">Flight + {resourceDisplayNames.ftd}</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        formData.isActive
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}>
                        {formData.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={handleSave}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-xs font-semibold hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={code.code} className="border-b border-gray-700 hover:bg-gray-700/20">
                  <td className="py-3 px-4 text-white font-mono font-semibold">{code.code}</td>
                  <td className="py-3 px-4 text-gray-300">{code.category}</td>
                  <td className="py-3 px-4 text-gray-300">{code.description}</td>
                  <td className="py-3 px-4 text-gray-300">{formatAppliesToLabel(code.appliesTo)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      code.isActive
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-red-900/50 text-red-400'
                    }`}>
                      {code.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="py-3 px-4">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleStartEdit(code)}
                          disabled={!isEditUnlocked || isAddingNew || editingCode !== null}
                          className="px-3 py-1 bg-sky-600 text-white rounded text-xs font-semibold hover:bg-sky-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onToggleActive(code.code)}
                          disabled={!isEditUnlocked || isAddingNew || editingCode !== null}
                          className={`px-3 py-1 rounded text-xs font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed ${
                            code.isActive
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {code.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(code.code)}
                          disabled={!isEditUnlocked || isAddingNew || editingCode !== null}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                          title={isUsed ? "Delete code with usage warning" : "Delete code"}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Empty state */}
            {sortedCodes.length === 0 && !isAddingNew && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-gray-500">
                  No cancellation codes found.
                  {canEdit && (
                    <span className="ml-1">
                      Click <span className="text-sky-400 font-semibold">Add</span> to create one.
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-400">
        <p>Inactive codes remain visible in historical records.</p>
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete the cancellation code{' '}
              <span className="font-mono font-bold text-red-400">{deletingCode}</span>?
              This action cannot be undone.
            </p>
            {deletingCodeHasHistory && (
              <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
                <p className="font-semibold text-amber-200">This code has been used in cancellation history.</p>
                <p className="mt-2">
                  Deleting it may affect historical reporting, filters, or audit interpretation. Confirm only if this code was created in error or has been replaced.
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CancellationCodesTable;
