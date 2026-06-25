'use client';

import { useEffect, useState, useCallback } from 'react';
import DataTable, { Column } from '@/components/DataTable';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import { IndianRupee, ReceiptText, Users, Percent, Banknote } from 'lucide-react';
import SettlementLeadsList from '@/components/leads/SettlementLeadsList';

interface Settlement {
  _id: string; // Reseller ID
  resellerName: string;
  resellerEmail: string;
  commissionRate: string;
  totalLeadsCount: number;
  totalLeadsAmount: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  resellerImage?: string;
}

interface LeadSettlement {
  id: string;
  customerName: string;
  status: string;
  paymentAmount: number;
  commissionAmount: number;
  paymentDate: string | null;
  paymentMode: string;
}

export function SettlementsContent() {
  const [isMounted, setIsMounted] = useState(false);
  const [settlementsData, setSettlementsData] = useState<Settlement[]>([]);
  const [resellerLeadsData, setResellerLeadsData] = useState<LeadSettlement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Settlement | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('Bank Transfer');
  const [payRefId, setPayRefId] = useState<string>('');
  const [payError, setPayError] = useState<string>('');
  const [payNote, setPayNote] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  const getUserRole = useCallback((): string => {
    if (!token) return '';
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(window.atob(parts[1]));
        return payload?.role?.roleName?.toLowerCase() || '';
      }
    } catch (e) {
      console.error('Failed to parse token payload:', e);
    }
    return '';
  }, [token]);

  const userRole = getUserRole();

  const fetchSettlements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.settlements, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const payload = res.data?.data || [];
      setSettlementsData(payload);

      if (getUserRole() === 'reseller') {
        const leadsRes = await axios.get(`${baseUrl.resellerLeadSettlements}?limit=1000`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        setResellerLeadsData(leadsRes.data?.data?.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
      toast.error('Failed to load settlements data');
      setSettlementsData([]);
      setResellerLeadsData([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, getUserRole]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const fetchHistory = async (resellerId: string) => {
    setIsHistoryLoading(true);
    try {
      const res = await axios.get(`${baseUrl.settlementHistory}/${resellerId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setHistoryData(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast.error('Failed to load settlement history');
      setHistoryData([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');
    if (!selectedReseller || !payAmount) return;

    if (parseFloat(payAmount) > selectedReseller.pendingCommission) {
      setPayError(`Settlement amount cannot exceed pending commission (₹${selectedReseller.pendingCommission.toLocaleString('en-IN')})`);
      return;
    }

    setIsPaying(true);
    try {
      await axios.post(
        baseUrl.addSettlement,
        {
          resellerId: selectedReseller._id,
          amount: parseFloat(payAmount),
          paymentMethod: payMethod,
          referenceId: payRefId,
          note: payNote,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      toast.success('Settlement payment recorded successfully');
      setIsPayModalOpen(false);
      setPayAmount('');
      setPayMethod('Bank Transfer');
      setPayRefId('');
      setPayNote('');
      setSelectedReseller(null);
      fetchSettlements();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsPaying(false);
    }
  };

  const columns: Column<Settlement>[] = [
    {
      key: 'resellerName',
      label: 'RESELLER',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-900">
            {row.resellerImage ? (
              <img src={`${process.env.NEXT_PUBLIC_IMAGE_URL || ''}/images/ResellerProfileImages/${row.resellerImage}`} alt={value} className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs font-bold text-gray-500">
                {value?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">{value}</span>
            <a href={`mailto:${row.resellerEmail}`} className="text-xs text-primary underline">
              {row.resellerEmail}
            </a>
          </div>
        </div>
      ),
    },
    {
      key: 'commissionRate',
      label: 'COMMISSION RATE',
      render: (value) => (
        <div className="flex flex-row items-center gap-0.5">
          <span className="font-medium text-gray-700">{value}</span>
          <Percent className="h-3 w-3 text-gray-500" />
        </div>
      ),
    },
    {
      key: 'totalLeadsCount',
      label: 'TOTAL LEADS',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: 'totalLeadsAmount',
      label: 'TOTAL LEAD AMOUNT',
      render: (value) => (
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3 w-3 text-emerald-600" />
          <span className="font-semibold text-emerald-700">
            {value.toLocaleString('en-IN')}
          </span>
        </div>
      ),
    },
    {
      key: 'totalCommission',
      label: 'TOTAL EARNED',
      render: (value) => (
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3 w-3 text-gray-600" />
          <span className="font-semibold text-gray-800">
            {value.toLocaleString('en-IN')}
          </span>
        </div>
      ),
    },
    {
      key: 'paidCommission',
      label: 'PAID',
      render: (value) => (
        <div className="flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 w-max border border-green-200">
          <IndianRupee className="h-3 w-3 text-green-700" />
          <span className="font-bold text-green-700">
            {value.toLocaleString('en-IN')}
          </span>
        </div>
      ),
    },
    {
      key: 'pendingCommission',
      label: 'PENDING',
      render: (value) => (
        <div className="flex items-center gap-1 rounded-md bg-orange-100 px-2 py-1 w-max border border-orange-200">
          <IndianRupee className="h-3 w-3 text-orange-700" />
          <span className="font-bold text-orange-700">
            {value.toLocaleString('en-IN')}
          </span>
        </div>
      ),
    },
  ];

  if (userRole === 'admin') {
    columns.push({
      key: '_id',
      label: 'ACTIONS',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.pendingCommission > 0 && (
            <button
              onClick={() => {
                setSelectedReseller(row);
                setPayAmount(row.pendingCommission.toString());
                setIsPayModalOpen(true);
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 flex items-center gap-1 shadow-sm"
            >
              <Banknote className="h-3 w-3" />
              Pay
            </button>
          )}
          <button
            onClick={() => {
              setSelectedReseller(row);
              fetchHistory(row._id);
              setIsHistoryModalOpen(true);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1 shadow-sm"
          >
            <ReceiptText className="h-3 w-3" />
            View Payments
          </button>
        </div>
      ),
    });
  }

  const resellerColumns: Column<LeadSettlement>[] = [
    {
      key: 'customerName',
      label: 'LEAD NAME',
      render: (value) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (value) => (
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {value}
        </span>
      ),
    },
    {
      key: 'paymentAmount',
      label: 'LEAD REVENUE',
      render: (value) => (
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3 w-3 text-emerald-600" />
          <span className="font-semibold text-emerald-700">
            {value.toLocaleString('en-IN')}
          </span>
        </div>
      ),
    },
    {
      key: 'commissionAmount',
      label: 'COMMISSION EARNED',
      render: (value) => (
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3 w-3 text-gray-600" />
          <span className="font-semibold text-gray-800">
            {value.toLocaleString('en-IN')}
          </span>
        </div>
      ),
    },
    {
      key: 'paymentDate',
      label: 'DATE',
      render: (value) => value ? new Date(value).toLocaleDateString('en-IN') : '-',
    },
  ];

  // Calculate totals for summary cards
  const totalLeadsAmount = settlementsData.reduce((acc, curr) => acc + curr.totalLeadsAmount, 0);
  const totalCommissionAmount = settlementsData.reduce((acc, curr) => acc + curr.totalCommission, 0);
  const totalPaid = settlementsData.reduce((acc, curr) => acc + curr.paidCommission, 0);
  const totalPending = settlementsData.reduce((acc, curr) => acc + curr.pendingCommission, 0);

  const filteredSettlements = settlementsData.filter(settlement => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      settlement.resellerName?.toLowerCase().includes(query) ||
      settlement.resellerEmail?.toLowerCase().includes(query) ||
      settlement.commissionRate?.toString().includes(query)
    );
  });

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Leads Revenue</p>
              <h3 className="text-2xl font-bold text-gray-900 flex items-center"><IndianRupee className="h-5 w-5 mr-1 text-gray-600"/>{totalLeadsAmount.toLocaleString('en-IN')}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <ReceiptText className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Commissions</p>
              <h3 className="text-2xl font-bold text-gray-900 flex items-center"><IndianRupee className="h-5 w-5 mr-1 text-gray-600"/>{totalCommissionAmount.toLocaleString('en-IN')}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Banknote className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-6 shadow-sm bg-green-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 mb-1">Total Paid</p>
              <h3 className="text-2xl font-bold text-green-700 flex items-center"><IndianRupee className="h-5 w-5 mr-1"/>{totalPaid.toLocaleString('en-IN')}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-200 flex items-center justify-center">
              <IndianRupee className="h-6 w-6 text-green-700" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 p-6 shadow-sm bg-orange-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-800 mb-1">Total Pending</p>
              <h3 className="text-2xl font-bold text-orange-700 flex items-center"><IndianRupee className="h-5 w-5 mr-1"/>{totalPending.toLocaleString('en-IN')}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-200 flex items-center justify-center">
              <IndianRupee className="h-6 w-6 text-orange-700" />
            </div>
          </div>
        </div>

        {userRole === 'reseller' ? (
          <DataTable
            data={resellerLeadsData}
            columns={resellerColumns}
            searchable={false}
            pagination={false}
            actions={false}
          />
        ) : (
          <DataTable
              data={filteredSettlements}
              columns={columns}
              loading={isLoading}
              title="Reseller Settlements"
              subtitle="Manage commissions and record payments for your resellers."
              searchable
              onSearch={(val) => setSearchQuery(val)}
              expandableContent={(row) => <SettlementLeadsList resellerId={row._id} />}
            />
        )}
      </div>

      {isPayModalOpen && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Record Settlement Payment</h2>
            <p className="text-sm text-gray-600 mb-4">
              Recording payment for <strong>{selectedReseller.resellerName}</strong>. 
              Pending balance: <span className="font-semibold text-orange-600 flex items-center inline-flex"><IndianRupee className="h-3 w-3"/>{selectedReseller.pendingCommission.toLocaleString('en-IN')}</span>
            </p>
            <form onSubmit={handlePaySubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (INR)</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <IndianRupee className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      max={selectedReseller.pendingCommission}
                      step="0.01"
                      required
                      className="block w-full rounded-xl border border-gray-300 pl-9 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      value={payAmount}
                      onChange={(e) => {
                        setPayAmount(e.target.value);
                        setPayError('');
                      }}
                    />
                  </div>
                  {payError && <p className="mt-1 text-sm text-red-500">{payError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    className="block w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference ID (Optional)</label>
                  <input
                    type="text"
                    className="block w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="e.g. UTR Number"
                    value={payRefId}
                    onChange={(e) => setPayRefId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
                  <textarea
                    className="block w-full rounded-xl border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    rows={3}
                    placeholder="e.g. Bank Transfer ID 12345"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isPaying ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isHistoryModalOpen && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Settlement History</h2>
            <p className="text-sm text-gray-600 mb-4">
              Payout records for <strong>{selectedReseller.resellerName}</strong>
            </p>
            <div className="flex-1 overflow-auto border border-gray-200 rounded-xl bg-gray-50 p-4">
              {isHistoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading history...</span>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ReceiptText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p>No settlement history found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map((item, idx) => (
                    <div key={item._id || idx} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900 flex items-center"><IndianRupee className="h-4 w-4" />{item.amount.toLocaleString('en-IN')}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${item.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{item.status || 'Completed'}</span>
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                          <span>Date: {new Date(item.createdAt).toLocaleString('en-IN')}</span>
                          <span>Method: {item.paymentMethod || 'Bank Transfer'}</span>
                          {item.referenceId && <span>Ref: <span className="font-mono text-gray-700">{item.referenceId}</span></span>}
                        </div>
                        {item.note && <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded-md italic">"{item.note}"</p>}
                      </div>
                      <div className="text-xs text-gray-500 text-right sm:min-w-[120px]">
                        {item.processedBy && (
                          <>
                            <p className="font-medium text-gray-700">Processed by:</p>
                            <p>{item.processedBy.firstName} {item.processedBy.lastName}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setHistoryData([]);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Settlements() {
  return (
    <>
      <SettlementsContent />
    </>
  );
}
