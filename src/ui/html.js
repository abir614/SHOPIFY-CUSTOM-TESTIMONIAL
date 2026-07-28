import { STYLES } from "./styles.js";
import { SCRIPTS } from "./scripts.js";
import { SECURITY_HEADERS } from "../security.js";

export function renderUI(request) {
  const siteKey = process.env.PLATFORM_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
 <meta charset="UTF-8" />
 <meta name="viewport" content="width=device-width, initial-scale=1.0" />
 <title>FormHub — Multi-Tenant Edge Forms & Shopify Metaobject Platform</title>
 <meta name="description" content="Multi-tenant form intake platform on Node.js and MongoDB with optional Shopify Admin API metaobject sync." />
 <link rel="preconnect" href="https://fonts.googleapis.com" />
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
 <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
 <script>window.PLATFORM_TURNSTILE_SITE_KEY = "${siteKey}";</script>
 <style>
  ${STYLES}
 </style>
</head>
<body>
 <!-- Background Glow Animations -->
 <div class="bg-glow-container">
  <div class="bg-glow-circle bg-glow-1"></div>
  <div class="bg-glow-circle bg-glow-2"></div>
  <div class="bg-glow-circle bg-glow-3"></div>
 </div>

 <!-- Sticky Top Navigation -->
 <header class="app-header">
  <a class="logo-group" href="#home">
   <div class="logo-icon">FH</div>
   <div>
    <span class="logo-text">FormHub</span>
   </div>
   <span class="logo-badge">Node.js App</span>
  </a>

  <nav class="nav-links" id="nav-links">
   <a class="nav-link active" href="#home">Home</a>
   <a class="nav-link" href="#guide">Shopify Metaobjects</a>
  </nav>

  <div class="nav-actions" id="nav-auth-actions">
   <!-- Dynamically populated by JS based on user session -->
  </div>
 </header>

 <!-- Main View Router Container -->
 <main class="main-content" id="main-view">
  <!-- Rendered dynamically by SPA client router -->
 </main>

 <!-- Toast Notification System -->
 <div id="toast-container" class="toast-container"></div>

 <!-- MODALS SECTION -->

 <!-- 1. Login Modal -->
 <div id="login-modal" class="modal-overlay">
  <div class="modal-container" style="max-width: 440px;">
   <div class="modal-header">
    <h3 class="modal-title">Sign In to FormHub</h3>
    <button class="modal-close" onclick="closeModal('login-modal')"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
   </div>
   <form onsubmit="handleLoginSubmit(event)">
    <div class="modal-body">
     <div id="login-error-msg" style="display:none; padding:0.75rem; background:var(--danger-bg); color:var(--danger-color); border-radius:var(--radius-sm); font-size:0.85rem; margin-bottom:1rem;"></div>
     <div class="form-group">
      <label class="form-label">Username</label>
      <input type="text" id="login-username" class="form-input" placeholder="Enter your username" required />
     </div>
     <div class="form-group">
      <label class="form-label">Password</label>
      <input type="password" id="login-password" class="form-input" placeholder="••••••••" required />
     </div>
    </div>
    <div style="display:flex; justify-content:center; margin: 0.5rem 0 0.25rem;">
     <div class="cf-turnstile" id="login-turnstile" data-sitekey="${siteKey}" data-theme="dark" data-callback="onLoginTurnstileSuccess" data-expired-callback="onLoginTurnstileExpired"></div>
    </div>
    <div class="modal-footer">
     <button type="button" class="btn btn-secondary" onclick="closeModal('login-modal')">Cancel</button>
     <button type="submit" class="btn btn-primary">Sign In</button>
    </div>
   </form>
  </div>
 </div>

 <!-- 2. Register Modal -->
 <div id="register-modal" class="modal-overlay">
  <div class="modal-container" style="max-width: 480px;">
   <div class="modal-header">
    <h3 class="modal-title">Create Free FormHub Account</h3>
    <button class="modal-close" onclick="closeModal('register-modal')"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
   </div>
   <form onsubmit="handleRegisterSubmit(event)">
    <div class="modal-body">
     <div id="reg-error-msg" style="display:none; padding:0.75rem; background:var(--danger-bg); color:var(--danger-color); border-radius:var(--radius-sm); font-size:0.85rem; margin-bottom:1rem;"></div>
     <div class="form-group">
      <label class="form-label">Username Slug</label>
      <input type="text" id="reg-username" class="form-input" placeholder="e.g. abir (3-32 chars lowercase)" required />
      <span class="form-hint">Used in your public API URLs: /your-username/app-name/</span>
     </div>
     <div class="form-group">
      <label class="form-label">Email Address</label>
      <input type="email" id="reg-email" class="form-input" placeholder="you@example.com" required />
     </div>
     <div class="form-group">
      <label class="form-label">Password</label>
      <input type="password" id="reg-password" class="form-input" placeholder="At least 8 characters" minlength="8" required />
     </div>
    </div>
    <div style="display:flex; justify-content:center; margin: 0.5rem 0 0.25rem;">
     <div class="cf-turnstile" id="register-turnstile" data-sitekey="${siteKey}" data-theme="dark" data-callback="onRegisterTurnstileSuccess" data-expired-callback="onRegisterTurnstileExpired"></div>
    </div>
    <div class="modal-footer">
     <button type="button" class="btn btn-secondary" onclick="closeModal('register-modal')">Cancel</button>
     <button type="submit" class="btn btn-primary">Create Account</button>
    </div>
   </form>
  </div>
 </div>

 <!-- 3. App Creator / Editor Modal (Multi-Tab) -->
 <div id="app-editor-modal" class="modal-overlay">
  <div class="modal-container" style="max-width: 820px;">
   <div class="modal-header">
    <h3 class="modal-title" id="app-modal-title">Create New Form Application</h3>
    <button class="modal-close" onclick="closeModal('app-editor-modal')"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
   </div>
   <div class="modal-body">
    <!-- Quick Start Template Presets Bar -->
    <div style="background:rgba(129,140,248,0.08); border:1px solid rgba(129,140,248,0.25); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-bottom:1.2rem; display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem;">
     <span style="font-size:0.8rem; font-weight:700; color:var(--accent-color); text-transform:uppercase; letter-spacing:0.05em; margin-right:0.3rem;">Presets:</span>
     <button type="button" class="btn btn-secondary btn-sm" onclick="applyTemplatePreset('contact')">Contact</button>
     <button type="button" class="btn btn-secondary btn-sm" onclick="applyTemplatePreset('shopify-story')">Shopify Product Story</button>
     <button type="button" class="btn btn-secondary btn-sm" onclick="applyTemplatePreset('survey')"> Survey</button>
     <button type="button" class="btn btn-secondary btn-sm" onclick="applyTemplatePreset('event')"> Event</button>
     <button type="button" class="btn btn-secondary btn-sm" onclick="applyTemplatePreset('blank')" style="border-color:var(--border-color); color:var(--text-secondary);"> Blank</button>
    </div>

    <!-- Tabs Header -->
    <div class="tabs-header">
     <button type="button" class="tab-btn app-tab-btn active" data-tab="general" onclick="switchAppModalTab('general')"> General & UI</button>
     <button type="button" class="tab-btn app-tab-btn" data-tab="fields" onclick="switchAppModalTab('fields')">Fields Schema</button>
     <button type="button" class="tab-btn app-tab-btn" data-tab="shopify" onclick="switchAppModalTab('shopify')"> Shopify Sync</button>
     <button type="button" class="tab-btn app-tab-btn" data-tab="security" onclick="switchAppModalTab('security')">Security & Limits</button>
    </div>

    <!-- Tab 1: General & UI Theme Customization -->
    <div id="tab-pane-general" class="app-tab-pane">
     <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
      <div class="form-group">
       <label class="form-label">Application Slug / Key <span style="color:var(--danger-color)">*</span></label>
       <input type="text" id="app-name-input" class="form-input" placeholder="e.g. story-intake (lowercase letters, numbers, -)" required />
       <span class="form-hint">API endpoint: <code style="color:#818cf8">/api/:username/:app-name/</code></span>
      </div>
      <div class="form-group">
       <label class="form-label">Display Form Title</label>
       <input type="text" id="app-title-input" class="form-input" placeholder="e.g. Share Your Story" />
       <span class="form-hint">Shown at the top of your public form & emails</span>
      </div>
     </div>

     <div class="form-group">
      <label class="form-label">Form Description / Instructions</label>
      <input type="text" id="app-description-input" class="form-input" placeholder="e.g. Please fill out your details below. We value your privacy." />
      <span class="form-hint">Subtitle explaining what this form is for</span>
     </div>

     <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:1rem;">
      <div class="form-group">
       <label class="form-label">Brand Accent Color (Theme)</label>
       <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.3rem;">
        <input type="color" id="app-theme-color" value="818cf8" style="width:42px; height:38px; border:none; background:none; cursor:pointer;" onchange="document.getElementById('app-theme-hex').value = this.value" />
        <input type="text" id="app-theme-hex" class="form-input" value="818cf8" style="width:110px;" oninput="if(/^[0-9A-Fa-f]{6}$/.test(this.value)) document.getElementById('app-theme-color').value = this.value" />
        <div style="display:flex; gap:0.4rem; margin-left:auto;">
         <span onclick="setThemeSwatch('818cf8')" style="width:22px; height:22px; border-radius:50%; background:#818cf8; cursor:pointer; display:inline-block;" title="Indigo"></span>
         <span onclick="setThemeSwatch('10b981')" style="width:22px; height:22px; border-radius:50%; background:#10b981; cursor:pointer; display:inline-block;" title="Emerald"></span>
         <span onclick="setThemeSwatch('f43f5e')" style="width:22px; height:22px; border-radius:50%; background:#f43f5e; cursor:pointer; display:inline-block;" title="Rose"></span>
         <span onclick="setThemeSwatch('f59e0b')" style="width:22px; height:22px; border-radius:50%; background:#f59e0b; cursor:pointer; display:inline-block;" title="Amber"></span>
         <span onclick="setThemeSwatch('06b6d4')" style="width:22px; height:22px; border-radius:50%; background:#06b6d4; cursor:pointer; display:inline-block;" title="Cyan"></span>
         <span onclick="setThemeSwatch('a855f7')" style="width:22px; height:22px; border-radius:50%; background:#a855f7; cursor:pointer; display:inline-block;" title="Violet"></span>
        </div>
       </div>
       <span class="form-hint">Matches your brand styling across form UI and embedded forms</span>
      </div>
      <div class="form-group">
       <label class="form-label">Submit Button Label</label>
       <input type="text" id="app-submit-btn-input" class="form-input" placeholder="e.g. Submit Form / Register" value="Submit Form" />
       <span class="form-hint">Custom text for primary submit button</span>
      </div>
     </div>

     <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
      <div class="form-group">
       <label class="form-label">Success Message After Submit</label>
       <input type="text" id="app-success-msg-input" class="form-input" placeholder="Thank you! Your submission has been received." value="Thank you! Your submission has been received." />
       <span class="form-hint">Message shown to user on successful submission</span>
      </div>
      <div class="form-group">
       <label class="form-label">Redirect URL (Optional)</label>
       <input type="text" id="app-redirect-url-input" class="form-input" placeholder="e.g. https://mystore.com/thank-you" />
       <span class="form-hint">Optional destination to redirect users after submitting</span>
      </div>
     </div>

     <div class="form-group">
      <label class="form-label">Webhook URL (Optional Real-Time Notification)</label>
      <input type="text" id="app-webhook-url-input" class="form-input" placeholder="e.g. https://hooks.zapier.com/hooks/catch/..." />
      <span class="form-hint">We POST JSON submission data to this webhook URL immediately on every new submission</span>
     </div>
    </div>

    <!-- Tab 2: Fields Schema Builder -->
    <div id="tab-pane-fields" class="app-tab-pane" style="display:none;">
     <div style="margin-top: 0.2rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.8rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
      <div>
       <label class="form-label" style="margin:0; font-size: 0.95rem; color:#fff;">Form Fields & Advanced Customization</label>
       <span class="form-hint" style="margin: 0.2rem 0 0 0; display: block;">Design your form schema, layout width, validation regex, and rich field properties.</span>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onclick="addFieldRow()" style="white-space: nowrap;">+ Add New Field</button>
     </div>

     <div id="fields-builder-list" style="display: flex; flex-direction: column; gap: 1.1rem;"></div>
    </div>

    <!-- Tab 2: Shopify Metaobjects Configurator -->
    <div id="tab-pane-shopify" class="app-tab-pane" style="display:none;">
     <div class="guide-banner" style="margin-bottom:1.5rem;">
      <div class="guide-banner-text">
       <h4>Shopify Metaobject Auto-Sync</h4>
       <p>Every submission is saved to MongoDB first, then automatically synced as a Metaobject in your Shopify Store!</p>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="window.location.hash = '#guide'; closeModal('app-editor-modal');">Setup Guide</button>
     </div>

     <label class="form-checkbox-group" style="margin-bottom: 1.5rem; padding: 0.8rem; background:rgba(255,255,255,0.03); border-radius:var(--radius-md); border:1px solid var(--border-color);">
      <input type="checkbox" id="shopify-enabled" class="form-checkbox" onchange="updateShopifyTabVisibility()" />
      <div>
       <strong style="color:var(--text-primary); font-size:0.95rem;">Enable Shopify Metaobject Sync</strong>
       <div class="form-hint" style="margin:0;">Turn this on to sync submissions to your Shopify Admin API.</div>
      </div>
     </label>

     <div id="shopify-config-fields" style="opacity:0.4; pointer-events:none; transition:opacity 0.3s ease;">
      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1rem;">
       <div class="form-group">
        <label class="form-label">Shopify Store Domain</label>
        <input type="text" id="shopify-store-domain" class="form-input" placeholder="your-store.myshopify.com" />
       </div>
       <div class="form-group">
        <label class="form-label">Admin API Version</label>
        <input type="text" id="shopify-api-version" class="form-input" value="2025-01" placeholder="2025-01" />
       </div>
      </div>

      <div class="form-group">
       <label class="form-label">Shopify Admin API Access Token (<code style="color:#818cf8">shpat_...</code>)</label>
       <input type="password" id="shopify-admin-token" class="form-input" placeholder="Leave blank to keep existing encrypted token unchanged" />
       <span class="form-hint">Token requires <code style="color:#818cf8">write_metaobjects</code> and <code style="color:#818cf8">write_files</code> scopes. Stored encrypted with AES-GCM at rest.</span>
      </div>

      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1rem;">
       <div class="form-group">
        <label class="form-label">Metaobject Type Handle</label>
        <input type="text" id="shopify-metaobject-type" class="form-input" placeholder="e.g. story_intake" />
        <span class="form-hint">Must match your Custom Data definition in Shopify Admin</span>
       </div>
       <div class="form-group">
        <label class="form-label">Image Upload Field Key</label>
        <select id="shopify-image-field" class="form-select">
         <option value="">-- None / No Image --</option>
        </select>
        <span class="form-hint">Which file field uploads to Shopify Files</span>
       </div>
      </div>

      <div class="form-group" style="display:flex;align-items:flex-start;gap:0.75rem;margin-top:0.5rem;">
       <input type="checkbox" id="shopify-dual-write" style="width:16px;height:16px;margin-top:3px;accent-color:var(--accent);flex-shrink:0;">
       <div>
        <label class="form-label" for="shopify-dual-write" style="margin:0;cursor:pointer;">Enable Dual Write</label>
        <span class="form-hint" style="display:block;margin-top:2px;">Also creates a <code>testimonial</code> or <code>pet_testimonial</code> metaobject when <code>permission_to_share</code> includes &ldquo;Yes&rdquo;</span>
       </div>
      </div>

      <div style="margin-top:1.5rem;">
       <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <label class="form-label" style="margin:0;">Custom Field Mapping (Optional)</label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addShopifyMappingRow()">Add Field Map</button>
       </div>
       <p class="form-hint" style="margin-top:0; margin-bottom:0.75rem;">
        Map your FormHub field key to a different Shopify Metaobject field key if their names differ (by default keys match 1-to-1).
       </p>
       <div id="shopify-mapping-list"></div>
      </div>
     </div>
    </div>

    <!-- Tab 3: Security & Rate Limits -->
    <div id="tab-pane-security" class="app-tab-pane" style="display:none;">
     <div class="form-group">
      <label class="form-label">Allowed CORS Origins</label>
      <input type="text" id="setting-origins" class="form-input" placeholder="e.g. * or https://mystore.com, https://example.org" value="*" />
      <span class="form-hint">Comma-separated list of web origins allowed to call your public POST endpoint</span>
     </div>

     <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
      <div class="form-group">
       <label class="form-label">Max File Size (MB)</label>
       <input type="number" id="setting-max-file-mb" class="form-input" min="1" max="25" value="10" />
      </div>
      <div class="form-group">
       <label class="form-label">Max Form Fields Count</label>
       <input type="number" id="setting-max-fields" class="form-input" min="5" max="100" value="40" />
      </div>
     </div>

     <div class="form-group">
      <label class="form-label">Honeypot Field Name</label>
      <input type="text" id="setting-honeypot" class="form-input" value="website" />
      <span class="form-hint">Bots fill every field—if this hidden field is filled, the submission is silently dropped.</span>
     </div>

     <div style="margin-top: 1.5rem; padding: 1.2rem; background:rgba(255,255,255,0.03); border-radius:var(--radius-md); border:1px solid var(--border-color);">
      <label class="form-checkbox-group" style="margin-bottom:0.75rem;">
       <input type="checkbox" id="setting-turnstile-enabled" class="form-checkbox" />
       <strong style="color:var(--text-primary);">Enable Cloudflare Turnstile CAPTCHA</strong>
      </label>
      <div class="form-group" style="margin-bottom:0;">
       <label class="form-label">Turnstile Secret Key</label>
       <input type="password" id="setting-turnstile-secret" class="form-input" placeholder="0x4AAAAAAA..." />
       <span class="form-hint">Secret key is encrypted at rest in MongoDB. Never sent back to client.</span>
      </div>
     </div>
    </div>
   </div>
    <div style="display:flex; justify-content:center; margin-bottom:0.75rem;">
     <div class="cf-turnstile" id="create-app-turnstile" data-sitekey="${siteKey}" data-theme="dark" data-callback="onCreateAppTurnstileSuccess" data-expired-callback="onCreateAppTurnstileExpired"></div>
    </div>
    <div class="modal-footer">
     <button type="button" class="btn btn-secondary" onclick="closeModal('app-editor-modal')">Cancel</button>
     <button type="button" class="btn btn-primary" onclick="saveApp()">Save Form Schema</button>
    </div>
  </div>
 </div>

 <!-- 4. API Hub & Code Snippets Modal -->
 <div id="api-hub-modal" class="modal-overlay">
  <div class="modal-container" style="max-width: 800px;">
   <div class="modal-header">
    <h3 class="modal-title" id="api-hub-modal-title">API Hub & Integration Snippets</h3>
    <button class="modal-close" onclick="closeModal('api-hub-modal')"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
   </div>
   <div class="modal-body">
    <div class="form-group">
     <label class="form-label">Final API Submission Endpoint URL</label>
     <div style="display:flex; gap:0.5rem;">
      <input type="text" id="hub-submit-url" class="form-input" readonly style="font-family:var(--font-mono); color:#818cf8;" />
      <button class="btn btn-secondary" onclick="copyText('hub-submit-url', this)">Copy URL</button>
     </div>
    </div>

    <div style="margin-top: 1.5rem;">
     <h4 style="margin-bottom:0.75rem;">1. Ready-to-use HTML &lt;form&gt; Snippet</h4>
     <div style="position:relative;">
      <button class="copy-btn" onclick="copyText('snippet-html', this)">Copy HTML</button>
      <pre class="code-box" id="snippet-html"></pre>
     </div>
    </div>

    <div style="margin-top: 1.5rem;">
     <h4 style="margin-bottom:0.75rem;">2. Vanilla JavaScript (fetch) Async Upload</h4>
     <div style="position:relative;">
      <button class="copy-btn" onclick="copyText('snippet-js', this)">Copy JS</button>
      <pre class="code-box" id="snippet-js"></pre>
     </div>
    </div>

    <div style="margin-top: 1.5rem;">
     <h4 style="margin-bottom:0.75rem;">3. cURL CLI Test Command</h4>
     <div style="position:relative;">
      <button class="copy-btn" onclick="copyText('snippet-curl', this)">Copy cURL</button>
      <pre class="code-box" id="snippet-curl"></pre>
     </div>
    </div>
   </div>
   <div class="modal-footer">
    <button type="button" class="btn btn-secondary" onclick="closeModal('api-hub-modal')">Close</button>
   </div>
  </div>
 </div>

 <!-- 5. Submissions Viewer Modal -->
 <div id="submissions-modal" class="modal-overlay">
  <div class="modal-container" style="max-width: 1000px;">
   <div class="modal-header">
    <h3 class="modal-title" id="submissions-modal-title">Collected Form Submissions</h3>
    <div style="display:flex; gap:0.5rem; align-items:center;">
     <button class="btn btn-secondary btn-sm" onclick="exportSubmissionsCsv()">Export CSV</button>
     <button class="modal-close" onclick="closeModal('submissions-modal')"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>
   </div>
   <div class="modal-body" style="padding: 1rem;">
    <div class="table-container">
     <table class="data-table">
      <thead>
       <tr>
        <th>ID</th>
        <th>Timestamp</th>
        <th>Shopify Sync</th>
        <th>Form Fields Data</th>
        <th>Uploaded File</th>
        <th>Actions</th>
       </tr>
      </thead>
      <tbody id="submissions-table-body">
       <!-- Dynamically populated -->
      </tbody>
     </table>
    </div>
   </div>
   <div class="modal-footer">
    <button type="button" class="btn btn-secondary" onclick="closeModal('submissions-modal')">Close</button>
   </div>
  </div>
 </div>

 <!-- 6. Inspect Submission Modal (Shopify Errors / Full JSON) -->
 <div id="inspect-submission-modal" class="modal-overlay">
  <div class="modal-container" style="max-width: 650px;">
   <div class="modal-header">
    <h3 class="modal-title" id="inspect-modal-title">Submission Details</h3>
    <button class="modal-close" onclick="closeModal('inspect-submission-modal')"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
   </div>
   <div class="modal-body" id="inspect-modal-body">
    <!-- Dynamically populated -->
   </div>
   <div class="modal-footer">
    <button type="button" class="btn btn-secondary" onclick="closeModal('inspect-submission-modal')">Close</button>
   </div>
  </div>
 </div>

 <!-- 7. Interactive Live Test Modal -->
 <div id="live-test-modal" class="modal-overlay" style="align-items:flex-start;overflow-y:auto;padding:2rem 1rem;">
  <div class="modal-container" style="max-width: 580px;margin:auto;">
   <div class="modal-header">
    <h3 class="modal-title" id="test-modal-title">Live Test Submission</h3>
    <button class="modal-close" onclick="closeModal('live-test-modal')"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
   </div>
   <form id="test-form" onsubmit="submitLiveTestForm(event)" style="display:flex;flex-direction:column;min-height:0;flex:1;">
    <div class="modal-body">
     <p class="form-hint" style="margin-top:0; margin-bottom:1.25rem;">
      This renders your exact form schema. Submitting will send a live POST request to your Node.js API endpoint and save it in MongoDB (and Shopify if enabled).
     </p>
     <div id="test-form-fields-container"></div>
     <div id="test-result-box" style="display:none; margin-top:1.25rem; padding:1rem; background:rgba(0,0,0,0.3); border-radius:var(--radius-md); font-family:var(--font-mono); font-size:0.85rem;"></div>
    </div>
    <div class="modal-footer">
     <button type="button" class="btn btn-secondary" onclick="closeModal('live-test-modal')">Close</button>
     <button type="submit" class="btn btn-primary">Submit Test Entry</button>
    </div>
   </form>
  </div>
 </div>

 <script>
  ${SCRIPTS}
 </script>
</body>
</html>`;

 return new Response(html, {
  status: 200,
  headers: {
   "Content-Type": "text/html; charset=utf-8",
   "Cache-Control": "no-store, no-cache, must-revalidate",
   ...SECURITY_HEADERS,
  },
 });
}
