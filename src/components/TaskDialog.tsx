'use client';
import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { baseUrl, getAuthToken } from '@/config';
import Dialog, { CenterDialog } from './Dialog';
import { DefaultEditor } from 'react-simple-wysiwyg';
import { Eye, Download, Trash2, Paperclip } from 'lucide-react';
import { getFileIcon } from '@/utills/utill';
import FormInput from './ui/Input';
import FormSelect from './ui/FormSelect';
import Label from './ui/Label';
import DatePicker from '@/components/ui/DatePicker';

// Types
export interface Attachment {
  _id: string;
  originalName: string;
  filename: string;
  path: string;
  size?: number;
}

interface StaffOption {
  _id: string;
  fullName: string;
  email?: string;
  teams: any[];
}

interface TeamOption {
  _id: string;
  name: string;
}

export interface Task {
  _id: string;
  subject: string;
  startDate: string;
  endDate: string;
  status: { _id: string; name: string; color: string };
  taskStatus?: { _id: string; name: string; color: string };
  legacyStatus?: string;
  priority: string;
  assignedUsers: { _id: string; fullName: string }[];
  assignedTeams: { _id: string; name: string }[];
  description: string;
  attachments: Attachment[];
}

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  initialData: Task | null;
  onSuccess: () => void;
  taskStatuses?: { _id: string; name: string; color: string }[];
}

interface TaskFormData {
  subject: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  assignedUsers: string[];
  assignedTeams: string[];
  description: string;
}

const defaultForm: TaskFormData = {
  subject: '',
  startDate: '',
  endDate: '',
  status: '',
  priority: 'medium',
  assignedUsers: [],
  assignedTeams: [],
  description: '',
};

// Static TaskValidationSchema removed - moved inside component for dynamic required fields

// Image extensions
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const isImage = (filename: string) => IMAGE_EXTS.includes(filename.split('.').pop()?.toLowerCase() || '');

