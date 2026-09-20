/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ToastContainer } from './ToastContainer';
import { useToastStore } from '../stores/useToastStore';

describe('ToastContainer and ToastItem', () => {
  beforeEach(() => {
    useToastStore.getState().clearToasts();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toasts with correct titles, messages, and icons', () => {
    useToastStore.getState().addToast({
      type: 'info',
      title: 'Pruning Inception...',
      message: 'Unlinking files',
    });
    useToastStore.getState().addToast({
      type: 'success',
      title: 'Deleted from Sonarr & Disk',
      message: '12.5 GB reclaimed',
    });

    render(<ToastContainer />);

    expect(screen.getByText('Pruning Inception...')).toBeDefined();
    expect(screen.getByText('Unlinking files')).toBeDefined();
    expect(screen.getByTestId('toast-icon-loader')).toBeDefined();

    expect(screen.getByText('Deleted from Sonarr & Disk')).toBeDefined();
    expect(screen.getByText('12.5 GB reclaimed')).toBeDefined();
    expect(screen.getByTestId('toast-icon-success')).toBeDefined();
  });

  it('renders warning toast with manual steps and action button', () => {
    const manualSteps = [
      'Plex: Empty Trash in your Plex library if automatic emptying is disabled.',
      "Overseerr / Seerr: Media will show as 'Available' until the next scheduled library sync.",
      'Download Client: Verify hardlinked or seeded downloads in your torrent/usenet client.',
    ];

    useToastStore.getState().addToast({
      type: 'warning',
      title: 'Prune Complete: Manual Steps',
      message: 'Arr instances and disk files have been deleted. Complete these follow-up actions:',
      manualSteps,
      duration: null,
      action: {
        label: 'Scan Plex Libraries',
        onClick: vi.fn(),
      },
    });

    render(<ToastContainer />);

    expect(screen.getByText('Prune Complete: Manual Steps')).toBeDefined();
    expect(screen.getByTestId('toast-icon-warning')).toBeDefined();
    for (const step of manualSteps) {
      expect(screen.getByText(step)).toBeDefined();
    }
    expect(screen.getByRole('button', { name: 'Scan Plex Libraries' })).toBeDefined();
  });

  it('executes action callback and handles async loading state', async () => {
    let resolveAction!: () => void;
    const actionPromise = new Promise<void>((res) => {
      resolveAction = res;
    });
    const onClick = vi.fn().mockImplementation(() => actionPromise);

    useToastStore.getState().addToast({
      type: 'warning',
      title: 'Prune Complete: Manual Steps',
      action: {
        label: 'Scan Plex Libraries',
        onClick,
      },
    });

    render(<ToastContainer />);

    const actionButton = screen.getByRole('button', { name: 'Scan Plex Libraries' });
    expect(screen.queryByTestId('action-spinner')).toBeNull();

    fireEvent.click(actionButton);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('action-spinner')).toBeDefined();
    expect(actionButton).toHaveProperty('disabled', true);

    resolveAction();

    await waitFor(() => {
      expect(screen.queryByTestId('action-spinner')).toBeNull();
      expect(actionButton).toHaveProperty('disabled', false);
    });
  });

  it('dismisses toast when X button is clicked', () => {
    useToastStore.getState().addToast({
      type: 'error',
      title: 'Prune Failed',
      message: 'Network timeout',
    });

    render(<ToastContainer />);

    expect(screen.getByText('Prune Failed')).toBeDefined();

    const dismissBtn = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Prune Failed')).toBeNull();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
