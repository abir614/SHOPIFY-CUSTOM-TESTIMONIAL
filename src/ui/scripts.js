export const SCRIPTS = `
// FormHub Node.js Frontend SPA Application
let state = {
 token: localStorage.getItem('fh_token') || null,
 user: JSON.parse(localStorage.getItem('fh_user') || 'null'),
 apps: [],
 currentView: 'home',
 editingApp: null,
 activeTab: 'fields',
 selectedAppForSubmissions: null,
 submissions: [],
 testApp: null,
 hubApp: null
};

// ── Cloudflare Turnstile Platform CAPTCHA ──────────────────────────────
const _tsTokens = { login: null, register: null, createApp: null };
function onLoginTurnstileSuccess(token) { _tsTokens.login = token; }
function onLoginTurnstileExpired() { _tsTokens.login = null; }
function onRegisterTurnstileSuccess(token) { _tsTokens.register = token; }
function onRegisterTurnstileExpired() { _tsTokens.register = null; }
function onCreateAppTurnstileSuccess(token) { _tsTokens.createApp = token; }
function onCreateAppTurnstileExpired() { _tsTokens.createApp = null; }
function resetTurnstile(id) {
 if (typeof turnstile !== 'undefined') {
  try { turnstile.reset(document.getElementById(id)); } catch(e) {}
 } else { _tsTokens[id === 'login-turnstile' ? 'login' : id === 'register-turnstile' ? 'register' : 'createApp'] = null; }
}

// DOM Content Loaded - Init Application
document.addEventListener('DOMContentLoaded', async () => {
 initTheme();
 setupNavigation();
 setupModalEvents();
 await verifySession();
 handleRoute();
 window.addEventListener('hashchange', handleRoute);
});

function initTheme() {
 const theme = localStorage.getItem('fh_theme') || 'dark';
 document.documentElement.setAttribute('data-theme', theme);
 updateThemeIcon(theme);
}

function toggleTheme() {
 const current = document.documentElement.getAttribute('data-theme') || 'dark';
 const next = current === 'dark' ? 'light' : 'dark';
 document.documentElement.setAttribute('data-theme', next);
 localStorage.setItem('fh_theme', next);
 updateThemeIcon(next);
}

function updateThemeIcon(theme) {
 const btn = document.getElementById('theme-toggle-btn');
 if (btn) {
  btn.innerHTML = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
 }
}

function showToast(message, type = 'info') {
 const container = document.getElementById('toast-container');
 if (!container) return;
 const toast = document.createElement('div');
 toast.className = 'toast ' + type;
 toast.innerHTML = '<span>' + (type === 'success' ? '' : type === 'error' ? '' : '') + '</span><span>' + escapeHtml(message) + '</span>';
 document.getElementById('toast-container').appendChild(toast);
 
 
 setTimeout(() => {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  toast.style.transition = 'all 0.3s ease';
  setTimeout(() => toast.remove(), 300);
 }, 4000);
}

function escapeHtml(str) {
 if (!str) return '';
 return String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&039;');
}

async function verifySession() {
 if (!state.token) {
  updateAuthUI();
  return;
 }
 try {
  const res = await fetch('/api/me', {
   headers: { 'Authorization': 'Bearer ' + state.token }
  });
  const data = await res.json();
  if (data.ok && data.user) {
   state.user = data.user;
   localStorage.setItem('fh_user', JSON.stringify(data.user));
  } else {
   logout(false);
  }
 } catch (e) {
  console.error('Session verify error:', e);
 }
 updateAuthUI();
}

function updateAuthUI() {
 const navAuth = document.getElementById('nav-auth-actions');
 const navLinks = document.getElementById('nav-links');
 if (!navAuth || !navLinks) return;

 if (state.user && state.token) {
  navLinks.innerHTML = \`
   <a class="nav-link" href="#home">Home</a>
   <a class="nav-link" href="#dashboard">My Apps</a>
   <a class="nav-link" href="#guide">Shopify Metaobjects</a>
  \`;
  navAuth.innerHTML = \`
   <div style="display:flex; align-items:center; gap: 1rem;">
    <span style="font-size: 0.88rem; color: var(--text-secondary);">\${escapeHtml(state.user.username)}</span>
    <button class="btn btn-secondary btn-sm" onclick="logout()">Sign Out</button>
    <button class="btn btn-secondary btn-sm" style="display:flex; align-items:center;" id="theme-toggle-btn" onclick="toggleTheme()" title="Toggle Theme">🌙 Dark</button>
   </div>
  \`;
 } else {
  navLinks.innerHTML = \`
   <a class="nav-link" href="#home">Home</a>
   <a class="nav-link" href="#guide">Shopify Metaobjects</a>
  \`;
  navAuth.innerHTML = \`
   <button class="btn btn-secondary btn-sm" onclick="openLoginModal()">Sign In</button>
   <button class="btn btn-primary btn-sm" onclick="openRegisterModal()">Get Started</button>
   <button class="btn btn-secondary btn-sm" style="display:flex; align-items:center;" id="theme-toggle-btn" onclick="toggleTheme()" title="Toggle Theme">🌙 Dark</button>
  \`;
 }
 const theme = document.documentElement.getAttribute('data-theme') || 'dark';
 updateThemeIcon(theme);
}

function logout(notify = true) {
 state.token = null;
 state.user = null;
 localStorage.removeItem('fh_token');
 localStorage.removeItem('fh_user');
 updateAuthUI();
 if (notify) showToast('Logged out successfully.', 'success');
 window.location.hash = '#home';
}

function handleRoute() {
 const hash = window.location.hash || '#home';
 const links = document.querySelectorAll('.nav-link');
 links.forEach(l => {
  l.classList.toggle('active', l.getAttribute('href') === hash);
 });

 const main = document.getElementById('main-view');
 if (!main) return;

 if (hash === '#dashboard') {
  if (!state.token) {
   showToast('Please sign in to access your dashboard.', 'error');
   openLoginModal();
   window.location.hash = '#home';
   return;
  }
  renderDashboardView(main);
 } else if (hash === '#guide') {
  renderGuideView(main);
 } else {
  renderHomeView(main);
 }
}

function setupNavigation() {
 document.querySelectorAll('.logo-group').forEach(el => {
  el.addEventListener('click', () => window.location.hash = '#home');
 });
}

// --- Home Landing Page View ---
function renderHomeView(container) {
 container.innerHTML = \`
  <section class="hero-section">
   <div class="hero-badge">Node.js Backend + MongoDB Atlas Source of Truth</div>
   <h1 class="hero-title">Multi-Tenant Form Intake on <span class="gradient-text">Node.js</span></h1>
   <p class="hero-subtitle">
    Create custom form schemas, collect secure multi-part submissions, and sync data instantly as Shopify Metaobjects—all powered by a fast Node.js server.
   </p>
   <div class="hero-actions">
    \${state.token ? \`
     <a class="btn btn-primary" href="#dashboard">Go to My Apps Dashboard →</a>
    \` : \`
     <button class="btn btn-primary" onclick="openRegisterModal()">Create Free Account →</button>
     <button class="btn btn-secondary" onclick="openLoginModal()">Sign In to Dashboard</button>
    \`}
   </div>

   <div class="features-grid">
    <div class="feature-card">
     <h3 class="feature-title">Zero-Latency Edge Routing</h3>
     <p class="feature-description">
      Your form endpoints live at <code style="color:#818cf8">/api/:username/:appname/</code> with built-in CORS, IP rate limiting, Turnstile verification, and honeypot protection.
     </p>
    </div>
    <div class="feature-card">
     <h3 class="feature-title">MongoDB Source of Truth</h3>
     <p class="feature-description">
      Every submission is permanently stored in MongoDB first. Never lose a single submission, even if upstream store APIs are temporarily offline.
     </p>
    </div>
    <div class="feature-card">
     <h3 class="feature-title">Shopify Metaobject Sync</h3>
     <p class="feature-description">
      Automatically sync submissions as Shopify Metaobjects in your store. Images are staged, uploaded to Shopify Files, and attached to your metaobject.
     </p>
    </div>
    <div class="feature-card">
     <h3 class="feature-title">EXIF Stripping & File Vault</h3>
     <p class="feature-description">
      Uploaded images are magic-byte sniffed for safety and JPEGs have GPS/metadata EXIF stripped before storage in R2 or Shopify Files.
     </p>
    </div>
   </div>
  </section>
 \`;
 
}

// --- Shopify Metaobjects Guide View ---
function renderGuideView(container) {
 container.innerHTML = \`
  <div style="max-width: 900px; margin: 0 auto; padding: 1rem 0;">
   <div class="guide-banner">
    <div class="guide-banner-text">
     <h4>Shopify Metaobject Integration Guide</h4>
     <p>Learn how to connect your FormHub forms to Shopify Admin API and sync submissions as Metaobjects.</p>
    </div>
    <button class="btn btn-primary btn-sm" onclick="window.location.hash = '#dashboard'">Configure Apps</button>
   </div>

   <div class="app-card" style="margin-bottom: 1.5rem;">
    <h2 style="font-size: 1.4rem; margin-bottom: 0.75rem;">1. Define Your Metaobject Definition in Shopify</h2>
    <p style="color: var(--text-secondary); margin-bottom: 1rem;">
     In your Shopify Admin, go to <strong>Settings → Custom data → Metaobjects</strong> and click <strong>Add definition</strong>. For example:
    </p>
    <ul style="color: var(--text-secondary); margin-left: 1.5rem; line-height: 1.8;">
     <li><strong>Name:</strong> Story Intake</li>
     <li><strong>Type (Handle):</strong> <code style="color:#818cf8">story_intake</code></li>
     <li><strong>Fields:</strong> Add fields matching your form keys (e.g. <code style="color:#818cf8">name</code>, <code style="color:#818cf8">email</code>, <code style="color:#818cf8">hospital</code>, <code style="color:#818cf8">experience_story</code>, and <code style="color:#818cf8">user_image</code> as a File reference).</li>
    </ul>
   </div>

   <div class="app-card" style="margin-bottom: 1.5rem;">
    <h2 style="font-size: 1.4rem; margin-bottom: 0.75rem;">2. Create a Custom App & Generate Admin Token</h2>
    <p style="color: var(--text-secondary); margin-bottom: 1rem;">
     In Shopify Admin, go to <strong>Settings → Apps and sales channels → Develop apps</strong> and create an app:
    </p>
    <ul style="color: var(--text-secondary); margin-left: 1.5rem; line-height: 1.8;">
     <li>Enable Admin API scopes: <code>read_metaobjects</code>, <code>write_metaobjects</code>, <code>read_files</code>, <code>write_files</code>.</li>
     <li>Install the app and copy your <strong>Admin API access token</strong> (<code style="color:#818cf8">shpat_...</code>).</li>
    </ul>
   </div>

   <div class="app-card">
    <h2 style="font-size: 1.4rem; margin-bottom: 0.75rem;">3. Connect in FormHub App Settings</h2>
    <p style="color: var(--text-secondary); margin-bottom: 1rem;">
     In your FormHub Dashboard, open <strong>Manage App → Tab 2: Shopify Metaobject Sync</strong> and paste your Store Domain, Admin Token, Metaobject Type handle, and map your form field keys!
    </p>
   </div>
  </div>
 \`;
 
}

// --- Dashboard View (My Apps) ---
async function renderDashboardView(container) {
 container.innerHTML = \`
  <div class="section-header">
   <div class="section-title-group">
    <h2>My Form Applications</h2>
    <p>Manage your form field schemas, Shopify metaobject syncs, and collect public submissions.</p>
   </div>
   <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
    <div class="search-input-wrapper">
     <span class="search-icon"></span>
     <input type="text" id="app-search-input" placeholder="Search apps by name..." oninput="filterAppsList(this.value)" />
    </div>
    <button class="btn btn-primary" onclick="openCreateAppModal()">Create New Form App</button>
   </div>
  </div>
  <div id="apps-grid-container" class="apps-grid">
   <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
    Loading your form applications...
   </div>
  </div>

  <!-- API Keys Section -->
  <div style="margin-top: 3rem; max-width: 860px;">
   <div class="apikey-section-header">
    <div>
     <h2 style="font-size:1.35rem; margin:0;">API Keys</h2>
     <p style="margin:0.25rem 0 0; color:var(--text-secondary); font-size:0.9rem;">Create programmatic access keys. Requests go to <code style="color:#818cf8">/api/{API_KEY}/apps</code> and <code style="color:#818cf8">/api/{API_KEY}/apps/{app}/submissions</code>.</p>
    </div>
    <button class="btn btn-primary" onclick="openCreateApiKeyModal()">
     <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.3rem"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
     New API Key
    </button>
   </div>
   <div id="apikeys-list-container">
    <div style="text-align:center; padding:2rem; color:var(--text-muted);">Loading API keys...</div>
   </div>
  </div>
 \`;
 
 await loadApps();
 await loadApiKeys();
}

async function loadApps() {
 const container = document.getElementById('apps-grid-container');
 if (!container) return;
 try {
  const res = await fetch('/api/apps', {
   headers: { 'Authorization': 'Bearer ' + state.token }
  });
  const data = await res.json();
  if (!data.ok) {
   showToast(data.error || 'Failed to load apps.', 'error');
   return;
  }
  state.apps = data.apps || [];
  renderAppsGrid(state.apps);
 } catch (e) {
  showToast('Network error loading apps.', 'error');
 }
}

function filterAppsList(query) {
 const q = (query || '').toLowerCase().trim();
 const filtered = state.apps.filter(a => a.appName.toLowerCase().includes(q));
 renderAppsGrid(filtered);
}

function renderAppsGrid(appsList) {
 const container = document.getElementById('apps-grid-container');
 if (!container) return;
 if (!appsList || appsList.length === 0) {
  container.innerHTML = \`
   <div class="empty-state" style="grid-column: 1 / -1;">
    <div class="empty-state-icon"></div>
    <h3>No Form Applications Yet</h3>
    <p>Create your first multi-tenant form schema to get your public submission endpoint and start collecting data.</p>
    <button class="btn btn-primary" onclick="openCreateAppModal()">Create Your First App</button>
   </div>
  \`;
  return;
 }

 container.innerHTML = appsList.map(app => {
  const shopifyConfigured = app.settings?.shopify?.enabled;
  const turnstileConfigured = app.settings?.turnstile?.enabled;
  const fieldsCount = Array.isArray(app.fields) ? app.fields.length : 0;
  const originCount = Array.isArray(app.settings?.allowedOrigins) ? app.settings.allowedOrigins.length : 0;
  const fullSubmitPath = '/' + encodeURIComponent(state.user.username) + '/' + encodeURIComponent(app.appName) + '/';

  return \`
   <div class="app-card">
    <div>
     <div class="app-card-header">
      <div>
       <h3 class="app-card-title">\${escapeHtml(app.appName)}</h3>
       <span class="app-card-slug">\${escapeHtml(fullSubmitPath)}</span>
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteApp('\${escapeHtml(app.appName)}')" title="Delete App" style="display:flex;align-items:center;gap:0.3rem;flex-shrink:0;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg> Delete</button>
     </div>
     <div class="app-card-meta" style="margin-top: 1rem;">
      <span class="badge" style="background: rgba(99,102,241,0.15); color:#818cf8;">\${fieldsCount} Fields</span>
      \${shopifyConfigured ? \`
       <span class="badge badge-shopify" title="Metaobject Type: \${escapeHtml(app.settings.shopify.metaobjectType)}">Shopify Sync ON</span>
      \` : \`
       <span class="badge badge-disabled">Shopify OFF</span>
      \`}
      \${turnstileConfigured ? \`
       <span class="badge badge-turnstile">Turnstile ON</span>
      \` : ''}
      <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">\${originCount} Origins</span>
     </div>
    </div>
    <div class="app-card-footer">
     <div class="app-card-actions">
      <button class="btn btn-secondary btn-sm" onclick="openEditAppModal('\${escapeHtml(app.appName)}')">Manage</button>
      <button class="btn btn-secondary btn-sm" onclick="openApiHubModal('\${escapeHtml(app.appName)}')">API & Code</button>
      <button class="btn btn-secondary btn-sm" onclick="openSubmissionsModal('\${escapeHtml(app.appName)}')">Submissions</button>
      <button class="btn btn-secondary btn-sm" onclick="openLiveTestModal('\${escapeHtml(app.appName)}')">Test</button>
     </div>
    </div>
   </div>
  \`;

 }).join('');
 
 
}

// --- App Manager Modal (Create / Edit) ---
function openCreateAppModal() {
 state.editingApp = null;
 state.activeTab = 'general';
 document.getElementById('app-modal-title').innerText = 'Create New Form Application';
 document.getElementById('app-name-input').value = '';
 document.getElementById('app-name-input').disabled = false;
 
 // Default general & theme identity
 document.getElementById('app-title-input').value = 'Share Your Story';
 document.getElementById('app-description-input').value = 'Please fill out your details below. We value your privacy.';
 document.getElementById('app-theme-color').value = '818cf8';
 document.getElementById('app-theme-hex').value = '818cf8';
 document.getElementById('app-submit-btn-input').value = 'Submit Form';
 document.getElementById('app-success-msg-input').value = 'Thank you! Your submission has been received.';
 document.getElementById('app-redirect-url-input').value = '';
 document.getElementById('app-webhook-url-input').value = '';

 // Default sample schema
 renderFieldsBuilder([
  { key: 'name', label: 'Your Name', type: 'text', required: true, maxLength: 100, placeholder: 'e.g. Jane Doe' },
  { key: 'email', label: 'Email Address', type: 'email', required: true, maxLength: 255, placeholder: 'e.g. jane@example.com', helpText: 'We never share your email.' },
  { key: 'role', label: 'Your Role', type: 'select', required: true, options: ['Patient', 'Family Member', 'Healthcare Professional', 'Other'], allowOther: true },
  { key: 'story', label: 'Your Story', type: 'textarea', required: false, maxLength: 3000, placeholder: 'Write your story here...' },
  { key: 'photo', label: 'Photo Upload', type: 'file', required: false, helpText: 'Optional JPG/PNG image upload' }
 ]);
 
 // Default settings
 document.getElementById('setting-origins').value = '*';
 document.getElementById('setting-honeypot').value = 'website';
 document.getElementById('setting-max-file-mb').value = '10';
 document.getElementById('setting-max-fields').value = '40';
 document.getElementById('setting-turnstile-enabled').checked = false;
 document.getElementById('setting-turnstile-secret').value = '';

 // Default shopify
 document.getElementById('shopify-enabled').checked = false;
 document.getElementById('shopify-store-domain').value = '';
 document.getElementById('shopify-api-version').value = '2025-01';
 document.getElementById('shopify-admin-token').value = '';
 document.getElementById('shopify-metaobject-type').value = '';
 document.getElementById('shopify-image-field').value = 'photo';
 renderShopifyMappingTable({});
 updateShopifyTabVisibility();

 switchAppModalTab('general');
 openModal('app-editor-modal');
}

function setThemeSwatch(hex) {
 const col = document.getElementById('app-theme-color');
 const txt = document.getElementById('app-theme-hex');
 if (col) col.value = hex;
 if (txt) txt.value = hex;
}

function applyTemplatePreset(preset) {
 let slug = '';
 let title = '';
 let desc = '';
 let submitBtn = 'Submit Form';
 let themeHex = '818cf8';
 let fields = [];

 if (preset === 'contact') {
  slug = 'contact-form';
  title = 'Contact Us';
  desc = 'We would love to hear from you. Please fill out the form below.';
  submitBtn = 'Send Message';
  themeHex = '10b981';
  fields = [
   { key: 'name', label: 'Your Full Name', type: 'text', required: true, placeholder: 'e.g. Jane Doe' },
   { key: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'e.g. jane@example.com', helpText: 'We will never share your email with third parties.' },
   { key: 'subject', label: 'Subject', type: 'text', required: true, placeholder: 'How can we help?' },
   { key: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Write your message here...', maxLength: 2000 }
  ];
 } else if (preset === 'shopify-story') {
  slug = 'story-intake';
  title = 'Share Your Product Story';
  desc = 'Tell us how you use our products! Selected stories receive an exclusive store gift card.';
  submitBtn = 'Submit My Story';
  themeHex = '818cf8';
  fields = [
   { key: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'e.g. Alex Rivera' },
   { key: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'e.g. alex@example.com' },
   { key: 'role', label: 'Your Relationship to Our Store', type: 'select', required: true, options: ['Customer', 'Brand Ambassador', 'Retail Partner', 'Other'], allowOther: true },
   { key: 'story', label: 'Your Experience & Story', type: 'textarea', required: true, placeholder: 'What do you love most about using our products?', maxLength: 3000 },
   { key: 'photo', label: 'Upload Product Photo', type: 'file', required: false, helpText: 'High resolution images preferred (JPG/PNG/WEBP)' }
  ];
 } else if (preset === 'survey') {
  slug = 'customer-feedback';
  title = 'Customer Feedback Survey';
  desc = 'We strive for excellence! Let us know how your recent shopping experience went.';
  submitBtn = 'Submit Feedback';
  themeHex = 'f59e0b';
  fields = [
   { key: 'satisfaction', label: 'Overall Satisfaction', type: 'radio', required: true, options: ['5 - Excellent', '4 - Good', '3 - Average', '2 - Poor', '1 - Very Poor'], allowOther: false },
   { key: 'improvements', label: 'What can we improve?', type: 'textarea', required: false, placeholder: 'Any suggestions or comments...' },
   { key: 'recommend', label: 'How likely are you to recommend us? (1-10)', type: 'number', required: false, min: 1, max: 10, defaultValue: '10' },
   { key: 'email', label: 'Email (Optional for follow-up)', type: 'email', required: false }
  ];
 } else if (preset === 'event') {
  slug = 'event-register';
  title = 'Live Event Registration';
  desc = 'Reserve your spot for our upcoming live showcase and networking workshop.';
  submitBtn = 'Register Spot';
  themeHex = 'f43f5e';
  fields = [
   { key: 'name', label: 'Attendee Full Name', type: 'text', required: true, placeholder: 'e.g. Michael Scott' },
   { key: 'phone', label: 'Phone Number', type: 'tel', required: true, placeholder: '+1 (555) 019-2834' },
   { key: 'ticket_type', label: 'Ticket Class', type: 'select', required: true, options: ['VIP Pass (All-Access)', 'General Admission', 'Student / Discounted'], allowOther: false },
   { key: 'dietary', label: 'Dietary Restrictions / Notes', type: 'text', required: false, placeholder: 'e.g. Vegetarian, Gluten-Free' }
  ];
 } else {
  slug = '';
  title = 'New Custom Form';
  desc = '';
  submitBtn = 'Submit Form';
  themeHex = '818cf8';
  fields = [
   { key: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'e.g. user@example.com' }
  ];
 }

 const nameEl = document.getElementById('app-name-input');
 if (nameEl && !nameEl.disabled) nameEl.value = slug;
 document.getElementById('app-title-input').value = title;
 document.getElementById('app-description-input').value = desc;
 document.getElementById('app-submit-btn-input').value = submitBtn;
 setThemeSwatch(themeHex);

 renderFieldsBuilder(fields);
 switchAppModalTab('fields');
 showToast('Applied preset: ' + (title || 'Blank Form'), 'success');
}

async function openEditAppModal(appName) {
 const app = state.apps.find(a => a.appName === appName);
 if (!app) return;
 state.editingApp = app;
 state.activeTab = 'general';
 document.getElementById('app-modal-title').innerText = 'Manage Form App: ' + app.appName;
 document.getElementById('app-name-input').value = app.appName;
 document.getElementById('app-name-input').disabled = false; // renaming is allowed

 const settings = app.settings || {};
 document.getElementById('app-title-input').value = settings.appTitle || app.appName;
 document.getElementById('app-description-input').value = settings.appDescription || '';
 document.getElementById('app-theme-color').value = settings.themeColor || '818cf8';
 document.getElementById('app-theme-hex').value = settings.themeColor || '818cf8';
 document.getElementById('app-submit-btn-input').value = settings.submitBtnText || 'Submit Form';
 document.getElementById('app-success-msg-input').value = settings.successMessage || 'Thank you! Your submission has been received.';
 document.getElementById('app-redirect-url-input').value = settings.redirectUrl || '';
 document.getElementById('app-webhook-url-input').value = settings.webhookUrl || '';

 renderFieldsBuilder(app.fields || []);
 
 document.getElementById('setting-origins').value = (settings.allowedOrigins || ['*']).join(', ');
 document.getElementById('setting-honeypot').value = settings.honeypotField || 'website';
 document.getElementById('setting-max-file-mb').value = Math.round((settings.maxFileBytes || 10485760) / (1024 * 1024));
 document.getElementById('setting-max-fields').value = settings.maxFormFields || 40;
 document.getElementById('setting-turnstile-enabled').checked = settings.turnstile?.enabled || false;
 document.getElementById('setting-turnstile-secret').value = '';

 const shopify = settings.shopify || {};
 document.getElementById('shopify-enabled').checked = shopify.enabled || false;
 document.getElementById('shopify-store-domain').value = shopify.storeDomain || '';
 document.getElementById('shopify-api-version').value = shopify.apiVersion || '2025-01';
 document.getElementById('shopify-admin-token').value = '';
 document.getElementById('shopify-metaobject-type').value = shopify.metaobjectType || '';
 document.getElementById('shopify-image-field').value = shopify.imageFieldKey || '';
 document.getElementById('shopify-dual-write').checked = shopify.dualWrite || false;
 renderShopifyMappingTable(shopify.fieldMapping || {});
 updateShopifyTabVisibility();

 switchAppModalTab('general');
 openModal('app-editor-modal');
}

function switchAppModalTab(tabKey) {
 state.activeTab = tabKey;
 document.querySelectorAll('.app-tab-btn').forEach(b => {
  b.classList.toggle('active', b.getAttribute('data-tab') === tabKey);
 });
 document.querySelectorAll('.app-tab-pane').forEach(p => {
  p.style.display = p.id === 'tab-pane-' + tabKey ? 'block' : 'none';
 });
}

function updateShopifyTabVisibility() {
 const enabled = document.getElementById('shopify-enabled')?.checked;
 const fieldsContainer = document.getElementById('shopify-config-fields');
 if (fieldsContainer) {
  fieldsContainer.style.opacity = enabled ? '1' : '0.4';
  fieldsContainer.style.pointerEvents = enabled ? 'auto' : 'none';
 }
}

// --- Fields Schema Builder Table ---
function renderFieldsBuilder(fields) {
 const container = document.getElementById('fields-builder-list');
 if (!container) return;
 container.innerHTML = fields.map((f, idx) => buildFieldRowHtml(f, idx)).join('');
 updateImageFieldDropdown();
 
}

function buildFieldRowHtml(f, idx) {
 const isSelect = f.type === 'select' || f.type === 'radio';
 const isText = f.type === 'text' || f.type === 'textarea' || f.type === 'email' || f.type === 'url' || f.type === 'tel';
 const isNumber = f.type === 'number';
 const optionsStr = Array.isArray(f.options) ? f.options.join(', ') : '';
 const typeLabelMap = {
  text: 'Text Input',
  email: 'Email Address',
  select: 'Select Dropdown',
  radio: 'Radio Buttons',
  textarea: 'Textarea',
  number: 'Number',
  tel: 'Phone / Tel',
  url: 'Website URL',
  date: 'Date',
  checkbox: 'Checkbox',
  file: 'File / Image Upload'
 };
 const typeBadge = typeLabelMap[f.type] || f.type.toUpperCase();

 return \`
  <div class="field-card-item" data-idx="\${idx}">
   <!-- Card Header -->
   <div class="field-card-header">
    <div style="display:flex; align-items:center; gap:0.75rem;">
     <span class="field-type-pill">\${typeBadge}</span>
     <span style="font-size:0.8rem; color:var(--text-secondary); font-weight:600;">Field\${idx + 1}</span>
    </div>
    <div style="display:flex; align-items:center; gap:0.75rem;">
     <label class="form-checkbox-group" style="margin:0; padding:0.3rem 0.7rem; background:rgba(255,255,255,0.05); border-radius:9999px; border:1px solid var(--border-color); cursor:pointer;">
      <input type="checkbox" class="form-checkbox field-required" \${f.required ? 'checked' : ''} />
      <span style="font-size: 0.8rem; font-weight:600; color:#fff;">Required Field</span>
     </label>
     <button type="button" class="btn btn-danger btn-sm" onclick="removeFieldRow(\${idx})" title="Remove field">✕ Remove</button>
    </div>
   </div>

   <!-- Core Fields: Key, Label, Type, Width -->
   <div class="field-card-grid-top">
    <div>
     <label class="form-label">Field Key (Slug) <span style="font-weight:400; color:var(--text-secondary);">(API var)</span></label>
     <input type="text" class="form-input field-key" value="\${escapeHtml(f.key)}" placeholder="e.g. user_email" onchange="updateImageFieldDropdown()" />
    </div>
    <div>
     <label class="form-label">Field Title (Label)</label>
     <input type="text" class="form-input field-label" value="\${escapeHtml(f.label)}" placeholder="e.g. Your Email Address" />
    </div>
    <div>
     <label class="form-label">Field Type</label>
     <select class="form-select field-type" onchange="handleFieldTypeChange(this, \${idx})">
      <option value="text" \${f.type === 'text' ? 'selected' : ''}>Text Input</option>
      <option value="email" \${f.type === 'email' ? 'selected' : ''}>Email Address</option>
      <option value="select" \${f.type === 'select' ? 'selected' : ''}>Select Dropdown</option>
      <option value="radio" \${f.type === 'radio' ? 'selected' : ''}>Radio Buttons</option>
      <option value="textarea" \${f.type === 'textarea' ? 'selected' : ''}>Textarea</option>
      <option value="number" \${f.type === 'number' ? 'selected' : ''}>Number</option>
      <option value="tel" \${f.type === 'tel' ? 'selected' : ''}>Phone / Tel</option>
      <option value="url" \${f.type === 'url' ? 'selected' : ''}>Website URL</option>
      <option value="date" \${f.type === 'date' ? 'selected' : ''}>Date</option>
      <option value="checkbox" \${f.type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
      <option value="file" \${f.type === 'file' ? 'selected' : ''}>File / Image Upload</option>
     </select>
    </div>
    <div>
     <label class="form-label">Layout Width</label>
     <select class="form-select field-width">
      <option value="100" \${f.width === '100' || !f.width ? 'selected' : ''}>100% (Full Row)</option>
      <option value="50" \${f.width === '50' ? 'selected' : ''}>50% (Half Row)</option>
      <option value="33" \${f.width === '33' ? 'selected' : ''}>33% (One-Third)</option>
     </select>
    </div>
   </div>

   <!-- Display & Hints: Placeholder, Default Value, Help Text -->
   <div class="field-card-grid-middle">
    <div>
     <label class="form-label" style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.2rem;">Placeholder Text</label>
     <input type="text" class="form-input field-placeholder" style="font-size:0.85rem;" value="\${escapeHtml(f.placeholder || '')}" placeholder="e.g. Enter value..." />
    </div>
    <div>
     <label class="form-label" style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.2rem;">Default Value</label>
     <input type="text" class="form-input field-default-val" style="font-size:0.85rem;" value="\${escapeHtml(f.defaultValue || '')}" placeholder="e.g. 10" />
    </div>
    <div>
     <label class="form-label" style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.2rem;">Help Subtitle Below Field</label>
     <input type="text" class="form-input field-help-text" style="font-size:0.85rem;" value="\${escapeHtml(f.helpText || '')}" placeholder="e.g. We never share this info" />
    </div>
   </div>

   <!-- Advanced Customization: Regex Pattern, Error Msg, CSS Class -->
   <div class="field-card-grid-advanced">
    <div>
     <label class="form-label" style="font-size:0.75rem; color:#93c5fd; margin-bottom:0.2rem;">Regex Validation Pattern</label>
     <input type="text" class="form-input field-pattern" style="font-size:0.82rem; font-family:var(--font-mono);" value="\${escapeHtml(f.pattern || '')}" placeholder="e.g. ^[0-9]{5}$ (Optional regex)" />
    </div>
    <div>
     <label class="form-label" style="font-size:0.75rem; color:#93c5fd; margin-bottom:0.2rem;">Custom Regex Error Message</label>
     <input type="text" class="form-input field-pattern-error" style="font-size:0.82rem;" value="\${escapeHtml(f.patternError || '')}" placeholder="e.g. Must be 5 digits" />
    </div>
    <div>
     <label class="form-label" style="font-size:0.75rem; color:#93c5fd; margin-bottom:0.2rem;">Custom CSS Wrapper Class</label>
     <input type="text" class="form-input field-custom-class" style="font-size:0.82rem; font-family:var(--font-mono);" value="\${escapeHtml(f.customClass || '')}" placeholder="e.g. my-custom-field col-span-2" />
    </div>
   </div>

   <!-- Type-Specific Controls -->
   <div class="field-card-options-box field-extra-text" style="display:\${isText ? 'flex' : 'none'}; align-items:center; gap:0.75rem;">
    <label class="form-label" style="margin:0; font-size:0.82rem; font-weight:600; color:#c7d2fe;">Max Character Length:</label>
    <input type="number" class="form-input field-max-length" style="width: 120px; font-size:0.85rem; padding:0.35rem 0.6rem;" value="\${f.maxLength || 1000}" min="1" max="10000" />
    <span class="form-hint" style="margin:0;">Limits user input size (up to 10,000 characters)</span>
   </div>

   <div class="field-card-options-box field-extra-number" style="display:\${isNumber ? 'flex' : 'none'}; align-items:center; gap:0.75rem;">
    <label class="form-label" style="margin:0; font-size:0.82rem; font-weight:600; color:#c7d2fe;">Min Allowed Value:</label>
    <input type="number" class="form-input field-min-val" style="width: 110px; font-size:0.85rem; padding:0.35rem 0.6rem;" value="\${f.min !== undefined ? f.min : ''}" placeholder="None" />
    <label class="form-label" style="margin:0; font-size:0.82rem; font-weight:600; color:#c7d2fe;">Max Allowed Value:</label>
    <input type="number" class="form-input field-max-val" style="width: 110px; font-size:0.85rem; padding:0.35rem 0.6rem;" value="\${f.max !== undefined ? f.max : ''}" placeholder="None" />
   </div>

   <div class="field-card-options-box field-extra-select" style="display:\${isSelect ? 'flex' : 'none'}; align-items:center; gap:1rem; width:100%;">
    <label class="form-label" style="margin:0; font-size:0.82rem; font-weight:600; color:#c7d2fe; white-space:nowrap;">Options (comma-separated):</label>
    <input type="text" class="form-input field-options" style="flex:1; min-width:200px; font-size:0.85rem; padding:0.4rem 0.7rem;" value="\${escapeHtml(optionsStr)}" placeholder="e.g. Option A, Option B, Option C" />
    <label class="form-checkbox-group" style="margin:0; white-space:nowrap;">
     <input type="checkbox" class="form-checkbox field-allow-other" \${f.allowOther ? 'checked' : ''} />
     <span style="font-size: 0.82rem; font-weight:600;">Allow "Other" write-in option</span>
    </label>
   </div>
  </div>
 \`;
}

function addFieldRow() {
 const container = document.getElementById('fields-builder-list');
 if (!container) return;
 const idx = container.children.length;
 const div = document.createElement('div');
 div.innerHTML = buildFieldRowHtml({ key: 'field_' + (idx + 1), label: 'New Field', type: 'text', width: '100', required: false, maxLength: 500 }, idx);
 container.appendChild(div.firstElementChild);
 updateImageFieldDropdown();
 
}

function removeFieldRow(idx) {
 const container = document.getElementById('fields-builder-list');
 if (!container) return;
 const row = container.querySelector('[data-idx="' + idx + '"]');
 if (row) {
  row.remove();
  updateImageFieldDropdown();
 }
}

function handleFieldTypeChange(selectEl, idx) {
 const row = selectEl.closest('.field-card-item');
 if (!row) return;
 const val = selectEl.value;
 const isSelect = val === 'select' || val === 'radio';
 const isText = val === 'text' || val === 'textarea' || val === 'email' || val === 'url' || val === 'tel';
 const isNumber = val === 'number';
 const extraSelect = row.querySelector('.field-extra-select');
 const extraText = row.querySelector('.field-extra-text');
 const extraNum = row.querySelector('.field-extra-number');
 if (extraSelect) extraSelect.style.display = isSelect ? 'flex' : 'none';
 if (extraText) extraText.style.display = isText ? 'flex' : 'none';
 if (extraNum) extraNum.style.display = isNumber ? 'flex' : 'none';

 const pill = row.querySelector('.field-type-pill');
 if (pill) {
  const typeLabelMap = {
   text: 'Text Input',
   email: 'Email Address',
   select: 'Select Dropdown',
   radio: 'Radio Buttons',
   textarea: 'Textarea',
   number: 'Number',
   tel: 'Phone / Tel',
   url: 'Website URL',
   date: 'Date',
   checkbox: 'Checkbox',
   file: 'File / Image Upload'
  };
  pill.innerHTML = typeLabelMap[val] || val.toUpperCase();
 }
 updateImageFieldDropdown();
 
}

function updateImageFieldDropdown() {
 const select = document.getElementById('shopify-image-field');
 if (!select) return;
 const fileKeys = [];
 document.querySelectorAll('.field-card-item').forEach(row => {
  const typeEl = row.querySelector('.field-type');
  const keyEl = row.querySelector('.field-key');
  if (typeEl && typeEl.value === 'file' && keyEl && keyEl.value.trim()) {
   fileKeys.push(keyEl.value.trim());
  }
 });
 const current = select.value;
 select.innerHTML = '<option value="">-- None / No Image Sync --</option>' + 
  fileKeys.map(k => '<option value="' + escapeHtml(k) + '" ' + (current === k ? 'selected' : '') + '>' + escapeHtml(k) + '</option>').join('');
}

// --- Shopify Field Mapping Table ---
function renderShopifyMappingTable(mapping) {
 const container = document.getElementById('shopify-mapping-list');
 if (!container) return;
 const entries = Object.entries(mapping || {});
 if (entries.length === 0) {
  container.innerHTML = buildMappingRowHtml('', '');
  return;
 }
 container.innerHTML = entries.map(([appKey, shopKey]) => buildMappingRowHtml(appKey, shopKey)).join('');
}

function buildMappingRowHtml(appKey, shopKey) {
 return \`
  <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.5rem;" class="mapping-row">
   <input type="text" class="form-input mapping-app-key" placeholder="Form Field Key (e.g. story)" value="\${escapeHtml(appKey)}" />
   <span style="color:var(--text-secondary);"></span>
   <input type="text" class="form-input mapping-shop-key" placeholder="Shopify Metaobject Key (e.g. experience_story)" value="\${escapeHtml(shopKey)}" />
   <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
  </div>
 \`;
}

function addShopifyMappingRow() {
 const container = document.getElementById('shopify-mapping-list');
 if (!container) return;
 const div = document.createElement('div');
 div.innerHTML = buildMappingRowHtml('', '');
 container.appendChild(div.firstElementChild);
 
}

// --- Save Application Schema ---
async function saveApp() {
 const appName = document.getElementById('app-name-input').value.trim().toLowerCase();
 if (!appName || !/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(appName)) {
  showToast('App name must be 1-50 characters: lowercase letters, numbers, hyphens.', 'error');
  return;
 }

 // Collect fields
 const fields = [];
 let fieldError = null;
 document.querySelectorAll('.field-card-item').forEach(row => {
  const key = row.querySelector('.field-key').value.trim().toLowerCase();
  const label = row.querySelector('.field-label').value.trim();
  const type = row.querySelector('.field-type').value;
  const required = row.querySelector('.field-required').checked;
  if (!key) {
   fieldError = 'All form fields must have a valid key slug.';
   return;
  }
  const field = { key, label: label || key, type, required };
  const placeholder = row.querySelector('.field-placeholder')?.value.trim() || '';
  const helpText = row.querySelector('.field-help-text')?.value.trim() || '';
  const defaultValue = row.querySelector('.field-default-val')?.value.trim() || '';
  const width = row.querySelector('.field-width')?.value || '100';
  const pattern = row.querySelector('.field-pattern')?.value.trim() || '';
  const patternError = row.querySelector('.field-pattern-error')?.value.trim() || '';
  const customClass = row.querySelector('.field-custom-class')?.value.trim() || '';

  if (placeholder) field.placeholder = placeholder;
  if (helpText) field.helpText = helpText;
  if (defaultValue) field.defaultValue = defaultValue;
  if (width && width !== '100') field.width = width;
  if (pattern) field.pattern = pattern;
  if (patternError) field.patternError = patternError;
  if (customClass) field.customClass = customClass;

  if (type === 'text' || type === 'textarea' || type === 'email' || type === 'url' || type === 'tel') {
   const maxEl = row.querySelector('.field-max-length');
   if (maxEl && maxEl.value) field.maxLength = parseInt(maxEl.value, 10);
  }
  if (type === 'number') {
   const minEl = row.querySelector('.field-min-val');
   const maxEl = row.querySelector('.field-max-val');
   if (minEl && minEl.value !== '') field.min = Number(minEl.value);
   if (maxEl && maxEl.value !== '') field.max = Number(maxEl.value);
  }
  if (type === 'select' || type === 'radio') {
   const optionsEl = row.querySelector('.field-options');
   const allowOtherEl = row.querySelector('.field-allow-other');
   field.options = (optionsEl?.value || '').split(',').map(s => s.trim()).filter(Boolean);
   field.allowOther = allowOtherEl?.checked || false;
  }
  fields.push(field);
 });
 if (fieldError) {
  showToast(fieldError, 'error');
  switchAppModalTab('fields');
  return;
 }
 if (fields.length === 0) {
  showToast('Please define at least one form field.', 'error');
  switchAppModalTab('fields');
  return;
 }

 // Collect settings
 const appTitle = document.getElementById('app-title-input')?.value.trim() || '';
 const appDescription = document.getElementById('app-description-input')?.value.trim() || '';
 const submitBtnText = document.getElementById('app-submit-btn-input')?.value.trim() || 'Submit Form';
 const successMessage = document.getElementById('app-success-msg-input')?.value.trim() || 'Thank you! Your submission has been received.';
 const redirectUrl = document.getElementById('app-redirect-url-input')?.value.trim() || '';
 const themeColor = document.getElementById('app-theme-hex')?.value.trim() || '818cf8';
 const webhookUrl = document.getElementById('app-webhook-url-input')?.value.trim() || '';

 const originsVal = document.getElementById('setting-origins').value.trim();
 const allowedOrigins = originsVal ? originsVal.split(',').map(s => s.trim()).filter(Boolean) : ['*'];
 const honeypotField = document.getElementById('setting-honeypot').value.trim() || 'website';
 const maxFileMb = parseFloat(document.getElementById('setting-max-file-mb').value) || 10;
 const maxFormFields = parseInt(document.getElementById('setting-max-fields').value, 10) || 40;
 const turnstileEnabled = document.getElementById('setting-turnstile-enabled').checked;
 const turnstileSecret = document.getElementById('setting-turnstile-secret').value.trim();

 // Collect shopify settings
 const shopifyEnabled = document.getElementById('shopify-enabled').checked;
 const shopifyStoreDomain = document.getElementById('shopify-store-domain').value.trim();
 const shopifyApiVersion = document.getElementById('shopify-api-version').value.trim() || '2025-01';
 const shopifyAdminToken = document.getElementById('shopify-admin-token').value.trim();
 const shopifyMetaobjectType = document.getElementById('shopify-metaobject-type').value.trim();
 const shopifyImageField = document.getElementById('shopify-image-field').value.trim();

 const fieldMapping = {};
 document.querySelectorAll('.mapping-row').forEach(row => {
  const appKey = row.querySelector('.mapping-app-key').value.trim();
  const shopKey = row.querySelector('.mapping-shop-key').value.trim();
  if (appKey && shopKey) {
   fieldMapping[appKey] = shopKey;
  }
 });

 const settings = {
  appTitle,
  appDescription,
  submitBtnText,
  successMessage,
  redirectUrl,
  themeColor,
  webhookUrl,
  allowedOrigins,
  honeypotField,
  maxFileBytes: Math.round(maxFileMb * 1024 * 1024),
  maxFormFields,
  turnstile: { enabled: turnstileEnabled },
  shopify: { enabled: shopifyEnabled }
 };
 if (turnstileSecret) settings.turnstile.secretKey = turnstileSecret;

 if (shopifyEnabled) {
  if (!shopifyStoreDomain || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shopifyStoreDomain)) {
   showToast('Shopify Store Domain must look like your-store.myshopify.com', 'error');
   switchAppModalTab('shopify');
   return;
  }
  if (!shopifyMetaobjectType) {
   showToast('Metaobject Type handle is required when Shopify sync is enabled.', 'error');
   switchAppModalTab('shopify');
   return;
  }
  settings.shopify = {
   enabled: true,
   storeDomain: shopifyStoreDomain,
   apiVersion: shopifyApiVersion,
   metaobjectType: shopifyMetaobjectType,
   imageFieldKey: shopifyImageField,
   fieldMapping,
   dualWrite: document.getElementById('shopify-dual-write')?.checked || false,
  };
  if (shopifyAdminToken) {
   settings.shopify.adminAccessToken = shopifyAdminToken;
  }
 }

 const newAppName = (document.getElementById('app-name-input').value || '').trim().toLowerCase();
 const isRename = state.editingApp && newAppName && newAppName !== state.editingApp.appName;
 const payload = state.editingApp
  ? { fields, settings, ...(isRename ? { newAppName } : {}) }
  : { appName, fields, settings };
 const url = state.editingApp ? '/api/apps/' + encodeURIComponent(state.editingApp.appName) : '/api/apps';
 const method = state.editingApp ? 'PUT' : 'POST';
 const effectiveAppName = state.editingApp ? (isRename ? newAppName : state.editingApp.appName) : appName;

 try {
  const res = await fetch(url, {
   method,
   headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + state.token
   },
   body: JSON.stringify(method === 'POST' ? { ...payload, turnstileToken: _tsTokens.createApp || '' } : payload)
  });
  const data = await res.json();
  if (!data.ok) {
   showToast(data.error || 'Failed to save app.', 'error');
   return;
  }
  showToast('Application schema saved successfully!', 'success');
  if (isRename) { showToast('App renamed to "' + effectiveAppName + '"', 'success'); }
  closeModal('app-editor-modal');
  await loadApps();
  
  if (method === 'POST') {
   openApiHubModal(effectiveAppName);
  }
 } catch (e) {
  showToast('Network error saving application.', 'error');
 }
}

async function deleteApp(appName) {
 if (!confirm('Are you sure you want to delete form app "' + appName + '" and all its submissions? This cannot be undone.')) {
  return;
 }
 try {
  const res = await fetch('/api/apps/' + encodeURIComponent(appName), {
   method: 'DELETE',
   headers: { 'Authorization': 'Bearer ' + state.token }
  });
  const data = await res.json();
  if (data.ok) {
   showToast('App deleted successfully.', 'success');
   await loadApps();
  } else {
   showToast(data.error || 'Failed to delete app.', 'error');
  }
 } catch (e) {
  showToast('Network error deleting app.', 'error');
 }
}

// --- Integration & API Hub Modal ---
function openApiHubModal(appName) {
 const app = state.apps.find(a => a.appName === appName);
 if (!app) return;
 state.hubApp = app;
 document.getElementById('api-hub-modal-title').innerText = 'API Hub & Code Snippets: ' + app.appName;

 const origin = window.location.origin;
 const submitUrl = origin + '/api/' + encodeURIComponent(state.user.username) + '/' + encodeURIComponent(app.appName) + '/';
 
 document.getElementById('hub-submit-url').value = submitUrl;
 
 // Generate HTML Snippet
 const htmlSnippet = buildHtmlFormSnippet(app, submitUrl);
 document.getElementById('snippet-html').innerText = htmlSnippet;

 // Generate JS Snippet
 const jsSnippet = buildJsFetchSnippet(app, submitUrl);
 document.getElementById('snippet-js').innerText = jsSnippet;

 // Generate cURL Snippet
 const curlSnippet = buildCurlSnippet(app, submitUrl);
 document.getElementById('snippet-curl').innerText = curlSnippet;

 openModal('api-hub-modal');
}

function copyEndpointUrl(btnEl) {
 const url = document.getElementById('hub-submit-url').value;
 navigator.clipboard.writeText(url).then(() => {
  btnEl.innerHTML = 'Copied';
  
  setTimeout(() => {
   btnEl.innerHTML = 'Copy URL';
   
  }, 2000);
 });
}

function buildHtmlFormSnippet(app, submitUrl) {
 const fields = app.fields || [];
 const honeypot = app.settings?.honeypotField || 'website';
 let lines = [];
 lines.push('<form id="formhub-form" action="' + submitUrl + '" method="POST" enctype="multipart/form-data">');
 
 // Honeypot field
 lines.push(' <!-- Honeypot (hidden from real users) -->');
 lines.push(' <div style="display:none;"><input type="text" name="' + honeypot + '" value="" /></div>');
 lines.push('');

 fields.forEach(f => {
  lines.push(' <!-- ' + escapeHtml(f.label) + ' -->');
  lines.push(' <div class="form-group">');
  lines.push('  <label for="' + f.key + '">' + escapeHtml(f.label) + (f.required ? ' *' : '') + '</label>');
  
  if (f.type === 'select') {
   lines.push('  <select name="' + f.key + '" id="' + f.key + '"' + (f.required ? ' required' : '') + '>');
   (f.options || []).forEach(opt => {
    lines.push('   <option value="' + escapeHtml(opt) + '">' + escapeHtml(opt) + '</option>');
   });
   if (f.allowOther && !(f.options || []).includes('Other')) {
    lines.push('   <option value="Other">Other</option>');
   }
   lines.push('  </select>');
  } else if (f.type === 'textarea') {
   lines.push('  <textarea name="' + f.key + '" id="' + f.key + '" rows="4"' + (f.required ? ' required' : '') + '></textarea>');
  } else {
   const typeStr = f.type === 'file' ? 'file' : f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text';
   lines.push('  <input type="' + typeStr + '" name="' + f.key + '" id="' + f.key + '"' + (f.required ? ' required' : '') + ' />');
  }
  lines.push(' </div>');
  lines.push('');
 });

 if (app.settings?.turnstile?.enabled) {
  lines.push(' <!-- Cloudflare Turnstile CAPTCHA -->');
  lines.push(' <div class="cf-turnstile" data-sitekey="YOUR_TURNSTILE_SITE_KEY"></div>');
  lines.push('');
 }

 lines.push(' <button type="submit" class="submit-btn">Submit</button>');
 lines.push('</form>');
 return lines.join('\\n');
}

function buildJsFetchSnippet(app, submitUrl) {
 return \`async function submitFormHubForm(formElement) {
 const formData = new FormData(formElement);
 
 try {
  const response = await fetch('\${submitUrl}', {
   method: 'POST',
   body: formData
  });
  
  const result = await response.json();
  if (response.ok && result.ok) {
   alert('Form submitted successfully! ID: ' + result.id);
   formElement.reset();
  } else {
   alert('Error: ' + (result.error || 'Submission failed'));
  }
 } catch (error) {
  console.error('Submission error:', error);
  alert('Network error while submitting.');
 }
}\`;
}

function buildCurlSnippet(app, submitUrl) {
 const fields = app.fields || [];
 let lines = ['curl -X POST "' + submitUrl + '" \\\\'];
 fields.forEach((f, i) => {
  const flag = f.type === 'file'
   ? '-F "' + f.key + '=@/path/to/file.pdf"'
   : '-F "' + f.key + '=Sample ' + escapeHtml(f.label) + '"';
  lines.push(' ' + flag + (i < fields.length - 1 ? ' \\\\' : ''));
 });
 return lines.join('\\n');
}

function copyText(elementId, btnEl) {
 const textEl = document.getElementById(elementId);
 if (!textEl) return;
 const text = textEl.tagName === 'INPUT' ? textEl.value : textEl.innerText;
 navigator.clipboard.writeText(text).then(() => {
  const orig = btnEl.innerHTML;
  btnEl.innerHTML = 'Copied';
  
  setTimeout(() => {
   btnEl.innerHTML = orig;
   
  }, 2000);
 });
}

// --- Submissions Viewer Modal ---
async function openSubmissionsModal(appName) {
 const app = state.apps.find(a => a.appName === appName);
 if (!app) return;
 state.selectedAppForSubmissions = app;
 document.getElementById('submissions-modal-title').innerText = 'Submissions for: ' + app.appName;
 document.getElementById('submissions-table-body').innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Loading submissions...</td></tr>';
 
 openModal('submissions-modal');

 try {
  const res = await fetch('/api/apps/' + encodeURIComponent(app.appName) + '/submissions', {
   headers: { 'Authorization': 'Bearer ' + state.token }
  });
  const data = await res.json();
  if (!data.ok) {
   showToast(data.error || 'Failed to load submissions.', 'error');
   return;
  }
  state.submissions = data.submissions || [];
  renderSubmissionsTable(state.submissions);
 } catch (e) {
  showToast('Network error loading submissions.', 'error');
 }
}

function renderSubmissionsTable(list) {
 const container = document.getElementById('submissions-table-body');
 if (!container) return;
 if (!list || list.length === 0) {
  container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 3rem; color:var(--text-secondary);">No submissions collected yet. Use the Live Test Form or submit via API!</td></tr>';
  return;
 }

 container.innerHTML = list.map(s => {
  const dateStr = new Date(s.createdAt).toLocaleString();
  const status = s.shopifyStatus || 'skipped';
  const statusClass = 'status-' + status;
  const fieldsStr = Object.entries(s.data || {}).map(([k, v]) => '<strong>' + escapeHtml(k) + ':</strong> ' + escapeHtml(v)).join('<br/>');
  
  // Check files
  let filesHtml = '-';
  if (s.files && Object.keys(s.files).length > 0) {
   filesHtml = Object.entries(s.files).map(([k, fileObj]) => {
    if (!fileObj) return '';
    if (fileObj.url) {
     return '<a href="' + fileObj.url + '" target="_blank" style="color:#818cf8; text-decoration:underline;">' + escapeHtml(k) + '</a>';
    } else if (fileObj.shopifyFileId) {
     return '<span style="color:#34d399;">Shopify ID: ' + escapeHtml(fileObj.shopifyFileId) + '</span>';
    }
    return '';
   }).join('<br/>');
  }

  return \`
   <tr>
    <td><code style="font-size:0.75rem;">\${escapeHtml(s.id.slice(0, 8))}...</code></td>
    <td style="white-space:nowrap;">\${escapeHtml(dateStr)}</td>
    <td><span class="status-badge \${statusClass}" onclick="inspectSubmissionStatus('\${s.id}')">\${status.toUpperCase()}</span></td>
    <td><div style="max-height:100px; overflow-y:auto; font-size:0.85rem;">\${fieldsStr || '-'}</div></td>
    <td>\${filesHtml}</td>
    <td>
     <button class="btn btn-secondary btn-sm" onclick="inspectSubmissionStatus('\${s.id}')">View</button>
    </td>
   </tr>
  \`;
 }).join('');
 
}

async function inspectSubmissionStatus(submissionId) {
 const app = state.selectedAppForSubmissions;
 if (!app) return;
 try {
  const res = await fetch('/api/apps/' + encodeURIComponent(app.appName) + '/submissions/' + encodeURIComponent(submissionId), {
   headers: { 'Authorization': 'Bearer ' + state.token }
  });
  const data = await res.json();
  if (!data.ok || !data.submission) {
   showToast('Could not load submission details.', 'error');
   return;
  }
  const sub = data.submission;
  document.getElementById('inspect-modal-title').innerText = 'Submission Details: ' + sub.id;
  
  let detailsHtml = \`
   <div style="margin-bottom: 1.25rem;">
    <h4 style="margin-bottom:0.5rem; color:var(--text-secondary);">Sync Status</h4>
    <span class="status-badge status-\${sub.shopifyStatus || 'skipped'}">\${(sub.shopifyStatus || 'SKIPPED').toUpperCase()}</span>
    \${sub.shopifyHandle ? '<p style="margin-top:0.5rem;">Shopify Handle: <code style="color:#34d399;">' + escapeHtml(sub.shopifyHandle) + '</code></p>' : ''}
   </div>
  \`;

  if (sub.shopifyStatus === 'failed' && sub.shopifyErrors) {
   detailsHtml += \`
    <div style="margin-bottom: 1.25rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md);">
     <h4 style="color:var(--danger-color); margin-bottom:0.5rem;">Shopify Sync Errors</h4>
     <ul style="margin-left: 1.5rem; color:#fca5a5; font-family: var(--font-mono); font-size:0.85rem;">
      \${sub.shopifyErrors.map(err => '<li>' + escapeHtml(err.message || JSON.stringify(err)) + '</li>').join('')}
     </ul>
    </div>
   \`;
  }

  detailsHtml += \`
   <div>
    <h4 style="margin-bottom:0.5rem; color:var(--text-secondary);">Submitted Form Data</h4>
    <pre class="code-box" style="margin-top:0;">\${escapeHtml(JSON.stringify(s.data, null, 2))}</pre>
   </div>
  \`;

  document.getElementById('inspect-modal-body').innerHTML = detailsHtml;
  openModal('inspect-submission-modal');
 } catch (e) {
  showToast('Network error loading details.', 'error');
    console.error('[inspectSubmission]', e);
 }
}

function exportSubmissionsCsv() {
 const list = state.submissions || [];
 if (list.length === 0) {
  showToast('No submissions to export.', 'info');
  return;
 }
 const allKeys = new Set(['ID', 'Created At', 'Shopify Status']);
 list.forEach(s => {
  Object.keys(s.data || {}).forEach(k => allKeys.add(k));
 });
 const headers = Array.from(allKeys);
 const rows = [headers.join(',')];

 list.forEach(s => {
  const row = headers.map(h => {
   if (h === 'ID') return '"' + String(s.id) + '"';
   if (h === 'Created At') return '"' + new Date(s.createdAt).toISOString() + '"';
   if (h === 'Shopify Status') return '"' + String(s.shopifyStatus || '') + '"';
   return '"' + String(s.data?.[h] || '').replace(/"/g, '""') + '"';
  });
  rows.push(row.join(','));
 });

 const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = (state.selectedAppForSubmissions?.appName || 'submissions') + '.csv';
 a.click();
 URL.revokeObjectURL(url);
}

// --- Live Form Tester Modal ---
function openLiveTestModal(appName) {
 const app = state.apps.find(a => a.appName === appName);
 if (!app) return;
 state.testApp = app;
 const settings = app.settings || {};
 const title = settings.appTitle || app.appName;
 const desc = settings.appDescription || 'Fill out the form below to test your Edge submission endpoint.';
 const btnText = settings.submitBtnText || 'Submit Test Entry';
 const themeColor = settings.themeColor || '818cf8';

 document.getElementById('test-modal-title').innerText = 'Test Live Form: ' + title;
 document.getElementById('test-result-box').style.display = 'none';

 const container = document.getElementById('test-form-fields-container');
 const fields = app.fields || [];

 let html = \`
  <div style="margin-bottom:1.25rem; padding:1rem; background:rgba(255,255,255,0.02); border-left:4px solid \${themeColor}; border-radius:var(--radius-md);">
   <h4 style="margin:0 0 0.4rem 0; font-size:1.05rem; font-weight:700;">\${escapeHtml(title)}</h4>
   \${desc ? '<p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">' + escapeHtml(desc) + '</p>' : ''}
  </div>
 \`;

 html += '<div style="display:grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem 1rem;">';

 html += fields.map(f => {
  const hintHtml = f.helpText ? '<span class="form-hint" style="display:block; margin-top:0.25rem;">' + escapeHtml(f.helpText) + '</span>' : '';
  const reqStr = f.required ? 'required' : '';
  const reqStar = f.required ? ' <span style="color:var(--danger-color);">*</span>' : '';
  const defaultVal = f.defaultValue !== undefined ? escapeHtml(f.defaultValue) : '';
  const colSpan = f.width === '50' ? 'span 3' : (f.width === '33' ? 'span 2' : 'span 6');
  const groupStyle = 'grid-column: ' + colSpan + '; margin-bottom:1.1rem;';
  const customClassStr = f.customClass ? ' ' + escapeHtml(f.customClass) : '';

  if (f.type === 'select') {
   return \`
    <div class="form-group\${customClassStr}" style="\${groupStyle}">
     <label class="form-label">\${escapeHtml(f.label)}\${reqStar}</label>
     <select name="\${f.key}" class="form-select" \${reqStr}>
      <option value="">-- Choose option --</option>
      \${(f.options || []).map(o => '<option value="' + escapeHtml(o) + '" ' + (o === defaultVal ? 'selected' : '') + '>' + escapeHtml(o) + '</option>').join('')}
      \${f.allowOther ? '<option value="Other">Other</option>' : ''}
     </select>
     \${hintHtml}
    </div>
   \`;
  } else if (f.type === 'radio') {
   return \`
    <div class="form-group\${customClassStr}" style="\${groupStyle}">
     <label class="form-label">\${escapeHtml(f.label)}\${reqStar}</label>
     <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.35rem;">
      \${(f.options || []).map((o, idx) => {
       const checked = o === defaultVal ? 'checked' : '';
       return '<label class="form-checkbox-group"><input type="radio" name="' + escapeHtml(f.key) + '" value="' + escapeHtml(o) + '" ' + checked + ' ' + reqStr + ' /> <span>' + escapeHtml(o) + '</span></label>';
      }).join('')}
     </div>
     \${hintHtml}
    </div>
   \`;
  } else if (f.type === 'checkbox') {
   const checked = (defaultVal === 'true' || defaultVal === 'yes' || defaultVal === '1') ? 'checked' : '';
   return \`
    <div class="form-group\${customClassStr}" style="\${groupStyle}">
     <label class="form-checkbox-group" style="font-weight:600; font-size:0.9rem;">
      <input type="checkbox" name="\${f.key}" class="form-checkbox" value="true" \${checked} \${reqStr} />
      <span>\${escapeHtml(f.label)}\${reqStar}</span>
     </label>
     \${hintHtml}
    </div>
   \`;
  } else if (f.type === 'textarea') {
   return \`
    <div class="form-group\${customClassStr}" style="\${groupStyle}">
     <label class="form-label">\${escapeHtml(f.label)}\${reqStar}</label>
     <textarea name="\${f.key}" class="form-textarea" rows="3" placeholder="\${escapeHtml(f.placeholder || '')}" \${f.maxLength ? 'maxlength="' + f.maxLength + '"' : ''} \${reqStr}>\${defaultVal}</textarea>
     \${hintHtml}
    </div>
   \`;
  } else if (f.type === 'file') {
   const maxMb = Math.round((app.settings?.maxFileBytes || 10485760) / 1048576);
   return \`
    <div class="form-group\${customClassStr}" style="\${groupStyle}">
     <label class="form-label">\${escapeHtml(f.label)}\${reqStar}</label>
     <input type="file" name="\${f.key}" class="form-input" \${reqStr} />
     <span class="form-hint" style="display:block; margin-top:0.25rem;">Max \${maxMb} MB &mdash; any file type accepted. Uploaded directly to Shopify. \${escapeHtml(f.helpText || '')}</span>
    </div>
   \`;
  } else {
   let typeStr = 'text';
   if (f.type === 'email') typeStr = 'email';
   else if (f.type === 'date') typeStr = 'date';
   else if (f.type === 'number') typeStr = 'number';
   else if (f.type === 'tel') typeStr = 'tel';
   else if (f.type === 'url') typeStr = 'url';

   const minAttr = f.min !== undefined ? 'min="' + f.min + '"' : '';
   const maxAttr = f.max !== undefined ? 'max="' + f.max + '"' : '';
   const maxLenAttr = f.maxLength ? 'maxlength="' + f.maxLength + '"' : '';
   const patAttr = f.pattern ? 'pattern="' + escapeHtml(f.pattern) + '" title="' + escapeHtml(f.patternError || 'Must match pattern ' + f.pattern) + '"' : '';

   return \`
    <div class="form-group\${customClassStr}" style="\${groupStyle}">
     <label class="form-label">\${escapeHtml(f.label)}\${reqStar}</label>
     <input type="\${typeStr}" name="\${f.key}" class="form-input" value="\${defaultVal}" placeholder="\${escapeHtml(f.placeholder || '')}" \${minAttr} \${maxAttr} \${maxLenAttr} \${patAttr} \${reqStr} />
     \${hintHtml}
    </div>
   \`;
  }
 }).join('');

 html += '</div>';

 container.innerHTML = html;

 const submitBtn = document.querySelector('#test-form button[type="submit"]');
 if (submitBtn) {
  submitBtn.innerHTML = btnText;
  submitBtn.style.backgroundColor = themeColor;
  submitBtn.style.borderColor = themeColor;
 }

 openModal('live-test-modal');
 
}

async function submitLiveTestForm(e) {
 e.preventDefault();
 const app = state.testApp;
 if (!app) return;
 const form = document.getElementById('test-form');
 const formData = new FormData(form);
 const submitUrl = '/api/' + encodeURIComponent(state.user.username) + '/' + encodeURIComponent(app.appName) + '/';

 const resBox = document.getElementById('test-result-box');
 resBox.style.display = 'block';

 // Detect whether the form has any file inputs with a selected file.
 const hasFile = app.fields.some(f => f.type === 'file' && formData.get(f.key) instanceof File && formData.get(f.key).size > 0);

 if (hasFile) {
  // Use XHR so we can show upload progress.
  await new Promise((resolve) => {
   const xhr = new XMLHttpRequest();

   // --- Upload phase: progress bar ---
   xhr.upload.onprogress = (ev) => {
    if (!ev.lengthComputable) return;
    const pct = Math.round((ev.loaded / ev.total) * 100);
    resBox.innerHTML = \`
     <div style="margin-bottom:0.6rem; font-size:0.875rem; color:var(--text-secondary);">⬆️ Uploading to server… <strong>\${pct}%</strong></div>
     <div style="background:rgba(255,255,255,0.08); border-radius:99px; height:8px; overflow:hidden;">
      <div style="height:100%; width:\${pct}%; background:var(--accent-gradient); border-radius:99px;
            transition:width 0.15s ease;"></div>
     </div>\`;
   };

   xhr.upload.onload = () => {
    resBox.innerHTML = \`
     <div style="display:flex; align-items:center; gap:0.6rem; font-size:0.875rem; color:var(--text-secondary);">
      <span style="display:inline-block; width:16px; height:16px; border:2px solid var(--accent-primary);
             border-top-color:transparent; border-radius:50%;
             animation:spin 0.7s linear infinite;"></span>
      Uploading file to Shopify…
     </div>\`;
   };

   xhr.onload = () => {
    try {
     const result = JSON.parse(xhr.responseText);
     if (xhr.status >= 200 && xhr.status < 300 && result.ok) {
      showToast(result.successMessage || 'Live test submitted successfully!', 'success');
      let msgHtml = '<div style="color:var(--success-color); font-weight:700; margin-bottom:0.4rem;">' + escapeHtml(result.successMessage || 'Success!') + '</div>';
      msgHtml += '<div>Submission ID: <code>' + escapeHtml(result.id) + '</code></div>';
      if (result.redirectUrl) {
       msgHtml += '<div style="margin-top:0.4rem; font-size:0.8rem; color:var(--text-secondary);">Redirect: <a href="' + escapeHtml(result.redirectUrl) + '" target="_blank" style="color:#818cf8;text-decoration:underline;">' + escapeHtml(result.redirectUrl) + '</a></div>';
      }
      resBox.innerHTML = msgHtml;
      form.reset();
     } else {
      resBox.innerHTML = '<span style="color:var(--danger-color);">Submission Error:</span> <code>' + escapeHtml(result.error || 'Unknown error') + '</code>';
     }
    } catch { resBox.innerHTML = '<span style="color:var(--danger-color);">Invalid server response</span>'; }
    
    resolve();
   };

   xhr.onerror = () => {
    resBox.innerHTML = '<span style="color:var(--danger-color);">Network Error during upload</span>';
    
    resolve();
   };

   xhr.open('POST', submitUrl);
   xhr.send(formData);
  });
 } else {
  // No file — plain fetch is fine.
  resBox.innerHTML = 'Submitting test entry to edge endpoint...';
  
  try {
   const response = await fetch(submitUrl, { method: 'POST', body: formData });
   const result = await response.json();
   if (response.ok && result.ok) {
    showToast(result.successMessage || 'Live test submitted successfully!', 'success');
    let msgHtml = '<div style="color:var(--success-color); font-weight:700; margin-bottom:0.4rem;">' + escapeHtml(result.successMessage || 'Success!') + '</div>';
    msgHtml += '<div>Submission ID: <code>' + escapeHtml(result.id) + '</code></div>';
    if (result.redirectUrl) {
     msgHtml += '<div style="margin-top:0.4rem; font-size:0.8rem; color:var(--text-secondary);">Redirect: <a href="' + escapeHtml(result.redirectUrl) + '" target="_blank" style="color:#818cf8;text-decoration:underline;">' + escapeHtml(result.redirectUrl) + '</a></div>';
    }
    resBox.innerHTML = msgHtml;
    form.reset();
   } else {
    resBox.innerHTML = '<span style="color:var(--danger-color);">Submission Error:</span> <code>' + escapeHtml(result.error || 'Unknown error') + '</code>';
   }
  } catch (err) {
   resBox.innerHTML = '<span style="color:var(--danger-color);">Network Error during submit</span>';
  }
  
 }
}

// --- Auth Modals (Login & Register) ---
function openLoginModal() {
 document.getElementById('login-username').value = '';
 document.getElementById('login-password').value = '';
 document.getElementById('login-error-msg').style.display = 'none';
 openModal('login-modal');
}

function openRegisterModal() {
 document.getElementById('reg-username').value = '';
 document.getElementById('reg-email').value = '';
 document.getElementById('reg-password').value = '';
 document.getElementById('reg-error-msg').style.display = 'none';
 openModal('register-modal');
}

async function handleLoginSubmit(e) {
 e.preventDefault();
 const username = document.getElementById('login-username').value.trim();
 const password = document.getElementById('login-password').value;
 const errorBox = document.getElementById('login-error-msg');
 
 try {
  const res = await fetch('/api/login', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ username, password, turnstileToken: _tsTokens.login || '' })
  });
  const data = await res.json();
  if (data.ok && data.token) {
   state.token = data.token;
   state.user = data.user;
   localStorage.setItem('fh_token', data.token);
   localStorage.setItem('fh_user', JSON.stringify(data.user));
   showToast('Welcome back, ' + data.user.username + '!', 'success');
   closeModal('login-modal');
   updateAuthUI();
   window.location.hash = '#dashboard';
  } else {
   errorBox.style.display = 'block';
   if (data.notRegistered || (data.error && data.error.toLowerCase().includes('no account'))) {
    errorBox.innerHTML = (data.error || 'No account found.') + ' <a href="#" onclick="closeModal(&quot;login-modal&quot;); openModal(&quot;register-modal&quot;); return false;" style="color:#818cf8; text-decoration:underline; font-weight:600; margin-left:0.3rem;">Register now &rarr;</a>';
   } else if (data.error && (data.error.includes('MONGODB_URI') || data.error.includes('Failed to connect'))) {
    errorBox.innerHTML = '<strong>Database Error:</strong> ' + data.error + '<br><small style="color:var(--text-secondary); margin-top:0.3rem; display:block;">Tip: Verify IP (0.0.0.0/0) is whitelisted in Atlas Network Access and MONGODB_URI in .dev.vars is valid.</small>';
   } else {
    errorBox.innerText = data.error || 'Login failed.';
   }
   
  }
 } catch (err) {
  errorBox.style.display = 'block';
  errorBox.innerText = 'Network error during login.';
 }
}

async function handleRegisterSubmit(e) {
 e.preventDefault();
 const username = document.getElementById('reg-username').value.trim();
 const email = document.getElementById('reg-email').value.trim();
 const password = document.getElementById('reg-password').value;
 const errorBox = document.getElementById('reg-error-msg');
 
 try {
  const res = await fetch('/api/register', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ username, email, password, turnstileToken: _tsTokens.register || '' })
  });
  const data = await res.json();
  if (data.ok && data.token) {
   state.token = data.token;
   state.user = data.user;
   localStorage.setItem('fh_token', data.token);
   localStorage.setItem('fh_user', JSON.stringify(data.user));
   showToast('Account created successfully!', 'success');
   closeModal('register-modal');
   updateAuthUI();
   window.location.hash = '#dashboard';
  } else {
   errorBox.style.display = 'block';
   if (data.alreadyRegistered || (data.error && data.error.toLowerCase().includes('already registered'))) {
    errorBox.innerHTML = (data.error || 'Already registered.') + ' <a href="#" onclick="closeModal(&quot;register-modal&quot;); openModal(&quot;login-modal&quot;); return false;" style="color:#818cf8; text-decoration:underline; font-weight:600; margin-left:0.3rem;">Sign in now &rarr;</a>';
   } else if (data.error && (data.error.includes('MONGODB_URI') || data.error.includes('Failed to connect'))) {
    errorBox.innerHTML = '<strong>Database Error:</strong> ' + data.error + '<br><small style="color:var(--text-secondary); margin-top:0.3rem; display:block;">Tip: Verify IP (0.0.0.0/0) is whitelisted in Atlas Network Access and MONGODB_URI in .dev.vars is valid.</small>';
   } else {
    errorBox.innerText = data.error || 'Registration failed.';
   }
   
  }
 } catch (err) {
  errorBox.style.display = 'block';
  errorBox.innerText = 'Network error during registration.';
 }
}

// --- Modal Helper Logic ---
function openModal(id) {
 const modal = document.getElementById(id);
 if (modal) modal.classList.add('open');
}

function closeModal(id) {
 const modal = document.getElementById(id);
 if (modal) modal.classList.remove('open');
}

function setupModalEvents() {
 document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
   if (e.target === el) {
    el.classList.remove('open');
   }
  });
 });
}

// ── API Key Management ───────────────────────────────────────────────────

async function loadApiKeys() {
 const container = document.getElementById('apikeys-list-container');
 if (!container) return;
 try {
  const res = await fetch('/api/apikeys', {
   headers: { 'Authorization': 'Bearer ' + state.token }
  });
  const data = await res.json();
  if (!data.ok) {
   container.innerHTML = '<div style="color:var(--danger-color);padding:1rem;">Failed to load API keys.</div>';
   return;
  }
  renderApiKeysList(data.apikeys || [], container);
 } catch (e) {
  container.innerHTML = '<div style="color:var(--danger-color);padding:1rem;">Network error.</div>';
 }
}

function renderApiKeysList(keys, container) {
 if (!container) return;
 const active = keys.filter(k => !k.revokedAt);
 const revoked = keys.filter(k => k.revokedAt);

 if (keys.length === 0) {
  container.innerHTML = \`
   <div style="text-align:center; padding:2.5rem; background:var(--bg-card); border:1px dashed var(--border-color); border-radius:var(--radius-md);">
    <div style="font-size:2rem; margin-bottom:0.75rem;">🔑</div>
    <p style="color:var(--text-muted); margin:0;">No API keys yet. Create one to start making programmatic requests.</p>
   </div>
  \`;
  return;
 }

 const renderKey = (k) => {
  const perms = k.permissions || {};
  const actions = perms.actions || [];
  const apps = perms.apps;
  const lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never';
  const created = k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '';
  const isRevoked = !!k.revokedAt;
  return \`
   <div class="apikey-card \${isRevoked ? 'revoked' : ''}">
    <div class="apikey-info">
     <div class="apikey-name">\${escapeHtml(k.name)}</div>
     <div class="apikey-hint">\${escapeHtml(k.keyHint || '')}</div>
     <div class="apikey-meta">Created: \${created} &nbsp;·&nbsp; Last used: \${lastUsed}</div>
    </div>
    <div class="apikey-permissions">
     \${actions.includes('read') ? '<span class="perm-badge perm-badge-read">📖 Read</span>' : ''}
     \${actions.includes('submit') ? '<span class="perm-badge perm-badge-submit">✉ Submit</span>' : ''}
     <span class="perm-badge perm-badge-scope">\${apps === '*' ? '★ All Apps' : (Array.isArray(apps) ? apps.length + ' app(s)' : '')}</span>
     \${isRevoked ? '<span class="perm-badge perm-badge-revoked">Revoked</span>' : ''}
    </div>
    \${!isRevoked ? \`
     <button class="btn btn-secondary btn-sm" style="color:var(--danger-color); border-color:var(--danger-color);" onclick="revokeApiKey('\${escapeHtml(k.id)}', this)">
      Revoke
     </button>
    \` : ''}
   </div>
  \`;
 };

 container.innerHTML = \`
  <div class="apikey-list">
   \${active.map(renderKey).join('')}
   \${revoked.length > 0 ? \`
    <details style="margin-top:0.5rem;">
     <summary style="cursor:pointer; color:var(--text-muted); font-size:0.85rem; padding:0.4rem 0;">Show revoked keys (\${revoked.length})</summary>
     <div class="apikey-list" style="margin-top:0.5rem;">\${revoked.map(renderKey).join('')}</div>
    </details>
   \` : ''}
  </div>
 \`;
}

async function revokeApiKey(id, btn) {
 if (!confirm('Revoke this API key? All requests using it will immediately fail.')) return;
 btn.disabled = true;
 btn.textContent = 'Revoking...';
 try {
  const res = await fetch('/api/apikeys/' + id, {
   method: 'DELETE',
   headers: { 'Authorization': 'Bearer ' + state.token }
  });
  const data = await res.json();
  if (data.ok) {
   showToast('API key revoked successfully.', 'success');
   await loadApiKeys();
  } else {
   showToast(data.error || 'Failed to revoke key.', 'error');
   btn.disabled = false;
   btn.textContent = 'Revoke';
  }
 } catch (e) {
  showToast('Network error.', 'error');
  btn.disabled = false;
  btn.textContent = 'Revoke';
 }
}

function openCreateApiKeyModal() {
 // Reset form to creation state
 document.getElementById('apikey-reveal-area').style.display = 'none';
 document.getElementById('apikey-create-form').style.display = '';
 document.getElementById('apikey-create-error').style.display = 'none';
 document.getElementById('apikey-name-input').value = '';
 document.getElementById('perm-read').checked = true;
 document.getElementById('perm-submit').checked = true;
 document.getElementById('scope-all').checked = true;
 document.getElementById('apikey-app-list-container').style.display = 'none';

 // Populate app checkboxes with current apps list
 const checkboxContainer = document.getElementById('apikey-app-checkboxes');
 if (checkboxContainer) {
  if (state.apps && state.apps.length > 0) {
   checkboxContainer.innerHTML = state.apps.map(app => \`
    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.3rem 0;">
     <input type="checkbox" name="apikey-app" value="\${escapeHtml(app.appName)}" style="accent-color:var(--accent-color);" />
     <span style="font-size:0.88rem;">\${escapeHtml(app.appName)}</span>
     \${app.settings?.appTitle ? \`<span style="color:var(--text-muted); font-size:0.78rem;">— \${escapeHtml(app.settings.appTitle)}</span>\` : ''}
    </label>
   \`).join('');
  } else {
   checkboxContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; margin:0;">No apps found. Create an app first.</p>';
  }
 }

 openModal('apikey-create-modal');
}

function toggleApikeyAppList() {
 const isSpecific = document.getElementById('scope-specific').checked;
 document.getElementById('apikey-app-list-container').style.display = isSpecific ? '' : 'none';
}

async function submitCreateApiKey() {
 const errEl = document.getElementById('apikey-create-error');
 errEl.style.display = 'none';

 const name = document.getElementById('apikey-name-input').value.trim();
 if (!name) {
  errEl.textContent = 'Please provide a name for this key.';
  errEl.style.display = '';
  return;
 }

 const actions = [];
 if (document.getElementById('perm-read').checked) actions.push('read');
 if (document.getElementById('perm-submit').checked) actions.push('submit');
 if (actions.length === 0) {
  errEl.textContent = 'Select at least one permission (Read or Submit).';
  errEl.style.display = '';
  return;
 }

 let apps = '*';
 if (document.getElementById('scope-specific').checked) {
  const checked = Array.from(document.querySelectorAll('#apikey-app-checkboxes input[name="apikey-app"]:checked')).map(el => el.value);
  if (checked.length === 0) {
   errEl.textContent = 'Select at least one app, or switch scope to "All my apps".';
   errEl.style.display = '';
   return;
  }
  apps = checked;
 }

 const btn = document.querySelector('#apikey-create-modal #apikey-create-form .btn-primary');
 if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

 try {
  const res = await fetch('/api/apikeys', {
   method: 'POST',
   headers: {
    'Authorization': 'Bearer ' + state.token,
    'Content-Type': 'application/json'
   },
   body: JSON.stringify({ name, permissions: { actions, apps } })
  });
  const data = await res.json();

  if (!data.ok || !data.apikey) {
   errEl.textContent = data.error || 'Failed to create API key.';
   errEl.style.display = '';
   if (btn) { btn.disabled = false; btn.textContent = 'Generate Key'; }
   return;
  }

  // Show reveal area
  document.getElementById('apikey-reveal-value').textContent = data.apikey.key;
  document.getElementById('apikey-create-form').style.display = 'none';
  document.getElementById('apikey-reveal-area').style.display = '';
  showToast('API key created! Copy it now — it will not be shown again.', 'success');
 } catch (e) {
  errEl.textContent = 'Network error. Please try again.';
  errEl.style.display = '';
  if (btn) { btn.disabled = false; btn.textContent = 'Generate Key'; }
 }
}

function copyApiKeyValue() {
 const val = document.getElementById('apikey-reveal-value').textContent;
 if (!val) return;
 navigator.clipboard.writeText(val).then(() => {
  showToast('API key copied to clipboard!', 'success');
 }).catch(() => {
  showToast('Copy failed — please select and copy manually.', 'error');
 });
}
`;
