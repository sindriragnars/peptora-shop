// Custom stacks live in localStorage, so this route can't be
// enumerated at build time. Disable prerender + SSR — adapter-static
// serves the 200.html fallback shell which then loads data client-side.
export const prerender = false;
export const ssr = false;
