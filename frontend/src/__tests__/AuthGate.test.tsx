import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthGate from '@/components/AuthGate';
import { getCurrentAuthUser, loginWithPassword, registerAccount } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getCurrentAuthUser: vi.fn(),
    loginWithPassword: vi.fn(),
    registerAccount: vi.fn(),
  };
});

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn().mockReturnValue(''),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { removeItem: vi.fn() },
    });
  });

  it('shows login form before credentials are submitted', async () => {
    render(<AuthGate><div>inside app</div></AuthGate>);

    expect(await screen.findByText('ShopGenie')).toBeInTheDocument();
    expect(screen.queryByText('inside app')).not.toBeInTheDocument();
  });

  it('enters the app after password login succeeds', async () => {
    vi.mocked(loginWithPassword).mockResolvedValue({ user_id: 'merchant_a', token: 'signed-token' });

    render(<AuthGate><div>inside app</div></AuthGate>);
    fireEvent.change(await screen.findByPlaceholderText('字母、数字、下划线或短横线'), { target: { value: 'merchant_a' } });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getAllByRole('button', { name: '登录' })[1]);

    await waitFor(() => expect(screen.getByText('inside app')).toBeInTheDocument());
    expect(loginWithPassword).toHaveBeenCalledWith('merchant_a', 'secret123');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('shopgenie.auth_token', 'signed-token');
  });

  it('registers a new account from the register tab', async () => {
    vi.mocked(registerAccount).mockResolvedValue({ user_id: 'merchant_b', token: 'new-token' });

    render(<AuthGate><div>inside app</div></AuthGate>);
    fireEvent.click(await screen.findByRole('button', { name: '注册' }));
    fireEvent.change(screen.getByPlaceholderText('字母、数字、下划线或短横线'), { target: { value: 'merchant_b' } });
    fireEvent.change(screen.getByPlaceholderText('至少 6 位'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    await waitFor(() => expect(screen.getByText('inside app')).toBeInTheDocument());
    expect(registerAccount).toHaveBeenCalledWith('merchant_b', 'secret123');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('shopgenie.auth_token', 'new-token');
  });

  it('uses an existing token to validate the session', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('token-a');
    vi.mocked(getCurrentAuthUser).mockResolvedValue({ user_id: 'merchant_a' });

    render(<AuthGate><div>inside app</div></AuthGate>);

    await waitFor(() => expect(screen.getByText('inside app')).toBeInTheDocument());
    expect(getCurrentAuthUser).toHaveBeenCalled();
  });
});
