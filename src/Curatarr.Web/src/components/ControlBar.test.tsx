/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ControlBar } from './ControlBar';
import { useCatalogStore } from '../stores/useCatalogStore';

describe('ControlBar component', () => {
  beforeEach(() => {
    useCatalogStore.setState({
      items: [
        {
          id: 'item-1',
          title: 'Movie 1',
          sortTitle: 'Movie 1',
          mediaType: 0,
          totalSizeBytes: 1000,
          isProtected: false,
          instances: [],
          seasons: [],
          watchStats: [],
        },
      ],
      users: [{ userId: 'user-1', username: 'alice', friendlyName: 'Alice' }],
      selectedUserId: null,
      selectedMediaType: 'all',
      selectedResolution: null,
      selectedCutoffUnmet: null,
      selectedPre2017Filter: 'all',
      searchQuery: '',
      sortBy: 'size',
      sortDesc: true,
      viewMode: 'grid',
      selectedIds: new Set<string>(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('updates search query on user input', () => {
    render(<ControlBar />);
    const input = screen.getByPlaceholderText('Search titles...');
    fireEvent.change(input, { target: { value: 'Inception' } });

    expect(useCatalogStore.getState().searchQuery).toBe('Inception');
  });

  it('updates pre-2017 history filter on selection change', () => {
    render(<ControlBar />);
    const select = screen.getByLabelText('Filter watch history era');
    fireEvent.change(select, { target: { value: 'exclude' } });

    expect(useCatalogStore.getState().selectedPre2017Filter).toBe('exclude');

    fireEvent.change(select, { target: { value: 'only' } });
    expect(useCatalogStore.getState().selectedPre2017Filter).toBe('only');
  });

  it('toggles cutoff unmet filter on button click', () => {
    render(<ControlBar />);
    const cutoffBtn = screen.getByRole('button', { name: /Cutoff Unmet/i });

    fireEvent.click(cutoffBtn);
    expect(useCatalogStore.getState().selectedCutoffUnmet).toBe(true);

    fireEvent.click(cutoffBtn);
    expect(useCatalogStore.getState().selectedCutoffUnmet).toBeNull();
  });

  it('updates resolution filter on selection change', () => {
    render(<ControlBar />);
    const select = screen.getByLabelText('Filter resolution');
    fireEvent.change(select, { target: { value: '4K' } });

    expect(useCatalogStore.getState().selectedResolution).toBe('4K');
  });

  it('switches media type between All, Movies, and TV Shows', () => {
    render(<ControlBar />);
    const moviesBtn = screen.getByRole('button', { name: /Movies/i });
    fireEvent.click(moviesBtn);
    expect(useCatalogStore.getState().selectedMediaType).toBe('movie');

    const tvBtn = screen.getByRole('button', { name: /TV Shows/i });
    fireEvent.click(tvBtn);
    expect(useCatalogStore.getState().selectedMediaType).toBe('series');

    const allBtn = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allBtn);
    expect(useCatalogStore.getState().selectedMediaType).toBe('all');
  });

  it('toggles view mode between grid and table', () => {
    render(<ControlBar />);
    const tableBtn = screen.getByTitle('Compact Table');
    fireEvent.click(tableBtn);
    expect(useCatalogStore.getState().viewMode).toBe('table');

    const gridBtn = screen.getByTitle('Poster Grid');
    fireEvent.click(gridBtn);
    expect(useCatalogStore.getState().viewMode).toBe('grid');
  });

  it('toggles select all and deselect all correctly', () => {
    render(<ControlBar />);
    const selectBtn = screen.getByRole('button', { name: 'Select Loaded (1)' });
    fireEvent.click(selectBtn);
    expect(useCatalogStore.getState().selectedIds.size).toBe(1);

    // Now button should show 'Deselect All'
    const deselectBtn = screen.getByRole('button', { name: 'Deselect All' });
    fireEvent.click(deselectBtn);
    expect(useCatalogStore.getState().selectedIds.size).toBe(0);
  });
});
