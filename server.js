import express from 'express';
import multer from 'multer';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_KEYS = [
  'name', 'email', 'hospital', 'department', 'role',
  'date_of_experience', 'loved_one_name', 'loved_one_initials',
  'relationship', 'experience_story', 'kit_help_story',
  'favorite_memory', 'permission_to_share',
];
const REQUIRED_FIELDS = ['email', 'hospital', 'role', 'date_of_experience'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// ---------------------------------------------------------------------------
// Config — required secrets are validated at request time; missing values
// are logged server-side only and never reflected back to the client.
// ---------------------------------------------------------------------------
function getEnv() {
  return {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    SHOPIFY_ADMIN_TOKEN: process.env.SHOPIFY_ADMIN_TOKEN,
  };
}

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null; // null => nothing configured, deny all cross-origin by default
}

const allowedOrigins = getAllowedOrigins();
if (!allowedOrigins) {
  console.warn('[startup] ALLOWED_ORIGINS is not set — all cross-origin browser requests will be rejected until it is configured.');
} else if (allowedOrigins.includes('*') && process.env.NODE_ENV === 'production') {
  console.warn('[startup] ALLOWED_ORIGINS is "*" in production — consider restricting to your storefront domain(s).');
}

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / non-browser requests (no Origin header) through.
    if (!origin) return callback(null, true);
    if (allowedOrigins && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
  maxAge: 600,
};

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Fly.io terminates TLS at the edge; trust one hop for correct req.ip

app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(cors(corsOptions));

// Minimal, PII-safe request logging (method, path, status, timing only — no bodies, no query strings).
morgan.token('safe-url', (req) => req.path);
app.use(morgan(':method :safe-url :status :res[content-length] - :response-time ms'));

app.use(express.json({ limit: '100kb', strict: true }));

const submitLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this address. Please try again later.' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
    fields: 30,
    fieldSize: 5 * 1024, // 5KB per text field, well above MAX_FIELD_LENGTH
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      return cb(new Error('UNSUPPORTED_FILE_TYPE'));
    }
    cb(null, true);
  },
});

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Only surface field-level validation errors to the browser (these are meant
// to help the user fix their submission). Top-level/system GraphQL errors are
// logged server-side only, since they can carry internal schema/infra detail.
function sanitizeUserErrors(errors) {
  return (errors || []).slice(0, 10).map((e) => ({
    field: Array.isArray(e.field) ? e.field.join('.') : (e.field ? String(e.field) : null),
    message: typeof e.message === 'string' ? e.message.slice(0, 300) : 'Invalid value provided.',
  }));
}

async function verifyImageMagicBytes(file) {
  if (!file) return true;
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !ALLOWED_IMAGE_MIME.has(detected.mime)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
app.post('/', submitLimiter, upload.single('user_image'), async (req, res) => {
  const env = getEnv();

  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      console.error(`[config] Missing required environment variable: ${key}`);
      return res.status(500).json({ error: 'Service temporarily unavailable. Please try again later.' });
    }
  }

  const body = req.body || {};
  const file = req.file || null;

  if (file) {
    const looksValid = await verifyImageMagicBytes(file);
    if (!looksValid) {
      return res.status(400).json({ error: 'The uploaded file does not appear to be a valid image.' });
    }
  }

  // Honeypot
  if (body.website) {
    return res.status(200).json({ ok: true });
  }

  for (const key of REQUIRED_FIELDS) {
    if (!body[key] || typeof body[key] !== 'string' || body[key].trim() === '') {
      return res.status(400).json({ error: `Missing required field: ${key}` });
    }
  }

  if (!EMAIL_REGEX.test(body.email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  let fileGid = null;
  if (file) {
    try {
      const stagedUploadQuery = `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets { url resourceUrl parameters { name value } }
          }
        }
      `;
      const stagedUploadVariables = {
        input: [{
          filename: file.originalname || 'upload.jpg',
          mimeType: file.mimetype || 'image/jpeg',
          httpMethod: 'POST',
          resource: 'IMAGE',
        }],
      };
      const stagedUploadRes = await fetch(
        `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN },
          body: JSON.stringify({ query: stagedUploadQuery, variables: stagedUploadVariables }),
        }
      );
      const stagedUploadData = await stagedUploadRes.json();
      const target = stagedUploadData.data?.stagedUploadsCreate?.stagedTargets?.[0];

      if (target) {
        const s3FormData = new FormData();
        target.parameters.forEach((p) => s3FormData.append(p.name, p.value));
        s3FormData.append('file', new Blob([file.buffer], { type: file.mimetype || 'image/jpeg' }), file.originalname || 'upload.jpg');

        const s3Res = await fetch(target.url, { method: 'POST', body: s3FormData });

        if (s3Res.ok) {
          const fileCreateQuery = `
            mutation fileCreate($files: [FileCreateInput!]!) {
              fileCreate(files: $files) { files { id } }
            }
          `;
          const fileCreateVariables = {
            files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE' }],
          };
          const fileCreateRes = await fetch(
            `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN },
              body: JSON.stringify({ query: fileCreateQuery, variables: fileCreateVariables }),
            }
          );
          const fileCreateData = await fileCreateRes.json();
          fileGid = fileCreateData.data?.fileCreate?.files?.[0]?.id;
        }
      }
    } catch (err) {
      console.error('[shopify] Image upload failed, continuing without image:', err);
    }
  }

  let mappedBody = { ...body };
  const isPetStory = body.is_pet_story === 'true';

  // Prevent Shopify schema crashes for story_intake by mapping pet-specific roles/relationships to 'Other'
  if (isPetStory) {
    if (mappedBody.role && !['Patient', 'Family Member', 'Healthcare Professional'].includes(mappedBody.role)) {
      mappedBody.role = 'Other';
    }
    if (mappedBody.relationship && !['Mother', 'Father', 'Grandparent', 'Sibling'].includes(mappedBody.relationship)) {
      mappedBody.relationship = 'Other';
    }

    // Preserve pet specific info since unique_traits isn't in ALLOWED_KEYS
    if (mappedBody.unique_traits) {
      mappedBody.kit_help_story = (mappedBody.kit_help_story || '') + '\n\n--- Pet Details ---\n' + mappedBody.unique_traits + '\nRole: ' + (body.role || 'N/A') + '\nRelationship: ' + (body.relationship || 'N/A');
    }
  }

  const fields = ALLOWED_KEYS
    .filter((key) => mappedBody[key] !== undefined && mappedBody[key] !== null && String(mappedBody[key]).trim() !== '')
    .map((key) => ({ key, value: String(mappedBody[key]).slice(0, MAX_FIELD_LENGTH) }));

  if (fileGid) {
    fields.push({ key: 'user_image', value: fileGid });
  }

  let mutation = `
    mutation CreateStoryIntake($metaobject: MetaobjectCreateInput!) {
      intake: metaobjectCreate(metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message code }
      }
    }
  `;

  const variables = {
    metaobject: {
      type: 'story_intake',
      fields,
    },
  };

  const permission = body.permission_to_share || '';
  if (permission.includes('Yes')) {
    let displayName = permission.includes('anonymous') ? 'Anonymous' : (body.name || 'Anonymous');

    let testimonialFields = [];
    let metaobjectType = '';

    if (isPetStory) {
      metaobjectType = 'pet_testimonial';
      testimonialFields = [
        { key: 'author_name', value: displayName },
        { key: 'provider_name', value: body.hospital ? String(body.hospital).slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'pet_name', value: body.loved_one_name ? String(body.loved_one_name).slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'quote', value: body.experience_story ? String(body.experience_story).slice(0, MAX_FIELD_LENGTH) : '' },
      ].filter((f) => f.value !== '');

      if (fileGid) {
        testimonialFields.push({ key: 'pet_image', value: fileGid });
      }
    } else {
      metaobjectType = 'testimonial';
      testimonialFields = [
        { key: 'display_name', value: displayName },
        { key: 'hospital', value: body.hospital ? String(body.hospital).slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'role', value: body.role ? String(body.role).slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'quote', value: body.experience_story ? String(body.experience_story).slice(0, MAX_FIELD_LENGTH) : '' },
      ].filter((f) => f.value !== '');

      if (fileGid) {
        testimonialFields.push({ key: 'user_image', value: fileGid });
      }
    }

    mutation = `
      mutation CreateStoryIntakeAndTestimonial($metaobject: MetaobjectCreateInput!, $testimonial: MetaobjectCreateInput!) {
        intake: metaobjectCreate(metaobject: $metaobject) {
          userErrors { field message code }
        }
        testimonial: metaobjectCreate(metaobject: $testimonial) {
          userErrors { field message code }
        }
      }
    `;
    variables.testimonial = {
      type: metaobjectType,
      fields: testimonialFields,
    };
  }

  let shopifyRes;
  try {
    shopifyRes = await fetch(
      `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN,
        },
        body: JSON.stringify({ query: mutation, variables }),
      }
    );
  } catch (err) {
    console.error('[shopify] Network error reaching Shopify:', err);
    return res.status(502).json({ error: 'Could not reach Shopify. Please try again.' });
  }

  let result;
  try {
    result = await shopifyRes.json();
  } catch (err) {
    console.error('[shopify] Failed to parse Shopify response:', err);
    return res.status(502).json({ error: 'Unexpected response from Shopify.' });
  }

  const intakeErrors = result?.data?.intake?.userErrors || [];
  const testimonialErrors = result?.data?.testimonial?.userErrors || [];
  const allUserErrors = [...intakeErrors, ...testimonialErrors];
  const systemErrors = result.errors || [];

  if (!shopifyRes.ok || systemErrors.length > 0) {
    // System/GraphQL-level errors can contain internal schema or infra detail —
    // log in full server-side, but never forward to the browser.
    console.error('[shopify] GraphQL system error:', JSON.stringify(systemErrors));
    return res.status(502).json({ error: 'Could not save your story. Please try again later.' });
  }

  if (allUserErrors.length > 0) {
    console.error('[shopify] userErrors:', JSON.stringify(allUserErrors));
    return res.status(400).json({
      error: 'Could not save your story. Please review the highlighted fields and try again.',
      details: sanitizeUserErrors(allUserErrors),
    });
  }

  return res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Error handling — always JSON, never a stack trace or Express's default
// HTML error page, regardless of NODE_ENV.
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file is too large.' : 'Invalid file upload.';
    return res.status(400).json({ error: message });
  }
  if (err && err.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ error: 'Only JPEG, PNG, WEBP, or GIF images are supported.' });
  }
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Request body too large.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
});

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------
const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`Story intake server listening on port ${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});
