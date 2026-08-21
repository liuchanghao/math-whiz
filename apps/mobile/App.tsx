import {
  memberChangePasswordRequestSchema,
  memberLoginRequestSchema,
  type AvailableGrade,
  type MemberSessionData,
} from '@math-whiz/contracts';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  changeMemberPassword,
  getAvailableGrades,
  getMember,
  loginMember,
  logoutMember,
  MemberApiError,
  refreshMember,
} from './src/member-api';
import {
  clearMemberSession,
  loadMemberSession,
  saveMemberSession,
} from './src/member-session';

type AppState =
  | { kind: 'restoring' }
  | { kind: 'restore-error' }
  | { kind: 'signed-out'; message?: string }
  | { kind: 'signed-in'; session: MemberSessionData };

const isInvalidSessionError = (error: unknown) =>
  error instanceof MemberApiError && error.status === 401;

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'restoring' });
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const { width } = useWindowDimensions();
  const isTabletWidth = width >= 700;

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const stored = await loadMemberSession();
        if (stored === null) {
          if (active) setState({ kind: 'signed-out' });
          return;
        }

        try {
          const member = await getMember(stored.accessToken);
          if (active) {
            setState({ kind: 'signed-in', session: { ...stored, member } });
          }
        } catch (accessError) {
          if (!isInvalidSessionError(accessError)) {
            throw accessError;
          }
          try {
            const refreshed = await refreshMember(stored.refreshToken);
            await saveMemberSession(refreshed);
            if (active) setState({ kind: 'signed-in', session: refreshed });
          } catch (refreshError) {
            if (!isInvalidSessionError(refreshError)) {
              throw refreshError;
            }
            await clearMemberSession();
            if (active) setState({ kind: 'signed-out' });
          }
        }
      } catch {
        if (active) setState({ kind: 'restore-error' });
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, [restoreAttempt]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.shell, isTabletWidth && styles.tabletShell]}>
          {state.kind === 'restoring' ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color="#3157a4" size="large" />
              <Text style={styles.loadingText}>正在恢复登录状态…</Text>
            </View>
          ) : state.kind === 'restore-error' ? (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>数学小达人</Text>
              <Text style={styles.title}>暂时无法连接服务</Text>
              <Text style={styles.subtitle}>
                登录信息仍安全保存在本机，请检查网络后重试。
              </Text>
              <Pressable
                accessibilityLabel="重试"
                accessibilityRole="button"
                onPress={() => {
                  setState({ kind: 'restoring' });
                  setRestoreAttempt((attempt) => attempt + 1);
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>重试</Text>
              </Pressable>
            </View>
          ) : state.kind === 'signed-out' ? (
            <LoginPanel
              message={state.message}
              onLogin={async (session) => {
                await saveMemberSession(session);
                setState({ kind: 'signed-in', session });
              }}
            />
          ) : (
            <HomePanel
              onLogout={async () => {
                try {
                  await logoutMember(state.session.refreshToken);
                } catch {
                  // Local secrets are still removed when the server is unavailable.
                } finally {
                  await clearMemberSession();
                  setState({ kind: 'signed-out' });
                }
              }}
              onPasswordChanged={async () => {
                await clearMemberSession();
                setState({
                  kind: 'signed-out',
                  message: '密码修改成功，请重新登录',
                });
              }}
              session={state.session}
            />
          )}
        </View>
      </ScrollView>
      <StatusBar style="dark" />
    </KeyboardAvoidingView>
  );
}

