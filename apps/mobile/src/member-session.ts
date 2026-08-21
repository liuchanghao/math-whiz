import {
  memberSessionDataSchema,
  type MemberSessionData,
} from '@math-whiz/contracts';
import * as SecureStore from 'expo-secure-store';

export const MEMBER_SESSION_KEY = 'math-whiz-member-session';

export const loadMemberSession =
  async (): Promise<MemberSessionData | null> => {
    const stored = await SecureStore.getItemAsync(MEMBER_SESSION_KEY);
    if (stored === null) {
      return null;
    }

    try {
      return memberSessionDataSchema.parse(JSON.parse(stored));
    } catch {
      await SecureStore.deleteItemAsync(MEMBER_SESSION_KEY);
      return null;
    }
  };

export const saveMemberSession = async (session: MemberSessionData) => {
  await SecureStore.setItemAsync(MEMBER_SESSION_KEY, JSON.stringify(session));
};

export const clearMemberSession = async () => {
  await SecureStore.deleteItemAsync(MEMBER_SESSION_KEY);
};
