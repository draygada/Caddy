// Vercel's static/Vite function discovery requires a concrete filesystem route.
// Keep policy, upstream selection, and response validation in the shared proxy.
export { default } from '../../[...path].js';
