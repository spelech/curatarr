/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CategoryTabs } from './CategoryTabs';
import { useCatalogStore } from '../stores/useCatalogStore';

describe('CategoryTabs component', () => {
  beforeEach(() => {
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
      ],
      selectedCategory: 'never_watched',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders categories with counts, reclaimable sizes, and All Items tab', () => {
    render(<CategoryTabs />);

    expect(screen.getByText('Never Watched')).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getByText('200.0 GB')).toBeDefined();

    expect(screen.getByText('Dormant (>1 Year)')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('50.0 GB')).toBeDefined();

    expect(screen.getByText('All Items')).toBeDefined();
  });

  it('changes selected category when a tab is clicked', () => {
    render(<CategoryTabs />);

    const dormantTab = screen.getByText('Dormant (>1 Year)');
    fireEvent.click(dormantTab);

    expect(useCatalogStore.getState().selectedCategory).toBe('dormant');

    const allItemsTab = screen.getByText('All Items');
    fireEvent.click(allItemsTab);

    expect(useCatalogStore.getState().selectedCategory).toBe('all');
  });
});
