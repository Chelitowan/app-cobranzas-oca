type P = { size?: number }

const base = (size = 22) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
})

export const IconPlus = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconBack = ({ size }: P) => (
  <svg {...base(size)}><path d="M15 6l-6 6 6 6" /></svg>
)
export const IconChevron = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 6l6 6-6 6" /></svg>
)
export const IconLogout = ({ size }: P) => (
  <svg {...base(size)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4M6 12h9" /></svg>
)
export const IconPen = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M13.5 6.5l3 3" /></svg>
)
export const IconHistory = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></svg>
)
export const IconMail = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 8l8 5.5L20 8" /></svg>
)
export const IconSearch = ({ size }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
)
export const IconCheck = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
export const IconCash = ({ size }: P) => (
  <svg {...base(size)}><rect x="2.5" y="6" width="19" height="12" rx="3" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></svg>
)
export const IconX = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
