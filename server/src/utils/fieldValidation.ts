import { AppError } from '../middleware/errorHandler';

/**
 * Validates a custom field value against its declared field type.
 * Throws AppError(400) if the value is invalid for the type.
 */
export function validateFieldValue(
  fieldType: string,
  value: string,
  fieldName: string,
  options?: string | null,
): void {
  if (!value) return; // Empty values are allowed (required-ness is a separate concern)

  switch (fieldType) {
    case 'number':
    case 'currency':
      if (isNaN(Number(value))) {
        throw new AppError(400, 'INVALID_FIELD', `Field "${fieldName}" must be a valid number`);
      }
      break;

    case 'date':
      if (isNaN(Date.parse(value))) {
        throw new AppError(400, 'INVALID_FIELD', `Field "${fieldName}" must be a valid date`);
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        throw new AppError(400, 'INVALID_FIELD', `Field "${fieldName}" must be a valid URL`);
      }
      break;

    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new AppError(400, 'INVALID_FIELD', `Field "${fieldName}" must be a valid email address`);
      }
      break;

    case 'checkbox':
      if (value !== 'true' && value !== 'false') {
        throw new AppError(400, 'INVALID_FIELD', `Field "${fieldName}" must be true or false`);
      }
      break;

    case 'dropdown': {
      const allowed = parseOptions(options);
      if (allowed && !allowed.includes(value)) {
        throw new AppError(400, 'INVALID_FIELD', `Field "${fieldName}" has an invalid option`);
      }
      break;
    }

    case 'multi_select': {
      const allowed = parseOptions(options);
      if (allowed) {
        let selected: string[];
        try {
          selected = JSON.parse(value);
          if (!Array.isArray(selected)) selected = value.split(',').map(s => s.trim());
        } catch {
          selected = value.split(',').map(s => s.trim());
        }
        for (const s of selected) {
          if (!allowed.includes(s)) {
            throw new AppError(400, 'INVALID_FIELD', `Field "${fieldName}" contains an invalid option: "${s}"`);
          }
        }
      }
      break;
    }

    // text, textarea, file, multi_file — no additional validation
    default:
      break;
  }
}

function parseOptions(options?: string | null): string[] | null {
  if (!options) return null;
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
