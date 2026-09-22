import React, { useState, useEffect } from 'react';
import { Project } from './ProjectDialog';
import { toast } from 'react-toastify';
import { 
  CheckCircle2, 
  ExternalLink, 
  ArrowRight, 
  Edit3, 
  Trash2, 
  Layers, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Key,
  Percent
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onView?: (project: Project) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  canManage?: boolean;
}

export function extractFeaturePoints(featuresHtmlOrText?: string): string[] {
  if (!featuresHtmlOrText) return [];
  const points: string[] = [];

  // 1. Check if HTML contains <li>...</li>
  const liMatches = featuresHtmlOrText.match(/<li[^>]*>(.*?)<\/li>/gi);
  if (liMatches) {
    liMatches.forEach((li) => {
      const clean = li.replace(/<[^>]+>/g, '').trim();
      if (clean) points.push(clean);
    });
  }

  // 2. If no <li> found, split by lines or bullets
  if (points.length === 0) {
    const lines = featuresHtmlOrText.replace(/<[^>]+>/g, '\n').split('\n');
    lines.forEach((line) => {
      const clean = line.replace(/^[\s•\-\*]+/, '').trim();
      if (clean && clean.length > 1) points.push(clean);
    });
  }

  return points.slice(0, 4);
}

export function extractDescriptionText(featuresOrDesc?: string): string {
  if (!featuresOrDesc) return '';
  let text = featuresOrDesc.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}

