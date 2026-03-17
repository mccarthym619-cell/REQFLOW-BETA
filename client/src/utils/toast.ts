import toast from 'react-hot-toast';

export function showError(message: string): void {
  toast.error(message);
}

export function showSuccess(message: string): void {
  toast.success(message);
}
