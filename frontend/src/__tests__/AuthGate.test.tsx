import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthGate from '@/components/AuthGate';
import { getCurrentAuthUser, loginWithAccessCode } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getCurrentAuthUser: vi.fn(),
    loginWithAccessCode: vi.fn(),
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

  it('shows login form before a valid access code is submitted', async () => {
    render(<AuthGate><div>inside app</div></AuthGate>);

    expect(await screen.findByText('ShopGenie')).toBeInTheDocument();
    expect(screen.queryByText('inside app')).not.toBeInTheDocument();
  });

  it('enters the app after access code login succeeds', async () => {
    vi.mocked(loginWithAccessCode).mockResolvedValue({ user_id: 'merchant_a' });

    render(<AuthGate><div>inside app</div></AuthGate>);
    fireEvent.change(await screen.findByPlaceholderText('请输入访问码'), { target: { value: 'token-a' } });
    fireEvent.click(screen.getByRole('button', { name: '进入 ShopGenie' }));

    await waitFor(() => expect(screen.getByText('inside app')).toBeInTheDocument());
    expect(loginWithAccessCode).toHaveBeenCalledWith('token-a');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('shopgenie.auth_token', 'token-a');
  });

  it('uses an existing token to validate the session', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('token-a');
    vi.mocked(getCurrentAuthUser).mockResolvedValue({ user_id: 'merchant_a' });

    render(<AuthGate><div>inside app</div></AuthGate>);

    await waitFor(() => expect(screen.getByText('inside app')).toBeInTheDocument());
    expect(getCurrentAuthUser).toHaveBeenCalled();
  });
});
