import React, { useState } from 'react';
import { CancellationCode, CancellationCodeCategory, CancellationCodeAppliesTo } from '../types';

interface CancellationCodesTableProps {
  codes: CancellationCode[];
  onAddCode: (code: CancellationCode) => void;
  onEditCode: (oldCode: string, newCode: CancellationCode) => void;
  onToggleActive: (code: string) => void;
  canEdit: boolean; // Based on user role
  usedCodes: Set<string>; // Codes that have been used in cancellations
}

const CancellationCodesTable: React.FC<CancellationCodesTableProps> = ({
  codes,
  onAddCode,
  onEditCode,
  onToggleActive,
  canEdit,
  usedCodes,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CancellationCode>>({
    code: '',
    category: 'Aircraft',
    description: '',
    appliesTo: 'Both',
    isActive: true,
  });

  const handleStartAdd = () => {
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

  const handleSave = () => {
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

  const sortedCodes = [...codes].sort((a, b) => {
    // Sort by category first, then by code
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.code.localeCompare(b.code);
  });

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Cancellation Codes (Master Table)</h2>
        {canEdit && (
          <button
            onClick={handleStartAdd}
            disabled={isAddingNew || editingCode !== null}
            className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            + Add Code
          </button>
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
                    <option value="FTD">FTD</option>
                    <option value="Both">Both</option>
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
                        <option value="FTD">FTD</option>
                        <option value="Both">Both</option>
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
                  <td className="py-3 px-4 text-gray-300">{code.appliesTo}</td>
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
                          disabled={isAddingNew || editingCode !== null}
                          className="px-3 py-1 bg-sky-600 text-white rounded text-xs font-semibold hover:bg-sky-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onToggleActive(code.code)}
                          disabled={isAddingNew || editingCode !== null}
                          className={`px-3 py-1 rounded text-xs font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed ${
                            code.isActive
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {code.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                      {isUsed && (
                        <p className="text-xs text-gray-500 text-center mt-1">Used in history</p>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-400">
        <p>• Only authorized users (Admin/Config roles) can add, edit, or activate/deactivate codes.</p>
        <p>• Codes that have been used in cancellations cannot be deleted.</p>
        <p>• Inactive codes remain visible in historical records.</p>
      </div>
    </div>
  );
};

export default CancellationCodesTable;