// components/leads/LeadBulkImportDialog.tsx
import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Upload, Download, X, FileSpreadsheet,
  CheckCircle2, AlertCircle, Loader2, Info, ChevronRight,
} from 'lucide-react';
import { baseUrl, getAuthToken } from '@/config';
import { toast } from 'react-toastify';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Step = 'idle' | 'uploading' | 'done' | 'error';

interface ImportResult {
  imported: number;
  failed: number;
  failedBlob?: Blob;
}

export default function LeadBulkImportDialog({ isOpen, onClose, onImported }: Props) {
  // ── All hooks MUST be at the top — before any early return ────────────────
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setStep('idle');
    setResult(null);
    setErrorMsg('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const validateAndSetFile = useCallback((f: File) => {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      toast.error('Only Excel files (.xlsx / .xls) are accepted.');
      return;
    }
    setFile(f);
    setStep('idle');
    setResult(null);
    setErrorMsg('');
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) validateAndSetFile(f);
  }, [validateAndSetFile]);

  // ── Early return AFTER all hooks ──────────────────────────────────────────
  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) validateAndSetFile(f);
  };

  const handleDownloadTemplate = async () => {
    if (downloadingTemplate) return;
    setDownloadingTemplate(true);
    try {
      const res = await axios.get(baseUrl.importLeadsTemplate, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded! Fill it and upload below.');
    } catch {
      toast.error('Failed to download template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImport = async () => {
    if (!file || step === 'uploading') return;
    setStep('uploading');
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(baseUrl.bulkImportLeads, formData, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'arraybuffer',
        validateStatus: () => true,
      });

      const contentType = String(res.headers['content-type'] || '');

      if (contentType.includes('spreadsheetml')) {
        const imported = parseInt(res.headers['x-import-imported'] || '0', 10);
        const failed   = parseInt(res.headers['x-import-failed']   || '0', 10);
        const blob = new Blob([res.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        setResult({ imported, failed, failedBlob: blob });
        setStep('done');
        if (imported > 0) onImported();
      } else {
        const text = new TextDecoder().decode(res.data as ArrayBuffer);
        const json = JSON.parse(text);
        if (json.status === 'Success') {
          setResult({ imported: json.data.imported, failed: 0 });
          setStep('done');
          onImported();
        } else {
          throw new Error(json.message || 'Import failed');
        }
      }
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const downloadFailed = () => {
    if (!result?.failedBlob) return;
    const url = window.URL.createObjectURL(result.failedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed_leads_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — not dismissible while uploading */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={step === 'uploading' ? undefined : handleClose}
      />

      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/10">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Import Leads</h2>
              <p className="text-blue-100 text-xs">Upload Excel to import multiple leads at once</p>
            </div>
          </div>
          {step !== 'uploading' && (
            <button
              onClick={handleClose}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── UPLOADING — full-panel animated loader ──────────────────────── */}
        {step === 'uploading' && (
          <div className="flex flex-col items-center justify-center gap-6 py-16 px-8 bg-white">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-24 w-24 rounded-full bg-indigo-100 animate-ping opacity-50" />
              <span className="absolute h-20 w-20 rounded-full bg-indigo-200 animate-pulse" />
              <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-indigo-600 shadow-xl">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-gray-800">Importing Leads...</p>
              <p className="text-sm text-gray-500">
                Processing{' '}
                <span className="font-semibold text-indigo-600">{file?.name}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Validating rows and saving to database. Please wait.
              </p>
            </div>
            {/* Sliding progress bar */}
            <div className="w-full max-w-xs h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-400 to-indigo-500"
                style={{ animation: 'importBar 1.6s ease-in-out infinite', width: '45%' }}
              />
            </div>
            <style>{`
              @keyframes importBar {
                0%   { margin-left: -50%; width: 45%; }
                100% { margin-left: 110%; width: 45%; }
              }
            `}</style>
          </div>
        )}

        {/* ── SUCCESS / PARTIAL ───────────────────────────────────────────── */}
        {step === 'done' && result && (
          <div className="flex flex-col items-center gap-5 py-10 px-8 bg-white">
            {/* Animated icon */}
            {result.failed === 0 ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute h-28 w-28 rounded-full bg-green-100 animate-ping opacity-30" />
                <span className="absolute h-20 w-20 rounded-full bg-green-100 animate-pulse" />
                <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-green-500 shadow-xl shadow-green-200">
                  <CheckCircle2 className="h-9 w-9 text-white" />
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <span className="absolute h-24 w-24 rounded-full bg-orange-100 animate-pulse" />
                <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-orange-400 shadow-lg">
                  <AlertCircle className="h-9 w-9 text-white" />
                </div>
              </div>
            )}

            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">
                {result.failed === 0 ? '🎉 Import Successful!' : 'Import Completed with Errors'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {result.failed === 0
                  ? 'All leads have been imported and saved successfully.'
                  : 'Some rows were imported. Failed rows are available for download.'}
              </p>
            </div>

            {/* Stats cards */}
            <div className="flex gap-4 w-full">
              <div className="flex-1 rounded-xl border-2 border-green-200 bg-green-50 p-4 text-center">
                <p className="text-4xl font-extrabold text-green-600">{result.imported}</p>
                <p className="text-xs font-semibold text-green-700 mt-1 uppercase tracking-wide">✅ Imported</p>
              </div>
              <div className={`flex-1 rounded-xl border-2 p-4 text-center ${result.failed > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                <p className={`text-4xl font-extrabold ${result.failed > 0 ? 'text-red-600' : 'text-gray-300'}`}>{result.failed}</p>
                <p className={`text-xs font-semibold mt-1 uppercase tracking-wide ${result.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {result.failed > 0 ? '❌ Failed' : '— Failed'}
                </p>
              </div>
            </div>

            {/* Download failed rows */}
            {result.failed > 0 && (
              <div className="w-full rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
                <p className="text-sm text-red-700">
                  <strong>{result.failed}</strong> row(s) failed validation. Download the report to see exact failure reasons, fix the data, and re-import.
                </p>
                <button
                  onClick={downloadFailed}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Failed Leads Report
                </button>
              </div>
            )}

            <div className="flex gap-3 w-full pt-1">
              <button
                onClick={reset}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Import More
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ───────────────────────────────────────────────────────── */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-5 py-10 px-8 bg-white">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-24 w-24 rounded-full bg-red-100 animate-pulse" />
              <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-red-500 shadow-lg">
                <AlertCircle className="h-9 w-9 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">Import Failed</h3>
              <p className="text-sm text-red-600 mt-2 max-w-xs leading-relaxed">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={reset} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Try Again
              </button>
              <button onClick={handleClose} className="flex-1 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 transition-colors">
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── IDLE FORM ───────────────────────────────────────────────────── */}
        {step === 'idle' && (
          <>
            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">

              {/* Step 1 – Download Template */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                  <h3 className="font-semibold text-blue-900">Download Template</h3>
                </div>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Download the official import template. It includes <strong>dropdowns</strong> for{' '}
                  <em>Lead Status</em> and <em>Priority</em> pre-filled from your master data.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['Full Name *', 'Contact *', 'Company Name *', 'Lead Status * (dropdown)', 'Email', 'Priority (dropdown)', 'Note'].map((f) => (
                    <div key={f} className="flex items-center gap-1 rounded-full bg-white border border-blue-200 px-3 py-1 text-blue-700">
                      <ChevronRight className="h-3 w-3" /> {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloadingTemplate ? 'Downloading...' : 'Download Template (.xlsx)'}
                </button>
              </div>

              {/* Step 2 – Upload */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">2</span>
                  <h3 className="font-semibold text-gray-900">Upload Filled Template</h3>
                </div>

                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all p-6 ${
                    dragging ? 'border-indigo-500 bg-indigo-50'
                    : file    ? 'border-green-400 bg-green-50'
                    :           'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                  {file ? (
                    <>
                      <FileSpreadsheet className="h-10 w-10 text-green-500" />
                      <div className="text-center">
                        <p className="font-semibold text-green-700 text-sm">{file.name}</p>
                        <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB • Click to change</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-gray-400" />
                      <div className="text-center">
                        <p className="font-medium text-gray-600 text-sm">Drag & drop or click to browse</p>
                        <p className="text-xs text-gray-400 mt-1">Supports .xlsx and .xls files only</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Use only the downloaded template. Custom Excel files may fail to parse correctly.</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex items-center justify-between gap-3">
              <button onClick={reset} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
                Reset
              </button>
              <div className="flex items-center gap-3">
                <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload className="h-4 w-4" />
                  Import Leads
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