const LoginPanel = ({
  message,
  onLogin,
}: {
  message?: string;
  onLogin: (session: MemberSessionData) => Promise<void>;
}) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const parsed = memberLoginRequestSchema.safeParse({ phone, password });
    if (!parsed.success) {
      setError(
        parsed.error.issues.some((issue) => issue.path[0] === 'phone')
          ? '请输入正确的 11 位手机号'
          : '请输入密码',
      );
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await onLogin(await loginMember(parsed.data));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : '登录失败，请稍后重试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>数学小达人</Text>
      <Text style={styles.title}>会员登录</Text>
      <Text style={styles.subtitle}>登录后即可选择年级开始数学答题</Text>
      {message ? <Text style={styles.successMessage}>{message}</Text> : null}
      <Text style={styles.label}>手机号</Text>
      <TextInput
        accessibilityLabel="手机号"
        autoComplete="tel"
        keyboardType="phone-pad"
        maxLength={11}
        onChangeText={setPhone}
        placeholder="请输入 11 位手机号"
        style={styles.input}
        value={phone}
      />
      <Text style={styles.label}>密码</Text>
      <TextInput
        accessibilityLabel="密码"
        autoComplete="current-password"
        onChangeText={setPassword}
        placeholder="请输入密码"
        secureTextEntry
        style={styles.input}
        value={password}
      />
      {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
      <Pressable
        accessibilityLabel="登录"
        accessibilityRole="button"
        disabled={submitting}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
          submitting && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {submitting ? '正在登录…' : '登录'}
        </Text>
      </Pressable>
      <Text style={styles.notice}>
        一期账号由项目维护者预先开通，暂不支持注册。
      </Text>
    </View>
  );
};

