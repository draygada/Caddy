import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({ width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...props });

export const Eye = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></svg>;
export const EyeOff = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M2 2l12 12M6.6 6.7A2 2 0 0 0 9.3 9.4M4.2 4.4C2.5 5.6 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.2 0 2.3-.4 3.2-.9M6.8 3.7A7 7 0 0 1 8 3.5c4 0 6.5 4.5 6.5 4.5s-.6 1.1-1.7 2.2" /></svg>;
export const Chevron = ({ open, ...p }: SVGProps<SVGSVGElement> & { open?: boolean }) => <svg {...base(p)} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .1s' }}><path d="M6 3l5 5-5 5" /></svg>;
export const Component = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 1.5l6 3.25v6.5L8 14.5l-6-3.25v-6.5L8 1.5Z" /><path d="M2 4.75L8 8l6-3.25M8 8v6.5" /></svg>;
export const Body = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="2.5" y="4.5" width="9" height="9" /><path d="M2.5 4.5l3-2h9v9l-3 2M11.5 4.5l3-2" /></svg>;
export const Folder = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M1.5 4.5v8.5h13V6H8L6.5 4.5h-5Z" /></svg>;
export const Feature = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 12.5h10M3 8.5h6M3 4.5h10" /></svg>;
export const Sketch = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M2.5 13.5L13.5 2.5M2.5 13.5l3-.6 8-8-2.4-2.4-8 8-.6 3Z" /></svg>;
export const Doc = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3.5 1.5h6l3 3v10h-9v-13Z" /><path d="M9.5 1.5v3h3" /></svg>;
export const Gear = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></svg>;
export const Home = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M2 8l6-5.5L14 8M3.5 6.8V14h9V6.8" /></svg>;
export const Orbit = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8c0 1.5 2.5 2.5 5.5 2.5s5.5-1 5.5-2.5" /><path d="M8 2.5c1.5 0 2.5 2.5 2.5 5.5S9.5 13.5 8 13.5" /></svg>;
export const Pan = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 1.5v13M1.5 8h13M8 1.5L6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" /></svg>;
export const Zoom = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14M5 7h4M7 5v4" /></svg>;
export const Fit = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /><rect x="5.5" y="5.5" width="5" height="5" /></svg>;
export const Display = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="1.5" y="2.5" width="13" height="9" rx="1" /><path d="M5.5 14h5M8 11.5V14" /></svg>;
export const Grid = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M2 2h12v12H2zM2 6h12M2 10h12M6 2v12M10 2v12" /></svg>;
export const Check = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 8.5l3 3 7-7" /></svg>;
