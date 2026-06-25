import React, { useState, useRef } from 'react';
import { X, Calendar, CreditCard, Image as ImageIcon, Pencil, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DatePicker from '@/components/ui/DatePicker';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, lead, onSuccess }: PaymentModalProps) {
  const isPaid = lead?.paymentStatus === 'Paid';
  // view mode when already paid; form mode when adding new payment
  const [mode, setMode] = useState<'view' | 'form'>(isPaid ? 'view' : 'form');

  const [amount, setAmount] = useState(() => {
    const pAmt = lead?.paidAmount;
    if (pAmt && pAmt > 0) return pAmt.toString();
    const pAmt2 = lead?.paymentAmount;
    if (pAmt2 && pAmt2 > 0) return pAmt2.toString();
    return '';
  });
  const [paymentDate, setPaymentDate] = useState(() => {
    if (lead?.paymentDate?.startDate) {
      return new Date(lead.paymentDate.startDate).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [paymentMode, setPaymentMode] = useState(lead?.paymentMode || 'Cash');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For showing proof image preview in view mode
  const [showProofPreview, setShowProofPreview] = useState(false);

  // Saved data (used after submit to show details without re-fetching)
  const [savedData, setSavedData] = useState<{
    amount: string;
    date: string;
    mode: string;
    proofFile?: File;
  } | null>(null);

  const [errors, setErrors] = useState<{ amount?: string; date?: string; mode?: string }>({});

  if (!isOpen) return null;

  // Derive display values — prefer savedData (just submitted), else lead data
  const displayAmount = savedData?.amount || lead?.paidAmount?.toString() || lead?.paymentAmount?.toString() || '0';
  const displayDate = savedData?.date
    || (lead?.paymentDate?.startDate ? new Date(lead.paymentDate.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
  const displayMode = savedData?.mode || lead?.paymentMode || '-';

  const proofUrl = lead?.paymentProof
    ? `${baseUrl.getImageUrl}/images/LeadAttachment/${lead.paymentProof}`
    : null;

  // For newly uploaded file preview
  const newProofPreviewUrl = savedData?.proofFile ? URL.createObjectURL(savedData.proofFile) : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setPaymentProof(file);
    }
  };

  const handleSubmit = async () => {
    const newErrors: { amount?: string; date?: string; mode?: string } = {};

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }
    if (!paymentDate) {
      newErrors.date = 'Please select a payment date';
    }
    if (!paymentMode) {
      newErrors.mode = 'Please select a payment mode';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('paidAmount', amount);
      formData.append('paymentAmount', amount);
      formData.append('paymentDate', paymentDate);
      formData.append('paymentMode', paymentMode);
      formData.append('paymentStatus', 'Paid');
      if (paymentProof) {
        formData.append('attachments', paymentProof);
      }

      await axios.put(`${baseUrl.updateLead}/${lead._id || lead.id}`, formData, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(isPaid ? 'Payment updated successfully' : 'Payment added successfully');

      // Save submitted values so view mode can show them immediately
      setSavedData({
        amount,
        date: new Date(paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        mode: paymentMode,
        proofFile: paymentProof || undefined,
      });

      onSuccess();
      // Switch to view mode to show saved details
      setMode('view');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to add payment');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr || dateStr === '-') return '-';
    // If it's already formatted (from savedData), return as-is
    if (dateStr.includes(' ')) return dateStr;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#3B82F6] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {mode === 'view' ? 'Payment Details' : (isPaid ? 'Edit Payment' : 'Add Payment')}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── VIEW MODE ──────────────────────────────────────────── */}
        {mode === 'view' && (
          <>
            <div className="p-6 space-y-4">
              {/* Paid status badge */}
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-sm font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  Payment Received
                </span>
              </div>

              {/* Amount */}
              <div className="bg-green-50 border border-green-100 rounded-md p-4 text-center">
                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Paid Amount</p>
                <p className="text-2xl font-bold text-green-700">₹{Number(displayAmount).toLocaleString('en-IN')}</p>
              </div>

              {/* Date & Mode row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 uppercase">Date</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{formatDisplayDate(displayDate)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 uppercase">Mode</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{displayMode}</p>
                </div>
              </div>

              {/* Payment Proof Preview */}
              {(proofUrl || newProofPreviewUrl) && (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Payment Proof</span>
                    </div>
                    <button
                      onClick={() => setShowProofPreview(!showProofPreview)}
                      className="text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {showProofPreview ? 'Hide' : 'Preview'}
                    </button>
                  </div>
                  {showProofPreview && (
                    <div className="p-3 bg-white flex justify-center">
                      <img
                        src={newProofPreviewUrl || proofUrl!}
                        alt="Payment Proof"
                        className="max-h-64 rounded-md object-contain border border-gray-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.innerHTML =
                            '<p class="text-sm text-gray-500 py-4">Unable to load preview. <a href="' +
                            (newProofPreviewUrl || proofUrl) +
                            '" target="_blank" class="text-blue-500 underline">Open in new tab</a></p>';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-between gap-3 bg-gray-50">
              <button
                onClick={onClose}
                className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => setMode('form')}
                className="flex-1 py-2 text-sm font-medium text-white bg-[#3B82F6] rounded-md hover:bg-[#2563EB] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Payment
              </button>
            </div>
          </>
        )}

        {/* ── FORM MODE ──────────────────────────────────────────── */}
        {mode === 'form' && (
          <>
            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span className="text-[#3B82F6] font-bold">₹</span> Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'E') {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (Number(val) < 0) return;
                    setAmount(val);
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  placeholder="Enter amount"
                  disabled
                  readOnly
                  className={`w-full border ${errors.amount ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] bg-gray-100 cursor-not-allowed`}
                />
                {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-[#3B82F6]" /> Payment Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={paymentDate}
                  onChange={(val) => {
                    setPaymentDate(val);
                    if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                  }}
                  error={!!errors.date}
                />
                {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <CreditCard className="h-4 w-4 text-[#3B82F6]" /> Payment Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['Cash', 'GPay', 'Bank Transfer'].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setPaymentMode(m);
                        if (errors.mode) setErrors((prev) => ({ ...prev, mode: undefined }));
                      }}
                      className={`py-2 text-sm font-medium rounded-md border cursor-pointer transition-colors ${
                        paymentMode === m
                          ? 'border-[#3B82F6] text-[#3B82F6] bg-blue-50'
                          : errors.mode
                            ? 'border-red-500 text-red-500 hover:bg-red-50'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {errors.mode && <p className="mt-1 text-xs text-red-500">{errors.mode}</p>}
              </div>

              {/* Payment Proof */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <ImageIcon className="h-4 w-4 text-[#3B82F6]" /> Payment Proof {isPaid ? '(Upload new to replace)' : '(Optional)'}
                </label>
                {isPaid && lead?.paymentProof && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Current: </span>
                      <a 
                        href={`${baseUrl.getImageUrl}/images/LeadAttachment/${lead.paymentProof}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-sm font-medium"
                      >
                        View Attachment
                      </a>
                    </div>
                )}
                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.webp"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-[#3B82F6] hover:file:bg-blue-100"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP — Max 2MB</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-between gap-3 bg-gray-50">
              <button
                onClick={() => {
                  if (isPaid || savedData) {
                    setMode('view');
                  } else {
                    onClose();
                  }
                }}
                className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {(isPaid || savedData) ? 'Back' : 'Cancel'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2 text-sm font-medium text-white bg-[#3B82F6] rounded-md hover:bg-[#2563EB] transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Saving...' : (isPaid ? 'Update Payment' : 'Save Payment')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
