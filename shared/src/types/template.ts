export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'dropdown'
  | 'multi_select'
  | 'checkbox'
  | 'file'
  | 'multi_file'
  | 'url'
  | 'email';

export interface ValidationRules {
  min?: number;
  max?: number;
  pattern?: string;
  min_length?: number;
  max_length?: number;
}

export interface CustomFieldDefinition {
  id: number;
  template_id: number;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  is_required: boolean;
  sort_order: number;
  options: string[] | null;
  default_value: string | null;
  placeholder: string | null;
  help_text: string | null;
  validation_rules: ValidationRules | null;
  is_standard: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFieldPayload {
  field_name: string;
  field_label: string;
  field_type: FieldType;
  is_required?: boolean;
  sort_order?: number;
  options?: string[];
  default_value?: string;
  placeholder?: string;
  help_text?: string;
  validation_rules?: ValidationRules;
}

export interface ApprovalChainStep {
  id: number;
  template_id: number;
  step_order: number;
  step_name: string;
  approver_type: 'role' | 'specific_user';
  approver_role: string | null;
  approver_user_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateApprovalStepPayload {
  step_order: number;
  step_name: string;
  approver_type: 'role' | 'specific_user';
  approver_role?: string;
  approver_user_id?: number;
}

export interface RequestTemplate {
  id: number;
  name: string;
  description: string | null;
  prefix: string;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  fields?: CustomFieldDefinition[];
  approval_chain?: ApprovalChainStep[];
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  prefix: string;
  fields?: CreateFieldPayload[];
  approval_chain?: CreateApprovalStepPayload[];
}