const HomePanel = ({
  session,
  onLogout,
  onPasswordChanged,
}: {
  session: MemberSessionData;
  onLogout: () => Promise<void>;
  onPasswordChanged: () => Promise<void>;
}) => {
  const [changingPassword, setChangingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [grades, setGrades] = useState<AvailableGrade[]>();
  const [gradeError, setGradeError] = useState<string>();

  useEffect(() => {
    let active = true;
    void getAvailableGrades(session.accessToken)
      .then((availableGrades) => {
        if (active) setGrades(availableGrades);
      })
      .catch(() => {
        if (active) setGradeError('可答年级暂时无法加载');
      });
    return () => {
      active = false;
    };
  }, [session.accessToken]);

  if (changingPassword) {
    return (
      <ChangePasswordPanel
        accessToken={session.accessToken}
        onCancel={() => setChangingPassword(false)}
        onPasswordChanged={onPasswordChanged}
      />
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>数学小达人</Text>
      <Text style={styles.title}>选择年级</Text>
      <Text style={styles.subtitle}>当前登录手机号</Text>
      <Text style={styles.memberPhone}>{session.member.phone}</Text>
      {gradeError ? (
        <Text style={styles.errorMessage}>{gradeError}</Text>
      ) : null}
      {grades === undefined && gradeError === undefined ? (
        <View style={styles.placeholderPanel}>
          <ActivityIndicator color="#3157a4" />
          <Text style={styles.placeholderText}>正在加载可答年级…</Text>
        </View>
      ) : grades?.length === 0 ? (
        <View style={styles.placeholderPanel}>
          <Text style={styles.placeholderTitle}>暂无可答年级</Text>
          <Text style={styles.placeholderText}>
            年级需要已启用、题量满10题且已配置当前奖品。
          </Text>
        </View>
      ) : (
        <View style={styles.gradeList}>
          {grades?.map((grade) => (
            <Pressable
              accessibilityLabel={`选择${grade.name}`}
              accessibilityRole="button"
              key={grade.id}
              style={({ pressed }) => [
                styles.gradeCard,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.gradeName}>{grade.name}</Text>
              <Text style={styles.gradePrize}>
                满10题且获得满分，可获得{grade.currentPrize.name}
              </Text>
              <Text style={styles.gradeDescription}>
                {grade.currentPrize.description}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable
        accessibilityLabel="修改密码"
        accessibilityRole="button"
        onPress={() => setChangingPassword(true)}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>修改密码</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="退出登录"
        accessibilityRole="button"
        disabled={loggingOut}
        onPress={() => {
          setLoggingOut(true);
          void onLogout();
        }}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.buttonPressed,
          loggingOut && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.logoutButtonText}>
          {loggingOut ? '正在退出…' : '退出登录'}
        </Text>
      </Pressable>
    </View>
  );
};

const ChangePasswordPanel = ({
  accessToken,
  onCancel,
  onPasswordChanged,
}: {
  accessToken: string;
  onCancel: () => void;
  onPasswordChanged: () => Promise<void>;
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const parsed = memberChangePasswordRequestSchema.safeParse({
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues.some(
          (issue) => issue.path[0] === 'confirmNewPassword',
        )
          ? '两次输入的新密码不一致'
          : '密码至少需要 6 个字符',
      );
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await changeMemberPassword(accessToken, parsed.data);
      await onPasswordChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '密码修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>账号安全</Text>
      <Text style={styles.title}>修改密码</Text>
      <Text style={styles.subtitle}>修改成功后，需要使用新密码重新登录。</Text>
      <Text style={styles.label}>原密码</Text>
      <TextInput
        accessibilityLabel="原密码"
        autoComplete="current-password"
        onChangeText={setCurrentPassword}
        secureTextEntry
        style={styles.input}
        value={currentPassword}
      />
      <Text style={styles.label}>新密码</Text>
      <TextInput
        accessibilityLabel="新密码"
        autoComplete="new-password"
        onChangeText={setNewPassword}
        secureTextEntry
        style={styles.input}
        value={newPassword}
      />
      <Text style={styles.label}>再次输入新密码</Text>
      <TextInput
        accessibilityLabel="确认新密码"
        autoComplete="new-password"
        onChangeText={setConfirmNewPassword}
        secureTextEntry
        style={styles.input}
        value={confirmNewPassword}
      />
      {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
      <Pressable
        accessibilityLabel="确认修改"
        accessibilityRole="button"
        disabled={submitting}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
          submitting && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {submitting ? '正在修改…' : '确认修改'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="取消修改"
        accessibilityRole="button"
        disabled={submitting}
        onPress={onCancel}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>取消</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef3fb' },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  shell: { width: '100%', maxWidth: 520 },
  tabletShell: { maxWidth: 720 },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 24,
    shadowColor: '#1d304e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  loadingPanel: { alignItems: 'center', gap: 16, padding: 32 },
  loadingText: { color: '#475569', fontSize: 16 },
  eyebrow: { color: '#3157a4', fontSize: 16, fontWeight: '700' },
  title: { marginTop: 6, color: '#172033', fontSize: 32, fontWeight: '800' },
  subtitle: { marginTop: 10, marginBottom: 24, color: '#526077', fontSize: 16 },
  label: { marginBottom: 8, color: '#24324a', fontSize: 16, fontWeight: '700' },
  input: {
    minHeight: 52,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#b8c5d8',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#172033',
    backgroundColor: '#ffffff',
    fontSize: 17,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#3157a4',
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  secondaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#3157a4',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: { color: '#3157a4', fontSize: 16, fontWeight: '800' },
  logoutButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 14,
  },
  logoutButtonText: { color: '#b42318', fontSize: 16, fontWeight: '800' },
  errorMessage: { marginBottom: 8, color: '#b42318', fontSize: 15 },
  successMessage: {
    marginBottom: 18,
    borderRadius: 12,
    padding: 12,
    color: '#166534',
    backgroundColor: '#dcfce7',
    fontSize: 15,
  },
  notice: { marginTop: 20, color: '#64748b', fontSize: 14, lineHeight: 21 },
  memberPhone: { color: '#172033', fontSize: 22, fontWeight: '800' },
  placeholderPanel: {
    marginTop: 28,
    borderRadius: 18,
    padding: 20,
    backgroundColor: '#eef3fb',
  },
  placeholderTitle: { color: '#24324a', fontSize: 18, fontWeight: '800' },
  placeholderText: {
    marginTop: 8,
    color: '#526077',
    fontSize: 15,
    lineHeight: 22,
  },
  gradeList: { marginTop: 24, gap: 12 },
  gradeCard: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#c8d5ea',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#f8faff',
  },
  gradeName: { color: '#172033', fontSize: 20, fontWeight: '800' },
  gradePrize: {
    marginTop: 8,
    color: '#3157a4',
    fontSize: 15,
    fontWeight: '700',
  },
  gradeDescription: {
    marginTop: 6,
    color: '#526077',
    fontSize: 14,
    lineHeight: 20,
  },
});
