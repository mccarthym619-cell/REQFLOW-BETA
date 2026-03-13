import { RequestStatus } from '../types/request.js';
import { VALID_TRANSITIONS } from '../constants/statuses.js';

export function isValidTransition(from: RequestStatus, to: RequestStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(status: RequestStatus): RequestStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
