import {
  memberChangePasswordRequestSchema,
  memberLoginRequestSchema,
  type AvailableGrade,
  type MemberSessionData,
} from '@math-whiz/contracts';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
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
import { darkTheme, lightTheme, type AppTheme } from './src/theme';

type AppState =
  | { kind: 'restoring' }
  | { kind: 'restore-error' }
  | { kind: 'signed-out'; message?: string }
  | { kind: 'signed-in'; session: MemberSessionData };

const isInvalidSessionError = (error: unknown) =>
  error instanceof MemberApiError && error.status === 401;

const ThemeContext = createContext<AppTheme>(lightTheme);
const useAppTheme = () => useContext(ThemeContext);

export default function App() {
  const [state, setState] = useState<AppState>({ kind: 'restoring' });
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isTabletWidth = width >= 700;
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const { colors, styles } = theme;

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
    <ThemeContext.Provider value={theme}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} testID="safe-area">
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={styles.mathMotifTop}
          >
            <Text style={styles.mathMotifPrimary}>7 + 5</Text>
            <Text style={styles.mathMotifSecondary}>3 × 4</Text>
          </View>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={styles.mathMotifBottom}
          >
            <Text style={styles.mathMotifPrimary}>24 ÷ 6</Text>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={[styles.shell, isTabletWidth && styles.tabletShell]}
                testID="app-shell"
              >
                {state.kind === 'restoring' ? (
                  <View style={styles.loadingPanel}>
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={styles.loadingMark}
                    >
                      <Text style={styles.loadingMarkText}>∑</Text>
                    </View>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={styles.loadingText}>正在恢复登录状态…</Text>
                  </View>
                ) : state.kind === 'restore-error' ? (
                  <View style={styles.card}>
                    <BrandLockup detail="连接状态" />
                    <Text style={styles.title}>暂时无法连接服务</Text>
                    <Text style={styles.subtitle}>
                      登录信息仍安全保存在本机，请检查网络后重试。
                    </Text>
                    <Pressable
                      accessibilityLabel="重试"
                      accessibilityRole="button"
                      android_ripple={{ color: colors.primaryRipple }}
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
          </KeyboardAvoidingView>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </SafeAreaView>
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}

const BrandLockup = ({ detail }: { detail: string }) => {
  const { styles } = useAppTheme();

  return (
    <View style={styles.brandLockup}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.brandMark}
      >
        <Text style={styles.brandMarkText}>∑</Text>
      </View>
      <View>
        <Text style={styles.brandName}>数学小达人</Text>
        <Text style={styles.brandDetail}>{detail}</Text>
      </View>
    </View>
  );
};

const LoginPanel = ({
  message,
  onLogin,
}: {
  message?: string;
  onLogin: (session: MemberSessionData) => Promise<void>;
}) => {
  const { colors, styles } = useAppTheme();
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
      <BrandLockup detail="每天进步一点点" />
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
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.selection}
        style={styles.input}
        value={phone}
      />
      <Text style={styles.label}>密码</Text>
      <TextInput
        accessibilityLabel="密码"
        autoComplete="current-password"
        onChangeText={setPassword}
        placeholder="请输入密码"
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.selection}
        secureTextEntry
        style={styles.input}
        value={password}
      />
      {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
      <Pressable
        accessibilityLabel="登录"
        accessibilityRole="button"
        disabled={submitting}
        android_ripple={{ color: colors.primaryRipple }}
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
  const { colors, styles } = useAppTheme();
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
      <BrandLockup detail="数学练习空间" />
      <Text style={styles.title}>选择年级</Text>
      <View style={styles.memberBadge}>
        <Text style={styles.memberBadgeLabel}>当前会员</Text>
        <Text style={styles.memberPhone}>{session.member.phone}</Text>
      </View>
      {gradeError ? (
        <Text style={styles.errorMessage}>{gradeError}</Text>
      ) : null}
      {grades === undefined && gradeError === undefined ? (
        <View style={styles.placeholderPanel}>
          <ActivityIndicator color={colors.primary} />
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
              android_ripple={{ color: colors.surfaceRipple }}
              key={grade.id}
              style={({ pressed }) => [
                styles.gradeCard,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.gradeHeader}>
                <Text style={styles.gradeName}>{grade.name}</Text>
                <Text style={styles.gradeMeta}>10 道题 · 100 分</Text>
              </View>
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
        android_ripple={{ color: colors.surfaceRipple }}
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
        android_ripple={{ color: colors.dangerRipple }}
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
  const { colors, styles } = useAppTheme();
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
      <BrandLockup detail="账号安全" />
      <Text style={styles.title}>修改密码</Text>
      <Text style={styles.subtitle}>修改成功后，需要使用新密码重新登录。</Text>
      <Text style={styles.label}>原密码</Text>
      <TextInput
        accessibilityLabel="原密码"
        autoComplete="current-password"
        onChangeText={setCurrentPassword}
        secureTextEntry
        placeholder="请输入原密码"
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.selection}
        style={styles.input}
        value={currentPassword}
      />
      <Text style={styles.label}>新密码</Text>
      <TextInput
        accessibilityLabel="新密码"
        autoComplete="new-password"
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="至少 6 个字符"
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.selection}
        style={styles.input}
        value={newPassword}
      />
      <Text style={styles.label}>再次输入新密码</Text>
      <TextInput
        accessibilityLabel="确认新密码"
        autoComplete="new-password"
        onChangeText={setConfirmNewPassword}
        secureTextEntry
        placeholder="再次输入新密码"
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.selection}
        style={styles.input}
        value={confirmNewPassword}
      />
      {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
      <Pressable
        accessibilityLabel="确认修改"
        accessibilityRole="button"
        disabled={submitting}
        android_ripple={{ color: colors.primaryRipple }}
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
        android_ripple={{ color: colors.surfaceRipple }}
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
