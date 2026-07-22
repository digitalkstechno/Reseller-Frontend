import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { FiSearch, FiCalendar } from 'react-icons/fi';
import { formatIndianCurrency } from '@/utills/formatters';
import DataTable, { Column } from '@/components/DataTable';

interface SettlementLeadsListProps {
  resellerId: string;
  onSuccess?: () => void;
  selectedLeads: any[];
  onSelectionChange: (selected: any[]) => void;
  activeTab: 'unsettled' | 'settled';
  setActiveTab: (tab: 'unsettled' | 'settled') => void;
}

export default function SettlementLeadsList({
  resellerId,
  onSuccess,
  selectedLeads,
  onSelectionChange,
  activeTab,
  setActiveTab
}: SettlementLeadsListProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [unsettledCount, setUnsettledCount] = useState(0);
  const [settledCount, setSettledCount] = useState(0);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSelections = [...selectedLeads];
      leads.forEach(lead => {
        if (!newSelections.some(l => l.id === lead.id)) {
          newSelections.push(lead);
        }
      });
      onSelectionChange(newSelections);
    } else {
      const leadIds = leads.map(l => l.id);
      onSelectionChange(selectedLeads.filter(l => !leadIds.includes(l.id)));
    }
  };

  const handleSelectLead = (lead: any, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedLeads, lead]);
    } else {
      onSelectionChange(selectedLeads.filter((l) => l.id !== lead.id));
    }
  };

  const totalSettlementAmount = selectedLeads.filter(l => leads.some(lead => lead.id === l.id)).reduce((sum, lead) => {
    return sum + (Number(lead.commissionAmount) || 0);
  }, 0);

  const fetchLeads = async (currentPage: number, currentSearch: string, currentMonth: string, currentYear: string, currentTab: 'unsettled' | 'settled') => {
    if (loading) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      let queryUrl = `${baseUrl.resellerLeadSettlements}?resellerId=${resellerId}&page=${currentPage}&limit=10&settled=${currentTab === 'settled'}`;
      if (currentSearch) queryUrl += `&search=${encodeURIComponent(currentSearch)}`;
      if (currentMonth) {
        queryUrl += `&month=${currentMonth}`;
        if (currentYear) queryUrl += `&year=${currentYear}`;
      }

      const res = await axios.get(queryUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const { data, totalPages: tPages, totalRecords: total, unsettledCount: uCount, settledCount: sCount } = res.data.data;

      setLeads(data);
      setTotalPages(tPages || 1);
      setTotalRecords(total);
      if (uCount !== undefined) setUnsettledCount(uCount);
      if (sCount !== undefined) setSettledCount(sCount);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchLeads(1, search, month, year, activeTab);
  }, [search, month, year, activeTab]);

  useEffect(() => {
    if (page > 1) {
      fetchLeads(page, search, month, year, activeTab);
    }
  }, [page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSearch(val);
    }, 500);
  };

  const months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString()];

  const columns: Column<any>[] = [];
  
  if (activeTab === 'unsettled') {
    columns.push({
      key: 'select',
      label: 'Select',
      render: (val, lead) => (
        <div className="flex justify-start items-center">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            checked={selectedLeads.some((l) => l.id === lead.id)}
            onChange={(e) => handleSelectLead(lead, e.target.checked)}
          />
        </div>
      )
    });
  }

  columns.push(
    {
      key: 'details',
      label: 'Lead Details',
      render: (val, lead) => (
        <div>
          <div className="font-semibold text-gray-900">{lead.customerName}</div>
          {lead.paymentDate && (
            <div className="text-xs text-gray-500 mt-1 font-medium">Paid on: {new Date(lead.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, lead) => (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
          {lead.status}
        </span>
      )
    },
    {
      key: 'paymentMode',
      label: 'Payment Mode',
      render: (val, lead) => <div className="text-gray-600 font-medium">{lead.paymentMode}</div>
    },
    {
      key: 'paymentAmount',
      label: 'Payment Amount',
      render: (val, lead) => <div className="font-bold text-emerald-600">{formatIndianCurrency(lead.paymentAmount || 0)}</div>
    },
    {
      key: 'commission',
      label: 'Commission',
      render: (val, lead) => <div className="font-extrabold text-gray-900">{formatIndianCurrency(lead.commissionAmount || 0)}</div>
    }
  );

  return (
    <div className="bg-white w-full rounded-b-lg flex flex-col h-full flex-1 min-h-0">
      <div className="p-6 pb-2">
        {/* Tabs navigation */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => {
              onSelectionChange([]);
              setActiveTab('unsettled');
            }}
            className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-all duration-200 cursor-pointer ${
              activeTab === 'unsettled'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Awaiting Settlement ({unsettledCount})
          </button>
          <button
            onClick={() => {
              onSelectionChange([]);
              setActiveTab('settled');
            }}
            className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-all duration-200 cursor-pointer ${
              activeTab === 'settled'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settled Leads ({settledCount})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          {/* Left side: Select All on Page (only for unsettled tab) with left padding to align with table checkboxes */}
          <div className="flex items-center gap-3 pl-6">
            {activeTab === 'unsettled' && (
              <>
                <input
                  type="checkbox"
                  id="selectAll"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  onChange={handleSelectAll}
                  checked={leads.length > 0 && leads.every(lead => selectedLeads.some(l => l.id === lead.id))}
                />
                <label htmlFor="selectAll" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Select All on Page
                </label>
              </>
            )}
          </div>

          {/* Right side: Search and Calendar filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                onChange={handleSearchChange}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm transition-shadow"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <div className="relative w-full sm:w-auto">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm appearance-none bg-white transition-shadow cursor-pointer"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              {month && (
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm appearance-none bg-white transition-shadow cursor-pointer"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {selectedLeads.filter(l => leads.some(lead => lead.id === l.id)).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-blue-800 font-semibold text-sm">
                {selectedLeads.filter(l => leads.some(lead => lead.id === l.id)).length} Lead{selectedLeads.filter(l => leads.some(lead => lead.id === l.id)).length > 1 ? 's' : ''} Selected
              </h3>
              <p className="text-blue-600 text-xs mt-1">
                Total Commission: <span className="font-bold text-sm">{formatIndianCurrency(totalSettlementAmount)}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-6 min-h-0 flex flex-col">
        <DataTable
          data={leads}
          columns={columns}
          loading={loading}
          pagination={true}
          serverSidePagination={true}
          currentPage={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={10}
          onPageChange={setPage}
          title=""
          searchable={false}
        />
      </div>
    </div>
  );
}
