'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { User, Check, X, Hourglass } from 'lucide-react';

interface WinRateData {
  name: string;
  fullName: string;
  won: number;
  lost: number;
  inProgress: number;
}

interface ResellerWinRateChartProps {
  data?: WinRateData[];
  timeFilter?: string;
  onFilterChange?: (filter: string) => void;
  onCustomDateChange?: (from: string, to: string) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const totalAssigned = data.won + data.lost + data.inProgress;
    const winRate = totalAssigned > 0 ? ((data.won / totalAssigned) * 100).toFixed(1) : '0.0';

    return (
      <div className="bg-white text-gray-900 p-4 rounded-xl shadow-xl w-64 border border-gray-200 z-50">
        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
          <User className="text-purple-600" size={18} />
          <span className="font-bold uppercase tracking-wide text-sm text-gray-900">{data.fullName || data.name}</span>
        </div>
        
        <div className="space-y-3 text-sm font-medium">
          <div className="flex justify-between items-center text-gray-500">
            <span>Total Assigned</span>
            <span className="text-gray-900 text-base font-bold">{totalAssigned}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-2 text-emerald-500">
              <Check size={16} strokeWidth={3} /> Won
            </span>
            <span className="text-emerald-500 text-base font-bold">{data.won}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-2 text-red-500">
              <X size={16} strokeWidth={3} /> Lost
            </span>
            <span className="text-red-500 text-base font-bold">{data.lost}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-2 text-amber-500">
              <Hourglass size={16} strokeWidth={2.5} /> In Progress
            </span>
            <span className="text-amber-500 text-base font-bold">{data.inProgress}</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-baseline justify-center gap-2">
          <span className="text-red-500 text-3xl font-bold">{winRate}%</span>
          <span className="text-gray-500 text-sm font-medium">Win Rate</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function ResellerWinRateChart({ 
  data = [], 
  timeFilter = 'All', 
  onFilterChange,
  onCustomDateChange
}: ResellerWinRateChartProps) {
  const totalLeads = data.reduce((acc, curr) => acc + curr.won + curr.lost + curr.inProgress, 0);

  const filters = ['All', 'Week', 'Month', 'Year'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const handleMonthYearChange = (month: string, year: string) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    if (onCustomDateChange) {
      let startDate, endDate;
      if (month === '') {
        // All months for the selected year
        startDate = new Date(parseInt(year), 0, 1);
        endDate = new Date(parseInt(year), 11, 31);
      } else {
        startDate = new Date(parseInt(year), parseInt(month), 1);
        endDate = new Date(parseInt(year), parseInt(month) + 1, 0);
      }
      
      const format = (d: Date) => {
        const _d = new Date(d);
        _d.setMinutes(_d.getMinutes() - _d.getTimezoneOffset());
        return _d.toISOString().split("T")[0];
      };
      onCustomDateChange(format(startDate), format(endDate));
      if (onFilterChange) onFilterChange('Custom');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Reseller — Win Rate</h2>
          <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold">
            {totalLeads} Total Leads
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm items-center gap-1">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthYearChange(e.target.value, selectedYear)}
              className="px-2 py-1.5 rounded-md text-sm font-semibold border-none focus:ring-0 outline-none bg-transparent cursor-pointer text-gray-600 hover:text-gray-900"
            >
              <option value="">All Months</option>
              {months.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => handleMonthYearChange(selectedMonth, e.target.value)}
              className="px-2 py-1.5 rounded-md text-sm font-semibold border-none focus:ring-0 outline-none bg-transparent cursor-pointer text-gray-600 hover:text-gray-900"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setSelectedMonth(''); // reset custom dropdowns
                  if (onFilterChange) onFilterChange(filter);
                }}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                  timeFilter === filter
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 20, left: -20, bottom: 20 }}
            barSize={48}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 14, fontWeight: 600 }}
              dy={15}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 13 }}
              dx={-10}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ fill: '#f8fafc', opacity: 0.5 }} 
              isAnimationActive={false}
            />
            
            <Legend 
              iconType="square"
              iconSize={14}
              wrapperStyle={{ paddingTop: '30px' }}
              formatter={(value) => (
                <span className="text-gray-700 font-bold ml-1.5 mr-6 text-sm">{value}</span>
              )}
            />
            
            {/* Using project theme colors: emerald-500, red-500, amber-500 */}
            <Bar dataKey="won" name="Won" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
            <Bar dataKey="lost" name="Lost" stackId="a" fill="#EF4444" />
            <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
