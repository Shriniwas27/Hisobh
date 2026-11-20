import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AppSettings, CurrencyCode, UserProfile, SecuritySettings } from '../types';
import { getAppSetting, setAppSetting } from '../db/queries';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  profile: UserProfile;
  updateProfile: (newProfile: Partial<UserProfile>) => void;
  security: SecuritySettings;
  updateSecurity: (newSec: Partial<SecuritySettings>) => void;
  isLocked: boolean;
  unlock: () => void;
  lock: () => void;
  isOnboarded: boolean;
  setOnboarded: (val: boolean) => void;
  logout: () => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: '₹',
  currencyCode: 'INR',
  useIndianGrouping: true,
  dateFormat: 'DD/MM/YYYY',
  theme: 'light',
  showRunningTotal: false,
  hideAmounts: false,
};

const DEFAULT_PROFILE: UserProfile = {
  name: 'Shrinidhi',
  email: 'Personal Ledger',
  avatarUri: null,
  joinedDate: '2026',
};

const DEFAULT_SECURITY: SecuritySettings = {
  isLockEnabled: false,
  isBiometricEnabled: true,
  pinCode: null,
};

const AppContext = createContext<AppContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  profile: DEFAULT_PROFILE,
  updateProfile: () => {},
  security: DEFAULT_SECURITY,
  updateSecurity: () => {},
  isLocked: false,
  unlock: () => {},
  lock: () => {},
  isOnboarded: false,
  setOnboarded: () => {},
  logout: () => {},
  refreshTrigger: 0,
  triggerRefresh: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SECURITY);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const appState = useRef(AppState.currentState);

  // Load persisted settings, profile, and security from database
  useEffect(() => {
    try {
      const sym = getAppSetting('currency_symbol', '₹');
      const code = getAppSetting('currency_code', 'INR') as CurrencyCode;
      const indian = getAppSetting('use_indian_grouping', 'true') === 'true';
      const df = getAppSetting('date_format', 'DD/MM/YYYY') as AppSettings['dateFormat'];
      const th = getAppSetting('theme', 'light') as AppSettings['theme'];
      const rt = getAppSetting('show_running_total', 'false') === 'true';
      const ha = getAppSetting('hide_amounts', 'false') === 'true';

      setSettings({
        currencySymbol: sym,
        currencyCode: code,
        useIndianGrouping: indian,
        dateFormat: df,
        theme: th,
        showRunningTotal: rt,
        hideAmounts: ha,
      });

      // Profile
      const uName = getAppSetting('user_name', 'Shrinidhi');
      const uEmail = getAppSetting('user_email', 'Personal Ledger');
      const uAvatar = getAppSetting('user_avatar_uri', '');
      const uJoined = getAppSetting('user_joined_date', '2026');

      setProfile({
        name: uName,
        email: uEmail,
        avatarUri: uAvatar ? uAvatar : null,
        joinedDate: uJoined,
      });

      // Security
      const secEnabled = getAppSetting('app_lock_enabled', 'false') === 'true';
      const secBio = getAppSetting('app_lock_biometric', 'true') === 'true';
      const secPin = getAppSetting('app_lock_pin', '');

      const loadedSec: SecuritySettings = {
        isLockEnabled: secEnabled,
        isBiometricEnabled: secBio,
        pinCode: secPin ? secPin : null,
      };
      setSecurity(loadedSec);

      // If lock is enabled, start app locked
      if (secEnabled && secPin) {
        setIsLocked(true);
      }

      // Onboarding state
      const onboarded = getAppSetting('user_onboarded', 'false') === 'true';
      setIsOnboarded(onboarded);
    } catch (e) {
      console.warn('Could not load settings/profile/security from DB:', e);
    }
  }, []);

  // Listen for AppState changes to lock when coming from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const current = appState.current || '';
      if (
        current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (security.isLockEnabled && security.pinCode) {
          setIsLocked(true);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [security]);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  const lock = useCallback(() => {
    if (security.isLockEnabled && security.pinCode) {
      setIsLocked(true);
    }
  }, [security]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };

      if (newSettings.currencySymbol !== undefined) {
        setAppSetting('currency_symbol', updated.currencySymbol);
      }
      if (newSettings.currencyCode !== undefined) {
        setAppSetting('currency_code', updated.currencyCode);
      }
      if (newSettings.useIndianGrouping !== undefined) {
        setAppSetting('use_indian_grouping', String(updated.useIndianGrouping));
      }
      if (newSettings.dateFormat !== undefined) {
        setAppSetting('date_format', updated.dateFormat);
      }
      if (newSettings.theme !== undefined) {
        setAppSetting('theme', updated.theme);
      }
      if (newSettings.showRunningTotal !== undefined) {
        setAppSetting('show_running_total', String(updated.showRunningTotal));
      }
      if (newSettings.hideAmounts !== undefined) {
        setAppSetting('hide_amounts', String(updated.hideAmounts));
      }

      return updated;
    });
    triggerRefresh();
  }, [triggerRefresh]);

  const updateProfile = useCallback((newProfile: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...newProfile };

      if (newProfile.name !== undefined) {
        setAppSetting('user_name', updated.name);
      }
      if (newProfile.email !== undefined) {
        setAppSetting('user_email', updated.email);
      }
      if (newProfile.avatarUri !== undefined) {
        setAppSetting('user_avatar_uri', updated.avatarUri || '');
      }
      if (newProfile.joinedDate !== undefined) {
        setAppSetting('user_joined_date', updated.joinedDate);
      }

      return updated;
    });
    triggerRefresh();
  }, [triggerRefresh]);

  const updateSecurity = useCallback((newSec: Partial<SecuritySettings>) => {
    setSecurity((prev) => {
      const updated = { ...prev, ...newSec };

      if (newSec.isLockEnabled !== undefined) {
        setAppSetting('app_lock_enabled', String(updated.isLockEnabled));
        if (!updated.isLockEnabled) {
          setIsLocked(false);
        }
      }
      if (newSec.isBiometricEnabled !== undefined) {
        setAppSetting('app_lock_biometric', String(updated.isBiometricEnabled));
      }
      if (newSec.pinCode !== undefined) {
        setAppSetting('app_lock_pin', updated.pinCode || '');
      }

      return updated;
    });
    triggerRefresh();
  }, [triggerRefresh]);

  const setOnboarded = useCallback((val: boolean) => {
    setAppSetting('user_onboarded', val ? 'true' : 'false');
    setIsOnboarded(val);
    triggerRefresh();
  }, [triggerRefresh]);

  const logout = useCallback(() => {
    setAppSetting('user_onboarded', 'false');
    setIsOnboarded(false);
    setIsLocked(false);
    triggerRefresh();
  }, [triggerRefresh]);

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        profile,
        updateProfile,
        security,
        updateSecurity,
        isLocked,
        unlock,
        lock,
        isOnboarded,
        setOnboarded,
        logout,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
