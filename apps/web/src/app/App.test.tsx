// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { Field } from '../components/ui';

afterEach(cleanup);
it('exposes direct routes and navigation for downstream modules', () => {
  render(<MemoryRouter initialEntries={['/items/example']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '物品详情' })).toBeDefined();
  expect(screen.getByRole('navigation', { name: '主要导航' })).toBeDefined();
});
it('associates field labels and errors for assistive technology', () => {
  render(<Field label="标题" error="请输入标题" />);
  const input = screen.getByLabelText('标题');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('请输入标题');
});
