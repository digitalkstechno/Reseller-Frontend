import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import DataTable, { Column } from '@/components/DataTable';
import ProjectDialog, { Project } from '@/components/ProjectDialog';
import ProjectViewDialog from '@/components/ProjectViewDialog';
import ProjectCard from '@/components/ProjectCard';
import DeleteDialog from '@/components/DeleteDialog';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import { 
  ExternalLink, 
  Image as ImageIcon, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Layers,
  GripVertical,
  Palette
} from 'lucide-react';

// Debounce hook
function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function ProjectsContent() {
  const [projectsData, setProjectsData] = useState<Project[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const { role: userRole, permissions: rawPerms, user } = useSelector((state: any) => state.auth);

  // Extract role and email from Redux state or directly from JWT token payload
  const tokenPayload = (() => {
    if (typeof window === 'undefined') return null;
    const t = getAuthToken();
    if (!t) return null;
    try {
      const parts = t.split('.');
      if (parts.length === 3) {
        return JSON.parse(window.atob(parts[1]));
      }
    } catch {}
    return null;
  })();

  const tokenRole = tokenPayload?.role?.roleName || tokenPayload?.role || '';
  const tokenEmail = tokenPayload?.email || '';

  const currentRoleName = (
    userRole ||
    user?.role?.roleName ||
    (typeof user?.role === 'string' ? user.role : '') ||
    tokenRole ||
    ''
  ).toString().toLowerCase().trim();

  const userEmail = (user?.email || tokenEmail || '').toString().toLowerCase().trim();

  const isAdmin = 
    currentRoleName === 'admin' || 
    userEmail === 'admin@gmail.com' || 
    userEmail.includes('admin');

  const isProjectManager = 
    currentRoleName === 'project_manager' || 
    currentRoleName === 'projectmanager';

  const isReseller = !isAdmin && !isProjectManager && (currentRoleName === 'reseller' || currentRoleName === '');

  const canCreate = isAdmin || Boolean(rawPerms?.project?.create);
  const canUpdate = isAdmin || Boolean(rawPerms?.project?.update);
  const canDelete = isAdmin || Boolean(rawPerms?.project?.delete);

  const debouncedSearch = useDebounce(search, 500);
  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(baseUrl.getAllProjects, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: {
          page,
          limit,
          search: debouncedSearch.trim(),
        },
      });

      const payload = res.data?.data;
      if (payload?.projects) {
        setProjectsData(payload.projects);
        setTotalPages(payload.totalPages || 1);
        setTotalRecords(payload.totalProjects || 0);
      } else if (Array.isArray(payload)) {
        setProjectsData(payload);
        setTotalPages(1);
        setTotalRecords(payload.length);
      } else {
        setProjectsData([]);
        setTotalPages(1);
        setTotalRecords(0);
      }

      if (page > (payload?.totalPages || 1)) {
        setPage(payload?.totalPages || 1);
      }
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      setProjectsData([]);
      setTotalPages(1);
      setTotalRecords(0);
      toast.error(error.response?.data?.message || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, token]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const [isReordering, setIsReordering] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...projectsData];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(dropIdx, 0, moved);

    setProjectsData(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);

    // Save reordered positions to backend
    try {
      setIsReordering(true);
      const items = updated.map((p, idx) => ({
        id: p._id,
        sortOrder: (page - 1) * limit + idx,
      }));

      await axios.put(
        baseUrl.reorderProjects,
        { items },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      toast.success('Product positions updated!');
    } catch (err) {
      console.error('Failed to save product order:', err);
      toast.error('Failed to update product order');
      fetchProjects();
    } finally {
      setIsReordering(false);
    }
  };

  const columns: Column<Project>[] = [
    {
      key: 'dragHandle',
      label: '#',
      render: (_, row, idx) => (
        <div className="flex items-center gap-1.5 text-gray-400">
          <GripVertical className="w-4 h-4 cursor-grab text-gray-300 hover:text-gray-600" />
          <span className="text-xs font-mono font-semibold text-gray-500">
            {(page - 1) * limit + (idx !== undefined ? idx + 1 : 1)}
          </span>
        </div>
      ),
    },
    {
      key: 'images',
      label: 'IMAGE',
      render: (images, row) => {
        const firstImg = images?.[0];
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-sky-900 bg-gray-50 flex-shrink-0">
              {firstImg ? (
                <img
                  src={firstImg}
                  alt={row.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <ImageIcon className="h-5 w-5 text-gray-400" />
              )}
            </div>
            {images?.length > 1 && (
              <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                +{images.length - 1}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'name',
      label: 'PRODUCT NAME',
      render: (value, row) => {
        let pmNames: string[] = [];
        if (Array.isArray(row.projectManagers) && row.projectManagers.length > 0) {
          pmNames = row.projectManagers
            .map((pm: any) => (typeof pm === 'object' && pm !== null ? pm.fullName : pm))
            .filter(Boolean);
        } else if (row.projectManager) {
          const single = typeof row.projectManager === 'object' && row.projectManager !== null
            ? (row.projectManager as any).fullName
            : row.projectManager;
          if (single) pmNames = [single];
        }

        return (
          <div>
            <span className="font-semibold text-gray-900 block">{value}</span>
            {pmNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {pmNames.map((name, i) => (
                  <span
                    key={i}
                    className="inline-block text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-medium"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'projectAmount',
      label: 'PRODUCT AMOUNT',
      render: (value) => {
        const num = Number(value) || 0;
        return (
          <span className="font-bold text-emerald-600 text-sm">
            {num > 0 ? `₹${num.toLocaleString('en-IN')}` : '₹0'}
          </span>
        );
      },
    },
    {
      key: 'commissionRate',
      label: 'COMMISSION RATE',
      render: (value) => (
        <span className="font-semibold text-gray-800 text-sm">
          {value !== undefined && value !== null && Number(value) > 0 ? `${value}%` : '0%'}
        </span>
      ),
    },
    {
      key: 'features',
      label: 'DESCRIPTION',
      render: (value, row) => {
        const rawText = (value || row.description || '')
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return (
          <span className="text-xs text-gray-600 line-clamp-2 max-w-sm block" title={rawText}>
            {rawText || '-'}
          </span>
        );
      },
    },
    {
      key: 'demoLink',
      label: 'LINKS',
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          {value && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 underline hover:text-blue-800 font-medium"
            >
              <span>Live Demo</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {row.singlePageLink && (
            <a
              href={row.singlePageLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-600 underline hover:text-purple-800 font-medium"
            >
              <span>Single Page</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {!value && !row.singlePageLink && <span className="text-gray-400 text-xs">-</span>}
        </div>
      ),
    },
    {
      key: 'labelCustomization',
      label: 'CUSTOMIZATION',
      render: (value) =>
        value ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Enabled
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
            No
          </span>
        ),
    },
    {
      key: 'themeColor',
      label: 'COLOR',
      render: (value) => {
        const color = value || '#2563EB';
        return (
          <div className="flex items-center gap-1.5">
            <span 
              className="w-4 h-4 rounded-full border border-gray-200 shadow-2xs flex-shrink-0"
              style={{ backgroundColor: color }}
              title={color}
            />
            <span className="text-[11px] font-mono text-gray-500 uppercase">
              {color}
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (value) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
            value === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {value || 'active'}
        </span>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingProject(null);
    setIsFormOpen(true);
  };

  const handleEdit = async (row: Project) => {
    try {
      if (row._id) {
        const res = await axios.get(`${baseUrl.getProjectById}/${row._id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const project = res.data?.data;
        if (project) {
          setEditingProject(project);
          setIsFormOpen(true);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch full project details:', err);
    }
    setEditingProject(row);
    setIsFormOpen(true);
  };

  const handleView = (row: Project) => {
    setViewingProject(row);
  };

  const handleDeleteClick = (row: Project) => {
    setProjectToDelete(row);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete?._id) return;

    try {
      await axios.delete(`${baseUrl.deleteProject}/${projectToDelete._id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      fetchProjects();
      toast.success('Product deleted successfully');
      setShowDeleteDialog(false);
      setProjectToDelete(null);
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error(err?.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleSubmit = () => {
    fetchProjects();
    setIsFormOpen(false);
    setEditingProject(null);
  };

  // ── RESELLER VIEW: CARDS ONLY ──────────────────────────────────────────────
  if (isReseller) {
    return (
      <>
        <div className="flex flex-col h-full gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Top Bar for Reseller */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              <input
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div className="text-xs font-semibold text-gray-500 ml-auto">
              {totalRecords} {totalRecords === 1 ? 'Product Available' : 'Products Available'}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="flex flex-col gap-6 flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-3xl border border-gray-200 p-4 shadow-sm animate-pulse space-y-4"
                  >
                    <div className="h-44 bg-gray-200 rounded-2xl w-full" />
                    <div className="h-5 bg-gray-200 rounded-full w-28" />
                    <div className="h-6 bg-gray-200 rounded-md w-3/4" />
                    <div className="space-y-2">
                      <div className="h-3.5 bg-gray-200 rounded w-full" />
                      <div className="h-3.5 bg-gray-200 rounded w-5/6" />
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="h-3.5 bg-gray-200 rounded w-1/2" />
                      <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                    </div>
                    <div className="h-10 bg-gray-200 rounded-xl w-full pt-2" />
                  </div>
                ))}
              </div>
            ) : projectsData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {projectsData.map((project) => (
                  <ProjectCard
                    key={project._id || project.name}
                    project={project}
                    onView={handleView}
                    canManage={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-gray-200 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">No Products Available</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  {search ? 'No products matched your search criteria.' : 'There are currently no active products enabled for your account.'}
                </p>
              </div>
            )}

            {/* Pagination Controls for Reseller Grid */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-gray-200/90 shadow-2xs mt-auto">
                <div className="text-xs text-gray-500 font-medium">
                  Page <span className="font-bold text-gray-800">{page}</span> of{' '}
                  <span className="font-bold text-gray-800">{totalPages}</span> ({totalRecords} items)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && (
                            <span className="px-1 text-gray-400 text-xs">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPage(p)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              page === p
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <ProjectViewDialog
          isOpen={!!viewingProject}
          onClose={() => setViewingProject(null)}
          project={viewingProject}
        />
      </>
    );
  }

  // ── ADMIN / PM VIEW: ORIGINAL TABLE DATATABLE VIEW ─────────────────────────
  return (
    <>
      <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <DataTable
          data={projectsData}
          columns={columns}
          loading={isLoading}
          searchable
          pagination
          currentPage={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          draggableRows={isAdmin || isProjectManager}
          onRowDragStart={handleDragStart}
          onRowDragOver={handleDragOver}
          onRowDrop={handleDrop}
          draggedRowIndex={draggedIdx}
          dragOverRowIndex={dragOverIdx}
          onView={handleView}
          onEdit={canUpdate ? handleEdit : undefined}
          onDelete={canDelete ? handleDeleteClick : undefined}
          actions
          addButton={canCreate ? {
            label: 'Add Product',
            onClick: handleAdd,
          } : undefined}
        />
      </div>

      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setProjectToDelete(null);
        }}
        title="Delete Product"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowDeleteDialog(false);
                setProjectToDelete(null);
              }}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="rounded-lg cursor-pointer bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </>
        }
      >
        <div className="py-4">
          <p className="text-gray-700">
            Are you sure you want to delete product "{projectToDelete?.name}"?
          </p>
        </div>
      </DeleteDialog>

      <ProjectDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingProject}
      />

      <ProjectViewDialog
        isOpen={!!viewingProject}
        onClose={() => setViewingProject(null)}
        project={viewingProject}
      />
    </>
  );
}

export default function Projects() {
  return (
    <>
      <ProjectsContent />
    </>
  );
}
