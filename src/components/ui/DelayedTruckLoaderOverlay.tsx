import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useDelayedLoadingState } from '../../utils/delayedLoader';
import {
  TABRIX_EASE,
  TABRIX_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

export const DelayedTruckLoaderOverlay: React.FC = () => {
  const { visible, label, subtitle } = useDelayedLoadingState();
  const reducedMotion = useTabrixReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="delayed-truck-loader-backdrop"
          data-testid="delayed-truck-loader"
          role="status"
          aria-live="polite"
          aria-label={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: TABRIX_EASE }}
          className="no-print fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 14 }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 10 }
            }
            transition={reducedMotion ? { duration: 0.18 } : TABRIX_SPRING}
            className="relative w-full max-w-[390px] overflow-hidden rounded-[26px] border p-6 text-center shadow-2xl"
            style={{
              background:
                'linear-gradient(155deg, rgba(20, 19, 17, 0.94) 0%, rgba(10, 10, 12, 0.96) 58%, rgba(18, 15, 10, 0.95) 100%)',
              borderColor: 'color-mix(in srgb, var(--accent, #D4AF37) 48%, rgba(255,255,255,0.12))',
              backdropFilter: 'blur(22px) saturate(160%)',
              WebkitBackdropFilter: 'blur(22px) saturate(160%)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 240, 190, 0.16), 0 28px 64px -18px rgba(0, 0, 0, 0.85), 0 0 38px -14px rgba(212, 175, 55, 0.34)',
            }}
          >
            {/* Subtle top gold rim aura */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full blur-2xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(238, 210, 120, 0.24) 0%, rgba(212, 175, 55, 0.06) 55%, transparent 78%)',
              }}
            />

            {/* Animated 2D Obsidian & Gold Truck + Parcel Stage */}
            <div className="relative mx-auto mb-4 h-36 w-full max-w-[320px] overflow-hidden rounded-2xl border border-[#D4AF37]/20 bg-[#080809]/80 px-3 pt-2 pb-1">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 85%, rgba(212, 175, 55, 0.14), transparent 68%)',
                }}
              />

              <svg
                viewBox="0 0 300 128"
                className="relative h-full w-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="obsidianTruckBody" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#26231D" />
                    <stop offset="52%" stopColor="#141312" />
                    <stop offset="100%" stopColor="#09090B" />
                  </linearGradient>
                  <linearGradient id="goldLuxuryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFF0B8" />
                    <stop offset="45%" stopColor="#EED278" />
                    <stop offset="100%" stopColor="#B88E1E" />
                  </linearGradient>
                  <linearGradient id="goldParcelFace" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBE7A1" />
                    <stop offset="60%" stopColor="#D4AF37" />
                    <stop offset="100%" stopColor="#9A7618" />
                  </linearGradient>
                  <linearGradient id="goldRoadBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(212,175,55,0)" />
                    <stop offset="50%" stopColor="rgba(238,210,120,0.85)" />
                    <stop offset="100%" stopColor="rgba(212,175,55,0)" />
                  </linearGradient>
                  <linearGradient id="headlightCone" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="rgba(238,210,120,0.38)" />
                    <stop offset="100%" stopColor="rgba(238,210,120,0)" />
                  </linearGradient>
                </defs>

                {/* Highway track line & moving lane markers */}
                <line
                  x1="14"
                  y1="108"
                  x2="286"
                  y2="108"
                  stroke="rgba(212, 175, 55, 0.28)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <g className={reducedMotion ? '' : 'truck-road-dashes'}>
                  <line
                    x1="10"
                    y1="115"
                    x2="310"
                    y2="115"
                    stroke="rgba(238, 210, 120, 0.45)"
                    strokeWidth="2"
                    strokeDasharray="16 14"
                    strokeLinecap="round"
                  />
                </g>

                {/* Subtle speed wind lines behind the truck */}
                <g className={reducedMotion ? 'opacity-40' : 'truck-wind-lines'}>
                  <line
                    x1="20"
                    y1="54"
                    x2="54"
                    y2="54"
                    stroke="rgba(238, 210, 120, 0.45)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="12"
                    y1="66"
                    x2="42"
                    y2="66"
                    stroke="rgba(212, 175, 55, 0.3)"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                  <line
                    x1="28"
                    y1="78"
                    x2="58"
                    y2="78"
                    stroke="rgba(238, 210, 120, 0.36)"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </g>

                {/* Main Truck Assembly (drives/bounces subtly on suspension) */}
                <g className={reducedMotion ? '' : 'truck-chassis-motion'}>
                  {/* Ground shadow under truck */}
                  <ellipse
                    cx="152"
                    cy="108"
                    rx="82"
                    ry="4.5"
                    fill="rgba(0, 0, 0, 0.72)"
                  />

                  {/* Headlight Golden Beam */}
                  <polygon
                    points="232,76 286,64 286,92 232,84"
                    fill="url(#headlightCone)"
                  />

                  {/* Cargo Container Box Frame */}
                  <rect
                    x="72"
                    y="38"
                    width="102"
                    height="56"
                    rx="9"
                    fill="url(#obsidianTruckBody)"
                    stroke="url(#goldLuxuryGrad)"
                    strokeWidth="2"
                  />

                  {/* Subtle Obsidian Interior Bay Backlight */}
                  <rect
                    x="79"
                    y="45"
                    width="88"
                    height="42"
                    rx="5"
                    fill="rgba(212, 175, 55, 0.05)"
                    stroke="rgba(212, 175, 55, 0.18)"
                    strokeWidth="1"
                  />

                  {/* Animated Golden Parcel / Shipment loading into cargo bay */}
                  <g className={reducedMotion ? '' : 'parcel-load-cycle'}>
                    {/* Parcel Box */}
                    <rect
                      x="105"
                      y="50"
                      width="34"
                      height="29"
                      rx="4.5"
                      fill="url(#goldParcelFace)"
                      stroke="#FFF4CC"
                      strokeWidth="1.2"
                    />
                    {/* Parcel Ribbon / Seal */}
                    <rect
                      x="119"
                      y="50"
                      width="6"
                      height="29"
                      fill="rgba(16, 14, 10, 0.65)"
                    />
                    <rect
                      x="105"
                      y="62"
                      width="34"
                      height="4"
                      fill="rgba(16, 14, 10, 0.4)"
                    />
                    {/* Top clasp gleam */}
                    <path
                      d="M116 50 L122 45 L128 50"
                      fill="none"
                      stroke="#FFF4CC"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>

                  {/* Cargo door vertical luxury accent stripes */}
                  <line
                    x1="86"
                    y1="52"
                    x2="86"
                    y2="82"
                    stroke="rgba(238, 210, 120, 0.3)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <line
                    x1="160"
                    y1="52"
                    x2="160"
                    y2="82"
                    stroke="rgba(238, 210, 120, 0.3)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />

                  {/* Chassis lower beam connecting cargo and cab */}
                  <rect
                    x="68"
                    y="90"
                    width="166"
                    height="7"
                    rx="3.5"
                    fill="#161411"
                    stroke="rgba(212, 175, 55, 0.45)"
                    strokeWidth="1.2"
                  />

                  {/* Truck Cab (front facing right) */}
                  <path
                    d="M177 48 H208 C215 48 220 52 223 58 L232 74 C234 77 235 81 235 85 V91 C235 93 233 95 230 95 H177 Z"
                    fill="url(#obsidianTruckBody)"
                    stroke="url(#goldLuxuryGrad)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />

                  {/* Cab Windshield */}
                  <path
                    d="M193 54 H207 C212 54 215 57 218 62 L223 72 H193 Z"
                    fill="#1D222B"
                    stroke="rgba(238, 210, 120, 0.55)"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  {/* Windshield reflection streak */}
                  <line
                    x1="199"
                    y1="57"
                    x2="206"
                    y2="69"
                    stroke="rgba(255, 244, 204, 0.35)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Cab Gold Trim & Door Handle */}
                  <rect
                    x="184"
                    y="78"
                    width="10"
                    height="2.5"
                    rx="1.25"
                    fill="url(#goldLuxuryGrad)"
                  />

                  {/* Headlight Jewel */}
                  <rect
                    x="228"
                    y="77"
                    width="7"
                    height="6"
                    rx="2"
                    fill="#FFF3C4"
                  />

                  {/* Rear Wheel */}
                  <g transform="translate(103 97)">
                    <g className={reducedMotion ? '' : 'truck-wheel-spin'}>
                      <circle cx="0" cy="0" r="12.5" fill="#0B0B0D" stroke="url(#goldLuxuryGrad)" strokeWidth="2.5" />
                      <circle cx="0" cy="0" r="5" fill="url(#goldLuxuryGrad)" />
                      <line x1="-8" y1="0" x2="8" y2="0" stroke="rgba(238, 210, 120, 0.55)" strokeWidth="1.4" />
                      <line x1="0" y1="-8" x2="0" y2="8" stroke="rgba(238, 210, 120, 0.55)" strokeWidth="1.4" />
                    </g>
                  </g>

                  {/* Front Wheel */}
                  <g transform="translate(205 97)">
                    <g className={reducedMotion ? '' : 'truck-wheel-spin'}>
                      <circle cx="0" cy="0" r="12.5" fill="#0B0B0D" stroke="url(#goldLuxuryGrad)" strokeWidth="2.5" />
                      <circle cx="0" cy="0" r="5" fill="url(#goldLuxuryGrad)" />
                      <line x1="-8" y1="0" x2="8" y2="0" stroke="rgba(238, 210, 120, 0.55)" strokeWidth="1.4" />
                      <line x1="0" y1="-8" x2="0" y2="8" stroke="rgba(238, 210, 120, 0.55)" strokeWidth="1.4" />
                    </g>
                  </g>
                </g>
              </svg>
            </div>

            {/* Golden Shimmer Progress Bar */}
            <div className="mx-auto mb-3.5 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-[#D4AF37]/15">
              <div
                className={`h-full rounded-full ${
                  reducedMotion ? 'w-2/3' : 'truck-progress-shimmer w-1/2'
                }`}
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, #D4AF37 35%, #FFF1BA 55%, #D4AF37 75%, transparent 100%)',
                }}
              />
            </div>

            <h3 className="font-display-ar text-sm font-black tracking-tight text-[#F6EFE0]">
              {label}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#A79E8D]">
              {subtitle}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
