import React from 'react';
import { motion } from 'motion/react';
import {
  FileSpreadsheet,
  FolderTree,
  Image as ImageIcon,
  MapPin,
  Share2,
  StickyNote,
  Users,
  Archive,
} from 'lucide-react';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../utils/tabrixMotion';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
import { Tabrix3DTiltSurface } from './ui/TabrixMotionPrimitives';

interface StructuredExportModalProps {
  open: boolean;
  onClose: () => void;
  personsCount: number;
  relationsCount: number;
  agenciesCount: number;
  notesCount: number;
  attachmentsCount: number;
  busy: boolean;
  onDirectShare: () => void;
  onStructuredZipExport: () => void;
}

export const StructuredExportModal: React.FC<StructuredExportModalProps> = ({
  open,
  onClose,
  personsCount,
  relationsCount,
  agenciesCount,
  notesCount,
  attachmentsCount,
  busy,
  onDirectShare,
  onStructuredZipExport,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const dateStamp = new Date().toISOString().slice(0, 10);

  const folders = [
    {
      name: 'الأسماء',
      detail: `${personsCount} مستفيد و${agenciesCount} وكالة (CSV)`,
      icon: Users,
    },
    {
      name: 'العناوين',
      detail: `${relationsCount} سجل عناوين وتوصيل (CSV + JSON)`,
      icon: MapPin,
    },
    {
      name: 'ملفات الإكسل والجداول',
      detail: `السجل الشامل + كشوفات الوكالات + المالية (XLSX)`,
      icon: FileSpreadsheet,
    },
    {
      name: 'الصور والمرفقات',
      detail: `${attachmentsCount} صورة ومرفق محفوظ`,
      icon: ImageIcon,
    },
    {
      name: 'الملاحظات والأفكار',
      detail: `${notesCount} ملاحظة وفكرة منظمة`,
      icon: StickyNote,
    },
  ];

  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      title="تصدير بياناتك"
      subtitle="اختر طريقة التصدير أو المشاركة الأنسب لاحتياجاتك"
      icon={
        <NexusDuotoneIcon tone="gold" sizeClass="h-9 w-9">
          <FolderTree className="h-4 w-4" />
        </NexusDuotoneIcon>
      }
      maxWidthClass="max-w-3xl"
      ariaLabel="خيارات تصدير البيانات"
    >
      <div className="space-y-5">
        {/* Two Clear Action Paths */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Path 1: Direct Share */}
          <Tabrix3DTiltSurface as="section" maxTiltX={4.8} maxTiltY={6} className="p-5 flex flex-col justify-between gap-4">
            <div className="relative z-[1] space-y-3">
              <div className="flex items-center gap-3">
                <NexusDuotoneIcon tone="ai" size="md">
                  <Share2 className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h3 className="text-sm font-black">مشاركة مباشرة</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Direct Share
                  </p>
                </div>
              </div>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                جهّز التقرير والحزمة المضغوطة وأرسلها مباشرة عبر تطبيقات المشاركة
                على جهازك (واتساب، تيليجرام، تطبيقات السحابة، أو البريد).
              </p>
            </div>

            <motion.button
              type="button"
              disabled={busy}
              whileHover={reducedMotion || busy ? undefined : { y: -1.5, scale: 1.015 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.97 }}
              transition={TABRIX_TACTILE_SPRING}
              onClick={onDirectShare}
              className="relative z-[1] nexus-pill-btn inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold disabled:opacity-50"
              style={{
                background:
                  'linear-gradient(135deg, var(--accent-ai, #5B4FE9) 0%, #4338CA 100%)',
                color: '#FFFFFF',
              }}
            >
              <Share2 className="h-4 w-4" />
              <span>مشاركة الحزمة الآن</span>
            </motion.button>
          </Tabrix3DTiltSurface>

          {/* Path 2: Structured Folder Export */}
          <Tabrix3DTiltSurface
            as="section"
            maxTiltX={4.8}
            maxTiltY={6}
            className="p-5 flex flex-col justify-between gap-4"
            style={{
              borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border-color))',
            }}
          >
            <div className="relative z-[1] space-y-3">
              <div className="flex items-center gap-3">
                <NexusDuotoneIcon tone="gold" size="md">
                  <Archive className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h3 className="text-sm font-black">تصدير كملف منظّم ومفصل</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Structured Export (ZIP)
                  </p>
                </div>
              </div>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                ينشئ مجلداً رئيسياً منسقاً باسم التطبيق وتاريخ اليوم ويفرز داخله كل
                فئة في مجلد مستقل بأسماء واضحة ومفهومة مع ضغط آمن.
              </p>
            </div>

            <motion.button
              type="button"
              disabled={busy}
              whileHover={reducedMotion || busy ? undefined : { y: -1.5, scale: 1.015 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.97 }}
              transition={TABRIX_TACTILE_SPRING}
              onClick={onStructuredZipExport}
              className="relative z-[1] nexus-pill-btn inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <FolderTree className="h-4 w-4" />
              <span>إنشاء وتنزيل المجلد المنظّم</span>
            </motion.button>
          </Tabrix3DTiltSurface>
        </div>

        {/* Folder Tree Preview */}
        <section className="nexus-squircle p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black">
              الهيكلية التنظيمية للمجلد المصدّر
            </div>
            <span
              dir="ltr"
              className="text-[11px] font-bold"
              style={{ color: 'var(--accent)' }}
            >
              Morrow_بيانات_{dateStamp}.zip
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((f) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.name}
                  whileHover={reducedMotion ? undefined : { y: -2, scale: 1.015 }}
                  transition={TABRIX_TACTILE_SPRING}
                  className="flex items-start gap-2.5 rounded-2xl border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold">{f.name}</div>
                    <div
                      className="mt-0.5 text-[11px] leading-snug"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {f.detail}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>
    </FullScreenPushPage>
  );
};
