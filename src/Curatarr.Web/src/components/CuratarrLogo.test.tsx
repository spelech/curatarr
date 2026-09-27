/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CuratarrLogo } from './CuratarrLogo';

describe('CuratarrLogo component', () => {
  it('renders SVG with default size and accessible label', () => {
    render(<CuratarrLogo />);
    const logo = screen.getByLabelText('Curatarr Logo');
    expect(logo).toBeDefined();
    expect(logo.getAttribute('width')).toBe('24');
    expect(logo.getAttribute('height')).toBe('24');
  });

  it('renders custom size and glow styles', () => {
    render(<CuratarrLogo size={36} glow className="custom-test-logo" />);
    const logo = screen.getByLabelText('Curatarr Logo');
    expect(logo.getAttribute('width')).toBe('36');
    expect(logo.getAttribute('height')).toBe('36');
    expect(logo.getAttribute('class')).toContain('custom-test-logo');
  });
});
