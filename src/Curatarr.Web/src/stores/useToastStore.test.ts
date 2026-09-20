import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToastStore } from './useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearToasts();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('adds a toast with generated id, createdAt, and default duration (5000ms)', () => {
    const id = useToastStore.getState().addToast({
      type: 'info',
      title: 'Testing Info',
      message: 'Info message',
    });

    const state = useToastStore.getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe(id);
    expect(state.toasts[0].title).toBe('Testing Info');
    expect(state.toasts[0].message).toBe('Info message');
    expect(state.toasts[0].duration).toBe(5000);
    expect(state.toasts[0].createdAt).toBeTypeOf('number');
  });

  it('automatically removes toast after default 5000ms duration', () => {
    useToastStore.getState().addToast({
      type: 'success',
      title: 'Success!',
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('automatically removes toast after custom positive duration', () => {
    useToastStore.getState().addToast({
      type: 'error',
      title: 'Error occurred',
      duration: 2000,
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('keeps persistent toast with duration: null until explicitly dismissed', () => {
    const id = useToastStore.getState().addToast({
      type: 'warning',
      title: 'Persistent Warning',
      duration: null,
      manualSteps: ['Step 1', 'Step 2'],
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(60000); // 1 minute later
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removes toast explicitly and cleans up timers', () => {
    const id = useToastStore.getState().addToast({
      type: 'info',
      title: 'Quick info',
      duration: 5000,
    });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);

    // Advancing timers should not throw or cause unexpected behaviour
    vi.advanceTimersByTime(5000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('clears all toasts and timers on clearToasts', () => {
    useToastStore.getState().addToast({ type: 'info', title: 'Toast 1' });
    useToastStore.getState().addToast({ type: 'success', title: 'Toast 2', duration: null });
    useToastStore.getState().addToast({ type: 'error', title: 'Toast 3', duration: 10000 });

    expect(useToastStore.getState().toasts).toHaveLength(3);

    useToastStore.getState().clearToasts();
    expect(useToastStore.getState().toasts).toHaveLength(0);

    vi.advanceTimersByTime(10000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('stores action callback correctly and allows invocation', async () => {
    let actionInvoked = false;
    useToastStore.getState().addToast({
      type: 'warning',
      title: 'Action Toast',
      action: {
        label: 'Retry',
        onClick: () => {
          actionInvoked = true;
        },
      },
    });

    const toast = useToastStore.getState().toasts[0];
    expect(toast.action?.label).toBe('Retry');
    await toast.action?.onClick();
    expect(actionInvoked).toBe(true);
  });
});
