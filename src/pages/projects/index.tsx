'use client';

import { useEffect, useState, useCallback } from 'react';
import DataTable, { Column } from '@/components/DataTable';
import ProjectDialog, { Project } from '@/components/ProjectDialog';
import ProjectViewDialog from '@/components/ProjectViewDialog';
import DeleteDialog from '@/components/DeleteDialog';
import axios from 'axios';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';
import { ExternalLink, Image as ImageIcon } from 'lucide-react';

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
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

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

  const columns: Column<Project>[] = [
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
      label: 'PROJECT NAME',
      render: (value, row) => (
        <div>
          <span className="font-semibold text-gray-900 block">{value}</span>
          {row.projectManager && (
            <span className="text-[11px] text-blue-600 font-medium block mt-0.5">
              Manager: {row.projectManager}
            </span>
          )}
        </div>
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
      label: 'DEMO LINK',
      render: (value) =>
        value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-950 underline hover:text-blue-700 font-medium"
          >
            <span>Live Demo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        ),
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

  const handleEdit = (row: Project) => {
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
      toast.success('Project deleted successfully');
      setShowDeleteDialog(false);
      setProjectToDelete(null);
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error(err?.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleSubmit = () => {
    fetchProjects();
    setIsFormOpen(false);
    setEditingProject(null);
  };

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
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          actions
          addButton={{
            label: 'Add Project',
            onClick: handleAdd,
          }}
        />
      </div>

      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setProjectToDelete(null);
        }}
        title="Delete Project"
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
            Are you sure you want to delete project "{projectToDelete?.name}"?
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
