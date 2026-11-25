import React, { useState, useEffect } from 'react';
import { TemplateMetadata } from '../../shared/types';
import { Check, Camera, Sparkles, Filter } from 'lucide-react';

interface TemplateSelectorProps {
  templates: TemplateMetadata[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReady: () => void;
  onCancel: () => void;
}

export const TemplateSelectorScreen: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedId,
  onSelect,
  onReady,
  onCancel,
}) => {
  const [filterPose, setFilterPose] = useState<number | 'all'>('all');
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);

  // Auto return to idle if inactive for 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onCancel]);

  const filteredTemplates = templates.filter((t) => {
    if (filterPose === 'all') return true;
    return t.poseCount === filterPose;
  });

  const selectedTemplate = templates.find((t) => t.id === selectedId) || templates[0];

  return (
    <div className="relative w-full h-full bg-gray-950 flex flex-col p-8 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-pink-500" />
            Pilih Desain Kolase Foto
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Sentuh desain yang kamu suka, lalu tekan tombol Lanjut di bawah.
          </p>
        </div>

        {/* Filter Tabs & Auto Timeout Badge */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-900 p-1.5 rounded-2xl border border-gray-800">
            {(['all', 2, 3, 4] as const).map((count) => (
              <button
                key={count}
                onClick={() => setFilterPose(count)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filterPose === count
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {count === 'all' ? 'Semua (20)' : `${count} Pose`}
              </button>
            ))}
          </div>

          <div className="px-3.5 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs font-mono text-gray-400">
            Auto-reset: <span className="text-pink-400 font-bold">{timeoutSeconds}s</span>
          </div>
        </div>
      </div>

      {/* Main Grid & Preview Split */}
      <div className="flex-1 grid grid-cols-12 gap-8 py-6 overflow-hidden">
        {/* Template Catalog Grid (Left 8 cols) */}
        <div className="col-span-8 overflow-y-auto pr-2 grid grid-cols-4 gap-4 scrollbar-thin scrollbar-thumb-gray-800">
          {filteredTemplates.map((t) => {
            const isSelected = t.id === selectedId;
            return (
              <div
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`relative group rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-200 transform active:scale-95 ${
                  isSelected
                    ? 'border-pink-500 shadow-2xl shadow-pink-500/30 scale-[1.02]'
                    : 'border-gray-800 hover:border-gray-700 bg-gray-900'
                }`}
              >
                {/* Thumbnail Image */}
                <div className="aspect-[2/3] w-full bg-gray-900 flex items-center justify-center overflow-hidden">
                  <img
                    src={`/templates/${t.id}.png`}
                    alt={t.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                {/* Pose Badge */}
                <div className="absolute top-2 right-2 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-lg text-xs font-bold text-pink-400 border border-pink-500/30">
                  {t.poseCount} Poses
                </div>

                {/* Selected Checkmark Indicator */}
                {isSelected && (
                  <div className="absolute top-2 left-2 w-7 h-7 bg-pink-500 rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                  </div>
                )}

                {/* Bottom Label */}
                <div className="p-2.5 bg-gray-900/95 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-200 truncate">Template #{t.id}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Preview & Action Card (Right 4 cols) */}
        <div className="col-span-4 bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-pink-400 mb-2">
              Preview Terpilih
            </span>
            <h2 className="text-xl font-bold text-white mb-4">Template #{selectedTemplate?.id}</h2>

            {/* Large Preview */}
            <div className="w-56 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-pink-500/40 shadow-2xl bg-black">
              {selectedTemplate && (
                <img
                  src={`/templates/${selectedTemplate.id}.png`}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Info Badges */}
            <div className="flex gap-4 mt-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl text-sm font-semibold text-gray-300">
                <Camera className="w-4 h-4 text-pink-400" />
                <span>{selectedTemplate?.poseCount} Kali Foto</span>
              </div>
              <div className="px-4 py-2 bg-gray-800 rounded-xl text-sm font-semibold text-gray-300">
                2 Lembar Strip 2x6"
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-6 border-t border-gray-800">
            <button
              onClick={onReady}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl text-xl font-display font-extrabold text-white shadow-xl shadow-pink-500/25 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <span>SIAP FOTO</span>
              <span className="text-pink-200">➔</span>
            </button>

            <button
              onClick={onCancel}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl text-sm font-semibold transition-all"
            >
              Kembali ke Depan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
