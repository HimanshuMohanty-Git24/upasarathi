// A handful of stroke icons (no icon dependency).
type P = { size?: number; className?: string };
const base = (size = 16) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconPlay = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" /></svg>);
export const IconPause = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M8 5v14M16 5v14" /></svg>);
export const IconArrow = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconBack = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const IconExternal = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const IconClose = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconKey = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></svg>);
export const IconSun = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IconMoon = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);
export const IconCheck = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12.5l4.5 4.5L19 7" /></svg>);
export const IconAlert = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></svg>);
export const IconReplay = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /></svg>);
