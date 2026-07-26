// Allow-list of fields we will ever read off the submitted form and pass
// through to Shopify. Anything not in this list is ignored — this is what
// prevents mass-assignment (a client stuffing extra/unexpected keys into
// the form and having them land on the metaobject).
export const ALLOWED_KEYS = [
  'name',
  'email',
  'hospital',
  'department',
  'role',
  'date_of_experience',
  'loved_one_name',
  'loved_one_initials',
  'relationship',
  'experience_story',
  'kit_help_story',
  'favorite_memory',
  'permission_to_share',
];

export const REQUIRED_FIELDS = ['email', 'hospital', 'role', 'date_of_experience'];

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ROLE_OPTIONS = ['Patient', 'Family Member', 'Healthcare Professional'];
export const RELATIONSHIP_OPTIONS = ['Mother', 'Father', 'Grandparent', 'Sibling'];

export const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export function normalizeEnumValue(value, allowedValues) {
  if (typeof value !== 'string' || value.trim() === '' || allowedValues.includes(value)) {
    return value;
  }
  return 'Other';
}

export function sanitizeUserErrors(errors) {
  return (errors || []).slice(0, 10).map((e) => ({
    field: Array.isArray(e.field) ? e.field.join('.') : e.field ? String(e.field) : null,
    message: typeof e.message === 'string' ? e.message.slice(0, 300) : 'Invalid value provided.',
  }));
}

export function asString(value) {
  return typeof value === 'string' ? value : undefined;
}
