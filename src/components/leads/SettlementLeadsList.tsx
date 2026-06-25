'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { FiSearch, FiCalendar } from 'react-icons/fi';
import { IndianRupee } from 'lucide-react';
import { toast } from 'react-toastify';

interface SettlementLeadsListProps {
  resellerId: string;
}

export default function SettlementLeadsList({ resellerId }: SettlementLeadsListProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [totalRecords, setTotalRecords] = useState(0);

  const [selectedLeads, setSelectedLeads] = useState<any[]>([]);
  const [settling, setSettling] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLTableRowElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(leads);
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (lead: any, checked: boolean) => {
    if (checked) {
      setSelectedLeads((prev) => [...prev, lead]);
    } else {
      setSelectedLeads((prev) => prev.filter((l) => l.id !== lead.id));
    }
  };

  const handleSettleLeads = async () => {
    if (selectedLeads.length === 0) return;
    setSettling(true);
    try {
      const leadIds = selectedLeads.map(l => l.id);
      await axios.post(
        baseUrl.settleLeads,
        { leadIds },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      toast.success('Leads settled successfully!');
      setSelectedLeads([]);
      setPage(1);
      fetchLeads(1, search, month, year, true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to settle leads');
    } finally {
      setSettling(false);
    }
  };

  const totalSettlementAmount = selectedLeads.reduce((sum, lead) => {
    return sum + (Number(lead.commissionAmount) || 0);
  }, 0);

  const fetchLeads = async (currentPage: number, currentSearch: string, currentMonth: string, currentYear: string, reset: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      let queryUrl = `${baseUrl.resellerLeadSettlements}?resellerId=${resellerId}&page=${currentPage}&limit=10`;
      if (currentSearch) queryUrl += `&search=${encodeURIComponent(currentSearch)}`;
      if (currentMonth) {
        queryUrl += `&month=${currentMonth}`;
        if (currentYear) queryUrl += `&year=${currentYear}`;
      }

      const res = await axios.get(queryUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const { data, totalPages, totalRecords: total } = res.data.data;

      setLeads((prev) => reset ? data : [...prev, ...data]);
      setHasMore(currentPage < totalPages);
      setTotalRecords(total);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset and fetch when filters change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchLeads(1, search, month, year, true);
  }, [search, month, year]);

  // Fetch more when page changes
  useEffect(() => {
    if (page > 1) {
      fetchLeads(page, search, month, year, false);
    }
  }, [page]);

  // Handle Search Input (Debounced)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSearch(val);
    }, 500);
  };

  // Infinite Scroll Observer setup
  useEffect(() => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage((prevPage) => prevPage + 1);
      }
    }, { threshold: 1.0 });

    if (lastElementRef.current) {
      observerRef.current.observe(lastElementRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loading, hasMore]);

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

  return (
    <div className="bg-white p-6 w-full rounded-b-lg border-t border-gray-100 shadow-inner">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Paid Leads ({totalRecords})</h3>
          <p className="text-sm text-gray-500">Leads that have been paid and are awaiting settlement</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              onChange={handleSearchChange}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm transition-shadow"
            />
          </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <div className="relative w-full sm:w-auto">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full sm:w-auto pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm appearance-none bg-white transition-shadow cursor-pointer"
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
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm appearance-none bg-white transition-shadow cursor-pointer"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {selectedLeads.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="text-blue-800 font-semibold text-sm">
              {selectedLeads.length} Lead{selectedLeads.length > 1 ? 's' : ''} Selected
            </h3>
            <p className="text-blue-600 text-xs mt-1">
              Total Commission: <span className="font-bold text-sm">₹{totalSettlementAmount.toLocaleString('en-IN')}</span>
            </p>
          </div>
          <button
            onClick={handleSettleLeads}
            disabled={settling}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {settling ? 'Processing...' : 'Settle Leads'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-[400px] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 relative">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-left w-12">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  onChange={handleSelectAll}
                  checked={leads.length > 0 && selectedLeads.length === leads.length}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead Details</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Mode</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Amount</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No paid leads found matching your criteria.
                </td>
              </tr>
            )}
            {leads.map((lead, index) => {
              const isLast = index === leads.length - 1;
              const isSelected = selectedLeads.some((l) => l.id === lead.id);
              return (
                <tr key={lead.id || index} ref={isLast ? lastElementRef : null} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                      checked={isSelected}
                      onChange={(e) => handleSelectLead(lead, e.target.checked)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{lead.customerName}</div>
                    {lead.paymentDate && (
                      <div className="text-xs text-gray-500 mt-1">Paid on: {new Date(lead.paymentDate).toLocaleDateString()}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.paymentMode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-emerald-600">
                    ₹{lead.paymentAmount?.toLocaleString('en-IN') || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    ₹{lead.commissionAmount?.toLocaleString('en-IN') || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && (
          <div className="flex justify-center py-4 bg-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          </div>
        )}
      </div>
    </div>
  );
}
