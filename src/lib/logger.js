function ts() {
  return new Date().toISOString();
}

// Deliberately dumb: no secrets are ever passed to this logger anywhere in
// the codebase (we only log error messages / stack traces / string codes).
export const logger = {
  info: (...args) => console.log(`[${ts()}]`, ...args),
  warn: (...args) => console.warn(`[${ts()}]`, ...args),
  error: (...args) => console.error(`[${ts()}]`, ...args),
};
