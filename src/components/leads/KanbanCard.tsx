import React from 'react';
import { FiPhone, FiMail, FiEye, FiEdit } from 'react-icons/fi';
import { Building2, FolderKanban, IndianRupee } from 'lucide-react';
import { formatContactNumber } from "@/utills/utill";
import { ApiLead } from './types';

export default function KanbanCard({
    lead, onDragStart, onView, onEdit, isUpdating
}: {
    lead: ApiLead;
    onDragStart: () => void;
    onView: () => void;
    onEdit?: () => void;
    onMarkLost?: () => void;
    onMarkWon?: () => void;
    isUpdating?: boolean;
}) {
    const projectName = (lead.project as any)?.projectName || (lead.project as any)?.name || lead.product;
    const amount = Number(lead.paymentAmount || lead.projectAmount || 0);

    return (
        <div
            draggable={!isUpdating}
            onDragStart={!isUpdating ? onDragStart : undefined}
            className={`group relative rounded-xl bg-white p-3.5 border border-gray-200/80 shadow-xs hover:shadow-md transition-all duration-200 ${
                isUpdating ? "opacity-60 pointer-events-none" : "cursor-grab active:cursor-grabbing hover:border-blue-300"
            }`}
        >
            {isUpdating && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-xs">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent"></div>
                </div>
            )}

            {/* Header: Customer Name & Actions */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-gray-900 text-sm truncate leading-tight group-hover:text-[#3B82F6] transition-colors">
                        {lead.customerName || 'Unnamed Lead'}
                    </h4>
                    {lead.companyName && lead.companyName !== '-' && (
                        <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span>{lead.companyName}</span>
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onView(); }}
                        title="View Details"
                        className="h-6 w-6 rounded-md bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-[#3B82F6] flex items-center justify-center transition-colors cursor-pointer"
                    >
                        <FiEye className="h-3 w-3" />
                    </button>
                    {onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            title="Edit Lead"
                            className="h-6 w-6 rounded-md bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <FiEdit className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Contact Information */}
            <div className="mt-2.5 space-y-1 text-xs text-gray-600">
                {lead.customerContact && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                        <FiPhone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{formatContactNumber(lead.customerContact)}</span>
                    </div>
                )}
                {lead.customerEmail && (
                    <div className="flex items-center gap-1.5 min-w-0 text-gray-500">
                        <FiMail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="truncate text-[11px]">{lead.customerEmail}</span>
                    </div>
                )}
            </div>

            {/* Footer Badges: Project, Amount, Priority */}
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-1.5 flex-wrap">
                {projectName ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 max-w-[140px] truncate" title={projectName}>
                        <FolderKanban className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{projectName}</span>
                    </span>
                ) : <span />}

                <div className="flex items-center gap-1.5 ml-auto">
                    {amount > 0 && (
                        <span className="inline-flex items-center text-[11px] font-bold text-gray-900">
                            ₹{amount.toLocaleString('en-IN')}
                        </span>
                    )}

                    {lead.priority && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md flex-shrink-0 ${
                            lead.priority.toLowerCase() === 'high'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : lead.priority.toLowerCase() === 'medium'
                                    ? 'bg-orange-50 text-orange-600 border border-orange-200'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}>
                            {lead.priority}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}