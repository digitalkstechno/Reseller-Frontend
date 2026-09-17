import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import DataTable, { Column } from '@/components/DataTable';
import Badge from '@/components/Badge';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  IndianRupee,
  Search,
  Download,
  CreditCard,
  Building2,
  X,
  FileSpreadsheet,
  Banknote
} from 'lucide-react';
import { exportToExcel } from '@/utills/exportHelper';

interface ResellerInfo {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  commissionRate?: number;
  bankDetails?: string;
  upiId?: string;
}

interface LeadSettlementItem {
  id: string;
  customerName: string;
  customerContact: string;
  customerEmail: string;
  companyName: string;
  projectName: string;
  status: string;
  paymentAmount: number;
  commissionAmount: number;
  commissionRate: number;
  paymentDate: string;
  paymentMode: string;
  isSettled: boolean;
  settlementDate?: string | null;
  settlementRef?: string;
  settlementMethod?: string;
}

const formatLeadDate = (dateVal: any): string => {
  if (!dateVal) return '-';
  // If paymentDate is an object like { startDate: '...' }
  const raw = typeof dateVal === 'object' ? dateVal.startDate || dateVal.date || null : dateVal;
  if (!raw) return '-';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export default function SettlementDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const resellerId = id as string;

  const [isMounted, setIsMounted] = useState(false);
  const [reseller, setReseller] = useState<ResellerInfo | null>(null);

  // Tabs: 'unsettled' | 'settled'
  const [activeTab, setActiveTab] = useState<'unsettled' | 'settled'>('unsettled');

  // Leads list & stats
  const [leads, setLeads] = useState<LeadSettlementItem[]>([]);
  const [unsettledCount, setUnsettledCount] = useState(0);
  const [settledCount, setSettledCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Selection
  const [selectedLeads, setSelectedLeads] = useState<LeadSettlementItem[]>([]);

  // Settle Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleMethod, setSettleMethod] = useState('Bank Transfer');
  const [settleRefId, setSettleRefId] = useState('');
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [settleNote, setSettleNote] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch leads for this reseller
  const fetchLeads = useCallback(async () => {
    if (!resellerId) return;
    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.resellerLeadSettlements, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: {
          resellerId,
          settled: activeTab === 'settled',
          page,
          limit,
          search: debouncedSearch
        }
      });

      const responseData = res.data?.data;
      if (responseData) {
        setLeads(responseData.data || []);
        setTotalRecords(responseData.totalRecords || 0);
        setTotalPages(responseData.totalPages || 1);
        setUnsettledCount(responseData.unsettledCount || 0);
        setSettledCount(responseData.settledCount || 0);
        if (responseData.reseller) {
          setReseller(responseData.reseller);
        }
      }
    } catch (error) {
      console.error('Failed to fetch reseller leads:', error);
      toast.error('Failed to load lead settlements');
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [resellerId, activeTab, page, limit, debouncedSearch, token]);

  useEffect(() => {
    setIsMounted(true);
    if (resellerId) {
      fetchLeads();
    }
  }, [resellerId, fetchLeads]);

  // Clear selections when switching tabs
  const handleTabChange = (tab: 'unsettled' | 'settled') => {
    setActiveTab(tab);
    setSelectedLeads([]);
    setPage(1);
  };

  // Selection handlers
  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newItems = [...selectedLeads];
      leads.forEach((lead) => {
        if (!newItems.some((item) => item.id === lead.id)) {
          newItems.push(lead);
        }
      });
      setSelectedLeads(newItems);
    } else {
      const currentPageIds = leads.map((l) => l.id);
      setSelectedLeads(selectedLeads.filter((item) => !currentPageIds.includes(item.id)));
    }
  };

  const handleToggleSelectLead = (lead: LeadSettlementItem, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, lead]);
    } else {
      setSelectedLeads(selectedLeads.filter((item) => item.id !== lead.id));
    }
  };

  // Selected Total Commission Calculation
  const selectedTotalCommission = selectedLeads.reduce(
    (sum, item) => sum + (Number(item.commissionAmount) || 0),
    0
  );

  // Submit Settlement Payout for selected leads
  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one lead to settle');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      const leadIds = selectedLeads.map((l) => l.id);
      await axios.post(
        baseUrl.settleLeads,
        {
          leadIds,
          paymentMethod: settleMethod,
          referenceId: settleRefId,
          paymentDate: settleDate,
          note: settleNote
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      toast.success(`Successfully settled ${selectedLeads.length} leads!`);
      setIsSettleModalOpen(false);
      setSelectedLeads([]);
      setSettleRefId('');
      setSettleNote('');
      setActiveTab('settled');
      fetchLeads();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to settle leads');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!leads.length) {
      toast.error('No data to export');
      return;
    }
    const exportData = leads.map((l) => ({
      'Customer Name': l.customerName,
      'Contact': l.customerContact,
      'Email': l.customerEmail,
      'Company': l.companyName,
      'Project': l.projectName,
      'Lead Amount (₹)': l.paymentAmount,
      'Commission Rate (%)': l.commissionRate,
      'Commission Earned (₹)': l.commissionAmount,
      'Payment Date': formatLeadDate(l.paymentDate),
      'Status': l.isSettled ? 'Settled' : 'Awaiting Settlement',
      'Settlement Date': formatLeadDate(l.settlementDate),
      'Settlement Mode': l.settlementMethod || '-',
      'Reference / UTR': l.settlementRef || '-'
    }));

    exportToExcel(
      exportData,
      `${reseller?.fullName || 'Reseller'}_${activeTab === 'settled' ? 'Settled_Leads' : 'Unsettled_Leads'}`
    );
  };

  if (!isMounted || !router.isReady) return null;

  const isAllCurrentPageSelected =
    leads.length > 0 && leads.every((l) => selectedLeads.some((item) => item.id === l.id));

  // Table Columns Definition
  const columns: Column<LeadSettlementItem>[] = [];

  // Checkbox column for Unsettled tab only
  if (activeTab === 'unsettled') {
    columns.push({
      key: 'id',
      label: 'SELECT',
      render: (_, row) => {
        const isChecked = selectedLeads.some((item) => item.id === row.id);
        return (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => handleToggleSelectLead(row, e.target.checked)}
            className="h-4 w-4 rounded-sm border-gray-300 text-[#3B82F6] focus:ring-[#3B82F6] cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
    });
  }

  columns.push(
    {
      key: 'customerName',
      label: 'CUSTOMER & COMPANY',
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{value}</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            {row.companyName && row.companyName !== '-' && (
              <span className="font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm">
                {row.companyName}
              </span>
            )}
            <span>{row.customerContact}</span>
          </div>
        </div>
      )
    },
    {
      key: 'projectName',
      label: 'PROJECT / PRODUCT',
      render: (value) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
          {value || '-'}
        </span>
      )
    },
    {
      key: 'paymentAmount',
      label: 'LEAD REVENUE',
      render: (value) => (
        <span className="font-semibold text-gray-900">
          ₹{(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'commissionAmount',
      label: 'COMMISSION PAYABLE',
      render: (value, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-emerald-700 text-sm">
            ₹{(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-gray-500">
            Rate: {row.commissionRate || reseller?.commissionRate || 0}%
          </span>
        </div>
      )
    },
    {
      key: 'paymentDate',
      label: 'PAYMENT DATE',
      render: (value) => (
        <span className="text-xs text-gray-700 font-medium">
          {formatLeadDate(value)}
        </span>
      )
    }
  );

  if (activeTab === 'settled') {
    columns.push(
      {
        key: 'settlementDate',
        label: 'SETTLED DATE & METHOD',
        render: (value, row) => (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {formatLeadDate(value)}
            </span>
            <span className="text-[11px] text-gray-500 mt-0.5">
              via {row.settlementMethod || 'Bank Transfer'}{' '}
              {row.settlementRef && row.settlementRef !== '-' && `(Ref: ${row.settlementRef})`}
            </span>
          </div>
        )
      }
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Head>
        <title>{reseller?.fullName || 'Reseller'} | Lead Settlements</title>
      </Head>

      {/* Standard App Header Toolbar */}
      <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 border border-gray-200 px-4 py-3 rounded-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/settlements')}
              className="p-2 bg-white hover:bg-gray-100 text-gray-700 rounded-md transition-colors border border-gray-200 cursor-pointer shadow-xs"
              title="Back to Resellers"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-900 bg-gray-50">
                <span className="text-xs font-bold text-gray-500">
                  {reseller?.fullName?.charAt(0)?.toUpperCase() || '?'}
                </span>
                {reseller?.profileImage && (
                  <img
                    src={
                      reseller.profileImage.includes('http')
                        ? reseller.profileImage
                        : `${baseUrl.getImageUrl}/images/ResellerProfileImages/${reseller.profileImage}`
                    }
                    alt={reseller.fullName}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  {reseller?.fullName || 'Reseller Details'}
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#3B82F6] border border-blue-200">
                    {reseller?.commissionRate || 0}% Comm.
                  </span>
                </h1>
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{reseller?.email}</span>
                  {reseller?.phone && <span>• {reseller.phone}</span>}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reseller?.upiId && (
              <div className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-xs font-medium flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                UPI: <span className="font-semibold">{reseller.upiId}</span>
              </div>
            )}
            {reseller?.bankDetails && (
              <div className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-medium flex items-center gap-1 max-w-xs truncate">
                <Building2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="truncate">{reseller.bankDetails}</span>
              </div>
            )}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Select Action Bar (Light CRM Theme Styled) */}
      {selectedLeads.length > 0 && (
        <div className="bg-blue-50/80 border border-blue-200 text-gray-900 px-4 py-3 rounded-md shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div>
            <span className="text-xs font-medium text-blue-700">Selected for Settlement:</span>
            <div className="text-sm font-bold text-gray-900 flex items-center gap-2 mt-0.5">
              <span>{selectedLeads.length} Lead(s) Selected</span>
              <span className="text-emerald-700 font-bold">
                (Payout: ₹{selectedTotalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedLeads([])}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setIsSettleModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#3B82F6] hover:bg-blue-600 text-xs font-semibold text-white shadow-xs transition-all cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              Process Settlement Payout
            </button>
          </div>
        </div>
      )}

      {/* Tabs & DataTable Container */}
      <div className="bg-white rounded-md border border-gray-200 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Standard Tab Navigation */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 pt-2.5 flex-shrink-0 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleTabChange('unsettled')}
              className={`pb-2.5 text-xs font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'unsettled'
                  ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Awaiting Settlement</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'unsettled'
                    ? 'bg-blue-100 text-[#3B82F6]'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {unsettledCount}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('settled')}
              className={`pb-2.5 text-xs font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'settled'
                  ? 'text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Settled Leads (Paid)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'settled'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {settledCount}
              </span>
            </button>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          data={leads}
          columns={columns}
          loading={isLoading}
          searchable={false}
          headerActions={
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {activeTab === 'unsettled' && leads.length > 0 && (
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer mr-2 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 rounded-sm border-gray-300 text-[#3B82F6] focus:ring-[#3B82F6] cursor-pointer"
                  />
                  <span>Select All on Page</span>
                </label>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search lead name, company, contact..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white pl-10 pr-4 py-2 text-xs text-gray-700 placeholder:text-gray-400 transition-all duration-200 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 hover:border-gray-300"
                />
              </div>
            </div>
          }
          pagination={true}
          serverSidePagination={true}
          currentPage={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={limit}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(r) => {
            setLimit(r);
            setPage(1);
          }}
        />
      </div>

      {/* Settle Selected Leads Modal (Consistent Dialog Theme) */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-gray-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#3B82F6] border border-blue-100">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Settle Selected Leads</h2>
                  <p className="text-xs text-gray-500">
                    Recording commission payout for {selectedLeads.length} leads
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Payout Summary */}
            <div className="mt-4 p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800">Total Payout Amount:</span>
                <p className="text-lg font-black text-emerald-900">
                  ₹{selectedTotalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right text-xs text-emerald-700 font-medium">
                <span>{selectedLeads.length} Leads</span>
              </div>
            </div>

            <form noValidate onSubmit={handleConfirmSettlement} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all cursor-pointer"
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
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Transaction / UTR Reference ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR89327498234"
                  value={settleRefId}
                  onChange={(e) => setSettleRefId(e.target.value)}
                  className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Note (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Commission cleared for closed won deals"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/20 transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="rounded-md border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="rounded-md bg-[#3B82F6] px-5 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingSettle ? 'Settling...' : 'Confirm & Mark Settled'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
