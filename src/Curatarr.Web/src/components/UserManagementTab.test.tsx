/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UserManagementTab } from './UserManagementTab';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useAuthStore } from '../stores/useAuthStore';

describe('UserManagementTab component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        plexId: 'plex-1',
        username: 'steven',
        email: 'steven@example.com',
        role: 'Admin',
      },
    });

    useSettingsStore.setState({
      users: [
        {
          id: 'admin-1',
          plexId: 'plex-1',
          username: 'steven',
          email: 'steven@example.com',
          role: 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'guest-2',
          plexId: 'plex-2',
          username: 'alice',
          email: 'alice@example.com',
          role: 'Guest',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      isFetchingUsers: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders user list with avatars, roles, and "You" badge on current user', () => {
    render(<UserManagementTab />);

    expect(screen.getByText('Plex User Management')).toBeDefined();
    expect(screen.getByText('steven')).toBeDefined();
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('alice')).toBeDefined();
  });

  it('updates role when role select is changed', async () => {
    const updateSpy = vi.spyOn(useSettingsStore.getState(), 'updateUserRole').mockResolvedValue(true);

    render(<UserManagementTab />);

    const aliceRoleSelect = screen.getByLabelText(/Role for alice/i);
    fireEvent.change(aliceRoleSelect, { target: { value: 'Admin' } });

    expect(updateSpy).toHaveBeenCalledWith('guest-2', 'Admin');
  });

  it('deletes user after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteSpy = vi.spyOn(useSettingsStore.getState(), 'deleteUser').mockResolvedValue(true);

    render(<UserManagementTab />);

    const deleteBtn = screen.getByLabelText(/Remove user alice/i);
    fireEvent.click(deleteBtn);

    expect(deleteSpy).toHaveBeenCalledWith('guest-2');
  });
});
