import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import DatePicker from '@/components/ui/DatePicker';
import { Download, RefreshCw, Filter, IndianRupee, Search, MoreVertical, X, FileText, File } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToExcel } from '@/utills/exportHelper';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { FormSelect } from '@/components/ui/FormSelect';

interface ReportLead {
  _id: string;
  customerName: string;
  customerEmail: string;
  product: string;
  paymentAmount: number;
  commissionAmount: number;
  createdAt: string;
  leadStatus: { name: string; _id: string };
  assignedTo: { fullName: string; _id: string };
}

export default function LeadsReport() {
  const router = useRouter();
  const { user, role } = useSelector((state: any) => state.auth);
  const [data, setData] = useState<ReportLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Temporary state for the filter popover
  const [tempFromDate, setTempFromDate] = useState('');
  const [tempToDate, setTempToDate] = useState('');
  const [tempPaymentStatus, setTempPaymentStatus] = useState('');

  // Sync temp state when opening popover
  useEffect(() => {
    if (showFilters) {
      setTempFromDate(fromDate);
      setTempToDate(toDate);
      setTempPaymentStatus(paymentStatus);
    }
  }, [showFilters, fromDate, toDate, paymentStatus]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const params: any = { limit, page, report: 'true', onlyWon: 'true' };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (debouncedSearch) params.search = debouncedSearch;

      const userRole = role?.toLowerCase() || user?.role?.roleName?.toLowerCase() || '';
      const url = userRole === 'admin' ? baseUrl.getAllLeads : baseUrl.myLeads;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setData(res.data?.data || []);
      setTotalRecords(res.data?.count || res.data?.data?.length || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch leads report:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, paymentStatus, user, role, page, limit, debouncedSearch]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const handleExport = async () => {
    const exportData = data.map(item => ({
      date: new Date(item.createdAt).toLocaleDateString('en-IN'),
      customerName: item.customerName || '-',
      email: item.customerEmail || '-',
      product: item.product || '-',
      status: item.leadStatus?.name || '-',
      reseller: item.assignedTo?.fullName || '-',
      amount: item.paymentAmount || 0,
      commission: item.commissionAmount || 0,
    }));

    const columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Product', key: 'product', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Reseller', key: 'reseller', width: 25 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Commission', key: 'commission', width: 15 },
    ];

    const fileName = `Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportToExcel(fileName, 'Leads', columns, exportData);
  };

  const columns: Column<ReportLead>[] = [

    {
      key: 'customerName',
      label: 'CUSTOMER',
      render: (value, row) => (
        <div>
          <div className="font-semibold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.customerEmail}</div>
        </div>
      ),
    },
    {
      key: 'assignedTo',
      label: 'RESELLER',
      render: (value) => <span className="font-medium text-gray-700">{value?.fullName || '-'}</span>,
    },
    {
      key: 'paymentAmount',
      label: 'AMOUNT',
      render: (value) => (
        <div className="flex items-center gap-1 font-semibold text-emerald-700">
          <IndianRupee className="h-3 w-3" />
          <span>{value.toLocaleString('en-IN')}</span>
        </div>
      ),
    },
    {
      key: 'paymentStatus',
      label: 'PAYMENT STATUS',
      render: (value) => (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${value === 'Paid' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-500/10'}`}>
          {value || 'Unpaid'}
        </span>
      ),
    },
    {
      key: 'commissionAmount',
      label: 'COMMISSION',
      render: (value) => (
        <div className="flex items-center gap-1 font-semibold text-blue-700">
          <IndianRupee className="h-3 w-3" />
          <span>{value.toLocaleString('en-IN')}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'DATE',
      render: (value) => new Date(value).toLocaleDateString('en-IN'),
    },
  ];

  const filteredData = data;

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Head>
        <title>Leads Report | Reseller Panel</title>
      </Head>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg">
          <DataTable
            data={filteredData}
            columns={columns}
            loading={isLoading}
            searchable={false}
            headerActions={
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 rounded-md border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 transition-all duration-200 focus:border-[#00b5ad] focus:outline-none focus:ring-1 focus:ring-[#00b5ad]/20 hover:border-gray-300"
                  />
                </div>

                {/* Filter Popover */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-md border transition-all ${showFilters ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    <Filter className="h-4 w-4" />
                  </button>
                  {showFilters && (
                    <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
                      <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-semibold text-gray-800 text-sm">Filter Reports</h3>
                        <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="p-4 flex flex-col gap-6">
                        {/* Date Range */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <DatePicker value={tempFromDate} onChange={setTempFromDate} placeholder="Start Date" />
                            </div>
                            <span className="text-gray-300 font-medium">-</span>
                            <div className="flex-1">
                              <DatePicker value={tempToDate} onChange={setTempToDate} placeholder="End Date" />
                            </div>
                          </div>
                        </div>

                        {/* Payment Status */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Status</label>
                          <FormSelect
                            value={tempPaymentStatus}
                            onChange={setTempPaymentStatus}
                            options={[
                              { value: '', label: 'All Payments' },
                              { value: 'Paid', label: 'Paid' },
                              { value: 'Unpaid', label: 'Unpaid' },
                            ]}
                          />
                        </div>
                      </div>
                      <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                        <button 
                          onClick={() => { 
                            setTempFromDate(''); 
                            setTempToDate(''); 
                            setTempPaymentStatus(''); 
                            setFromDate('');
                            setToDate('');
                            setPaymentStatus('');
                            setShowFilters(false);
                          }}
                          className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Clear All
                        </button>
                        <button 
                          onClick={() => {
                            setFromDate(tempFromDate);
                            setToDate(tempToDate);
                            setPaymentStatus(tempPaymentStatus);
                            setShowFilters(false);
                          }}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Export Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-md border transition-all ${showExportMenu ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1 overflow-hidden">
                      <button
                        onClick={() => { handleExport(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-emerald-600" /> Export to Excel
                      </button>
                      <button
                        onClick={() => { 
                          setShowExportMenu(false);
                          setTimeout(() => window.print(), 100);
                        }}
                        disabled={true}
                        title="Coming soon"
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <File className="h-4 w-4 text-red-600" /> Export to PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            }
            serverSidePagination={true}
            currentPage={page}
            pageSize={limit}
            totalRecords={totalRecords}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setLimit(newSize);
              setPage(1);
            }}
          />
      </div>
    </div>
  );
}
