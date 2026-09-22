import React, { useState, useEffect } from 'react';
import { Project } from './ProjectDialog';
import Dialog from './Dialog';
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
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Key,
  Percent,
  Globe,
  Link2,
  User,
  Lock,
  Eye,
  EyeOff,
  Sparkle
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

  return points;
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isProjectAccessOpen, setIsProjectAccessOpen] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);

  const images = project.images && project.images.length > 0 ? project.images : [];
  const allFeaturePoints = extractFeaturePoints(project.features || project.description);
  const visibleFeatures = allFeaturePoints.slice(0, 4);
  const extraFeaturesCount = Math.max(0, allFeaturePoints.length - 4);
  const descText = extractDescriptionText(project.features || project.description);

  const isCustomization = project.labelCustomization === true || (project.labelCustomization as any) === 'true' || (project.labelCustomization as any) === 1;
  const hasCommission = project.commissionRate !== undefined && Number(project.commissionRate) > 0;

  const hasAccessCredentials = Boolean(
    project.singlePageLink || 
    project.demoLink || 
    project.demoId || 
    project.demoPassword
  );

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

  const handleCopySingle = (text: string, fieldName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied!`);
    setTimeout(() => setCopiedField(null), 1800);
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

  const themeColor = project.themeColor || '#4F46E5';

  return (
    <>
      <div 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex flex-col rounded-3xl border shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] hover:shadow-2xl transition-all duration-300 overflow-hidden hover:-translate-y-1.5"
        style={{
          background: `linear-gradient(180deg, #FFFFFF 0%, ${themeColor}05 40%, ${themeColor}0F 100%)`,
          borderColor: isHovered ? `${themeColor}90` : `${themeColor}25`,
          boxShadow: isHovered ? `0 20px 35px -10px ${themeColor}28` : undefined,
        }}
      >
        
        {/* ── Top-Left Diagonal Cross Ribbon for Commission ── */}
        {hasCommission && (
          <div className="absolute top-0 left-0 w-28 h-28 overflow-hidden z-20 pointer-events-none">
            <div className="absolute top-[18px] -left-[38px] w-[140px] transform -rotate-45 bg-[#059669] text-white text-[10px] font-extrabold uppercase py-1 text-center shadow-md tracking-wider flex items-center justify-center gap-1 border-y border-white/20">
              <Percent className="w-2.5 h-2.5 text-white stroke-[3]" />
              <span>{project.commissionRate}% COMM.</span>
            </div>
          </div>
        )}

        {/* ── Top Image Container (Contains Logo / Screenshots cleanly) ── */}
        <div 
          className="relative w-full h-44 sm:h-48 border-b flex items-center justify-center p-3 select-none overflow-hidden"
          style={{
            borderColor: `${themeColor}15`,
            background: `linear-gradient(180deg, ${themeColor}0A 0%, #FFFFFF 65%, ${themeColor}05 100%)`
          }}
        >
          {images.length > 0 ? (
            <>
              <img
                src={images[activeImgIdx]}
                alt={project.name}
                className="max-h-full max-w-full object-contain object-center transition-all duration-500 group-hover:scale-105 drop-shadow-xs"
              />
              
              {/* Carousel navigation arrows if multiple images */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevImg}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow-md z-10"
                    title="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextImg}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow-md z-10"
                    title="Next image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Auto-loop indicator pill bar */}
              {images.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full">
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

          {/* Floating Top-Right Link button */}
          {primaryLink && (
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
              <a
                href={primaryLink}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-xl bg-white/95 hover:bg-white border border-gray-100 shadow-sm backdrop-blur-md transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
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
          
          {/* Customization Badge Row */}
          {isCustomization && (
            <div className="flex items-center mb-2.5">
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold border"
                style={{
                  backgroundColor: `${themeColor}0C`,
                  color: themeColor,
                  borderColor: `${themeColor}30`,
                }}
              >
                <Sparkles className="w-3 h-3" style={{ color: themeColor }} />
                Customization
              </span>
            </div>
          )}

          {/* Product Title */}
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight line-clamp-1 mb-1.5">
            {project.name}
          </h3>

          {/* Product Description */}
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3 min-h-[2.2rem]">
            {descText || '-'}
          </p>

          {/* Features Checklist */}
          <div className="space-y-1.5 mb-3.5">
            {visibleFeatures.length > 0 ? (
              visibleFeatures.map((point, i) => {
                const isLast = i === visibleFeatures.length - 1;
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                      <span className="text-xs font-medium text-slate-700 line-clamp-1">
                        {point}
                      </span>
                    </div>

                    {/* "+ More" popup link aligned inline on the 4th feature row */}
                    {isLast && (extraFeaturesCount > 0 || project.features) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFeaturesModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md hover:underline cursor-pointer transition-all flex-shrink-0"
                        style={{ 
                          color: themeColor,
                          backgroundColor: `${themeColor}12`
                        }}
                        title="View all features"
                      >
                        <span>+{extraFeaturesCount > 0 ? extraFeaturesCount : ''} More</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 font-medium py-1">
                -
              </div>
            )}
          </div>

          {/* ── PROJECT ACCESS SECTION (DEFAULT SLIDED DOWN / COLLAPSED) ─────────── */}
          {hasAccessCredentials && (
            <div className="pt-2 mb-3.5 border-t border-dashed border-slate-200/80">
              {/* Clickable Header that slides down / expands credentials */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProjectAccessOpen((prev) => !prev);
                }}
                className="w-full flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group/toggle select-none text-left"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 transition-transform group-hover/toggle:rotate-12" style={{ color: themeColor }} />
                  <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">Project Access</h4>
                </div>

                <div 
                  className="flex items-center gap-1 text-[11.5px] font-bold px-2 py-0.5 rounded-lg transition-all"
                  style={{ 
                    color: themeColor,
                    backgroundColor: `${themeColor}12`
                  }}
                >
                  <span>{isProjectAccessOpen ? 'Collapse' : 'Slide Down'}</span>
                  {isProjectAccessOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Slide-down Collapsible container (Default closed: isProjectAccessOpen = false) */}
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isProjectAccessOpen 
                    ? 'max-h-[500px] opacity-100 mt-2' 
                    : 'max-h-0 opacity-0 pointer-events-none mt-0'
                }`}
              >
                <div className="space-y-1.5 pt-0.5">
                  
                  {/* 1. Main Website */}
                  {project.singlePageLink && (
                    <div 
                      className="p-2 rounded-xl flex items-center justify-between gap-2 border transition-all"
                      style={{
                        backgroundColor: `${themeColor}08`,
                        borderColor: `${themeColor}18`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${themeColor}18`, color: themeColor }}
                        >
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-semibold text-slate-400 leading-tight">Main Website</span>
                          <span className="block text-xs font-semibold text-slate-800 truncate">{project.singlePageLink}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a
                          href={project.singlePageLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg hover:bg-white/80 text-slate-500 hover:text-slate-900 transition-colors"
                          title="Open Main Website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleCopySingle(project.singlePageLink!, 'Main Website Link', e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          {copiedField === 'Main Website Link' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{copiedField === 'Main Website Link' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Website / Demo */}
                  {project.demoLink && (
                    <div 
                      className="p-2 rounded-xl flex items-center justify-between gap-2 border transition-all"
                      style={{
                        backgroundColor: `${themeColor}08`,
                        borderColor: `${themeColor}18`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${themeColor}18`, color: themeColor }}
                        >
                          <Link2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-semibold text-slate-400 leading-tight">Website / Demo</span>
                          <span className="block text-xs font-semibold text-slate-800 truncate">{project.demoLink}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a
                          href={project.demoLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg hover:bg-white/80 text-slate-500 hover:text-slate-900 transition-colors"
                          title="Open Demo Link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleCopySingle(project.demoLink!, 'Demo Link', e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          {copiedField === 'Demo Link' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{copiedField === 'Demo Link' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. Login ID */}
                  {project.demoId && (
                    <div 
                      className="p-2 rounded-xl flex items-center justify-between gap-2 border transition-all"
                      style={{
                        backgroundColor: `${themeColor}08`,
                        borderColor: `${themeColor}18`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${themeColor}18`, color: themeColor }}
                        >
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-semibold text-slate-400 leading-tight">Login ID</span>
                          <span className="block text-xs font-semibold text-slate-800 truncate font-mono">{project.demoId}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopySingle(project.demoId!, 'Login ID', e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          {copiedField === 'Login ID' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{copiedField === 'Login ID' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 4. Password */}
                  {project.demoPassword && (
                    <div 
                      className="p-2 rounded-xl flex items-center justify-between gap-2 border transition-all"
                      style={{
                        backgroundColor: `${themeColor}08`,
                        borderColor: `${themeColor}18`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${themeColor}18`, color: themeColor }}
                        >
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-semibold text-slate-400 leading-tight">Password</span>
                          <span className="block text-xs font-semibold text-slate-800 truncate font-mono">
                            {showPassword ? project.demoPassword : '••••••••'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPassword((prev) => !prev);
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/80 text-slate-500 hover:text-slate-900 transition-colors"
                          title={showPassword ? 'Hide Password' : 'Show Password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCopySingle(project.demoPassword!, 'Password', e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          {copiedField === 'Password' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{copiedField === 'Password' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* ── Bottom Action Buttons ─────────────────────────────────────────────── */}
          <div 
            className="pt-3 mt-auto border-t flex items-center gap-2.5"
            style={{ borderColor: `${themeColor}18` }}
          >
            {/* Main Explore Product Button */}
            {primaryLink ? (
              <a
                href={primaryLink}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 py-3 px-4 rounded-2xl text-white font-bold text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-center group/btn"
                style={{
                  backgroundColor: themeColor,
                  boxShadow: `0 6px 18px 0 ${themeColor}45`
                }}
              >
                <span>Explore Product</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </a>
            ) : (
              <div className="flex-1 py-3 px-4 rounded-2xl bg-gray-100 text-gray-500 font-bold text-sm text-center">
                <span>Coming Soon</span>
              </div>
            )}

            {/* Copy All Details Button */}
            <button
              type="button"
              onClick={handleCopyAll}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex-shrink-0 shadow-2xs ${
                isCopied
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200/90 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
              }`}
              style={{
                borderColor: isCopied ? undefined : `${themeColor}35`,
                backgroundColor: isCopied ? undefined : `${themeColor}0A`,
                color: isCopied ? undefined : themeColor,
              }}
              title="Copy All Product & Demo Details"
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

      {/* ── EXCLUSIVE FEATURES ONLY POPUP MODAL ── */}
      <Dialog
        isOpen={showFeaturesModal}
        onClose={() => setShowFeaturesModal(false)}
        title={`${project.name} - Features`}
        size="md"
        footer={
          <button
            type="button"
            onClick={() => setShowFeaturesModal(false)}
            className="px-5 py-2 rounded-xl text-white font-semibold text-sm transition-all cursor-pointer shadow-sm"
            style={{ backgroundColor: themeColor }}
          >
            Close
          </button>
        }
      >
        <div className="py-2 space-y-4">
          <div 
            className="p-3.5 rounded-2xl border flex items-center gap-3"
            style={{ 
              backgroundColor: `${themeColor}08`, 
              borderColor: `${themeColor}20` 
            }}
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">{project.name}</h4>
              <p className="text-xs text-slate-500">All available feature highlights and capabilities.</p>
            </div>
          </div>

          {/* Feature points list */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {allFeaturePoints.length > 0 ? (
              allFeaturePoints.map((feat, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/80 transition-colors"
                >
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 leading-relaxed">
                    {feat}
                  </span>
                </div>
              ))
            ) : project.features ? (
              <div 
                className="prose prose-sm max-w-none text-xs text-slate-700 leading-relaxed p-3 bg-slate-50 rounded-xl border border-slate-100"
                dangerouslySetInnerHTML={{ __html: project.features }}
              />
            ) : (
              <p className="text-xs text-slate-400 italic p-4 text-center">No specific features listed for this product.</p>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}


