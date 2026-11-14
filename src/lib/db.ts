/**
 * The Next.js frontend intentionally does not open a local SQLite database.
 * Persistent translation limits and shared report data are owned by the
 * selected Bun API backend. Keep this module empty to prevent new route
 * handlers from silently reintroducing frontend-host-local persistence.
 */
export {};
