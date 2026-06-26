'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Save, CheckCircle2, Circle } from 'lucide-react';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';

// Removed hardcoded LEAD_FIELDS, fetched dynamically from backend

const TASK_FIELDS = [
  { id: 'subject', label: 'Subject' },
  { id: 'description', label: 'Description' },
  { id: 'startDate', label: 'Start Date' },
  { id: 'endDate', label: 'End Date' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignedTeams', label: 'Assign Teams' },
  { id: 'assignedUsers', label: 'Assign Users' },
];

export function FieldSettingsContent() {
  const [leadFields, setLeadFields] = useState<{ id: string; label: string }[]>([]);
  const [requiredLeads, setRequiredLeads] = useState<string[]>([]);
  const [requiredTasks, setRequiredTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [fieldsRes, reqRes] = await Promise.all([
          axios.get(baseUrl.settingsLeadFields || 'http://localhost:5005/v1/api/settings/lead-fields', { headers }),
          axios.get(baseUrl.settingsRequiredFields || 'http://localhost:5005/v1/api/settings/required-fields', { headers })
        ]);

        setLeadFields(fieldsRes.data?.data || []);
        setRequiredLeads(reqRes.data?.data?.requiredLeads || []);
        setRequiredTasks(reqRes.data?.data?.requiredTasks || []);
      } catch (err: any) {
        console.error('Failed to fetch field settings', err);
        const errorMessage = err.response?.data?.message || 'Failed to load field settings';
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleLead = (id: string) => {
    if (id === 'customerContact') return; // Always required for resellers
    setRequiredLeads(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleToggleTask = (id: string) => {
    if (id === 'subject' || id === 'taskStatus' || id === 'priority') return; // Core fields
    setRequiredTasks(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    try {
      const token = getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(baseUrl.settingsRequiredFields || 'http://localhost:5005/v1/api/settings/required-fields', { requiredLeads, requiredTasks }, { headers });
      toast.success('Field requirements saved successfully');
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('fieldSettingsUpdated'));
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to save field settings';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Field Settings</h2>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-[#3B82F6] text-white rounded-lg transition-colors font-medium shadow-sm"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Select the fields that should be mandatory (required) in the "Add Lead" and "Add Task" forms.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lead Fields */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
          <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
            Add Lead Required Fields
          </h3>
          <div className="space-y-2">
            {loading ? (
              <p className="text-gray-500">Loading fields...</p>
            ) : leadFields.map(field => {
              // Ensure customerContact is always checked and disabled
              const isContact = field.id === 'customerContact';
              const isChecked = isContact || requiredLeads.includes(field.id);
              
              return (
                <label
                  key={field.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isContact ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${
                    isChecked
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">{field.label} {isContact && <span className="text-xs ml-2 text-blue-600">(Mandatory)</span>}</span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isChecked}
                    disabled={isContact}
                    onChange={() => handleToggleLead(field.id)}
                  />
                  {isChecked ? (
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </label>
              );
            })}
          </div>
        </div>

     
      </div>
    </div>
  );
}

export default function FieldSettings() {
  return <FieldSettingsContent />;
}
