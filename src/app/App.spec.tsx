import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';

describe('App', () => {
  it('renders', () => {
    render(<App />);
    expect(screen.getByText('Click on the Vite and React logos to learn more')).toBeInTheDocument();
  });
});
