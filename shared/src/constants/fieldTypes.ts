import { FieldType } from '../types/template.js';

export interface FieldTypeMeta {
  label: string;
  description: string;
  hasOptions: boolean;
  icon: string;
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  text: { label: 'Text', description: 'Single-line text input', hasOptions: false, icon: 'Type' },
  textarea: { label: 'Text Area', description: 'Multi-line text input', hasOptions: false, icon: 'AlignLeft' },
  number: { label: 'Number', description: 'Numeric input', hasOptions: false, icon: 'Hash' },
  currency: { label: 'Currency', description: 'Currency amount', hasOptions: false, icon: 'DollarSign' },
  date: { label: 'Date', description: 'Date picker', hasOptions: false, icon: 'Calendar' },
  dropdown: { label: 'Dropdown', description: 'Select from options', hasOptions: true, icon: 'ChevronDown' },
  multi_select: { label: 'Multi Select', description: 'Select multiple options', hasOptions: true, icon: 'CheckSquare' },
  checkbox: { label: 'Checkbox', description: 'Yes/No toggle', hasOptions: false, icon: 'Check' },
  file: { label: 'File Upload', description: 'File attachment', hasOptions: false, icon: 'Paperclip' },
  multi_file: { label: 'Multi File Upload', description: 'Multiple file attachments (up to 10)', hasOptions: false, icon: 'Files' },
  url: { label: 'URL', description: 'Web address', hasOptions: false, icon: 'Link' },
  email: { label: 'Email', description: 'Email address', hasOptions: false, icon: 'Mail' },
};
