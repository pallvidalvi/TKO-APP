import { NativeModules, Platform } from 'react-native';

const DEFAULT_LOCAL_WIFI_PORT = 8765;
const NativeLocalLeaderboardSync = NativeModules.LocalLeaderboardSync;

const isAvailable = () => Platform.OS === 'android' && Boolean(NativeLocalLeaderboardSync);

const unavailableStatus = {
  running: false,
  port: DEFAULT_LOCAL_WIFI_PORT,
  host: '',
  url: '',
  message: '',
  pendingCount: 0,
  available: false,
};

const normalizeStatus = status => ({
  ...unavailableStatus,
  ...(status || {}),
  available: isAvailable(),
});

export const LocalWifiSyncService = {
  DEFAULT_PORT: DEFAULT_LOCAL_WIFI_PORT,

  isAvailable,

  startReceiver: async (port = DEFAULT_LOCAL_WIFI_PORT) => {
    if (!isAvailable()) {
      return unavailableStatus;
    }

    const status = await NativeLocalLeaderboardSync.startServer(port);
    return normalizeStatus(status);
  },

  stopReceiver: async () => {
    if (!isAvailable()) {
      return unavailableStatus;
    }

    const status = await NativeLocalLeaderboardSync.stopServer();
    return normalizeStatus(status);
  },

  getStatus: async () => {
    if (!isAvailable()) {
      return unavailableStatus;
    }

    const status = await NativeLocalLeaderboardSync.getStatus();
    return normalizeStatus(status);
  },

  drainSnapshots: async () => {
    if (!isAvailable()) {
      return [];
    }

    const rawSnapshots = await NativeLocalLeaderboardSync.drainReceivedSnapshots();

    return (Array.isArray(rawSnapshots) ? rawSnapshots : [])
      .map(rawSnapshot => {
        try {
          return JSON.parse(rawSnapshot);
        } catch (error) {
          console.warn('Unable to parse local Wi-Fi leaderboard payload:', error);
          return null;
        }
      })
      .filter(Boolean);
  },
};

export default LocalWifiSyncService;
