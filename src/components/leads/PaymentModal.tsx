import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  CreditCard,
  Plus,
  CheckCircle,
  Eye,
  History,
  Upload,
  Calendar,
  Wallet,
  Clock,
  ChevronRight,
  Info,
  ArrowRight,
  FileText,
  DollarSign
} from 'lucide-react';
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

const formatAmountDecimals = (val: number | string | undefined | null) => {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PaymentModal({ isOpen, onClose, lead, onSuccess }: PaymentModalProps) {
  const totalAmount = Number(lead?.projectAmount) || Number(lead?.paymentAmount) || 0;

  // Local payments list
  const [localPayments, setLocalPayments] = useState<any[]>([]);

  // Dynamically compute paid and pending
  const computedPaid = localPayments.length > 0
    ? localPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : (Number(lead?.paidAmount) || (lead?.paymentStatus === 'Paid' ? totalAmount : 0));
  const pendingAmount = Math.max(0, totalAmount - computedPaid);
  const isFullyPaid = totalAmount > 0 && computedPaid >= totalAmount;

  // Tabs: 'add' or 'history'
  const [activeTab, setActiveTab] = useState<'add' | 'history'>('add');

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentNote, setPaymentNote] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview proof image
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ amount?: string; date?: string; mode?: string }>({});

  useEffect(() => {
    if (isOpen) {
      let paymentsList: any[] = [];
      if (Array.isArray(lead?.payments) && lead.payments.length > 0) {
        paymentsList = lead.payments;
      } else if (Number(lead?.paidAmount) > 0) {
        paymentsList = [
          {
            amount: Number(lead.paidAmount),
            paymentDate: lead?.paymentDate?.startDate || lead?.createdAt,
            paymentMode: lead?.paymentMode || 'Cash',
            paymentProof: lead?.paymentProof,
            createdAt: lead?.createdAt,
          },
        ];
      }
      setLocalPayments(paymentsList);

      const currentPaid = paymentsList.length > 0
        ? paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        : (Number(lead?.paidAmount) || (lead?.paymentStatus === 'Paid' ? totalAmount : 0));

      const rem = Math.max(0, totalAmount - currentPaid);
      setAmount(rem > 0 ? String(rem) : '');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Cash');
      setPaymentProof(null);
      setPaymentNote('');
      setErrors({});
      setPreviewProofUrl(null);
      setActiveTab(currentPaid >= totalAmount && totalAmount > 0 ? 'history' : 'add');
    }
  }, [isOpen, lead, totalAmount]);

  if (!isOpen) return null;

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
      newErrors.amount = 'Please enter a valid payment amount';
    }

    if (!paymentDate) {
      newErrors.date = 'Payment date is required';
    }

    if (!paymentMode) {
      newErrors.mode = 'Payment mode is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const incomingVal = Number(amount);
      const newTotalPaid = computedPaid + incomingVal;
      const finalStatus = newTotalPaid >= totalAmount && totalAmount > 0 ? 'Paid' : 'Partially Paid';

      const formData = new FormData();
      formData.append('addPaymentAmount', String(incomingVal));
      formData.append('paymentDate', paymentDate);
      formData.append('paymentMode', paymentMode);
      formData.append('paymentStatus', finalStatus);
      if (paymentNote) {
        formData.append('paymentNote', paymentNote);
      }
      if (paymentProof) {
        formData.append('attachments', paymentProof);
      }

      const res = await axios.put(`${baseUrl.updateLead}/${lead._id || lead.id}`, formData, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Payment recorded successfully');

      const updatedLead = res.data?.data;

      // Update local state directly with latest records from server
      if (updatedLead && Array.isArray(updatedLead.payments) && updatedLead.payments.length > 0) {
        setLocalPayments(updatedLead.payments);
      } else {
        const updatedRecord = {
          amount: incomingVal,
          paymentDate: paymentDate,
          paymentMode: paymentMode,
          paymentProof: paymentProof ? URL.createObjectURL(paymentProof) : undefined,
          note: paymentNote,
          createdAt: new Date(),
        };
        setLocalPayments((prev) => [updatedRecord, ...prev]);
      }

      setAmount('');
      setPaymentProof(null);
      setPaymentNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayDate = (dateStr: any) => {
    if (!dateStr || dateStr === '-') return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between bg-white border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#3B82F6] flex items-center justify-center flex-shrink-0">
              <CreditCard className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">Payments & Installments</h2>
              <p className="text-xs text-gray-400 mt-0.5 font-normal">Add payment details and record the transaction.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Summary Overview Cards ───────────────────────────────── */}
        <div className="px-6 pt-3 pb-3 bg-white flex-shrink-0">
          <div className="grid grid-cols-3 gap-2.5 text-left">
            {/* Total Amount */}
            <div className="bg-[#f0f6ff] p-3 rounded-xl border border-[#dbeafe] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[#3B82F6] mb-1">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-3 w-3 text-[#3B82F6]" />
                </div>
                <span className="text-[10px] font-bold tracking-tight uppercase text-[#3B82F6]/90">TOTAL AMOUNT</span>
              </div>
              <span className="text-sm sm:text-[15px] font-extrabold text-gray-900 tabular-nums">
                {formatAmountDecimals(totalAmount)}
              </span>
            </div>

            {/* Paid Amount */}
            <div className="bg-[#ecfdf5] p-3 rounded-xl border border-[#a7f3d0] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-3 w-3 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold tracking-tight uppercase text-emerald-700/90">PAID AMOUNT</span>
              </div>
              <span className="text-sm sm:text-[15px] font-extrabold text-emerald-600 tabular-nums">
                {formatAmountDecimals(computedPaid)}
              </span>
            </div>

            {/* Pending Amount */}
            <div className="bg-[#fffbeb] p-3 rounded-xl border border-[#fde68a] flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[#d97706] mb-1">
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-3 w-3 text-[#d97706]" />
                </div>
                <span className="text-[10px] font-bold tracking-tight uppercase text-[#d97706]/90">PENDING AMOUNT</span>
              </div>
              <span className="text-sm sm:text-[15px] font-extrabold text-[#d97706] tabular-nums">
                {formatAmountDecimals(pendingAmount)}
              </span>
            </div>
          </div>

          {/* Navigation Bar: Payment History (count) > + Add Payment */}
          <div className="flex items-center justify-between mt-3 px-3.5 py-2 bg-[#f8fafc] border border-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="flex items-center gap-2 text-xs font-semibold text-gray-700 hover:text-[#3B82F6] transition-colors cursor-pointer group"
            >
              <History className="h-4 w-4 text-[#3B82F6]" />
              <span>Payment History ({localPayments.length})</span>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'add'
                  ? 'bg-white text-[#3B82F6] border border-[#3B82F6] shadow-sm'
                  : 'text-[#3B82F6] border border-[#3B82F6]/40 hover:bg-blue-50'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Payment
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="px-6 py-2 overflow-y-auto flex-1 space-y-3.5">
          {/* ── TAB 1: ADD PAYMENT ───────────────────────────── */}
          {activeTab === 'add' && (
            <div className="space-y-3.5">
              {/* Payment Amount to Add */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white inline-flex items-center justify-center text-[10px] font-bold">₹</span>
                    Payment Amount to Add <span className="text-red-500">*</span>
                  </label>
                  {pendingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(String(pendingAmount));
                        if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                      }}
                      className="text-[11px] font-semibold text-[#3B82F6] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Remaining: {formatAmountDecimals(pendingAmount)}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === 'E') {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAmount(val);
                      if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                    }}
                    placeholder="Enter amount (e.g. 12000)"
                    className={`w-full border ${
                      errors.amount ? 'border-red-500' : 'border-gray-200'
                    } rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-100 bg-white text-gray-900 placeholder:text-gray-400 font-normal transition-all`}
                  />
                </div>
                {errors.amount && <p className="mt-1 text-xs text-red-500 font-medium">{errors.amount}</p>}
              </div>

              {/* Payment Date & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#3B82F6]" />
                    Payment Date <span className="text-red-500">*</span>
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

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-[#3B82F6]" />
                    Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => {
                      setPaymentMode(e.target.value);
                      if (errors.mode) setErrors((prev) => ({ ...prev, mode: undefined }));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="GPay / UPI">GPay / UPI</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
              </div>

              {/* Payment Proof File */}
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#3B82F6]" />
                  Payment Proof / Screenshot (Optional)
                </label>
                <div className="flex items-center gap-3 p-1.5 bg-[#f8fafc] border border-dashed border-blue-200 rounded-xl">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    id="payment-proof-upload"
                  />
                  <label
                    htmlFor="payment-proof-upload"
                    className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#3B82F6] bg-white border border-blue-100 shadow-sm hover:bg-blue-50 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#3B82F6]" />
                    {paymentProof ? 'Change File' : 'Choose File'}
                  </label>
                  <span className="text-xs text-gray-500 truncate max-w-[240px]">
                    {paymentProof ? paymentProof.name : 'No file chosen'}
                  </span>
                </div>
              </div>

              {/* Note / Remarks */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#3B82F6]" />
                    Note / Transaction Ref (Optional)
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={100}
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="e.g. Installment 1 / UPI Ref ID"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono">
                    {paymentNote.length}/100
                  </span>
                </div>
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-98 text-white text-sm font-semibold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? 'Saving Payment...' : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Record Payment Entry</span>
                    <ArrowRight className="h-4 w-4 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── TAB 2: PAYMENT HISTORY ────────────────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-3 py-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Transaction Records</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="text-xs text-[#3B82F6] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add New
                </button>
              </div>

              {localPayments.length === 0 ? (
                <div className="p-8 text-center bg-gray-50/80 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-sm text-gray-500">No payment entries recorded yet.</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-2 text-xs font-semibold text-[#3B82F6] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Record First Payment
                  </button>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-semibold border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Note</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Proof</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {localPayments.map((p, idx) => {
                        const proofUrl = p.paymentProof
                          ? (p.paymentProof.startsWith('blob:')
                              ? p.paymentProof
                              : `${baseUrl.getImageUrl}/images/LeadAttachment/${p.paymentProof}`)
                          : null;

                        return (
                          <tr key={p._id || idx} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-2.5 px-3 text-gray-400 font-medium">{localPayments.length - idx}</td>
                            <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">
                              {formatDisplayDate(p.paymentDate || p.createdAt)}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-medium">
                                {p.paymentMode || 'Cash'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 max-w-[120px] truncate" title={p.note}>
                              {p.note || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                              {formatAmountDecimals(p.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {proofUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewProofUrl(proofUrl)}
                                  className="text-[#3B82F6] hover:text-blue-700 p-1 inline-flex items-center cursor-pointer"
                                  title="View Proof"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with note & close button */}
        <div className="px-6 py-3 border-t border-gray-100 bg-[#f8fafc] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Your payment details are secure and will be saved to the transaction history.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm transition-colors cursor-pointer ml-3 flex-shrink-0"
          >
            Close
          </button>
        </div>
      </div>

      {/* Proof Preview Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-4 max-w-lg w-full relative">
            <button
              onClick={() => setPreviewProofUrl(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Payment Proof</h3>
            <img
              src={previewProofUrl}
              alt="Payment Proof"
              className="w-full max-h-[60vh] object-contain rounded-xl border border-gray-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
