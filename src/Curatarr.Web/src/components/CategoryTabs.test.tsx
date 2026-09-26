/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { CategoryTabs } from './CategoryTabs';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useSettingsStore, DEFAULT_SETTINGS } from '../stores/useSettingsStore';

describe('CategoryTabs component', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        sub720pCutoffYear: 2000,
      },
    });

    useCatalogStore.setState({
      categories: [
        {
          categoryId: 'never_watched',
          name: 'Never Watched',
          count: 14,
          reclaimableSizeBytes: 200 * 1024 * 1024 * 1024,
        },
        {
          categoryId: 'dormant',
          name: 'Dormant (>1 Year)',
          count: 5,
          reclaimableSizeBytes: 50 * 1024 * 1024 * 1024,
        },
        {
          categoryId: 'sub_720p',
          name: 'Sub-720p (>=2000)',
          count: 8,
          reclaimableSizeBytes: 12 * 1024 * 1024 * 1024,
        },
      ],
      selectedCategory: 'never_watched',
      isCriteriaModalOpen: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders active category in the dropdown trigger button', () => {
    render(<CategoryTabs />);

    const trigger = screen.getByRole('button', { name: /Select Category/i });
    expect(trigger).toBeDefined();
    expect(screen.getByText('Never Watched')).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getByText('200.0 GB')).toBeDefined();
    expect(screen.getByText('All Items')).toBeDefined();
  });

  it('opens dropdown and allows selecting another category', () => {
    render(<CategoryTabs />);

    const trigger = screen.getByRole('button', { name: /Select Category/i });
    act(() => {
      fireEvent.click(trigger);
    });

    // Dropdown list should be open
    expect(screen.getByRole('listbox', { name: /Category list/i })).toBeDefined();
    expect(screen.getByText('Dormant (>1 Year)')).toBeDefined();
    expect(screen.getByText('Sub-720p (>=2000)')).toBeDefined();

    // Select Sub-720p
    const sub720pOption = screen.getByRole('option', { name: /Sub-720p/i });
    act(() => {
      fireEvent.click(sub720pOption);
    });

    expect(useCatalogStore.getState().selectedCategory).toBe('sub_720p');
    // Dropdown should be closed
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('changes selected category when All Items shortcut is clicked', () => {
    render(<CategoryTabs />);

    const allItemsBtn = screen.getByRole('button', { name: /All Items/i });
    act(() => {
      fireEvent.click(allItemsBtn);
    });

    expect(useCatalogStore.getState().selectedCategory).toBe('all');
  });

  it('opens criteria modal when Rules Guide button is clicked', () => {
    render(<CategoryTabs />);

    const guideBtn = screen.getByRole('button', { name: /Category criteria guide/i });
    act(() => {
      fireEvent.click(guideBtn);
    });

    expect(useCatalogStore.getState().isCriteriaModalOpen).toBe(true);
  });

  it('renders quick triage button when pending protection requests exist', () => {
    useCatalogStore.setState({
      categories: [
        {
          categoryId: 'never_watched',
          name: 'Never Watched',
          count: 10,
          reclaimableSizeBytes: 100 * 1024 * 1024 * 1024,
        },
        {
          categoryId: 'protection_requested',
          name: 'Protection Requests',
          count: 3,
          reclaimableSizeBytes: 45 * 1024 * 1024 * 1024,
        },
      ],
      selectedCategory: 'never_watched',
    });

    render(<CategoryTabs />);

    const triageBtn = screen.getByRole('button', { name: /Triage Requests/i });
    expect(triageBtn).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();

    act(() => {
      fireEvent.click(triageBtn);
    });

    expect(useCatalogStore.getState().selectedCategory).toBe('protection_requested');
  });
});
