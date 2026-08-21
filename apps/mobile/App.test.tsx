import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

import App from './App';

const mockUseWindowDimensions = jest.fn(() => ({
  fontScale: 1,
  height: 844,
  scale: 3,
  width: 390,
}));
const mockUseColorScheme = jest.fn((): 'dark' | 'light' | null => 'light');

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Native =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaView: (props: ViewProps) => React.createElement(Native.View, props),
  };
});
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockUseColorScheme(),
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
    mockUseColorScheme.mockReturnValue('light');
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1,
      height: 844,
      scale: 3,
      width: 390,
    });
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    globalThis.fetch = jest.fn();
  });

  it.each([
    ['手机竖屏', 390, 844, 520],
    ['平板竖屏', 768, 1024, 720],
    ['平板横屏', 1024, 768, 720],
  ])('adapts every core page for %s', async (_, width, height, maxWidth) => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1,
      height,
      scale: 2,
      width,
    });
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '登录成功', data: session }),
      )
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '可答年级获取成功', data: [] }),
      );

    render(<App />);

    expect(await screen.findByText('会员登录')).toBeVisible();
    expect(screen.getByTestId('safe-area')).toBeVisible();
    expect(screen.getByTestId('app-shell')).toHaveStyle({ maxWidth });
    expect(screen.getByRole('button', { name: '登录' })).toHaveStyle({
      minHeight: 54,
    });
    fireEvent.changeText(screen.getByLabelText('手机号'), session.member.phone);
    fireEvent.changeText(screen.getByLabelText('密码'), '123456');
    fireEvent.press(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('选择年级')).toBeVisible();
    expect(screen.getByTestId('app-shell')).toHaveStyle({ maxWidth });
    fireEvent.press(screen.getByRole('button', { name: '修改密码' }));

    expect(await screen.findByText('修改密码')).toBeVisible();
    expect(screen.getByTestId('app-shell')).toHaveStyle({ maxWidth });
  });

  it('uses the semantic dark theme when the system prefers dark colors', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1.5,
      height: 844,
      scale: 3,
      width: 390,
    });

    render(<App />);

    expect(await screen.findByText('会员登录')).toBeVisible();
    expect(screen.getByTestId('safe-area')).toHaveStyle({
      backgroundColor: '#0b1220',
    });
    expect(screen.getByLabelText('手机号')).toHaveStyle({
      backgroundColor: '#101a2d',
      color: '#f4f7ff',
    });
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

  it('shows only the available grades returned for the signed-in member', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '登录成功', data: session }),
      )
      .mockReturnValueOnce(
        apiResponse({
          status: 200,
          message: '可答年级获取成功',
          data: [
            {
              id: 1,
              name: '小学一年级',
              sortOrder: 1,
              currentPrize: {
                id: 'c4160f28-61a7-4c35-9473-259eef1da179',
                name: '数学星球模型',
                description: '一枚适合桌面摆放的实物奖品',
              },
            },
          ],
        }),
      );
    render(<App />);

    await screen.findByText('会员登录');
    fireEvent.changeText(screen.getByLabelText('手机号'), session.member.phone);
    fireEvent.changeText(screen.getByLabelText('密码'), '123456');
    fireEvent.press(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('小学一年级')).toBeVisible();
    expect(
      screen.getByText('满10题且获得满分，可获得数学星球模型'),
    ).toBeVisible();
    expect(screen.queryByText('小学二年级')).toBeNull();
  });

  it('explains why no grade is shown when none satisfies the opening rules', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '登录成功', data: session }),
      )
      .mockReturnValueOnce(
        apiResponse({ status: 200, message: '可答年级获取成功', data: [] }),
      );
    render(<App />);

    await screen.findByText('会员登录');
    fireEvent.changeText(screen.getByLabelText('手机号'), session.member.phone);
    fireEvent.changeText(screen.getByLabelText('密码'), '123456');
    fireEvent.press(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('暂无可答年级')).toBeVisible();
    expect(screen.getByText(/题量满10题且已配置当前奖品/)).toBeVisible();
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
        apiResponse({ status: 200, message: '可答年级获取成功', data: [] }),
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
        apiResponse({ status: 200, message: '可答年级获取成功', data: [] }),
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
