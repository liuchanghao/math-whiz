import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import App from './App';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const session = {
  member: {
    id: 'b2a33c56-f686-4b2a-8ae1-f0b76c55f135',
    phone: '13800138000',
  },
  accessToken: 'a'.repeat(43),
  accessTokenExpiresAt: '2026-08-21T10:00:00.000Z',
  refreshToken: 'r'.repeat(43),
  refreshTokenExpiresAt: '2026-09-20T10:00:00.000Z',
};

const apiResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

describe('member authentication in the mobile application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    globalThis.fetch = jest.fn();
  });

  it('logs in with a phone and password then stores the session securely', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '登录成功', data: session }),
      );
    render(<App />);

    expect(await screen.findByText('会员登录')).toBeVisible();
    fireEvent.changeText(screen.getByLabelText('手机号'), session.member.phone);
    fireEvent.changeText(screen.getByLabelText('密码'), '123456');
    fireEvent.press(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('选择年级')).toBeVisible();
    expect(screen.getByText(session.member.phone)).toBeVisible();
    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'math-whiz-member-session',
        JSON.stringify(session),
      );
    });
  });

  it('does not treat a non-200 HTTP response as a successful login', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '登录成功', data: session }, 201),
      );
    render(<App />);

    await screen.findByText('会员登录');
    fireEvent.changeText(screen.getByLabelText('手机号'), session.member.phone);
    fireEvent.changeText(screen.getByLabelText('密码'), '123456');
    fireEvent.press(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('服务响应异常，请稍后重试')).toBeVisible();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('rotates an expired access session while restoring the application', async () => {
    const refreshed = {
      ...session,
      accessToken: 'b'.repeat(43),
      refreshToken: 's'.repeat(43),
    };
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(session));
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse(
          {
            status: 401,
            message: '登录状态已失效',
            data: { errorCode: 'MEMBER_UNAUTHORIZED' },
          },
          401,
        ),
      )
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '会话已刷新', data: refreshed }),
      );

    render(<App />);

    expect(await screen.findByText('选择年级')).toBeVisible();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'math-whiz-member-session',
      JSON.stringify(refreshed),
    );
  });

  it('clears secure storage only when both access and refresh sessions are invalid', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(session));
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse(
          {
            status: 401,
            message: '登录状态已失效',
            data: { errorCode: 'MEMBER_UNAUTHORIZED' },
          },
          401,
        ),
      )
      .mockReturnValueOnce(
        apiResponse(
          {
            status: 401,
            message: '登录状态已失效',
            data: { errorCode: 'MEMBER_SESSION_INVALID' },
          },
          401,
        ),
      );

    render(<App />);

    expect(await screen.findByText('会员登录')).toBeVisible();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'math-whiz-member-session',
    );
  });

  it('keeps secure tokens on a transient restore failure and allows retry', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(session));
    jest
      .mocked(globalThis.fetch)
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockReturnValueOnce(
        apiResponse({
          status: 200,
          message: '会话有效',
          data: { member: session.member },
        }),
      );

    render(<App />);

    expect(await screen.findByText('暂时无法连接服务')).toBeVisible();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('选择年级')).toBeVisible();
  });

  it('changes the password and returns to login after clearing local tokens', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(session));
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse({
          status: 200,
          message: '会话有效',
          data: { member: session.member },
        }),
      )
      .mockReturnValueOnce(
        apiResponse({
          status: 200,
          message: '密码修改成功，请重新登录',
          data: null,
        }),
      );
    render(<App />);

    await screen.findByText('选择年级');
    fireEvent.press(screen.getByRole('button', { name: '修改密码' }));
    fireEvent.changeText(screen.getByLabelText('原密码'), '123456');
    fireEvent.changeText(screen.getByLabelText('新密码'), 'new-password-789');
    fireEvent.changeText(
      screen.getByLabelText('确认新密码'),
      'new-password-789',
    );
    fireEvent.press(screen.getByRole('button', { name: '确认修改' }));

    expect(await screen.findByText('密码修改成功，请重新登录')).toBeVisible();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'math-whiz-member-session',
    );
  });

  it('logs out and removes both tokens from secure storage', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(session));
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse({
          status: 200,
          message: '会话有效',
          data: { member: session.member },
        }),
      )
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '已退出登录', data: null }),
      );
    render(<App />);

    await screen.findByText('选择年级');
    fireEvent.press(screen.getByRole('button', { name: '退出登录' }));

    expect(await screen.findByText('会员登录')).toBeVisible();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'math-whiz-member-session',
    );
  });
});
