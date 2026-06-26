// components/LeadAddDialog.tsx
'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Dialog from '@/components/Dialog';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import Label from './ui/Label';
import Select from 'react-select';
import DatePicker from '@/components/ui/DatePicker';
import TimePicker from '@/components/ui/TimePicker';
import FormInput from '@/components/ui/Input';

interface DropdownItem {
  _id: string;
  name?: string;
  fullName?: string;
}



interface Lead {
  id: string;
  name: string;
  companyName?: string;
  address?: string;
  phone: string;
  email: string;
  source: string;     // _id when editing
  status: string;     // _id when editing
  staff: string;      // _id when editing
  priority: 'high' | 'medium' | 'low' | 'High' | 'Medium' | 'Low';
  nextFollowupDate?: string;
  nextFollowupTime?: string;
  note?: string;
  isActive?: boolean;
  attachments?: { name: string; url?: string }[];

  // ... other fields if needed in form
}

interface LeadAddDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  initialData?: Partial<Lead> | null;

  onLeadCreated?: (lead: any) => void;
  onLeadUpdated?: (lead: any) => void;
}

export default function LeadAddDialog({
  isOpen,
  onClose,
  mode,
  initialData,
  onLeadCreated,
  onLeadUpdated,
}: LeadAddDialogProps) {
  const [leadSources, setLeadSources] = useState<DropdownItem[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<DropdownItem[]>([]);
  const [staffList, setStaffList] = useState<DropdownItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    address: '',
    contact: '',
    email: '',
    leadSource: '',
    leadStatus: '',
    assignedTo: '',

    priority: 'medium' as 'high' | 'medium' | 'low',
    nextFollowupDate: '',
    nextFollowupTime: '',
    note: '',
    isActive: true,
  });
  const [attachmentsFiles, setAttachmentsFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<{ name: string; url?: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDropdownData = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setFormError(null);

        const [sourcesRes, statusRes, staffRes] = await Promise.all([
          axios.get(baseUrl.leadSources, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(baseUrl.leadStatuses, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(baseUrl.getAllStaff, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setLeadSources(sourcesRes.data?.data || []);
        setLeadStatuses(statusRes.data?.data || []);
        setStaffList(staffRes.data?.data || []);

      } catch (err) {
        console.error(err);
        setFormError('Failed to load dropdown options');
      } finally {
        setLoading(false);
      }
    };

    fetchDropdownData();

    // Populate form data
    if (mode === 'edit' && initialData) {


      setFormData({
        fullName: initialData.name || '',
        companyName: initialData.companyName || '',
        address: initialData.address || '',
        contact: initialData.phone || '',
        email: initialData.email || '',
        leadSource: initialData.source || '',
        leadStatus: initialData.status || '',
        assignedTo: initialData.staff || '',

        priority: (initialData.priority || 'medium').toLowerCase() as 'high' | 'medium' | 'low',
        nextFollowupDate: initialData.nextFollowupDate || '',
        nextFollowupTime: initialData.nextFollowupTime || '',
        note: initialData.note || '',
        isActive: initialData.isActive ?? true,
      });
      const att = (initialData as any)?.attachments || [];
      setExistingAttachments(Array.isArray(att) ? att : []);
      setAttachmentsFiles([]);
    } else {
      // reset for add
      setFormData({
        fullName: '',
        companyName: '',
        address: '',
        contact: '',
        email: '',
        leadSource: '',
        leadStatus: '',
        assignedTo: '',

        priority: 'medium',
        nextFollowupDate: '',
        nextFollowupTime: '',
        note: '',
        isActive: true,
      });
      setExistingAttachments([]);
      setAttachmentsFiles([]);
    }
  }, [isOpen, mode, initialData, token]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setFormError(null);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim()) return setFormError('Full Name is required');
    if (!formData.companyName.trim()) return setFormError('Company Name is required');
    if (!formData.address.trim()) return setFormError('Address is required');
    if (!formData.contact.trim()) return setFormError('Phone is required');
    if (!formData.email.trim()) return setFormError('Email is required');
    if (!formData.leadSource) return setFormError('Please select Source');
    if (!formData.leadStatus) return setFormError('Please select Status');
    if (!formData.assignedTo) return setFormError('Please assign Staff');
    if (!token) return setFormError('No authentication token found');

    try {
      setSubmitting(true);
      setFormError(null);

      const hasFiles = attachmentsFiles.length > 0;
      const payload: any = {
        customerName: formData.fullName.trim(),
        companyName: formData.companyName.trim(),
        address: formData.address.trim(),
        customerContact: formData.contact.trim(),
        customerEmail: formData.email.trim().toLowerCase(),
        leadSource: formData.leadSource,
        leadStatus: formData.leadStatus,
        assignedTo: formData.assignedTo,

        priority: formData.priority,
        nextFollowupDate: formData.nextFollowupDate || null,
        nextFollowupTime: formData.nextFollowupTime || null,
        note: formData.note.trim(),
        isActive: formData.isActive,
      };
      if (mode === 'edit' && !hasFiles && existingAttachments.length > 0) {
        payload.attachments = existingAttachments.map((a) => a.name);
      }
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          if (true) {
            fd.append(k, String(v));
          }
        }
      });
      attachmentsFiles.forEach((file) => {
        fd.append('attachments', file);
      });

      if (mode === 'add') {
        const res = await axios.post(`${baseUrl.addLead}`, hasFiles ? fd : payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(hasFiles ? {} : { 'Content-Type': 'application/json' }),
          },
        });
        toast.success('Lead created successfully!');
        onLeadCreated?.(res.data?.data ?? res.data);
      } else {
        if (!initialData?.id) throw new Error('Missing lead ID');
        const res = await axios.put(`${baseUrl.updateLead || baseUrl.addLead}/${initialData.id}`, hasFiles ? fd : payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(hasFiles ? {} : { 'Content-Type': 'application/json' }),
          },
        });
        toast.success('Lead updated successfully!');
        onLeadUpdated?.(res.data?.data ?? res.data);
      }

      onClose();
    } catch (error: any) {
      console.error(`${mode} lead failed:`, error);
      const msg = error.response?.data?.message || `Failed to ${mode} lead`;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'edit' ? 'Edit Lead' : 'Add New Lead';



  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="lead-form"
            disabled={submitting || loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 min-w-[80px]"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="text-center py-10 text-slate-500">Loading options...</p>
      ) : (
        <form noValidate id="lead-form" onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {formError}
            </div>
          )}

          <div>
            <Label required>Full Name</Label>
            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              placeholder="Enter Full Name"
            />
          </div>

          <div>
            <Label required>Company Name</Label>
            <input
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              required
              className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              placeholder="Enter Company Name"
            />
          </div>

          <div>
            <Label required>Address</Label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              rows={3}
              className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              placeholder="Enter Address"
            />
          </div>

          <div>
            <FormInput
              label="Phone"
              name="contact"
              type="tel"
              isPhone={true}
              value={formData.contact}
              onChange={handleChange}
              required
              placeholder="00000 00000"
            />
          </div>

          <div>
            <Label required>Email</Label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              placeholder="Enter Email Address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label required>Source</Label>
              <select
                name="leadSource"
                value={formData.leadSource}
                onChange={handleChange}
                required
                className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              >
                <option value="">— Select —</option>
                {leadSources.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label required>Status</Label>
              <select
                name="leadStatus"
                value={formData.leadStatus}
                onChange={handleChange}
                required
                className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              >
                <option value="">— Select —</option>
                {leadStatuses.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label required>Assigned To</Label>
              <select
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
                required
                className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              >
                <option value="">— Select —</option>
                {staffList.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.fullName || item.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Priority</Label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full border border-slate-400 rounded px-3 py-2 text-black"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>



          {mode === 'edit' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Next Follow-up Date</Label>
                  <DatePicker
                    value={formData.nextFollowupDate}
                    onChange={(val) => {
                      setFormData((prev) => ({ ...prev, nextFollowupDate: val }));
                      setFormError(null);
                    }}
                  />
                </div>
                <div>
                  <Label>Next Follow-up Time</Label>
                  <TimePicker
                    value={formData.nextFollowupTime}
                    onChange={(val) => {
                      setFormData((prev) => ({ ...prev, nextFollowupTime: val }));
                      setFormError(null);
                    }}
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-slate-400 rounded px-3 py-2 text-black"
                  placeholder="Add notes..."
                />
              </div>

              <div>
                <Label>Attachments</Label>
                <input
                  type="file"
                  multiple
                  className="w-full border border-slate-400 rounded px-3 py-2 text-black"
                  onChange={(e) =>
                    setAttachmentsFiles(Array.from((e.target as HTMLInputElement).files || []))
                  }
                />
                {existingAttachments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {existingAttachments.map((a, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-800">{a.name}</span>
                        {a.url ? (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-slate-500">No link</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {attachmentsFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {attachmentsFiles.map((file, i) => (
                      <li key={i} className="text-sm text-slate-600">
                        📎 {file.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                  Is Active Lead
                </label>
              </div>
            </>
          )}
        </form>
      )}
    </Dialog>
  );
}