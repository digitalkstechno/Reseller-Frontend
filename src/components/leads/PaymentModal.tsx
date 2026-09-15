import React, { useState, useRef, useEffect } from 'react';
import { X, Calendar, CreditCard, Image as ImageIcon, Plus, CheckCircle, Eye, History, FileText, ArrowDownLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DatePicker from '@/components/ui/DatePicker';
import { formatIndianCurrency } from '@/utills/formatters';

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

  // Dynamically compute paid and pending from localPayments so top summary cards NEVER desync!
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
      const incomingVal = Number(amount);
      const newPaidTotal = computedPaid + incomingVal;
      const finalStatus = totalAmount > 0 && newPaidTotal >= totalAmount ? 'Paid' : 'Partial';

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
      setActiveTab('history');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-100" />
            <div>
              <h2 className="text-lg font-bold">Payments & Installments</h2>
              <p className="text-xs text-blue-100">{lead?.customerName || lead?.fullName || 'Lead'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer p-1 rounded-full hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Summary Overview Card ───────────────────────────────── */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-gray-200 text-center shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Total Amount</span>
              <span className="text-xs sm:text-sm font-bold text-gray-900 tabular-nums">
                {formatAmountDecimals(totalAmount)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Paid Amount</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-600 tabular-nums">
                {formatAmountDecimals(computedPaid)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-0.5">Pending</span>
              <span className={`text-xs sm:text-sm font-bold tabular-nums ${pendingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatAmountDecimals(pendingAmount)}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-3 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('add')}
              className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'add'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Payment
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Payment History ({localPayments.length})
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* ── TAB 1: ADD PAYMENT ───────────────────────────── */}
          {activeTab === 'add' && (
            <div className="space-y-4">
              {isFullyPaid && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-md text-xs font-semibold">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>This lead is already fully paid. You can still record additional installments or adjustments if needed.</span>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <span className="text-blue-600">₹</span> Payment Amount to Add <span className="text-red-500">*</span>
                  </label>
                  {pendingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(String(pendingAmount));
                        if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline cursor-pointer"
                    >
                      Fill Remaining ({formatAmountDecimals(pendingAmount)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
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
                    placeholder="Enter amount (e.g. 50000)"
                    className={`w-full border ${
                      errors.amount ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg pl-8 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 font-medium`}
                  />
                </div>
                {errors.amount && <p className="mt-1 text-xs text-red-500 font-medium">{errors.amount}</p>}
              </div>

              {/* Payment Date & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" /> Payment Date <span className="text-red-500">*</span>
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
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-blue-600" /> Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => {
                      setPaymentMode(e.target.value);
                      if (errors.mode) setErrors((prev) => ({ ...prev, mode: undefined }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-blue-500"
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
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5 text-blue-600" /> Payment Proof / Screenshot (Optional)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-blue-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {/* Note / Remarks */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-blue-600" /> Note / Transaction Ref (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Installment 1 / UPI Ref ID"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-semibold rounded-lg shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Saving Payment...' : (
                  <>
                    <Plus className="h-4 w-4" />
                    Record Payment Entry
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── TAB 2: PAYMENT HISTORY ────────────────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {localPayments.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p className="text-sm text-gray-500">No payment entries recorded yet.</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Record First Payment
                  </button>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                          <tr key={p._id || idx} className="hover:bg-gray-50 transition-colors">
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
                                  className="text-blue-600 hover:text-blue-800 p-1 inline-flex items-center cursor-pointer"
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

              {/* Add more button */}
              {pendingAmount > 0 && (
                <button
                  onClick={() => setActiveTab('add')}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Another Payment / Installment
                </button>
              )}
            </div>
          )}

          {/* Proof Preview Modal / Popup */}
          {previewProofUrl && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="bg-white rounded-lg p-3 max-w-lg w-full overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
                  <span className="text-xs font-bold text-gray-700">Payment Proof Preview</span>
                  <button onClick={() => setPreviewProofUrl(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex justify-center max-h-[70vh] overflow-auto">
                  <img src={previewProofUrl} alt="Payment Proof" className="rounded object-contain max-h-[60vh] max-w-full" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
