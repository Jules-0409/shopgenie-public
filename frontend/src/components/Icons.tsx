export const BrandMark = ({ s = 24 }: { s?: number }) => (
  <svg width={s} height={s * 0.74} viewBox="0 0 30 22" fill="currentColor">
    <path d="M25.4 2.4l.62 1.78 1.78.62-1.78.62-.62 1.78-.62-1.78-1.78-.62 1.78-.62z" opacity="0.9" />
    <path d="M11.4 7.1c.5-.15.5-1.05 0-1.2-.5.15-.5 1.05 0 1.2z" />
    <circle cx="11.4" cy="6.5" r="1.35" />
    <rect x="10.75" y="7.2" width="1.3" height="1.5" />
    <path d="M4 14.3C4 10.9 8 9 13 9c3.4 0 6.3 1 8 2.6l4.1-2.4c.62-.36 1.2.5.66 1l-3.2 2.9c.46.86.42 1.7.16 2.4-1.2 3-5.6 4-10 4-5.4 0-8.6-2.2-8.6-4.6z" />
    <path d="M3.9 13.4c-2.1-.3-2.45-2.9.45-3.45" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const XhsMark = ({ s = 12 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 200 200" style={{ borderRadius: 2, overflow: 'hidden' }}>
    <rect width="200" height="200" fill="#FF2442" />
    <text x="100" y="148" textAnchor="middle" fontSize="126" fontWeight="900" fill="white" fontFamily="sans-serif">小</text>
  </svg>
);

export const DyMark = ({ s = 12 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 200 200" style={{ borderRadius: 2, overflow: 'hidden' }}>
    <rect width="200" height="200" fill="#0D0D0D" />
    <path d="M128 58c0 0 14 4 22 16 0 0-12-2-22 10v68c0 22-18 36-38 36s-38-14-38-36 18-36 38-36c2 0 6 1 8 2v22c-2-1-5-2-8-2-9 0-16 7-16 14s7 14 16 14 16-7 16-14V38h22z" fill="white" />
  </svg>
);

export const AmazonMark = ({ s = 12 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 200 200" style={{ borderRadius: 2, overflow: 'hidden' }}>
    <rect width="200" height="200" fill="#131A22" />
    <text x="100" y="126" textAnchor="middle" fontSize="112" fontWeight="700" fill="white" fontFamily="Arial, sans-serif">a</text>
    <path d="M52 145c27 19 63 22 96 4" fill="none" stroke="#FF9900" strokeWidth="12" strokeLinecap="round" />
  </svg>
);

export const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCopy = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

export const IconEdit = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" />
  </svg>
);

export const IconRefresh = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </svg>
);

export const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" />
  </svg>
);

export const IconCamera = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const IconHeart = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
    <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.4 1-1.1a5.5 5.5 0 000-7.8z" />
  </svg>
);

export const IconStar = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
    <polygon points="12 2 15.1 8.6 22 9.3 17 14 18.2 21 12 17.6 5.8 21 7 14 2 9.3 8.9 8.6 12 2" />
  </svg>
);

export const IconComment = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
    <path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-4-.9L3 21l1.4-4a8.4 8.4 0 01-1-4 8.5 8.5 0 0117 0z" />
  </svg>
);

export const IconHistory = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const IconShare = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
