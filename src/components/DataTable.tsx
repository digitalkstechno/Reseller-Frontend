'use client';

import React, { useRef } from 'react';
import { useEffect, useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit,
  FiTrash2,
  FiEye,
  FiSearch,
  FiFilter,
  FiDownload,
  FiMoreVertical,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiCheck
} from 'react-icons/fi';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchQuery?: string;
  searchPlaceholder?: string;
  pagination?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalRecords?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearch?: (value: string) => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onRowClick?: (row: T) => void;
  canEdit?: (row: T) => boolean;
  canDelete?: (row: T) => boolean;
  loading?: boolean;
  actions?: boolean;
  serverSidePagination?: boolean;
  title?: string;
  subtitle?: string;
  striped?: boolean;
  addButton?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  onRefresh?: () => void;
  onExport?: () => void;
  extraActions?: ActionItem<T>[];
  headerActions?: React.ReactNode;
  leftActions?: React.ReactNode;
  expandableContent?: (row: T) => React.ReactNode;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (selectedRows: T[]) => void;
  isRowSelectable?: (row: T) => boolean;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchQuery = '',
  searchPlaceholder = 'Search anything...',
  pagination = true,
  currentPage = 1,
  totalPages = 1,
  totalRecords = data.length,
  pageSize = 10,
  onPageChange = () => { },
  onPageSizeChange = () => { },
  onSearch = () => { },
  onView,
  onEdit,
  onDelete,
  onRowClick,
  canEdit,
  canDelete,
  loading = false,
  actions = true,
  serverSidePagination = false,
  title,
  subtitle,
  striped = true,
  addButton,
  onRefresh,
  onExport,
  extraActions,
  headerActions,
  leftActions,
  expandableContent,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  isRowSelectable = () => true,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = useState(currentPage);
  const [internalPageSize, setInternalPageSize] = useState(pageSize);

  useEffect(() => {
    setInternalPage(currentPage);
  }, [currentPage]);

  useEffect(() => {
    setInternalPageSize(pageSize);
  }, [pageSize]);

  const [searchValue, setSearchValue] = useState(searchQuery);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  const [showFilters, setShowFilters] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target as Node)) {
        setPageSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleRow = (index: number) => {
    setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const renderCell = (column: Column<T>, row: T) => {
    const value = row[column.key as string];
    return column.render ? column.render(value, row) : value ?? '-';
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch(value);
  };

  const actualTotalPages = serverSidePagination 
    ? (totalPages || Math.max(1, Math.ceil((totalRecords || 0) / internalPageSize))) 
    : Math.max(1, Math.ceil(data.length / internalPageSize));

  const handlePageChange = (newPage: number) => {
    setInternalPage(newPage);
    onPageChange(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setInternalPageSize(newSize);
    setInternalPage(1); // Reset to page 1 on size change
    onPageSizeChange(newSize);
  };

  // Calculate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (actualTotalPages <= maxVisible) {
      for (let i = 1; i <= actualTotalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, internalPage - 1);
      let end = Math.min(actualTotalPages - 1, internalPage + 1);

      if (internalPage <= 3) {
        end = Math.min(actualTotalPages - 1, 4);
      }

      if (internalPage >= actualTotalPages - 2) {
        start = Math.max(2, actualTotalPages - 3);
      }

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < actualTotalPages - 1) {
        pages.push('...');
      }

      if (actualTotalPages > 1) {
        pages.push(actualTotalPages);
      }
    }

    return pages;
  };

  useEffect(() => {
    if (!pagination) return;
    if (internalPage > 1 && data.length === 0 && totalRecords > 0) {
      handlePageChange(1);
    }
  }, [pagination, internalPage, data.length, totalRecords]);

  // Compute sliced data
  const currentData = (pagination && !serverSidePagination) ? data.slice((internalPage - 1) * internalPageSize, internalPage * internalPageSize) : data;

  return (
    <div className="rounded-md bg-white border border-gray-200 transition-all duration-300 hover:shadow-2xl flex flex-col h-full flex-1 min-h-0">
      {/* Header - only render when there's something to show */}
      {(title || subtitle || leftActions || headerActions || searchable || onRefresh || addButton) && (
      <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-200 px-3 py-3 rounded-t-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div>
              {title && (
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
            {leftActions && (
              <div className="flex flex-wrap items-center gap-3">
                {leftActions}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {headerActions}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="group relative inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2"
              >
                <FiRefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180 duration-500" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {/* {onExport && (
              <button
                onClick={onExport}
                className="group relative inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2"
              >
                <FiDownload className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )} */}

            {searchable && (
              <div className="relative w-full sm:w-auto">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                <input
                  type="search"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full sm:w-80 rounded-md border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 transition-all duration-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 hover:border-gray-300"
                />
              </div>
            )}

            {/* <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2"
            >
              <FiFilter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button> */}

            {addButton && (
              <button
                onClick={addButton.onClick}
                className="inline-flex items-center gap-2 rounded-md bg-[#3B82F6] px-6 py-1 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
              >
                {addButton.icon || <span className="text-lg">+</span>}
                {addButton.label}
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Table - Modern Design */}
      <div className="border-t border-gray-100 overflow-x-auto flex-1 overflow-y-auto custom-scrollbar">
        <table className="min-w-full divide-y divide-gray-100 relative">
          <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
            <tr>
              {selectable && (
                <th className="px-6 py-4 text-left w-12">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={(e) => {
                      if (onSelectionChange) {
                        const allSelectableRows = currentData.filter(isRowSelectable);
                        if (e.target.checked) {
                          onSelectionChange(allSelectableRows);
                        } else {
                          onSelectionChange([]);
                        }
                      }
                    }}
                    checked={currentData.length > 0 && selectedRows.length === currentData.filter(isRowSelectable).length}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
              {actions && (onView || onEdit || onDelete || extraActions || expandableContent) && (
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-200 border-r-blue-600"></div>
                    <p className="text-sm font-medium text-gray-600">Loading your data...</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="rounded-full bg-gray-50 p-4">
                      <FiSearch className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">No records found</p>
                    <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                    {addButton && (
                      <button
                        onClick={addButton.onClick}
                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        + Add your first record
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              currentData.map((row, index) => (
                <React.Fragment key={index}>
                  <tr
                    onClick={() => onRowClick && onRowClick(row)}
                    onMouseEnter={() => setHoveredRow(index)}
                    onMouseLeave={() => setHoveredRow(null)}
                    className={`
                      transition-all duration-200
                      ${striped && index % 2 === 1 ? 'bg-blue-50/50' : 'bg-white'}
                      ${hoveredRow === index ? 'bg-blue-50/30' : ''}
                      ${!expandedRows[index] ? 'border-b border-gray-50 last:border-0' : 'border-b-0'}
                      ${selectedRows.includes(row) ? 'bg-blue-50/50' : ''}
                      ${onRowClick ? 'cursor-pointer' : ''}
                    `}
                  >
                    {selectable && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!isRowSelectable(row)}
                          checked={selectedRows.includes(row)}
                          onChange={(e) => {
                            if (onSelectionChange) {
                              if (e.target.checked) {
                                onSelectionChange([...selectedRows, row]);
                              } else {
                                onSelectionChange(selectedRows.filter(r => r !== row));
                              }
                            }
                          }}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={`px-6 py-3.5 text-sm text-gray-700 whitespace-nowrap ${column.className || ''}`}
                      >
                        {renderCell(column, row)}
                      </td>
                    ))}

                    {actions && (onView || onEdit || onDelete || extraActions || expandableContent) && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">

                          {/* VIEW */}
                          {onView && (
                            <button
                              onClick={() => onView(row)}
                              className="group h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-all duration-200 hover:bg-[#3B82F6] hover:text-white hover:shadow-md focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 active:scale-95"
                            >
                              <FiEye className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </button>
                          )}

                          {/* EDIT */}
                          {onEdit && (!canEdit || canEdit(row)) && (
                            <button
                              onClick={() => onEdit(row)}
                              className="group h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 text-green-600 transition-all duration-200 hover:bg-green-600 hover:text-white hover:shadow-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:ring-offset-2 active:scale-95"
                            >
                              <FiEdit className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </button>
                          )}

                          {/* DELETE */}
                          {onDelete && (!canDelete || canDelete(row)) && (
                            <button
                              onClick={() => onDelete(row)}
                              className="group h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 text-red-600 transition-all duration-200 hover:bg-red-500 hover:text-white hover:shadow-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-offset-2 active:scale-95"
                            >
                              <FiTrash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            </button>
                          )}

                          {/* EXTRA ACTIONS */}
                          {extraActions?.map((act, idx) => {
                            const evaluatedLabel = typeof act.label === 'function' ? act.label(row) : act.label;
                            const evaluatedIcon = typeof act.icon === 'function' ? act.icon(row) : act.icon;
                            const evaluatedColor = typeof act.color === 'function' ? act.color(row) : act.color;

                            const colors: Record<string, string> = {
                              blue: 'text-blue-600 hover:bg-blue-600 hover:text-white focus:ring-blue-500',
                              green: 'text-green-600 hover:bg-green-600 hover:text-white focus:ring-green-500',
                              red: 'text-red-600 hover:bg-red-500 hover:text-white focus:ring-red-500',
                              orange: 'text-orange-600 hover:bg-orange-500 hover:text-white focus:ring-orange-500',
                              purple: 'text-purple-600 hover:bg-purple-600 hover:text-white focus:ring-purple-500',
                            };
                            const colorClass = colors[evaluatedColor || 'blue'];

                            if (act.show && !act.show(row)) return null;

                            return (
                              <button
                                key={idx}
                                onClick={() => act.onClick(row)}
                                title={evaluatedLabel as string}
                                className={`group h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 transition-all duration-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-2 active:scale-95 ${colorClass}`}
                              >
                                {evaluatedIcon ? (
                                  <span className="group-hover:scale-110 transition-transform">{evaluatedIcon}</span>
                                ) : (
                                  <FiMoreVertical className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                )}
                              </button>
                            );
                          })}

                          {/* EXPAND ACTION */}
                          {expandableContent && (
                            <button
                              onClick={() => toggleRow(index)}
                              className="group h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-all duration-200 hover:bg-gray-200 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-gray-300 focus:ring-offset-2 active:scale-95 ml-auto"
                            >
                              {expandedRows[index] ? (
                                <FiChevronUp className="h-4 w-4 transition-transform" />
                              ) : (
                                <FiChevronDown className="h-4 w-4 transition-transform" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expandableContent && expandedRows[index] && (
                    <tr key={`expand-${index}`} className="border-b border-gray-100 bg-gray-50/30">
                      <td colSpan={columns.length + (actions ? 1 : 0)} className="p-0">
                        <div className="overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
                          {expandableContent(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination - Modern Design */}
      {pagination && actualTotalPages > 0 && !loading && data.length > 0 && (
        <div className="border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 md:px-6 py-5 rounded-b-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Rows</span>
                <div className="relative" ref={pageSizeRef}>
                  <button
                    onClick={() => setPageSizeOpen(!pageSizeOpen)}
                    className="flex items-center justify-between w-[70px] bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-[#3B82F6] hover:ring-1 hover:ring-[#3B82F6]/50 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                  >
                    <span>{internalPageSize}</span>
                    <FiChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${pageSizeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {pageSizeOpen && (
                    <div className="absolute bottom-full left-0 mb-1 w-[80px] bg-white border border-gray-100 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                      {[10, 25, 50, 100].map((s) => (
                        <div
                          key={s}
                          onClick={() => {
                            handlePageSizeChange(s);
                            setPageSizeOpen(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${
                            internalPageSize === s 
                              ? 'bg-blue-50 text-blue-700 font-bold' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>{s}</span>
                          {internalPageSize === s && <FiCheck className="h-4 w-4 text-blue-600" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-gray-500 text-xs md:text-sm">
                Showing <span className="font-medium text-gray-700">{(internalPage - 1) * internalPageSize + 1}</span> to{' '}
                <span className="font-medium text-gray-700">
                  {Math.min(internalPage * internalPageSize, data.length)}
                </span>{' '}
                of <span className="font-medium text-gray-700">{data.length}</span>
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 md:pb-0">
              <button
                onClick={() => handlePageChange(internalPage - 1)}
                disabled={internalPage === 1}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 ${internalPage === 1
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2'
                  }`}
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-sm text-gray-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${page}`}
                      onClick={() => handlePageChange(page as number)}
                      className={`inline-flex min-w-[2.5rem] h-9 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${internalPage === page
                        ? 'bg-[#3B82F6] text-white shadow-md'
                        : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                        }`}
                    >
                      {page}
                    </button>
                  )
                ))}
              </div>

              <button
                onClick={() => handlePageChange(internalPage + 1)}
                disabled={internalPage === actualTotalPages}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 ${internalPage === actualTotalPages
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2'
                  }`}
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}