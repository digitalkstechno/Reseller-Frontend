import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Head from 'next/head';
import axios from 'axios';
import { toast } from 'react-toastify';
import { baseUrl, getAuthToken } from '@/config';
import DataTable, { Column } from '@/components/DataTable';
import Badge from '@/components/Badge';
import { exportToExcel } from '@/utills/exportHelper';
import FormSelect from '@/components/ui/FormSelect';
import DatePicker from '@/components/ui/DatePicker';
import { Filter, X, Search } from 'lucide-react';

// Define the transaction interface based on the SettlementTransaction model
interface SettlementTransaction {
  _id: string;
  reseller: { _id: string; fullName: string; email: string };
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceId: string;
  status: string;
  note: string;
  leads: any[];
  createdAt: string;
}

export default function LedgerPage() {
  const { role, user } = useSelector((state: any) => state.auth);
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedReseller, setSelectedReseller] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [showFilters, setShowFilters] = useState(false);
  const [tempSelectedMonth, setTempSelectedMonth] = useState('');
  const [tempSelectedYear, setTempSelectedYear] = useState(new Date().getFullYear().toString());
  const [tempSelectedReseller, setTempSelectedReseller] = useState('');
  const [tempSelectedMethod, setTempSelectedMethod] = useState('');
  const [tempSelectedDate, setTempSelectedDate] = useState('');

  useEffect(() => {
    if (showFilters) {
      setTempSelectedMonth(selectedMonth);
      setTempSelectedYear(selectedYear);
      setTempSelectedReseller(selectedReseller);
      setTempSelectedMethod(selectedMethod);
      setTempSelectedDate(selectedDate);
    }
  }, [showFilters, selectedMonth, selectedYear, selectedReseller, selectedMethod, selectedDate]);

  // Debounce search query to avoid too many requests
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchTransactions = async (page = currentPage) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) return;

      const roleName = role?.toLowerCase() || '';
      const userId = user?._id;

      const reqId = roleName === 'admin' ? 'all' : userId;
      
      const params: any = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;
      if (selectedReseller) params.reseller = selectedReseller;
      if (selectedMethod) params.method = selectedMethod;
      if (selectedDate) params.date = selectedDate;

      const res = await axios.get(`${baseUrl.getBaseUrl}settlement/history/${reqId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      const p = res.data.pagination || {};
      setTransactions(res.data.data || []);
      setCurrentPage(p.currentPage || 1);
      setTotalPages(p.totalPages || 1);
      setTotalRecords(p.totalRecords || res.data.data?.length || 0);
    } catch (error) {
      console.error("Error fetching ledger:", error);
      toast.error("Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);
  }, [selectedMonth, selectedYear, selectedReseller, selectedMethod, selectedDate, debouncedSearch, pageSize]);

  const handleExport = async () => {
    const exportData = transactions.map(tx => ({
      date: new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      reseller: tx.reseller?.fullName || '-',
      amount: tx.amount,
      method: tx.paymentMethod,
      referenceId: tx.referenceId || '-',
      status: tx.status,
      note: tx.note || '-',
      leadsSettled: tx.leads?.length || 0
    }));

    const columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Reseller', key: 'reseller', width: 25 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Reference ID', key: 'referenceId', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Note', key: 'note', width: 30 },
      { header: 'Leads Settled', key: 'leadsSettled', width: 15 },
    ];

    const fileName = `Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportToExcel(fileName, 'Ledger', columns, exportData);
  };

  const columns: Column<SettlementTransaction>[] = [
    {
      key: 'reseller',
      label: 'Reseller Name',
      render: (v) => v?.fullName || '-'
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (v) => <span className="font-bold text-emerald-600">₹{v?.toLocaleString('en-IN') || 0}</span>
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      render: (v) => {
        let colorClass = 'bg-gray-100 text-gray-500 border-gray-200';
        if (v === 'UPI') colorClass = 'bg-blue-50 text-blue-600 border-blue-200';
        else if (v === 'Cash') colorClass = 'bg-green-50 text-green-700 border-green-200';
        else if (v === 'Gpay' || v === 'GPay' || v === 'Google Pay') colorClass = 'bg-purple-50 text-purple-600 border-purple-200';
        else if (v === 'Bank Transfer') colorClass = 'bg-indigo-50 text-indigo-600 border-indigo-200';

        return (
          <Badge
            label={v || '-'}
            className={colorClass}
          />
        );
      }
    },
    // {
    //   key: 'referenceId',
    //   label: 'Ref ID',
    //   render: (v) => v || '-'
    // },
    {
      key: 'status',
      label: 'Status',
      render: (v) => {
        let colorClass = 'bg-yellow-50 text-yellow-600 border-yellow-200';
        if (v === 'Completed') colorClass = 'bg-green-50 text-green-700 border-green-200';
        else if (v === 'Failed') colorClass = 'bg-red-50 text-red-600 border-red-200';

        return (
          <Badge
            label={v}
            className={`${colorClass} font-bold`}
          />
        );
      }
    },
    {
      key: 'note',
      label: 'Note',
      render: (v) => v || '-'
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
  ];

  const uniqueResellers = Array.from(
    new Map(transactions.filter(t => t.reseller).map(t => [t.reseller._id, t.reseller])).values()
  );

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Head>
        <title>Ledger | Reseller Panel</title>
      </Head>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg">
        <DataTable
          data={transactions}
          columns={columns}
          loading={loading}
          onRefresh={() => fetchTransactions(currentPage)}
          onExport={handleExport}
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
                      <h3 className="font-semibold text-gray-800 text-sm">Filter Ledger</h3>
                      <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Month & Year</label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <FormSelect
                              value={tempSelectedMonth}
                              onChange={setTempSelectedMonth}
                              options={[
                                { value: "", label: "All Months" },
                                { value: "1", label: "January" },
                                { value: "2", label: "February" },
                                { value: "3", label: "March" },
                                { value: "4", label: "April" },
                                { value: "5", label: "May" },
                                { value: "6", label: "June" },
                                { value: "7", label: "July" },
                                { value: "8", label: "August" },
                                { value: "9", label: "September" },
                                { value: "10", label: "October" },
                                { value: "11", label: "November" },
                                { value: "12", label: "December" },
                              ]}
                              placeholder="All Months"
                            />
                          </div>
                          <div className="flex-1">
                            <FormSelect
                              value={tempSelectedYear}
                              onChange={setTempSelectedYear}
                              options={[
                                { value: "2024", label: "2024" },
                                { value: "2025", label: "2025" },
                                { value: "2026", label: "2026" },
                              ]}
                              placeholder="Year"
                            />
                          </div>
                        </div>
                      </div>

                      {role?.toLowerCase() === 'admin' && (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reseller</label>
                          <FormSelect
                            value={tempSelectedReseller}
                            onChange={setTempSelectedReseller}
                            options={[
                              { value: "", label: "All Resellers" },
                              ...uniqueResellers.map((r: any) => ({ value: r._id, label: r.fullName }))
                            ]}
                            placeholder="All Resellers"
                          />
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</label>
                        <FormSelect
                          value={tempSelectedMethod}
                          onChange={setTempSelectedMethod}
                          options={[
                            { value: "", label: "All Methods" },
                            { value: "Bank Transfer", label: "Bank Transfer" },
                            { value: "UPI", label: "UPI" },
                            { value: "Cash", label: "Cash" },
                          ]}
                          placeholder="All Methods"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Specific Date</label>
                        <DatePicker
                          value={tempSelectedDate}
                          onChange={setTempSelectedDate}
                          placeholder="Select date"
                        />
                      </div>

                    </div>
                    <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                      <button 
                        onClick={() => { 
                          setTempSelectedMonth('');
                          setTempSelectedYear(new Date().getFullYear().toString());
                          setTempSelectedReseller('');
                          setTempSelectedMethod('');
                          setTempSelectedDate('');
                          setSelectedMonth('');
                          setSelectedYear(new Date().getFullYear().toString());
                          setSelectedReseller('');
                          setSelectedMethod('');
                          setSelectedDate('');
                          setShowFilters(false);
                        }}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedMonth(tempSelectedMonth);
                          setSelectedYear(tempSelectedYear);
                          setSelectedReseller(tempSelectedReseller);
                          setSelectedMethod(tempSelectedMethod);
                          setSelectedDate(tempSelectedDate);
                          setShowFilters(false);
                        }}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#00b5ad] border border-[#00b5ad] rounded-md hover:bg-[#009b94] transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
          title="Transactions"
          
          pagination={true}
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          onPageChange={(page) => fetchTransactions(page)}
        />
      </div>
    </div>
  );
}
