/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CategoryCriteriaModal } from './CategoryCriteriaModal';
import { useSettingsStore } from '../stores/useSettingsStore';

describe('CategoryCriteriaModal component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CategoryCriteriaModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders smart category criteria rules and live threshold values', () => {
    useSettingsStore.setState({
      settings: {
        staleDays: 120,
        abandonedDays: 75,
        neverWatchedMinAgeDays: 60,
        movieSpaceHogThresholdBytes: 15 * 1024 * 1024 * 1024,
        movie4kSpaceHogThresholdBytes: 30 * 1024 * 1024 * 1024,
        seriesEpisodeSpaceHogThresholdBytes: 3 * 1024 * 1024 * 1024,
        catalogBatchSize: 50,
        syncIntervalHours: 6,
        movieSpaceHogGb: 15,
        movie4kSpaceHogGb: 30,
        seriesEpisodeSpaceHogGb: 3,
        adminUsernames: '',
      },
    });

    const onClose = vi.fn();
    render(<CategoryCriteriaModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Smart Category Rules & Thresholds')).toBeDefined();
    expect(screen.getByText('Never Watched')).toBeDefined();
    expect(screen.getByText(/at least 60 days ago/i)).toBeDefined();

    expect(screen.getByText('Stale Media')).toBeDefined();
    expect(screen.getByText(/more than 120 days ago/i)).toBeDefined();

    expect(screen.getByText('Abandoned TV')).toBeDefined();
    expect(screen.getByText(/in over 75 days/i)).toBeDefined();

    expect(screen.getByText('Space Hogs')).toBeDefined();
    expect(screen.getByText(/HD Movies > 15\.0 GB/i)).toBeDefined();
    expect(screen.getByText(/4K Movies > 30\.0 GB/i)).toBeDefined();

    expect(screen.getByText('Protection Requests')).toBeDefined();
    expect(screen.getByText('Protected')).toBeDefined();

    // Close button
    const gotItBtn = screen.getByRole('button', { name: /Got it/i });
    fireEvent.click(gotItBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
