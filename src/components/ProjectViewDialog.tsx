'use client';

import { useState } from 'react';
import Dialog from './Dialog';
import { Project } from './ProjectDialog';
import { FiExternalLink, FiChevronLeft, FiChevronRight, FiCheckCircle, FiXCircle, FiCopy, FiCheck } from 'react-icons/fi';
import { Badge } from './Badge';
import { toast } from 'react-toastify';

interface ProjectViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function ProjectViewDialog({
  isOpen,
  onClose,
  project,
}: ProjectViewDialogProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  if (!project) return null;

  const isCustomization = project.labelCustomization === true || (project.labelCustomization as any) === 'true' || (project.labelCustomization as any) === 1;

  const handleCopyAll = () => {
    const details: string[] = [
      `📌 Project Name: ${project.name}`,
    ];

    if (project.demoLink) details.push(`🔗 Live Demo Link: ${project.demoLink}`);
    if (project.singlePageLink) details.push(`📄 Single Page Link: ${project.singlePageLink}`);
    if (project.demoId) details.push(`👤 Demo ID / User: ${project.demoId}`);
    if (project.demoPassword) details.push(`🔑 Demo Password: ${project.demoPassword}`);
    if (isCustomization) {
      details.push(`✨ Customization: Available`);
    }

    const textToCopy = details.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast.success('Project details & demo credentials copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const images = project.images || [];
  let pmNames: string[] = [];
  if (Array.isArray(project.projectManagers) && project.projectManagers.length > 0) {
    pmNames = project.projectManagers
      .map((pm: any) => (typeof pm === 'object' && pm !== null ? pm.fullName : pm))
      .filter(Boolean);
  } else if (project.projectManager) {
    const single = typeof project.projectManager === 'object' && project.projectManager !== null
      ? project.projectManager.fullName
      : project.projectManager;
    if (single) pmNames = [single];
  }

  const nextImage = () => {
    if (images.length > 0) {
      setActiveImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 0) {
      setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Product Details"
      size="xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium text-sm cursor-pointer"
        >
          Close
        </button>
      }
    >
      <div className="space-y-6">
        {/* Header summary card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
              <Badge variant={project.status === 'active' ? 'success' : 'default'}>
                {project.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
              {project.commissionRate !== undefined && project.commissionRate !== null && Number(project.commissionRate) > 0 && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {project.commissionRate}% Commission
                </span>
              )}
              {isCustomization && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  Customization Available
                </span>
              )}
            </div>
            {pmNames.length > 0 && (
              <div className="text-xs text-blue-700 font-semibold mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span>Product Manager(s):</span>
                {pmNames.map((name, i) => (
                  <span
                    key={i}
                    className="bg-white text-gray-900 border border-blue-200 px-2 py-0.5 rounded-md shadow-2xs font-medium"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Created on{' '}
              {project.createdAt
                ? new Date(project.createdAt).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'N/A'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyAll}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-2xs'
              }`}
              title="Copy all links and credentials"
            >
              {isCopied ? <FiCheck className="w-4 h-4 text-white" /> : <FiCopy className="w-4 h-4 text-gray-600" />}
              <span>{isCopied ? 'Copied Details' : 'Copy All Details'}</span>
            </button>

            {project.singlePageLink && (
              <a
                href={project.singlePageLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                <span>Single Page</span>
                <FiExternalLink className="w-4 h-4" />
              </a>
            )}
            {project.demoLink && (
              <a
                href={project.demoLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                <span>Live Demo</span>
                <FiExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Demo Credentials Box if available */}
        {(project.demoId || project.demoPassword) && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm">
            <div className="font-semibold text-amber-900 flex items-center gap-1.5">
              <span>🔐 Demo Credentials:</span>
            </div>
            {project.demoId && (
              <div className="text-gray-800">
                <span className="text-gray-500 text-xs uppercase font-medium">Username / ID:</span>{' '}
                <code className="bg-white px-2 py-0.5 rounded border border-amber-200 font-mono font-bold text-blue-700">
                  {project.demoId}
                </code>
              </div>
            )}
            {project.demoPassword && (
              <div className="text-gray-800">
                <span className="text-gray-500 text-xs uppercase font-medium">Password:</span>{' '}
                <code className="bg-white px-2 py-0.5 rounded border border-amber-200 font-mono font-bold text-gray-900">
                  {project.demoPassword}
                </code>
              </div>
            )}
          </div>
        )}

        {/* 4 Images Gallery Carousel */}
        {images.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Product Screenshots & Previews ({images.length})
            </h3>

            {/* Main Preview Container */}
            <div className="relative w-full h-72 sm:h-96 rounded-2xl bg-gray-900 overflow-hidden flex items-center justify-center shadow-inner group">
              <img
                src={images[activeImageIndex]}
                alt={`${project.name} Screenshot ${activeImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
                    title="Previous Image"
                  >
                    <FiChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
                    title="Next Image"
                  >
                    <FiChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/70 text-white text-xs font-semibold backdrop-blur-sm">
                {activeImageIndex + 1} / {images.length}
              </div>
            </div>

            {/* Thumbnails list */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      activeImageIndex === idx
                        ? 'border-blue-600 ring-2 ring-blue-100 scale-102'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumb ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
            No preview images uploaded for this project.
          </div>
        )}

        {/* Features & Description */}
        <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Features & Description
          </h3>
          {project.features ? (
            <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed pt-2"
              dangerouslySetInnerHTML={{ __html: project.features }}
            />
          ) : (
            <p className="text-sm text-gray-400 italic">No features provided.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
