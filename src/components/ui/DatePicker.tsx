'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  className?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(s: string): string {
  const d = parseYMD(s);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  error = false,
  className = '',
  disabled = false,
}: DatePickerProps) {
  const today = new Date();
  const selected = parseYMD(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [dropdownPosition, setDropdownPosition] = useState<'below' | 'above'>('below');
  const [coords, setCoords] = useState({ left: 0, top: 0, bottom: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const isAbove = spaceBelow < 340;
    
    setDropdownPosition(isAbove ? 'above' : 'below');
    
    // Prevent overlapping the right edge of the screen
    const popupWidth = 288; // w-72 = 288px
    const maxLeft = window.innerWidth - popupWidth - 16; // 16px safe margin
    
    setCoords({
      left: Math.min(rect.left, maxLeft),
      top: rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
    });
  }, []);

  // Update position on open, scroll, and resize
  useEffect(() => {
    if (!open) return;
    updatePosition();
    
    const handleScroll = () => updatePosition();
    
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popupRef.current && !popupRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync view when value changes externally
  useEffect(() => {
    const d = parseYMD(value);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const selectDate = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(toYMD(d));
    setOpen(false);
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(toYMD(today));
    setOpen(false);
  };

  // Build calendar grid
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const prevMonthDays = daysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  const cells: { day: number; current: boolean }[] = [];
  // Previous month trailing days
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false });
  }
  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, current: true });
  }
  // Next month leading days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false });
  }

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const isSelected = (day: number) =>
    selected != null &&
    day === selected.getDate() &&
    viewMonth === selected.getMonth() &&
    viewYear === selected.getFullYear();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) updatePosition();
          setOpen((o) => !o);
        }}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm text-left transition-all
          ${error ? 'border-red-500' : open ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-white hover:border-gray-400 cursor-pointer'}
        `}
      >
        <span className={`truncate whitespace-nowrap ${value ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Dropdown Portal */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          data-datepicker-popup="true"
          className={`fixed z-[999999] w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-3 animate-in fade-in zoom-in-95 duration-150`}
          style={{
            left: coords.left,
            ...(dropdownPosition === 'below' ? { top: coords.top } : { bottom: coords.bottom })
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const current = cell.current;
              const sel = current && isSelected(cell.day);
              const tod = current && isToday(cell.day);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!current}
                  onClick={() => current && selectDate(cell.day)}
                  className={`h-8 w-full text-[13px] rounded-lg transition-all
                    ${!current ? 'text-gray-300 cursor-default' : 'cursor-pointer hover:bg-blue-50'}
                    ${sel ? 'bg-blue-500 text-white font-semibold hover:bg-blue-600' : ''}
                    ${tod && !sel ? 'text-blue-600 font-bold ring-1 ring-blue-300' : ''}
                    ${current && !sel && !tod ? 'text-gray-700' : ''}
                  `}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={goToToday}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
