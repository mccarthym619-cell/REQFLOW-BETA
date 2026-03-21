import { ApprovalPermission } from './user.js';

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

export type ApproverType = 'role' | 'specific_user' | 'role_by_command' | 'permission';

export type TriggerType = 'MANUAL' | 'AMOUNT' | 'CATEGORY' | 'AUTO';

/** Simple condition for a single field check */
export interface SimpleCondition {
  type: 'field_check';
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal';
  value?: string | number;
  values?: (string | number)[];
}

/** Amount threshold condition */
export interface AmountCondition {
  type: 'amount_threshold';
  min_amount?: number;
  max_amount?: number;
}

/** Compound condition combining multiple conditions with AND/OR */
export interface CompoundCondition {
  type: 'compound';
  operator: 'AND' | 'OR';
  rules: StepCondition[];
}

/** Union of all condition types */
export type StepCondition = SimpleCondition | AmountCondition | CompoundCondition;

/** Legacy condition format (kept for backward compatibility) */
export interface LegacyStepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in';
  value?: string;
  values?: string[];
}

export interface ApprovalChainStep {
  id: number;
  template_id: number;
  step_order: number;
  step_name: string;
  approver_type: ApproverType;
  approver_role: string | null;
  approver_user_id: number | null;
  target_department_id: number | null;
  required_permission: ApprovalPermission | null;
  execution_mode: 'sequential' | 'parallel';
  parallel_group: number | null;
  condition: string | null;
  sla_hours: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Joined fields */
  target_department_name?: string;
}

export interface CreateApprovalStepPayload {
  step_order: number;
  step_name: string;
  approver_type: ApproverType;
  approver_role?: string;
  approver_user_id?: number;
  target_department_id?: number | null;
  required_permission?: ApprovalPermission;
  execution_mode?: 'sequential' | 'parallel';
  parallel_group?: number;
  condition?: string | null;
  sla_hours?: number | null;
}

export interface TriggerConfig {
  min_amount?: number;
  max_amount?: number;
  categories?: string[];
}

export interface RequestTemplate {
  id: number;
  name: string;
  description: string | null;
  prefix: string;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig | null;
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
  trigger_type?: TriggerType;
  trigger_config?: TriggerConfig;
  fields?: CreateFieldPayload[];
  approval_chain?: CreateApprovalStepPayload[];
}
