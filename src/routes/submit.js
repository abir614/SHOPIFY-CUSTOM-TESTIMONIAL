import { verifyTurnstile } from '../lib/turnstile.js';
import { uploadImageToShopify, shopifyGraphQL } from '../lib/shopify.js';
import { sniffImageMime, stripJpegExif } from '../lib/image.js';
import {
  ALLOWED_KEYS,
  REQUIRED_FIELDS,
  EMAIL_REGEX,
  ROLE_OPTIONS,
  RELATIONSHIP_OPTIONS,
  normalizeEnumValue,
  sanitizeUserErrors,
  asString,
} from '../lib/validation.js';
import { config } from '../config.js';
import { getClientIp } from '../lib/ip.js';
import { logger } from '../lib/logger.js';

const MAX_FIELD_LENGTH = config.limits.maxFieldLength;

const CREATE_STORY_INTAKE = `
  mutation CreateStoryIntake($metaobject: MetaobjectCreateInput!) {
    intake: metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message code }
    }
  }
`;

const CREATE_STORY_INTAKE_AND_TESTIMONIAL = `
  mutation CreateStoryIntakeAndTestimonial($metaobject: MetaobjectCreateInput!, $testimonial: MetaobjectCreateInput!) {
    intake: metaobjectCreate(metaobject: $metaobject) {
      userErrors { field message code }
    }
    testimonial: metaobjectCreate(metaobject: $testimonial) {
      userErrors { field message code }
    }
  }
`;

export async function handleSubmit(req, res) {
  const body = req.body || {};

  // Honeypot: a hidden field real users never fill in. Bots that submit it
  // get a fake "success" and nothing downstream (Turnstile, Shopify) is
  // ever touched — cheapest possible spam filter.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const ip = getClientIp(req);
  const turnstileOk = await verifyTurnstile(body['cf-turnstile-response'], ip);
  if (!turnstileOk) {
    return res.status(403).json({ error: 'Verification failed. Please refresh and try again.' });
  }

  for (const field of REQUIRED_FIELDS) {
    const value = body[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }

  const email = body.email;
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  let imageFileId = null;
  if (req.file) {
    if (req.file.size === 0) {
      return res.status(400).json({ error: 'The uploaded file is empty.' });
    }
    let buffer = req.file.buffer;
    // Never trust req.file.mimetype (client-supplied) — sniff real bytes.
    const mime = sniffImageMime(buffer);
    if (!mime) {
      return res.status(400).json({ error: 'The uploaded file does not appear to be a valid image.' });
    }
    if (mime === 'image/jpeg') {
      try {
        buffer = stripJpegExif(buffer);
      } catch (err) {
        logger.error('[image] EXIF strip failed, uploading original bytes:', err?.message || String(err));
      }
    }
    imageFileId = await uploadImageToShopify(buffer, mime);
  }

  const fields = {};
  for (const key of ALLOWED_KEYS) {
    const value = body[key];
    if (typeof value === 'string') fields[key] = value;
  }
  fields.role = normalizeEnumValue(fields.role, ROLE_OPTIONS);
  fields.relationship = normalizeEnumValue(fields.relationship, RELATIONSHIP_OPTIONS);

  const isPetStory = body.is_pet_story === 'true';
  if (isPetStory) {
    const uniqueTraits = asString(body.unique_traits);
    if (uniqueTraits && uniqueTraits.trim() !== '') {
      const role = asString(body.role);
      const relationship = asString(body.relationship);
      fields.kit_help_story = `${fields.kit_help_story || ''}\n\n--- Pet Details ---\n${uniqueTraits}\nRole: ${
        role ?? 'N/A'
      }\nRelationship: ${relationship ?? 'N/A'}`;
    }
  }

  const metaobjectFields = ALLOWED_KEYS.filter(
    (k) => fields[k] !== undefined && String(fields[k]).trim() !== ''
  ).map((k) => ({ key: k, value: String(fields[k]).slice(0, MAX_FIELD_LENGTH) }));
  if (imageFileId) metaobjectFields.push({ key: 'user_image', value: imageFileId });

  let mutation = CREATE_STORY_INTAKE;
  const variables = { metaobject: { type: 'story_intake', fields: metaobjectFields } };

  const permission = asString(body.permission_to_share) || '';
  if (permission.includes('Yes')) {
    const rawName = asString(body.name);
    const displayName = permission.includes('anonymous') ? 'Anonymous' : rawName && rawName.trim() ? rawName : 'Anonymous';
    const experienceStory = asString(body.experience_story);

    let testimonialType;
    let testimonialFields;

    if (isPetStory) {
      testimonialType = 'pet_testimonial';
      const hospital = asString(body.hospital);
      const lovedOneName = asString(body.loved_one_name);
      testimonialFields = [
        { key: 'author_name', value: displayName },
        { key: 'provider_name', value: hospital ? hospital.slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'pet_name', value: lovedOneName ? lovedOneName.slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'quote', value: experienceStory ? experienceStory.slice(0, MAX_FIELD_LENGTH) : '' },
      ].filter((f) => f.value !== '');
      if (imageFileId) testimonialFields.push({ key: 'pet_image', value: imageFileId });
    } else {
      testimonialType = 'testimonial';
      const hospital = asString(body.hospital);
      const role = asString(body.role);
      testimonialFields = [
        { key: 'display_name', value: displayName },
        { key: 'hospital', value: hospital ? hospital.slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'role', value: role ? role.slice(0, MAX_FIELD_LENGTH) : '' },
        { key: 'quote', value: experienceStory ? experienceStory.slice(0, MAX_FIELD_LENGTH) : '' },
      ].filter((f) => f.value !== '');
      if (imageFileId) testimonialFields.push({ key: 'user_image', value: imageFileId });
    }

    mutation = CREATE_STORY_INTAKE_AND_TESTIMONIAL;
    variables.testimonial = { type: testimonialType, fields: testimonialFields };
  }

  let shopifyRes;
  try {
    shopifyRes = await shopifyGraphQL(mutation, variables);
  } catch (err) {
    logger.error('[shopify] Network error reaching Shopify:', err?.message || String(err));
    return res.status(502).json({ error: 'Could not reach Shopify. Please try again.' });
  }

  let payload;
  try {
    payload = await shopifyRes.json();
  } catch (err) {
    logger.error('[shopify] Failed to parse Shopify response:', err?.message || String(err));
    return res.status(502).json({ error: 'Unexpected response from Shopify.' });
  }

  const userErrors = [
    ...(payload?.data?.intake?.userErrors || []),
    ...(payload?.data?.testimonial?.userErrors || []),
  ];
  const systemErrors = payload.errors || [];

  if (!shopifyRes.ok || systemErrors.length > 0) {
    logger.error('[shopify] GraphQL system error:', JSON.stringify(systemErrors));
    return res.status(502).json({ error: 'Could not save your story. Please try again later.' });
  }

  if (userErrors.length > 0) {
    logger.error('[shopify] userErrors:', JSON.stringify(userErrors));
    return res.status(400).json({
      error: 'Could not save your story. Please review the highlighted fields and try again.',
      details: sanitizeUserErrors(userErrors),
    });
  }

  return res.status(200).json({ ok: true });
}
