export const STYLES = `
:root {
  --bg-primary: #0b0f19;
  --bg-secondary: #131a2b;
  --bg-card: rgba(22, 30, 49, 0.75);
  --bg-card-hover: rgba(30, 41, 67, 0.85);
  --border-color: rgba(255, 255, 255, 0.1);
  --border-glow: rgba(99, 102, 241, 0.4);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent-primary: #6366f1;
  --accent-hover: #4f46e5;
  --accent-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
  --success-color: #10b981;
  --success-bg: rgba(16, 185, 129, 0.15);
  --warning-color: #f59e0b;
  --warning-bg: rgba(245, 158, 11, 0.15);
  --danger-color: #ef4444;
  --danger-bg: rgba(239, 68, 68, 0.15);
  --info-color: #38bdf8;
  --info-bg: rgba(56, 189, 248, 0.15);
  --font-main: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-full: 9999px;
  --shadow-sm: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
  --shadow-glow: 0 0 30px rgba(99, 102, 241, 0.25);
  --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
[data-theme="light"] {
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-card: rgba(255, 255, 255, 0.85);
  --bg-card-hover: rgba(255, 255, 255, 0.95);
  --border-color: rgba(15, 23, 42, 0.12);
  --border-glow: rgba(99, 102, 241, 0.3);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --shadow-sm: 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 15px 25px -5px rgba(0, 0, 0, 0.1);
  --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.15);
}
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: var(--font-main);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  transition: background-color 0.3s ease, color 0.3s ease;
}
/* Background Animated Glows */
.bg-glow-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.bg-glow-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.18;
  animation: floatGlow 20s infinite alternate ease-in-out;
}
.bg-glow-1 {
  top: -10%;
  left: 15%;
  width: 500px;
  height: 500px;
  background: #6366f1;
}
.bg-glow-2 {
  bottom: 10%;
  right: 10%;
  width: 600px;
  height: 600px;
  background: #ec4899;
  animation-delay: -7s;
}
.bg-glow-3 {
  top: 40%;
  right: 35%;
  width: 400px;
  height: 400px;
  background: #38bdf8;
  animation-delay: -14s;
}
@keyframes floatGlow {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, -30px) scale(1.1); }
  100% { transform: translate(-20px, 40px) scale(0.95); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
/* App Header & Navigation */
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(11, 15, 25, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border-color);
  padding: 0.8rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: var(--transition);
}
[data-theme="light"] .app-header {
  background: rgba(248, 250, 252, 0.85);
}
.logo-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  text-decoration: none;
}
.logo-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--accent-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.25rem;
  color: #fff;
  box-shadow: var(--shadow-glow);
}
.logo-text {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}
.logo-badge {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  transition: var(--transition);
  cursor: pointer;
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-sm);
}
.nav-link:hover, .nav-link.active {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
/* Button Component Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  font-family: var(--font-main);
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
  white-space: nowrap;
}
.btn-sm {
  padding: 0.4rem 0.85rem;
  font-size: 0.82rem;
  border-radius: var(--radius-sm);
}
.btn-primary {
  background: var(--accent-gradient);
  color: #ffffff;
  box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.35);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px 0 rgba(99, 102, 241, 0.5);
}
.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}
.btn-danger {
  background: var(--danger-bg);
  color: var(--danger-color);
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.btn-danger:hover {
  background: var(--danger-color);
  color: #fff;
}
.btn-icon {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
}
.btn-icon:hover {
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
}
/* Main Container Layout */
.main-content {
  flex: 1;
  position: relative;
  z-index: 10;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 2.5rem 2rem;
}
/* Landing Page Hero */
.hero-section {
  text-align: center;
  padding: 4rem 1rem 5rem;
  max-width: 860px;
  margin: 0 auto;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-full);
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #818cf8;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  animation: pulseBadge 2.5s infinite;
}
@keyframes pulseBadge {
  0%, 100% { border-color: rgba(99, 102, 241, 0.3); }
  50% { border-color: rgba(99, 102, 241, 0.7); }
}
.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin-bottom: 1.25rem;
}
.gradient-text {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline;
}
.hero-subtitle {
  font-size: 1.2rem;
  color: var(--text-secondary);
  max-width: 680px;
  margin: 0 auto 2.5rem;
}
.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 4rem;
}
/* Feature Grid Cards */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}
.feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.8rem;
  transition: var(--transition);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(12px);
}
.feature-card:hover {
  transform: translateY(-5px);
  border-color: var(--border-glow);
  background: var(--bg-card-hover);
  box-shadow: var(--shadow-glow);
}
.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}
.feature-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}
.feature-description {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
/* Cards & Dashboard Layout */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.section-title-group h2 {
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 0.3rem;
}
.section-title-group p {
  color: var(--text-secondary);
  font-size: 0.95rem;
}
.search-input-wrapper {
  position: relative;
  min-width: 280px;
}
.search-input-wrapper input {
  width: 100%;
  padding: 0.65rem 1rem 0.65rem 2.4rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-main);
  font-size: 0.9rem;
  transition: var(--transition);
}
.search-input-wrapper input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}
.search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
/* Apps Grid */
.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}
.app-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 2rem 1.8rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.4rem;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  position: relative;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
.app-card:hover {
  transform: translateY(-4px) scale(1.01);
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}
.app-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.app-card-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  word-break: break-all;
}
.app-card-slug {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.1);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  display: inline-block;
}
.app-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.badge-shopify {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.badge-disabled {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}
.badge-turnstile {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}
.app-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.app-card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
/* Empty States */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--bg-card);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
  max-width: 600px;
  margin: 3rem auto;
}
.empty-state-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--text-muted);
}
.empty-state h3 {
  font-size: 1.4rem;
  margin-bottom: 0.5rem;
}
.empty-state p {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}
/* Modals & Dialogs */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 8, 15, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.modal-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  transform: scale(0.95);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.modal-overlay.open .modal-container {
  transform: scale(1);
}
.modal-header {
  padding: 1.25rem 1.75rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}
.modal-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
  transition: var(--transition);
}
.modal-close:hover {
  color: var(--text-primary);
}
.modal-body {
  padding: 1.75rem;
  overflow-y: auto;
  flex: 1;
}
.modal-footer {
  padding: 1.25rem 1.75rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.15);
}
/* Tabs */
.tabs-header {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 1.5rem;
  gap: 0.5rem;
  overflow-x: auto;
}
.tab-btn {
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-main);
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}
.tab-btn:hover {
  color: var(--text-primary);
}
.tab-btn.active {
  color: #818cf8;
  border-bottom-color: #6366f1;
}
/* Forms & Inputs */
.form-group {
  margin-bottom: 1.25rem;
}
.form-label {
  display: block;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.45rem;
}
.form-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.35rem;
}
.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: rgba(11, 15, 25, 0.6);
  color: var(--text-primary);
  font-family: var(--font-main);
  font-size: 0.95rem;
  transition: var(--transition);
}
[data-theme="light"] .form-input,
[data-theme="light"] .form-select,
[data-theme="light"] .form-textarea {
  background: #ffffff;
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}
.form-checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
}
.form-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-primary);
  cursor: pointer;
}
/* Fields Schema Builder - Modern Card UI */
.field-card-item {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  position: relative;
}
.field-card-item:hover {
  border-color: rgba(129, 140, 248, 0.4);
  background: rgba(255, 255, 255, 0.035);
}
.field-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-wrap: wrap;
  gap: 0.75rem;
}
.field-type-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 9999px;
  background: rgba(129, 140, 248, 0.18);
  color: #a5b4fc;
  border: 1px solid rgba(129, 140, 248, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.field-card-grid-top {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.3fr 1fr;
  gap: 1rem;
  align-items: flex-end;
}
.field-card-grid-middle {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1.5fr;
  gap: 1rem;
  align-items: flex-end;
  padding-top: 0.25rem;
}
.field-card-grid-advanced {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 1.2fr;
  gap: 1rem;
  align-items: flex-end;
  padding: 0.85rem 1rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: var(--radius-md);
  border: 1px dashed rgba(255, 255, 255, 0.12);
}
.field-card-options-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: rgba(129, 140, 248, 0.06);
  border-radius: var(--radius-md);
  border: 1px solid rgba(129, 140, 248, 0.15);
}
@media (max-width: 900px) {
  .field-card-grid-top,
  .field-card-grid-middle,
  .field-card-grid-advanced {
    grid-template-columns: 1fr;
  }
}
/* Code Snippets Block */
.code-box {
  position: relative;
  background: #070a12;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: #e2e8f0;
  overflow-x: auto;
  margin-top: 0.75rem;
}
[data-theme="light"] .code-box {
  background: #1e293b;
  color: #f8fafc;
}
.copy-btn {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  border-radius: var(--radius-sm);
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-family: var(--font-main);
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}
.copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
/* Data Table (Submissions) */
.table-container {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow-x: auto;
  background: var(--bg-card);
  backdrop-filter: blur(12px);
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.data-table th {
  padding: 1rem 1.25rem;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.data-table td {
  padding: 1rem 1.25rem;
  font-size: 0.92rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}
.data-table tr:last-child td {
  border-bottom: none;
}
.data-table tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}
/* Status Badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.status-synced {
  background: var(--success-bg);
  color: var(--success-color);
}
.status-pending {
  background: var(--warning-bg);
  color: var(--warning-color);
}
.status-failed {
  background: var(--danger-bg);
  color: var(--danger-color);
  cursor: pointer;
}
.status-skipped {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}
/* Toast Notifications */
.toast-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
}
.toast {
  padding: 1rem 1.5rem;
  border-radius: var(--radius-md);
  background: #1e293b;
  color: #f8fafc;
  pointer-events: auto;
  font-weight: 500;
  font-size: 0.92rem;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  animation: slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  min-width: 280px;
}
.toast.success { border-left: 4px solid var(--success-color); }
.toast.error { border-left: 4px solid var(--danger-color); }
.toast.info { border-left: 4px solid var(--info-color); }
@keyframes slideInToast {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
/* Guide Card Banner */
.guide-banner {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.guide-banner-text h4 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #818cf8;
  margin-bottom: 0.25rem;
}
.guide-banner-text p {
  font-size: 0.88rem;
  color: var(--text-secondary);
}
@media (max-width: 768px) {
  .field-row {
    grid-template-columns: 1fr;
  }
  .app-header {
    padding: 0.8rem 1rem;
  }
  .main-content {
    padding: 1.5rem 1rem;
  }
}
/* ── API Keys Section ───────────────────────────────────────────────────── */
.apikey-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
  flex-wrap: wrap;
}
.apikey-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.apikey-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.9rem 1.1rem;
  transition: border-color 0.2s;
  flex-wrap: wrap;
}
.apikey-card:hover {
  border-color: rgba(129, 140, 248, 0.4);
}
.apikey-card.revoked {
  opacity: 0.5;
}
.apikey-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}
.apikey-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.apikey-hint {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--accent-color);
  letter-spacing: 0.04em;
}
.apikey-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.apikey-permissions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  align-items: center;
}
.perm-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.perm-badge-read {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
}
.perm-badge-submit {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.3);
}
.perm-badge-revoked {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}
.perm-badge-scope {
  background: rgba(167, 139, 250, 0.12);
  color: #a78bfa;
  border: 1px solid rgba(167, 139, 250, 0.3);
}
/* New-key reveal box */
.apikey-reveal-box {
  background: rgba(129, 140, 248, 0.06);
  border: 1px solid rgba(129, 140, 248, 0.3);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  margin-top: 1rem;
}
.apikey-reveal-label {
  font-size: 0.78rem;
  color: var(--accent-color);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}
.apikey-reveal-value {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: #e2e8f0;
  word-break: break-all;
  line-height: 1.6;
  background: rgba(0,0,0,0.3);
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  margin-bottom: 0.75rem;
}
.apikey-reveal-warning {
  font-size: 0.78rem;
  color: #fbbf24;
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
}
`;
