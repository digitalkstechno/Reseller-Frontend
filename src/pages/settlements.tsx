'use client';

import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import DataTable, { Column } from '@/components/DataTable';
import Badge from '@/components/Badge';
import {
  IndianRupee,
  ReceiptText,
  Users,
  Percent,
  Banknote,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Building2,
  X,
  History,
  FileSpreadsheet
} from 'lucide-react';
import { exportToExcel } from '@/utills/exportHelper';

interface SettlementReseller {
  _id: string;
  resellerName: string;
  resellerEmail: string;
  resellerPhone?: string;
  commissionRate: number | string;
  totalLeadsCount: number;
  totalLeadsAmount: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  settledLeadsCount: number;
  unsettledLeadsCount: number;
  resellerImage?: string;
  bankDetails?: string;
  upiId?: string;
  projectNames?: string[];
}

interface SummaryStats {
  totalRevenue: number;
  totalCommission: number;
  totalPaid: number;
  pendingCommission: number;
  totalWonLeads: number;
  settledLeadsCount: number;
  unsettledLeadsCount: number;
  payoutCount: number;
  totalResellers: number;
}

export default function SettlementsPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Summary KPI Data
  const [summary, setSummary] = useState<SummaryStats>({
    totalRevenue: 0,
    totalCommission: 0,
    totalPaid: 0,
    pendingCommission: 0,
    totalWonLeads: 0,
    settledLeadsCount: 0,
    unsettledLeadsCount: 0,
    payoutCount: 0,
    totalResellers: 0
  });

  // Table Data & Pagination
  const [settlementsData, setSettlementsData] = useState<SettlementReseller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Quick Pay Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<SettlementReseller | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('Bank Transfer');
  const [payRefId, setPayRefId] = useState<string>('');
  const [payNote, setPayNote] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [payError, setPayError] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);

  // History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  // Search Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch KPI Summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await axios.get(baseUrl.settlementSummary, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (res.data?.data) {
        setSummary(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch settlement summary:', e);
    }
  }, [token]);

  // Fetch Resellers Settlement Table
  const fetchSettlements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.settlements, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: {
          page: currentPage,
          limit: rowsPerPage,
          search: debouncedSearch
        }
      });

      const payload = res.data?.data || [];
      setSettlementsData(payload);

      const pag = res.data?.pagination;
      if (pag) {
        setTotalRecords(pag.totalRecords || 0);
        setTotalPages(pag.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch settlements:', error);
      toast.error('Failed to load settlements data');
      setSettlementsData([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, currentPage, rowsPerPage, debouncedSearch]);

  useEffect(() => {
    setIsMounted(true);
    fetchSummary();
    fetchSettlements();
  }, [fetchSummary, fetchSettlements]);

  // Fetch History for Reseller
  const handleOpenHistory = async (reseller: SettlementReseller) => {
    setSelectedReseller(reseller);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    try {
      const res = await axios.get(`${baseUrl.settlementHistory}/${reseller._id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      setHistoryData(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load payout history:', err);
      toast.error('Failed to load payout history');
      setHistoryData([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Quick Pay Submit
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');
    if (!selectedReseller || !payAmount) return;

    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPayError('Please enter a valid amount greater than 0');
      return;
    }

    if (numAmount > selectedReseller.pendingCommission) {
      setPayError(`Amount cannot exceed pending balance (₹${selectedReseller.pendingCommission.toLocaleString('en-IN')})`);
      return;
    }

    setIsPaying(true);
    try {
      await axios.post(
        baseUrl.addSettlement,
        {
          resellerId: selectedReseller._id,
          amount: numAmount,
          paymentMethod: payMethod,
          referenceId: payRefId,
          paymentDate: payDate,
          note: payNote
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      toast.success('Payout recorded and leads updated successfully!');
      setIsPayModalOpen(false);
      setPayAmount('');
      setPayRefId('');
      setPayNote('');
      setSelectedReseller(null);
      fetchSummary();
      fetchSettlements();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record payout');
    } finally {
      setIsPaying(false);
    }
  };

  // Export Table Data
  const handleExportExcel = async () => {
    if (!settlementsData.length) {
      toast.error('No settlement data to export');
      return;
    }
    const columns = [
      { header: 'Reseller Name', key: 'resellerName', width: 25 },
      { header: 'Email', key: 'resellerEmail', width: 30 },
      { header: 'Phone', key: 'resellerPhone', width: 15 },
      { header: 'Commission Rate (%)', key: 'commissionRate', width: 20 },
      { header: 'Total Paid Leads', key: 'totalLeadsCount', width: 18 },
      { header: 'Total Revenue (₹)', key: 'totalLeadsAmount', width: 18 },
      { header: 'Total Commission Earned (₹)', key: 'totalCommission', width: 25 },
      { header: 'Paid Payout (₹)', key: 'paidCommission', width: 18 },
      { header: 'Pending Balance (₹)', key: 'pendingCommission', width: 18 },
      { header: 'Unsettled Leads', key: 'unsettledLeadsCount', width: 18 },
      { header: 'Settled Leads', key: 'settledLeadsCount', width: 18 },
    ];
    const fileName = `Settlements_Summary_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportToExcel(fileName, 'Settlements', columns, settlementsData);
  };

  if (!isMounted) return null;

  const columns: Column<SettlementReseller>[] = [
    {
      key: 'resellerName',
      label: 'RESELLER',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-900 bg-gray-50">
            <span className="text-xs font-bold text-gray-500">
              {value?.charAt(0)?.toUpperCase() || 'R'}
            </span>
            {row.resellerImage && (
              <img
                src={row.resellerImage.includes('http') ? row.resellerImage : `${baseUrl.getImageUrl}/images/ResellerProfileImages/${row.resellerImage}`}
                alt={value}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">{value}</span>
            <span className="text-xs text-sky-950 underline">{row.resellerEmail}</span>
            {row.resellerPhone && (
              <span className="text-[11px] text-gray-400">{row.resellerPhone}</span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'totalLeadsCount',
      label: 'TOTAL LEADS',
      render: (value, row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-medium text-gray-800">
            <Users className="h-3.5 w-3.5 text-blue-500" />
            <span>{value} Leads</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
            <span className="text-orange-600 font-medium">{row.unsettledLeadsCount || 0} pending</span>
            <span className="text-gray-300">•</span>
            <span className="text-emerald-600 font-medium">{row.settledLeadsCount || 0} settled</span>
          </div>
        </div>
      )
    },
    {
      key: 'totalLeadsAmount',
      label: 'TOTAL LEAD AMOUNT',
      render: (value) => (
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-semibold text-emerald-700">
            {(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )
    },
    {
      key: 'totalCommission',
      label: 'PAYABLE COMMISSION (DIGITALKS)',
      render: (value) => (
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3.5 w-3.5 text-gray-600" />
          <span className="font-semibold text-gray-800">
            {(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )
    },
    {
      key: 'paidCommission',
      label: 'PAID',
      render: (value) => (
        <Badge
          label={`₹ ${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          className="bg-green-50 text-green-700 border-green-200 font-bold"
        />
      )
    },
    {
      key: 'pendingCommission',
      label: 'PENDING PAYOUT',
      render: (value) => {
        const val = Number(value) || 0;
        return (
          <Badge
            label={`₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            className="bg-orange-50 text-orange-600 border-orange-200 font-bold"
          />
        );
      }
    },
    {
      key: '_id',
      label: 'ACTIONS',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => router.push(`/settlements/${row._id}`)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#3B82F6] bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer border border-blue-200"
            title="View Leads"
          >
            Leads
            <ArrowRight className="w-3 h-3" />
          </button>
          {row.pendingCommission > 0 && (
            <button
              onClick={() => {
                setSelectedReseller(row);
                setPayAmount(row.pendingCommission.toString());
                setIsPayModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs cursor-pointer"
              title="Quick Pay"
            >
              <Banknote className="w-3 h-3" />
              Pay
            </button>
          )}
          <button
            onClick={() => handleOpenHistory(row)}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors cursor-pointer border border-gray-200"
            title="Payout History"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col h-full gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Head>
        <title>Settlements | Reseller CRM</title>
      </Head>

      {/* 4 Standard KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-shrink-0">
        <div className="bg-white rounded-md border border-gray-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Total Leads Revenue</p>
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <IndianRupee className="h-4 w-4 mr-1 text-gray-600" />
              {(summary.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <ReceiptText className="h-5 w-5 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Payable Commissions (Digitalks)</p>
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <IndianRupee className="h-4 w-4 mr-1 text-gray-600" />
              {(summary.totalCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Banknote className="h-5 w-5 text-[#3B82F6]" />
          </div>
        </div>

        <div className="bg-white rounded-md border border-green-200 p-5 shadow-xs bg-green-50/40 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-green-800 mb-1">Total Paid</p>
            <h3 className="text-xl font-bold text-green-700 flex items-center">
              <IndianRupee className="h-4 w-4 mr-1" />
              {(summary.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-700" />
          </div>
        </div>

        <div className="bg-white rounded-md border border-orange-200 p-5 shadow-xs bg-orange-50/40 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-orange-800 mb-1">Pending Payouts</p>
            <h3 className="text-xl font-bold text-orange-700 flex items-center">
              <IndianRupee className="h-4 w-4 mr-1" />
              {(summary.pendingCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-200 flex items-center justify-center">
            <Clock className="h-5 w-5 text-orange-700" />
          </div>
        </div>
      </div>

      {/* Main Resellers Settlement DataTable */}
      <div className="bg-white rounded-md border border-gray-200 flex-1 min-h-0 flex flex-col overflow-hidden">
        <DataTable
          data={settlementsData}
          columns={columns}
          loading={isLoading}
          searchable={false}
          headerActions={
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search reseller..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white pl-10 pr-4 py-2 text-xs text-gray-700 placeholder:text-gray-400 transition-all duration-200 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 hover:border-gray-300"
                />
              </div>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Export
              </button>
            </div>
          }
          pagination={true}
          serverSidePagination={true}
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={rowsPerPage}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(r) => {
            setRowsPerPage(r);
            setCurrentPage(1);
          }}
          onRowClick={(row) => router.push(`/settlements/${row._id}`)}
        />
      </div>

      {/* Quick Pay Modal */}
      {isPayModalOpen && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Record Settlement Payment</h2>
                  <p className="text-xs text-gray-500">{selectedReseller.resellerName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(selectedReseller.bankDetails || selectedReseller.upiId) && (
              <div className="mt-3 p-2.5 bg-blue-50/70 border border-blue-100 rounded-md text-xs space-y-1">
                <p className="font-semibold text-blue-900 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Bank / UPI Destination:
                </p>
                {selectedReseller.upiId && (
                  <p className="text-blue-800">
                    UPI ID: <span className="font-semibold">{selectedReseller.upiId}</span>
                  </p>
                )}
                {selectedReseller.bankDetails && (
                  <p className="text-blue-800 whitespace-pre-wrap">{selectedReseller.bankDetails}</p>
                )}
              </div>
            )}

            <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-md flex items-center justify-between">
              <span className="text-xs text-amber-800 font-medium">Pending Balance:</span>
              <span className="text-sm font-bold text-amber-900">
                ₹{selectedReseller.pendingCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <form noValidate onSubmit={handlePaySubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Amount (INR) <span className="text-red-500">*</span>
                </label>
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
                    className="block w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all"
                    value={payAmount}
                    onChange={(e) => {
                      setPayAmount(e.target.value);
                      setPayError('');
                    }}
                  />
                </div>
                {payError && <p className="mt-1 text-xs font-semibold text-red-500">{payError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select
                    className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all cursor-pointer"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="UPI">UPI</option>
                    <option value="GPay">Google Pay</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Transaction / Reference ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR1234987654"
                  value={payRefId}
                  onChange={(e) => setPayRefId(e.target.value)}
                  className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Note (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Settled commission for March batch"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="rounded-md border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isPaying ? 'Processing...' : 'Confirm & Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-xl bg-white p-6 shadow-xl border border-gray-200 flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#3B82F6] border border-blue-100">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Settlement History Log</h2>
                  <p className="text-xs text-gray-500">
                    Payout records for <strong className="text-gray-800">{selectedReseller.resellerName}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 pr-1">
              {isHistoryLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
                  <span className="mt-2 text-xs">Loading history...</span>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs">
                  No payout transactions recorded for this reseller yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map((tx: any) => {
                    const leadsList = Array.isArray(tx.leads) ? tx.leads : [];
                    return (
                      <div
                        key={tx._id}
                        className="p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-300 shadow-xs transition-all space-y-3"
                      >
                        {/* Transaction Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
                              <IndianRupee className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-gray-900">
                                  ₹{(Number(tx.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Completed
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span className="font-semibold text-blue-600">{tx.paymentMethod}</span>
                                {tx.referenceId && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-gray-600">Ref: {tx.referenceId}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-semibold text-gray-800">
                              {new Date(tx.paymentDate || tx.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            {tx.processedBy?.fullName && (
                              <p className="text-[10px] text-gray-400 mt-0.5">By {tx.processedBy.fullName}</p>
                            )}
                          </div>
                        </div>

                        {/* Note */}
                        {tx.note && (
                          <div className="text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <span className="font-semibold text-gray-700">Note: </span>
                            {tx.note}
                          </div>
                        )}

                        {/* Settled Leads Details */}
                        {leadsList.length > 0 ? (
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Settled Leads ({leadsList.length})
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {leadsList.map((lead: any, lIdx: number) => {
                                const leadCustName = lead.customerName || lead.fullName || 'Lead';
                                const projName = lead.project?.projectName || lead.project?.name || lead.product || 'Project';
                                const leadAmt = Number(lead.paymentAmount || lead.paidAmount || 0);
                                const commAmt = Number(lead.commissionAmount || 0);
                                const commRate = lead.commissionRate || 0;

                                return (
                                  <div
                                    key={lead._id || lIdx}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 text-xs hover:bg-blue-50/30 transition-colors"
                                  >
                                    <div className="flex flex-col min-w-0 pr-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900 truncate">{leadCustName}</span>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                          {projName}
                                        </span>
                                      </div>
                                      {(lead.customerContact || lead.customerEmail) && (
                                        <span className="text-[11px] text-gray-400 mt-0.5 truncate">
                                          {lead.customerContact || lead.customerEmail}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                      <div className="font-bold text-emerald-700">
                                        ₹{commAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </div>
                                      <div className="text-[10px] text-gray-500">
                                        Lead: ₹{leadAmt.toLocaleString('en-IN')} {commRate ? `(${commRate}%)` : ''}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-1.5 border-t border-gray-100 text-[11px] text-gray-400 italic">
                            Direct payout (Lump-sum advance / manual settlement)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