// Get full URL for attachment
const getFileUrl = (path: string) => {
  const base = (process.env.NEXT_PUBLIC_IMAGE_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
};

export default function TaskDialog({ isOpen, onClose, mode, initialData, onSuccess, taskStatuses = [] }: TaskDialogProps) {
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [teamList, setTeamList] = useState<TeamOption[]>([]);
  const [localTaskStatuses, setLocalTaskStatuses] = useState<{ _id: string; name: string; color: string }[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState<Set<string>>(new Set());

  // State for delete confirmation dialog
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    attachment: Attachment | null;
  }>({
    isOpen: false,
    attachment: null,
  });

  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);

  useEffect(() => {
    const loadRequiredFields = () => {
      const saved = sessionStorage.getItem('taskRequiredFields');
      if (saved) {
        try {
          setRequiredFields(JSON.parse(saved));
        } catch (e) {
          setRequiredFields(['subject', 'status', 'priority']);
        }
      } else {
        setRequiredFields(['subject', 'status', 'priority']);
      }
    };

    loadRequiredFields();
    window.addEventListener('fieldSettingsUpdated', loadRequiredFields);
    return () => window.removeEventListener('fieldSettingsUpdated', loadRequiredFields);
  }, []);

  const TaskValidationSchema = useMemo(() => {
    let shape: any = {
      subject: Yup.string()
        .min(3, 'Subject must be at least 3 characters')
        .max(200, 'Subject must not exceed 200 characters'),
      startDate: Yup.date()
        .nullable()
        .typeError('Invalid date format'),
      endDate: Yup.date()
        .nullable()
        .typeError('Invalid date format')
        .min(Yup.ref('startDate'), 'End date must be after start date'),
      status: Yup.string(),
      priority: Yup.string().oneOf(['low', 'medium', 'high'], 'Invalid priority'),
      assignedUsers: Yup.array().of(Yup.string()),
      assignedTeams: Yup.array().of(Yup.string()),
      description: Yup.string()
        .max(5000, 'Description must not exceed 5000 characters'),
    };

    if (requiredFields.includes('subject')) shape.subject = shape.subject.required('Subject is required');
    if (requiredFields.includes('startDate')) shape.startDate = shape.startDate.required('Start Date is required');
    if (requiredFields.includes('endDate')) shape.endDate = shape.endDate.required('End Date is required');
    if (requiredFields.includes('status')) shape.status = shape.status.required('Status is required');
    if (requiredFields.includes('priority')) shape.priority = shape.priority.required('Priority is required');
    if (requiredFields.includes('description')) shape.description = shape.description.required('Description is required');
    if (requiredFields.includes('assignedTeams')) shape.assignedTeams = Yup.array().min(1, 'Please assign at least one team').required();
    if (requiredFields.includes('assignedUsers')) shape.assignedUsers = Yup.array().min(1, 'Please assign at least one user').required();

    return Yup.object().shape(shape);
  }, [requiredFields]);

  // Formik setup
  const formik = useFormik<TaskFormData>({
    initialValues: defaultForm,
    validationSchema: TaskValidationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const headers = { Authorization: `Bearer ${token}` };
        const fd = new FormData();

        Object.entries(values).forEach(([k, v]) => {
          if (k === 'status') {
            fd.append('taskStatus', v as string);
          } else if (Array.isArray(v)) {
            fd.append(k, JSON.stringify(v));
          } else {
            fd.append(k, v as string);
          }
        });
        attachments.forEach((f) => fd.append('attachments', f));

        if (mode === 'add') {
          await axios.post(baseUrl.createTask, fd, { headers });
          toast.success('Task created successfully');
        } else {
          await axios.put(`${baseUrl.updateTask}/${initialData?._id}`, fd, { headers });
          toast.success('Task updated successfully');
        }
        onSuccess();
        onClose();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
  });

  // Helper function to update formik field with proper error clearing
  const updateField = (field: keyof TaskFormData, value: any) => {
    formik.setFieldValue(field, value);
    // Clear field error if exists
    if (formik.errors[field]) {
      formik.setFieldError(field, undefined);
    }
    // Mark field as touched to hide error after selection
    if (!formik.touched[field]) {
      formik.setFieldTouched(field, true, false);
    }
  };

  const toggleUser = (id: string) => {
    const currentUsers = formik.values.assignedUsers;
    const newUsers = currentUsers.includes(id)
      ? currentUsers.filter((x) => x !== id)
      : [...currentUsers, id];
    updateField('assignedUsers', newUsers);
  };

  const toggleTeam = (teamId: string) => {
    const teamMembers = staffList
      .filter((s) => Array.isArray(s.teams) && s.teams.some((t: any) => (t._id || t) === teamId))
      .map((s) => s._id);

    const isSelected = formik.values.assignedTeams.includes(teamId);
    const updatedTeams = isSelected
      ? formik.values.assignedTeams.filter((x) => x !== teamId)
      : [...formik.values.assignedTeams, teamId];

    let updatedUsers = [...formik.values.assignedUsers];
    if (isSelected) {
      const otherTeamMemberIds = new Set(
        staffList
          .filter((s) => Array.isArray(s.teams) && s.teams.some((t: any) => updatedTeams.includes(t._id || t)))
          .map((s) => s._id)
      );
      updatedUsers = updatedUsers.filter((uid) => {
        const isMember = teamMembers.includes(uid);
        return !isMember || otherTeamMemberIds.has(uid);
      });
    } else {
      teamMembers.forEach((uid) => { if (!updatedUsers.includes(uid)) updatedUsers.push(uid); });
    }

    updateField('assignedTeams', updatedTeams);
    updateField('assignedUsers', updatedUsers);
  };

  /**
   * Opens the custom delete confirmation dialog
   */
  const handleDeleteExistingAttachment = (attachment: Attachment) => {
    setDeleteConfirmation({
      isOpen: true,
      attachment,
    });
  };

  /**
   * Actually performs the deletion after confirmation
   */
  const confirmDeleteAttachment = async () => {
    const attachment = deleteConfirmation.attachment;
    if (!attachment || !initialData?._id) {
      setDeleteConfirmation({ isOpen: false, attachment: null });
      return;
    }

    const attachmentId = attachment._id;

    // Mark as deleting → shows spinner on this item
    setDeletingAttachmentIds(prev => new Set(prev).add(attachmentId));

    try {
      const token = getAuthToken();
      await axios.delete(
        `${baseUrl.updateTask}/${initialData._id}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Remove from local list — UI updates immediately
      setExistingAttachments(prev =>
        prev.filter(a => a._id !== attachmentId)
      );
      toast.success('Attachment deleted successfully');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to delete attachment';
      toast.error(msg);
    } finally {
      setDeletingAttachmentIds(prev => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
      // Close the confirmation dialog
      setDeleteConfirmation({ isOpen: false, attachment: null });
    }
  };

  // Download helper
  const handleDownload = async (attachment: Attachment) => {
    try {
      const url = getFileUrl(attachment.path);
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = attachment.originalName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Failed to download file');
    }
  };

  // Fetch staff & teams when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadingOptions(true);
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${baseUrl.getAllStaff}?limit=1000`, { headers }),
      axios.get(baseUrl.teams, { headers }),
      axios.get(baseUrl.taskStatuses, { headers }),
    ])
      .then(([staffRes, teamRes, statusRes]) => {
        setStaffList(staffRes.data?.data || []);
        setTeamList(teamRes.data?.data || []);
        setLocalTaskStatuses(statusRes.data?.data || []);
      })
      .catch(() => { })
      .finally(() => setLoadingOptions(false));
  }, [isOpen]);

  // Populate form on edit
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const formData = {
        subject: initialData.subject || '',
        startDate: initialData.startDate ? initialData.startDate.split('T')[0] : '',
        endDate: initialData.endDate ? initialData.endDate.split('T')[0] : '',
        status: initialData.taskStatus?._id || (initialData.status as any)?._id || '',
        priority: initialData.priority || 'medium',
        assignedUsers: (initialData.assignedUsers || []).map((u: any) => u._id || u),
        assignedTeams: (initialData.assignedTeams || []).map((t: any) => t._id || t),
        description: initialData.description || '',
      };
      formik.setValues(formData as any);
      setExistingAttachments(initialData.attachments || []);
    } else {
      formik.resetForm();
      setAttachments([]);
      setExistingAttachments([]);
    }
    setPreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialData, isOpen]);

  const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low', cls: 'bg-green-100 text-green-700' },
    { value: 'medium', label: 'Medium', cls: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: 'High', cls: 'bg-red-100 text-red-700' },
  ]

  const dropdownStatuses = taskStatuses && taskStatuses.length > 0 ? taskStatuses : localTaskStatuses;

  if (!isOpen) return null;

  return (
    <>
      <Dialog isOpen={isOpen} onClose={onClose} title={mode === 'add' ? 'Add Task' : 'Edit Task'} size="lg">
        <form noValidate onSubmit={formik.handleSubmit} className="space-y-4">
          <FormInput
            label="Name"
            name="subject"
            type="text"
            value={formik.values.subject}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.subject ? formik.errors.subject : undefined}
            placeholder=""
            as="input"
            required={requiredFields.includes('subject')}
          />
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description {requiredFields.includes('description') && <span className="text-red-700 ml-1 font-semibold">*</span>}
            </label>
            <div className={`rounded-xl border overflow-hidden ${formik.touched.description && formik.errors.description
              ? 'border-red-500'
              : 'border-gray-300'
              }`}>
              <DefaultEditor
                value={formik.values.description}
                style={{ minHeight: "200px" }}
                onChange={(e) => {
                  formik.setFieldValue('description', e.target.value);
                  if (formik.errors.description) {
                    formik.setFieldError('description', undefined);
                  }
                }}
                onBlur={() => formik.setFieldTouched('description', true)}
                placeholder="Enter task description..."
              />
            </div>
            {formik.touched.description && formik.errors.description && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.description}</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="w-full">
              <label className="block mb-1.5 text-sm font-medium text-gray-700">
                Start Date{requiredFields.includes('startDate') && <span className="text-red-500 ml-1">*</span>}
              </label>
              <DatePicker
                value={formik.values.startDate}
                onChange={(val) => formik.setFieldValue('startDate', val)}
                error={!!(formik.touched.startDate && formik.errors.startDate)}
              />
              {formik.touched.startDate && formik.errors.startDate && (
                <p className="text-red-700 text-xs mt-1">{formik.errors.startDate}</p>
              )}
            </div>
            <div className="w-full">
              <label className="block mb-1.5 text-sm font-medium text-gray-700">
                End Date{requiredFields.includes('endDate') && <span className="text-red-500 ml-1">*</span>}
              </label>
              <DatePicker
                value={formik.values.endDate}
                onChange={(val) => formik.setFieldValue('endDate', val)}
                error={!!(formik.touched.endDate && formik.errors.endDate)}
              />
              {formik.touched.endDate && formik.errors.endDate && (
                <p className="text-red-700 text-xs mt-1">{formik.errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Status"
              name="status"
              value={formik.values.status}
              onChange={(val) => formik.setFieldValue('status', val)}
              // onBlur={() => formik.setFieldTouched('status')}
              options={dropdownStatuses.map((s: any) => ({ value: s._id, label: s.name! }))}
              error={formik.touched.status ? formik.errors.status : undefined}
              placeholder="— Select Status —"
              required={requiredFields.includes('status')}
            />
            <FormSelect
              label="Priority"
              name="priority"
              value={formik.values.priority}
              onChange={(val) => updateField('priority', val)}
              onBlur={() => formik.setFieldTouched('priority')}
              options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
              error={formik.touched.priority ? formik.errors.priority : undefined}
              placeholder="— Select Priority —"
              required={requiredFields.includes('priority')}
            />
          </div>

          {/* Assign Teams */}
          <div>
            <Label>Assign Teams {requiredFields.includes('assignedTeams') && <span className="text-red-700 ml-1 font-semibold">*</span>}</Label>
            {loadingOptions ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : (
              <div className="max-h-32 overflow-y-auto align-center rounded-xl border border-gray-300 p-2">
                <div className="space-y-1">

                  {teamList.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2">No teams available</p>
                  ) : (
                    teamList.map((t) => {
                      const memberCount = staffList.filter(
                        (s) => Array.isArray(s.teams) && s.teams.some((tm: any) => (tm._id || tm) === t._id)
                      ).length;
                      return (
                        <FormInput
                          key={t._id}
                          as="checkbox"
                          name={`team_${t._id}`}
                          checked={formik.values.assignedTeams.includes(t._id)}
                          onChange={() => toggleTeam(t._id)}
                          label={
                            (
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm text-gray-700">{t.name}</span>
                                {memberCount > 0 && (
                                  <span className="text-xs ml-2 text-gray-400">
                                    {memberCount} member{memberCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            ) as any
                          }
                          className="hover:bg-gray-50 rounded px-2 py-2 mt-2"
                          labelClassName="w-full"
                          compact
                        />
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Assign Users */}
          <div>
            <Label>Assign Users {requiredFields.includes('assignedUsers') && <span className="text-red-700 ml-1 font-semibold">*</span>}</Label>
            {loadingOptions ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : (
              <div className="max-h-32 overflow-y-auto rounded-xl border border-gray-300 p-2 space-y-1">
                {staffList.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2">No staff available</p>
                ) : (
                  staffList.map((s) => {
                    const isViaTeam =
                      Array.isArray(s.teams) &&
                      s.teams.some((t: any) => formik.values.assignedTeams.includes(t._id || t));
                    return (

                      <FormInput
                        key={s._id}
                        as="checkbox"
                        name={`user_${s._id}`}
                        label={
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm text-gray-700">{s.fullName}</span>
                            {isViaTeam && (
                              <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
                                via team
                              </span>
                            )}
                          </div>
                        }
                        checked={formik.values.assignedUsers.includes(s._id)}
                        onChange={() => toggleUser(s._id)}
                        className="hover:bg-gray-50 rounded px-2 py-1"
                        labelClassName="w-full"
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Existing Attachments (edit mode) */}
          {mode === 'edit' && existingAttachments.length > 0 && (
            <div>
              <Label>Existing Attachments</Label>
              <div className="space-y-2">
                {existingAttachments.map((att) => {
                  const fileUrl = getFileUrl(att.path);
                  const img = isImage(att.filename);
                  return (
                    <div
                      key={att._id}
                      className={`flex items-center gap-3 rounded-xl border transition-colors px-3 py-2 ${deletingAttachmentIds.has(att._id)
                        ? 'bg-red-50 border-red-200 opacity-60'
                        : 'bg-gray-50 border-gray-200'
                        }`}
                    >
                      {/* Thumbnail or file icon */}
                      <div className="flex-shrink-0">
                        {deletingAttachmentIds.has(att._id) ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                        ) : img ? (
                          <img
                            src={fileUrl}
                            alt={att.originalName}
                            className="w-10 h-10 rounded-lg object-contain flex-shrink-0 border border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            {getFileIcon(att.originalName)}
                          </div>
                        )}
                      </div>

                      {/* File name */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700 truncate" title={att.originalName}>
                          {att.originalName}
                        </p>
                        {deletingAttachmentIds.has(att._id) && (
                          <p className="text-xs text-red-500 mt-0.5">Deleting...</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* View */}
                        <button
                          type="button"
                          title="View"
                          disabled={deletingAttachmentIds.has(att._id)}
                          onClick={() => setPreviewUrl(fileUrl)}
                          className="p-1.5 cursor-pointer rounded-lg hover:bg-blue-100 text-blue-500 transition disabled:opacity-40"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Download */}
                        <button
                          type="button"
                          title="Download"
                          disabled={deletingAttachmentIds.has(att._id)}
                          onClick={() => handleDownload(att)}
                          className="p-1.5 cursor-pointer rounded-lg hover:bg-green-100 text-green-600 transition disabled:opacity-40"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          title="Delete"
                          disabled={deletingAttachmentIds.has(att._id)}
                          onClick={() => handleDeleteExistingAttachment(att)}
                          className="p-1.5 cursor-pointer rounded-lg hover:bg-red-100 text-red-500 transition disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Attachments Upload */}
          <div>

            <Label>{mode === 'edit' ? 'Add New Attachments' : 'Attachments'}</Label>
            <input
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files || []))}
              className="w-full text-sm text-gray-600
                         file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                         file:bg-blue-50 file:text-blue-700 file:text-sm hover:file:bg-blue-100"
            />
            {attachments.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {attachments.map((f, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-center gap-1">
                    <span>📎</span> {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 cursor-pointer rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formik.isValid || (formik.dirty === false && mode === 'edit')}
              className="px-6 py-2.5 cursor-pointer rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 transition"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {mode === 'add' ? 'Create Task' : 'Update Task'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-medium text-gray-700">Preview</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download
                  className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[75vh] flex items-center justify-center bg-gray-50 p-4">
              {isImage(previewUrl.split('/').pop() || '') ? (
                <img src={previewUrl} alt="preview" className="max-w-full max-h-full rounded-lg object-contain" />
              ) : (
                <div className="text-center py-12">
                  <Paperclip className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">Preview not available for this file type.</p>
                  <a
                    href={previewUrl}
                    download
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Dialog */}
      <CenterDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, attachment: null })}
      >
        <>
          <div className="py-4">
            <p className="text-gray-700">
              Are you sure you want to delete "
              <span className="font-semibold">
                {deleteConfirmation.attachment?.originalName ||
                  'this file'}
              </span>"?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteConfirmation({ isOpen: false, attachment: null })}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteAttachment}
              className="rounded-lg cursor-pointer bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </>
      </CenterDialog >
    </>
  );
}