export default function ProjectCard({
  project,
  onView,
  onEdit,
  onDelete,
  canManage = false,
}: ProjectCardProps) {
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const images = project.images && project.images.length > 0 ? project.images : [];
  const featurePoints = extractFeaturePoints(project.features || project.description);
  const descText = extractDescriptionText(project.features || project.description);

  const isCustomization = project.labelCustomization === true || (project.labelCustomization as any) === 'true' || (project.labelCustomization as any) === 1;
  const hasCommission = project.commissionRate !== undefined && Number(project.commissionRate) > 0;

  // Primary Explore link
  const primaryLink = project.singlePageLink || project.demoLink || '';

  // ── Auto loop images every 3.5 seconds ──────────────────────────────────────
  useEffect(() => {
    if (images.length <= 1 || isHovered) return;
    const interval = setInterval(() => {
      setActiveImgIdx((prev) => (prev + 1) % images.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [images.length, isHovered]);

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 0) {
      setActiveImgIdx((prev) => (prev + 1) % images.length);
    }
  };

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 0) {
      setActiveImgIdx((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  // Unified Copy Handler for all project details & credentials (without Commission)
  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const details: string[] = [
      `📌 Product: ${project.name}`,
    ];

    if (project.singlePageLink) {
      details.push(`📄 Single Page Link: ${project.singlePageLink}`);
    }
    if (project.demoLink) {
      details.push(`🔗 Live Demo Link: ${project.demoLink}`);
    }
    if (project.demoId) {
      details.push(`👤 Demo ID / User: ${project.demoId}`);
    }
    if (project.demoPassword) {
      details.push(`🔑 Demo Password: ${project.demoPassword}`);
    }
    if (isCustomization) {
      details.push(`✨ Customization: Available`);
    }

    const textToCopy = details.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast.success('Product details & demo credentials copied!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const themeColor = project.themeColor || '#2563EB';

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col rounded-3xl border shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-2xl transition-all duration-300 overflow-hidden hover:-translate-y-1.5"
      style={{
        background: `linear-gradient(180deg, #FFFFFF 0%, ${themeColor}05 40%, ${themeColor}0C 100%)`,
        borderColor: isHovered ? `${themeColor}80` : `${themeColor}22`,
        boxShadow: isHovered ? `0 20px 35px -10px ${themeColor}25` : undefined,
      }}
    >
      
      {/* ── Top-Left Premium Diagonal Cross Ribbon for Commission ── */}
      {hasCommission && (
        <div className="absolute top-0 left-0 w-28 h-28 overflow-hidden z-20 pointer-events-none">
          <div className="absolute top-[18px] -left-[38px] w-[140px] transform -rotate-45 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white text-[10px] font-extrabold uppercase py-1 text-center shadow-md tracking-wider flex items-center justify-center gap-1 border-y border-white/20">
            <Percent className="w-2.5 h-2.5 text-amber-300 stroke-[3]" />
            <span>{project.commissionRate}% Comm.</span>
          </div>
        </div>
      )}

      {/* ── Top Image Container (Contains Logo / Screenshots cleanly) ── */}
      <div 
        className="relative w-full h-44 sm:h-48 border-b flex items-center justify-center p-3.5 select-none overflow-hidden"
        style={{
          borderColor: `${themeColor}15`,
          background: `linear-gradient(180deg, ${themeColor}0D 0%, #FFFFFF 60%, ${themeColor}08 100%)`
        }}
      >
        {images.length > 0 ? (
          <>
            <img
              src={images[activeImgIdx]}
              alt={project.name}
              className="max-h-full max-w-full object-contain object-center transition-all duration-500 group-hover:scale-105 drop-shadow-sm"
            />
            
            {/* Carousel navigation arrows if multiple images */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImg}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md z-10"
                  title="Previous image"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextImg}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md z-10"
                  title="Next image"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Auto-loop indicator dots */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/40 backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImgIdx(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      activeImgIdx === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4" style={{ color: themeColor }}>
            <Layers className="w-10 h-10 mb-1.5 stroke-1 opacity-70" />
            <span className="text-xs font-semibold opacity-90">{project.name}</span>
          </div>
        )}

        {/* Floating Top-Right Actions (Link only, top copy removed) */}
        {primaryLink && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
            <a
              href={primaryLink}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-white/95 hover:bg-white border border-gray-100 shadow-md backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
              style={{ color: themeColor }}
              title="Open Product Link"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Status / Active Badge if inactive */}
        {project.status === 'inactive' && (
          <div className={`absolute ${hasCommission ? 'bottom-2.5 left-2.5' : 'top-2.5 left-2.5'} px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/95 text-white backdrop-blur-sm shadow-sm z-10`}>
            Inactive
          </div>
        )}
      </div>

      {/* ── Card Content ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 sm:p-5">
        
        {/* Category & Customization Badges Row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span 
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border"
            style={{ 
              backgroundColor: `${themeColor}12`, 
              color: themeColor,
              borderColor: `${themeColor}25`
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: themeColor }}></span>
            Software & CRM
          </span>

          {/* Customization Badge */}
          {isCustomization && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/90 ml-auto shadow-2xs">
              <Sparkles className="w-3 h-3 text-purple-600" />
              Customization
            </span>
          )}
        </div>

        {/* Product Title */}
        <h3 
          className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight line-clamp-1 mb-1.5 transition-colors"
        >
          {project.name}
        </h3>

        {/* Product Description */}
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3.5 min-h-[2.4rem]">
          {descText || 'Complete all-in-one software platform for customer operations, leads, and workflows.'}
        </p>

        {/* Features Checklist */}
        <div className="space-y-1.5 mb-4 flex-1">
          {featurePoints.length > 0 ? (
            featurePoints.map((point, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                <span className="text-xs font-medium text-slate-700 line-clamp-1">
                  {point}
                </span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: themeColor }} />
                <span className="text-xs font-medium text-slate-700">Custom Dashboard & Reports</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: themeColor }} />
                <span className="text-xs font-medium text-slate-700">Real-time Lead Management</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: themeColor }} />
                <span className="text-xs font-medium text-slate-700">Secure Cloud Data Backup</span>
              </div>
            </>
          )}
        </div>

        {/* Quick Demo Credentials Info bar */}
        {(project.demoId || project.demoPassword) && (
          <div 
            className="mb-3.5 px-3 py-1.5 rounded-xl border flex items-center justify-between text-[11px] text-slate-700"
            style={{
              backgroundColor: `${themeColor}08`,
              borderColor: `${themeColor}20`
            }}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Key className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="truncate font-mono text-[11px]">
                {project.demoId ? `ID: ${project.demoId}` : ''}
                {project.demoId && project.demoPassword ? ' | ' : ''}
                {project.demoPassword ? `Pass: ${project.demoPassword}` : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyAll}
              className="font-bold ml-2 text-[10px] uppercase tracking-wider flex-shrink-0 cursor-pointer hover:underline"
              style={{ color: themeColor }}
            >
              {isCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {/* ── Action Buttons ─────────────────────────────────────────────── */}
        <div 
          className="pt-2.5 mt-auto border-t flex items-center gap-2"
          style={{ borderColor: `${themeColor}15` }}
        >
          
          {/* Main Explore Product Button: Opens Link directly in new tab with themeColor */}
          {primaryLink ? (
            <a
              href={primaryLink}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 py-2.5 px-3.5 rounded-xl text-white font-bold text-xs sm:text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center group/btn"
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 4px 14px 0 ${themeColor}40`
              }}
            >
              <span>Explore Product</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
            </a>
          ) : (
            <div className="flex-1 py-2.5 px-3.5 rounded-xl bg-gray-100 text-gray-500 font-bold text-xs sm:text-sm text-center">
              <span>Coming Soon</span>
            </div>
          )}

          {/* Copy Details Button */}
          <button
            type="button"
            onClick={handleCopyAll}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex-shrink-0 shadow-2xs ${
              isCopied
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200/90 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            style={{
              borderColor: isCopied ? undefined : `${themeColor}30`,
              backgroundColor: isCopied ? undefined : `${themeColor}06`,
              color: isCopied ? undefined : themeColor,
            }}
            title="Copy Demo Links & Credentials"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Admin Management options */}
          {canManage && (
            <div className="flex items-center gap-1 pl-1 border-l border-slate-100">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(project);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                  title="Edit Product"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project);
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Delete Product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
