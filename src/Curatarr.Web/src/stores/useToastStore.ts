import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onClick: () => Promise<void> | void;
}

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number | null; // null = persistent until dismissed, default e.g. 5000ms
  action?: ToastAction;
  manualSteps?: string[];
  createdAt: number;
}

export interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_TOAST_DURATION = 5000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toastInput) => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const duration = toastInput.duration === undefined ? DEFAULT_TOAST_DURATION : toastInput.duration;

    const newToast: Toast = {
      ...toastInput,
      id,
      duration,
      createdAt: Date.now(),
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (duration !== null && duration > 0) {
      const timer = setTimeout(() => {
        get().removeToast(id);
      }, duration);
      timers.set(id, timer);
    }

    return id;
  },

  removeToast: (id) => {
    const existingTimer = timers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timers.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    set({ toasts: [] });
  },
}));
