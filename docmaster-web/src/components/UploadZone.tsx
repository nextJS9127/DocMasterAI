import { useRef, useState } from 'react';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { translations } from '../lib/translations';
import type { Language } from '../lib/translations';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
  isProcessing: boolean;
  lang: Language;
  /** 키 미등록 상태에서 업로드 시도(클릭/드롭) 시 호출 */
  onNoKeyAttempt?: () => void;
}

export function UploadZone({ onFileSelect, disabled, isProcessing, lang, onNoKeyAttempt }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang].upload;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pptx')) {
        if (disabled && onNoKeyAttempt) {
          onNoKeyAttempt();
          return;
        }
        onFileSelect(file);
      } else {
        alert(t.onlyFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleZoneClick = () => {
    if (disabled && onNoKeyAttempt) {
      onNoKeyAttempt();
      return;
    }
    if (!disabled && !isProcessing) fileInputRef.current?.click();
  };

  return (
    <div className="relative group w-full">
      {/* Tooltip */}
      {showTooltip && !isProcessing && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-10 flex items-center gap-2">
          <AlertCircle size={14} className="text-blue-300" />
          {t.tooltip}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-xl p-10 transition-all duration-200 
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'}
          ${(disabled || isProcessing) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleZoneClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.pptx"
          onChange={handleFileChange}
          disabled={disabled || isProcessing}
        />

        <div className="flex flex-col items-center justify-center text-center">
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <Loader2 size={40} className="text-blue-600 animate-spin mb-4" />
              <span className="text-blue-800 font-semibold text-lg">{t.processing}</span>
              <span className="text-slate-500 text-sm mt-2">{t.wait}</span>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <UploadCloud size={32} className={isDragging ? 'text-blue-600' : 'text-slate-400'} />
              </div>
              <span className="text-slate-700 font-semibold text-lg mb-1">
                {t.clickToSelect}
              </span>
              <span className="text-slate-500 text-sm mb-4">{t.orDrag}</span>

              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs font-medium">PDF</span>
                <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs font-medium">PPTX</span>
              </div>

              {disabled && (
                <p className="mt-4 text-xs text-red-500 font-medium bg-red-50 py-1 px-3 rounded-full border border-red-100">
                  {t.keyError}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
