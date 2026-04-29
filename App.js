import React, { useState, useEffect, useRef, useMemo, useDeferredValue, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  Vibration,
  useWindowDimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { initializeDatabase, seedDatabase } from './src/db/database';
import {
  TeamsService,
  CategoriesService,
  ResultsService,
  DisputesService,
  LeaderboardService,
  promoteExpiredDisputesToResults,
} from './src/services/dataService';
import { DISPUTE_AUTO_SUBMIT_POLL_MS, getDisputeAutoSubmitStatus } from './src/utils/scoring';
import ReportScreen from './src/screens/ReportScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import TouchableOpacity from './src/components/FastTouchableOpacity';
import { NavigationActionButton } from './src/components/NavigationActionButton';
import CategoryCard from './src/components/stopwatch-form/CategoryCard';
import DNFSelector from './src/components/stopwatch-form/DNFSelector';
import LateStartSelector from './src/components/stopwatch-form/LateStartSelector';
import LateStartCheckbox from './src/components/stopwatch-form/LateStartCheckbox';
import PenaltyCounter from './src/components/stopwatch-form/PenaltyCounter';
import styles from './src/styles/App.styles';
import SectionHeader from './src/components/common/SectionHeader/SectionHeader';
import EmptyStateCard from './src/components/common/EmptyStateCard/EmptyStateCard';
import ModalHeader from './src/components/common/ModalHeader/ModalHeader';
import TimeSummarySection from './src/components/common/TimeSummarySection/TimeSummarySection';

const HEADING_FONT = Platform.select({
  ios: 'monospace',
  android: 'monospace',
  web: 'monospace',
  default: 'monospace',
});

const TITLE_FONT = Platform.select({
  ios: 'monospace',
  android: 'monospace',
  web: 'monospace',
  default: 'monospace',
});

const BODY_FONT = Platform.select({
  ios: 'monospace',
  android: 'monospace',
  web: 'monospace',
  default: 'monospace',
});

const STABLE_TEXT_INPUT_PROPS = {
  autoCorrect: false,
  spellCheck: false,
  autoComplete: 'off',
  importantForAutofill: 'no',
  textContentType: 'none',
  underlineColorAndroid: 'transparent',
};

// Platform-specific imports
let FileSystem = null;
let Sharing = null;

// Only import FileSystem and Sharing on native platforms (not web)
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system/legacy');
  Sharing = require('expo-sharing');
}

/**
 * CSV Exporter
 * Creates CSV files for both web and mobile platforms
 */
const CSVExporter = {
  // Download CSV file (works on both mobile and web)
  downloadFile: async (fileName, headers, rows) => {
    if (Platform.OS === 'web') {
      // Web: Create CSV file with proper formatting
      const csvContent = [
        headers.join(','),
        ...rows.map(row =>
          row.map(cell => {
            const str = String(cell || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ),
      ].join('\n');

      try {
        const element = document.createElement('a');
        // Use CSV MIME type
        const file = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        element.href = URL.createObjectURL(file);
        element.download = fileName;
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        
        return true;
      } catch (error) {
        throw new Error(`Failed to download file on web: ${error.message}`);
      }
    } else if (FileSystem && Sharing) {
      // Mobile: Create CSV file
      try {
        const csvContent = [
          headers.join(','),
          ...rows.map(row =>
            row.map(cell => {
              const str = String(cell || '');
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            }).join(',')
          ),
        ].join('\n');

        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csvContent);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: 'Download Registration Data',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert('Success', `CSV file created: ${fileName}`);
        }
        return true;
      } catch (error) {
        throw new Error(`Failed to download file: ${error.message}`);
      }
    } else {
      throw new Error('CSV download not supported on this platform');
    }
  },
};

const MIN_TOUCH_TARGET = 48;
const TOUCH_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };

const getResponsiveLayout = (screenWidth, screenHeight) => {
  const shortestSide = Math.min(screenWidth, screenHeight);
  const isTablet = shortestSide >= 600;
  const isLargeTablet = shortestSide >= 720;
  const isSmallPhone = screenWidth < 390;
  const isLandscape = screenWidth > screenHeight;
  const isTabletLandscape = isTablet && isLandscape;
  const categoryColumns = isSmallPhone
    ? 1
    : isTabletLandscape
      ? screenWidth >= 1480
        ? 4
        : screenWidth >= 1320
          ? 3
          : 2
      : 2;
  const penaltyColumns = isTabletLandscape ? 3 : isTablet ? 2 : 1;
  const useSplitLayout = isTabletLandscape && screenWidth >= 960;
  const shellMaxWidth = isTablet
    ? Math.min(screenWidth - (isTabletLandscape ? 40 : 32), screenWidth >= 1400 ? 1320 : 1180)
    : screenWidth;
  const shellPadding = isTabletLandscape ? 28 : isLargeTablet ? 26 : isTablet ? 24 : isSmallPhone ? 12 : 16;
  const gridGap = isTabletLandscape ? 22 : isTablet ? 16 : 12;
  const usableWidth = Math.max(shellMaxWidth - shellPadding * 2, 0);
  const categoryCardWidth =
    usableWidth > 0
      ? (usableWidth - gridGap * (categoryColumns - 1)) / categoryColumns
      : screenWidth;

  return {
    screenWidth,
    screenHeight,
    isTablet,
    isLargeTablet,
    isSmallPhone,
    isLandscape,
    isTabletLandscape,
    categoryColumns,
    penaltyColumns,
    useSplitLayout,
    shellMaxWidth,
    shellPadding,
    gridGap,
    categoryCardWidth,
    listInitialNumToRender: isTablet ? 8 : 6,
    listMaxToRenderPerBatch: isTablet ? 10 : 8,
    listWindowSize: isTablet ? 7 : 5,
  };
};

const getVirtualizedListProps = (layout, overrides = {}) => ({
  removeClippedSubviews: Platform.OS === 'android',
  initialNumToRender: layout.listInitialNumToRender,
  maxToRenderPerBatch: layout.listMaxToRenderPerBatch,
  windowSize: layout.listWindowSize,
  updateCellsBatchingPeriod: layout.isTablet ? 32 : 48,
  ...overrides,
});

const INITIAL_LAYOUT = getResponsiveLayout(Dimensions.get('window').width, Dimensions.get('window').height);
const IS_TABLET = INITIAL_LAYOUT.isTablet;
const IS_SMALL_PHONE = INITIAL_LAYOUT.isSmallPhone;
const USE_SPLIT_LAYOUT = INITIAL_LAYOUT.useSplitLayout;
const USE_TWO_COLUMN_PENALTIES = INITIAL_LAYOUT.penaltyColumns > 1;
const CARD_WIDTH = INITIAL_LAYOUT.categoryCardWidth;

class FlowErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Flow error boundary caught a render error:', error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      // Reset when the protected flow changes, so a fresh screen can mount.
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={styles.flowErrorBoundaryCard}>
          <Text style={styles.flowErrorBoundaryTitle}>Unable to open this screen</Text>
          <Text style={styles.flowErrorBoundaryText}>
            Something went wrong while loading the race stopwatch page.
          </Text>
          <TouchableOpacity
            style={styles.flowErrorBoundaryButton}
            onPress={this.props.onRetry}
            activeOpacity={0.85}
          >
            <Text style={styles.flowErrorBoundaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const CATEGORY_TRACKS = {
  EXTREME: ['CHANDOLI', 'TADOBA', 'SUNDARBAN', 'RANTHAMBORE', 'KANHA', 'JIM CORBETT', 'KAZIRANGA'],
  DIESEL_MODIFIED: ['SHIVNERI', 'RAIGAD', 'PARATAPGAD', 'HARIHAR', 'VASOTA', 'LOHGAD', 'SARASGAD'],
  PETROL_MODIFIED: ['SHIVNERI', 'RAIGAD', 'PARATAPGAD', 'HARIHAR', 'VASOTA', 'LOHGAD', 'SARASGAD'],
  DIESEL_EXPERT: ['KRISHNA', 'KOYANA', 'GODAVARI', 'GANGA', 'YAMUNA', 'SARASWATI', 'CHANDRABHAGA'],
  PETROL_EXPERT: ['KRISHNA', 'KOYANA', 'GODAVARI', 'GANGA', 'YAMUNA', 'SARASWATI', 'CHANDRABHAGA'],
  THAR_SUV: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
  JIMNY_SUV: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
  SUV_MODIFIED: ['TAMHINI', 'AMBOLI', 'SAHYADRI', 'PASARANI', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
  STOCK_NDMS: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
  LADIES: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
  LADIES_CATEGORY: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
};

const REPORT_DAYS = [
  {
    id: 'day-1',
    dayLabel: 'Day 1',
    dateLabel: 'Friday, 29th May 2026',
  },
  {
    id: 'day-2',
    dayLabel: 'Day 2',
    dateLabel: 'Saturday, 30th May 2026',
  },
  {
    id: 'day-3',
    dayLabel: 'Day 3',
    dateLabel: 'Sunday, 31st May 2026',
  },
];

const CATEGORY_IMAGE_SOURCES = {
  EXTREME: require('./assets/Extreme.png'),
  DIESEL_MODIFIED: require('./assets/DieselModifiedTransparent.png'),
  PETROL_MODIFIED: require('./assets/PetrolModifiedTransparent.png'),
  DIESEL_EXPERT: require('./assets/DieselExpert.png'),
  PETROL_EXPERT: require('./assets/PetrolExpert.png'),
  THAR_SUV: require('./assets/TharSUV.png'),
  JIMNY_SUV: require('./assets/JimnySUV.png'),
  SUV_MODIFIED: require('./assets/SUVModified.png'),
  STOCK_NDMS: require('./assets/StockNDMS.png'),
  LADIES: require('./assets/Ladies.png'),
  LADIES_CATEGORY: require('./assets/Ladies.png'),
};

const CATEGORY_CARD_PALETTES = {
  EXTREME: {
    background: '#fff8f6',
    border: '#ff9e91',
    iconBackground: '#ff6b57',
    badgeBackground: '#c83f2d',
    secondaryBadgeBackground: '#ffe2db',
    secondaryBadgeBorder: '#f6b0a0',
    secondaryBadgeText: '#a12e1e',
    title: '#7a1f14',
    description: '#9b4b3f',
  },
  DIESEL_MODIFIED: {
    background: '#f6f8fb',
    border: '#8a99ab',
    iconBackground: '#3e4c61',
    badgeBackground: '#2d3848',
    secondaryBadgeBackground: '#e5ebf2',
    secondaryBadgeBorder: '#a7b4c3',
    secondaryBadgeText: '#2d3848',
    title: '#1f2833',
    description: '#586779',
  },
  PETROL_MODIFIED: {
    background: '#fffedf',
    border: '#e4db52',
    iconBackground: '#e1d400',
    badgeBackground: '#c6b800',
    secondaryBadgeBackground: '#fff7a6',
    secondaryBadgeBorder: '#eadf5e',
    secondaryBadgeText: '#9d9000',
    title: '#7d7300',
    description: '#a29b2a',
  },
  DIESEL_EXPERT: {
    background: '#fff7ef',
    border: '#c98a3d',
    iconBackground: '#b56a1f',
    badgeBackground: '#8f4f12',
    secondaryBadgeBackground: '#f6ddbf',
    secondaryBadgeBorder: '#d7a15b',
    secondaryBadgeText: '#8c4b0c',
    title: '#7a3f05',
    description: '#9c6b34',
  },
  PETROL_EXPERT: {
    background: '#f5f7e8',
    border: '#95a54c',
    iconBackground: '#6f7f2f',
    badgeBackground: '#5e6d25',
    secondaryBadgeBackground: '#e5ecc6',
    secondaryBadgeBorder: '#aab86c',
    secondaryBadgeText: '#58681f',
    title: '#4c5a1a',
    description: '#738249',
  },
  THAR_SUV: {
    background: '#edf3ff',
    border: '#294f9e',
    iconBackground: '#102d68',
    badgeBackground: '#143b8b',
    secondaryBadgeBackground: '#d8e4ff',
    secondaryBadgeBorder: '#6f92d6',
    secondaryBadgeText: '#173d86',
    title: '#102e69',
    description: '#47659c',
  },
  JIMNY_SUV: {
    background: '#f2fff1',
    border: '#57f56a',
    iconBackground: '#12d94e',
    badgeBackground: '#0ea43a',
    secondaryBadgeBackground: '#d8ffd8',
    secondaryBadgeBorder: '#83f38d',
    secondaryBadgeText: '#0d9e35',
    title: '#0c7d2c',
    description: '#3f9757',
  },
  SUV_MODIFIED: {
    background: '#fffde4',
    border: '#f3d51f',
    iconBackground: '#ffd400',
    badgeBackground: '#d4ad00',
    secondaryBadgeBackground: '#fff6a8',
    secondaryBadgeBorder: '#f3d84e',
    secondaryBadgeText: '#ab8600',
    title: '#846800',
    description: '#a6881b',
  },
  STOCK_NDMS: {
    background: '#fff5eb',
    border: '#ff8c1a',
    iconBackground: '#ff6f00',
    badgeBackground: '#ff7a00',
    secondaryBadgeBackground: '#ffe2bf',
    secondaryBadgeBorder: '#ffb05c',
    secondaryBadgeText: '#ff6a00',
    title: '#ff5a00',
    description: '#c95b00',
  },
  LADIES: {
    background: '#fff0f7',
    border: '#f7a9cf',
    iconBackground: '#f38fbe',
    badgeBackground: '#ea72ab',
    secondaryBadgeBackground: '#ffd8e9',
    secondaryBadgeBorder: '#f4acd0',
    secondaryBadgeText: '#cf4b8c',
    title: '#bf4b82',
    description: '#c97aa1',
  },
  LADIES_CATEGORY: {
    background: '#fff0f7',
    border: '#f7a9cf',
    iconBackground: '#f38fbe',
    badgeBackground: '#ea72ab',
    secondaryBadgeBackground: '#ffd8e9',
    secondaryBadgeBorder: '#f4acd0',
    secondaryBadgeText: '#cf4b8c',
    title: '#bf4b82',
    description: '#c97aa1',
  },
};

const CATEGORY_MOCK_TEAMS = {
  EXTREME: {
    team_name: 'Wild Torque',
    driver_name: 'Rudra Patil',
    driver_blood_group: 'B+ve',
    codriver_name: 'Sakshi Patil',
    codriver_blood_group: 'O+ve',
    car_number: '301',
    category: 'EXTREME',
    vehicle_name: 'Mahindra',
    vehicle_model: 'Proto Extreme',
    socials: '@wildtorque',
    status: 'MOCK',
  },
  DIESEL_MODIFIED: {
    team_name: 'Diesel Drift Co.',
    driver_name: 'Akash More',
    driver_blood_group: 'A+ve',
    codriver_name: 'Nilesh More',
    codriver_blood_group: 'B+ve',
    car_number: '302',
    category: 'DIESEL_MODIFIED',
    vehicle_name: 'Toyota',
    vehicle_model: 'Fortuner Modified',
    socials: '@dieseldriftco',
    status: 'MOCK',
  },
  PETROL_MODIFIED: {
    team_name: 'Octane Rebels',
    driver_name: 'Karan Shinde',
    driver_blood_group: 'O+ve',
    codriver_name: 'Vedant Shinde',
    codriver_blood_group: 'A+ve',
    car_number: '303',
    category: 'PETROL_MODIFIED',
    vehicle_name: 'Maruti',
    vehicle_model: 'Gypsy Modified',
    socials: '@octanerebels',
    status: 'MOCK',
  },
  DIESEL_EXPERT: {
    team_name: 'Torque Masters',
    driver_name: 'Mahesh Jagtap',
    driver_blood_group: 'AB+ve',
    codriver_name: 'Pooja Jagtap',
    codriver_blood_group: 'B+ve',
    car_number: '304',
    category: 'DIESEL_EXPERT',
    vehicle_name: 'Mahindra',
    vehicle_model: 'Bolero Expert',
    socials: '@torquemasters',
    status: 'MOCK',
  },
  PETROL_EXPERT: {
    team_name: 'Rev Limit Crew',
    driver_name: 'Swapnil Bhosale',
    driver_blood_group: 'A+ve',
    codriver_name: 'Tejaswini Bhosale',
    codriver_blood_group: 'O+ve',
    car_number: '305',
    category: 'PETROL_EXPERT',
    vehicle_name: 'Suzuki',
    vehicle_model: 'Jimny Rally',
    socials: '@revlimitcrew',
    status: 'MOCK',
  },
  THAR_SUV: {
    team_name: 'Thar Trail Squad',
    driver_name: 'Sagar Kale',
    driver_blood_group: 'O+ve',
    codriver_name: 'Rutuja Kale',
    codriver_blood_group: 'B+ve',
    car_number: '306',
    category: 'THAR_SUV',
    vehicle_name: 'Mahindra',
    vehicle_model: 'Thar 4x4',
    socials: '@thartrailsquad',
    status: 'MOCK',
  },
  JIMNY_SUV: {
    team_name: 'Jimny Junction',
    driver_name: 'Adwait Kulkarni',
    driver_blood_group: 'B+ve',
    codriver_name: 'Nupur Kulkarni',
    codriver_blood_group: 'AB+ve',
    car_number: '307',
    category: 'JIMNY_SUV',
    vehicle_name: 'Maruti',
    vehicle_model: 'Jimny Alpha',
    socials: '@jimnyjunction',
    status: 'MOCK',
  },
  SUV_MODIFIED: {
    team_name: 'Summit Customs',
    driver_name: 'Vishal Chavan',
    driver_blood_group: 'O-ve',
    codriver_name: 'Komal Chavan',
    codriver_blood_group: 'A+ve',
    car_number: '308',
    category: 'SUV_MODIFIED',
    vehicle_name: 'Ford',
    vehicle_model: 'Endeavour Modified',
    socials: '@summitcustoms',
    status: 'MOCK',
  },
  STOCK_NDMS: {
    team_name: 'Factory Trail',
    driver_name: 'Prasad Mane',
    driver_blood_group: 'A+ve',
    codriver_name: 'Neha Mane',
    codriver_blood_group: 'B+ve',
    car_number: '309',
    category: 'STOCK_NDMS',
    vehicle_name: 'Mahindra',
    vehicle_model: 'Scorpio N',
    socials: '@factorytrail',
    status: 'MOCK',
  },
  LADIES: {
    team_name: 'Trail Queens',
    driver_name: 'Snehal Pawar',
    driver_blood_group: 'B+ve',
    codriver_name: 'Mugdha Pawar',
    codriver_blood_group: 'O+ve',
    car_number: '310',
    category: 'LADIES',
    vehicle_name: 'Mahindra',
    vehicle_model: 'Thar Roxx',
    socials: '@trailqueens',
    status: 'MOCK',
  },
  LADIES_CATEGORY: {
    team_name: 'Trail Queens',
    driver_name: 'Snehal Pawar',
    driver_blood_group: 'B+ve',
    codriver_name: 'Mugdha Pawar',
    codriver_blood_group: 'O+ve',
    car_number: '310',
    category: 'LADIES_CATEGORY',
    vehicle_name: 'Mahindra',
    vehicle_model: 'Thar Roxx',
    socials: '@trailqueens',
    status: 'MOCK',
  },
};

const IGNITION_SOUND_DURATION_MS = 3000;
const IGNITION_VIBRATION_PATTERN = Platform.OS === 'android'
  ? [0, 70, 60, 110, 70, 160, 90, 220]
  : 220;
const RESULTS_RESET_TOKEN = '2026-04-09-clear-report-records';
const DEFAULT_SETTINGS_PASSWORD = 'admin123';
const LEGACY_SETTINGS_PASSWORDS = ['Pritisangam@MH50'];
const DEFAULT_SECURITY_PIN = '0000';
const APP_SETTINGS_STORAGE_KEY = 'tko_admin_settings_v1';
const APP_SETTINGS_FILE_NAME = 'tko-admin-settings.json';
const DEFAULT_LEADERBOARD_SYNC_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3000'
    : 'http://192.168.29.96:3000';
const DEFAULT_ANDROID_LOCALHOST_SYNC_BASE_URL = 'http://192.168.29.96:3000';
const DEFAULT_THEME_MODE = 'dark';

const APP_THEMES = {
  dark: {
    mode: 'dark',
    background: '#050505',
    backgroundStrong: '#0b0b0b',
    surface: '#111111',
    surfaceAlt: '#171717',
    surfaceMuted: '#1c1c1c',
    border: '#2a1a0f',
    textPrimary: '#fff7ef',
    textSecondary: '#e1ad7a',
    textTertiary: '#aa7a52',
    accent: '#ff7a00',
    accentStrong: '#ff920f',
    accentSoft: '#231308',
    accentText: '#120a05',
    primaryButton: '#ff7a00',
    primaryButtonText: '#120a05',
    inputBackground: '#0b0b0b',
    timerBackground: '#1a120a',
    timerText: '#ff9b2f',
    overlay: 'rgba(0, 0, 0, 0.72)',
    shadow: '#000000',
  },
  light: {
    mode: 'light',
    background: '#050505',
    backgroundStrong: '#0b0b0b',
    surface: '#111111',
    surfaceAlt: '#171717',
    surfaceMuted: '#1c1c1c',
    border: '#2a1a0f',
    textPrimary: '#fff7ef',
    textSecondary: '#e1ad7a',
    textTertiary: '#aa7a52',
    accent: '#ff7a00',
    accentStrong: '#ff920f',
    accentSoft: '#231308',
    accentText: '#120a05',
    primaryButton: '#ff7a00',
    primaryButtonText: '#120a05',
    inputBackground: '#0b0b0b',
    timerBackground: '#1a120a',
    timerText: '#ff9b2f',
    overlay: 'rgba(0, 0, 0, 0.72)',
    shadow: '#000000',
  },
};

const normalizeThemeMode = value => (String(value || '').trim().toLowerCase() === 'light' ? 'light' : 'dark');
const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include one uppercase letter, one lowercase letter, one number, and one special character.';
const isStrongPassword = value => {
  const password = String(value || '');

  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};
const PIN_RULE_MESSAGE = 'PIN must be exactly 4 digits.';
const normalizeSecurityPin = value => {
  const digitsOnly = String(value || '').replace(/\D/g, '').slice(0, 4);
  return digitsOnly.length === 4 ? digitsOnly : DEFAULT_SECURITY_PIN;
};
const isValidSecurityPin = value => /^\d{4}$/.test(String(value || ''));

const normalizeCategoryKey = (value = '') => {
  const normalizedValue = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalizedValue === 'LADIES') {
    return 'LADIES_CATEGORY';
  }

  return normalizedValue;
};

const attachTeamCountsToCategories = (categories = [], teams = []) =>
  categories.map(category => ({
    ...category,
    imageSource:
      category.imageSource ||
      CATEGORY_IMAGE_SOURCES[normalizeCategoryKey(category.name)] ||
      null,
    trackCount: getCategoryTracks(category.name).length,
    teamCount: teams.filter(
      team => normalizeCategoryKey(team.category) === normalizeCategoryKey(category.name)
    ).length,
  }));

const getTeamsForCategory = (teams = [], categoryName = '') =>
  teams.filter(team => normalizeCategoryKey(team.category) === normalizeCategoryKey(categoryName));

const getRecordKey = (record = {}) =>
  String(
    record.id ||
      record.car_number ||
      `${record.team_name || ''}-${record.driver_name || record.driverName || ''}`
  );

const getTeamStickerNumber = (team = {}) =>
  team.stickerNumber || team.sticker_number || team.car_number || '';

const normalizeLookupValue = value => String(value || '').trim().toUpperCase();
const getStickerSortValue = record => {
  const rawValue = getTeamStickerNumber(record);
  const numericValue = Number(rawValue);

  if (!Number.isNaN(numericValue)) {
    return { numeric: true, value: numericValue };
  }

  return { numeric: false, value: String(rawValue || '').toUpperCase() };
};

const compareRecordsByStickerThenKey = (a, b) => {
  const aSticker = getStickerSortValue(a);
  const bSticker = getStickerSortValue(b);

  if (aSticker.numeric && bSticker.numeric && aSticker.value !== bSticker.value) {
    return aSticker.value - bSticker.value;
  }

  if (aSticker.value !== bSticker.value) {
    return String(aSticker.value).localeCompare(String(bSticker.value), undefined, { numeric: true });
  }

  return String(getRecordKey(a)).localeCompare(String(getRecordKey(b)));
};

const buildCompletedTracksMap = (teams = [], results = [], selectedDayId = '', disputes = []) => {
  const recordKeyByCategoryAndSticker = new Map();

  teams.forEach(team => {
    const categoryKey = normalizeCategoryKey(team.category || '');
    const stickerKey = normalizeLookupValue(getTeamStickerNumber(team));

    if (!categoryKey || !stickerKey) {
      return;
    }

    recordKeyByCategoryAndSticker.set(`${categoryKey}::${stickerKey}`, getRecordKey(team));
  });

  return [...results, ...disputes].reduce((acc, result) => {
    const parsedResult = parseRegistrationPayload(result);
    const resultDayId =
      parsedResult.selected_day_id ||
      parsedResult.selectedDayId ||
      parsedResult.day_id ||
      parsedResult.dayId ||
      '';
    const categoryKey = normalizeCategoryKey(parsedResult.category || '');
    const stickerKey = normalizeLookupValue(parsedResult.sticker_number || parsedResult.stickerNumber || '');
    const trackName = String(parsedResult.track_name || parsedResult.trackName || '').trim();

    if (!categoryKey || !stickerKey || !trackName) {
      return acc;
    }

    if (selectedDayId && String(resultDayId) !== String(selectedDayId)) {
      return acc;
    }

    const recordKey = recordKeyByCategoryAndSticker.get(`${categoryKey}::${stickerKey}`);

    if (!recordKey) {
      return acc;
    }

    acc[recordKey] = [...new Set([...(acc[recordKey] || []), trackName])];
    return acc;
  }, {});
};

const normalizeDisputeLookupValue = value => String(value || '').trim().toLowerCase();
const normalizeDisputeDateValue = value =>
  normalizeDisputeLookupValue(value)
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getStoredDayIdentity = item => ({
  dayId: normalizeDisputeLookupValue(item.selected_day_id || item.selectedDayId || item.day_id || item.dayId || ''),
  dayLabel: normalizeDisputeLookupValue(
    item.selected_day_label || item.selectedDayLabel || item.day_label || item.dayLabel || ''
  ),
  dayDate: normalizeDisputeDateValue(
    item.selected_day_date || item.selectedDayDate || item.day_date || item.dayDate || ''
  ),
});

const matchesStoredSelectedDay = (item, selectedDay) => {
  if (!selectedDay?.id) {
    return false;
  }

  const itemDay = getStoredDayIdentity(item);

  return (
    itemDay.dayId === normalizeDisputeLookupValue(selectedDay.id) ||
    itemDay.dayLabel === normalizeDisputeLookupValue(selectedDay.dayLabel) ||
    itemDay.dayDate === normalizeDisputeDateValue(selectedDay.dateLabel)
  );
};

const ensureResultsClearedOnce = async () => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const resetKey = 'tko_results_reset_token';
      if (window.localStorage.getItem(resetKey) === RESULTS_RESET_TOKEN) {
        return false;
      }

      await ResultsService.clearAllResults();
      window.localStorage.setItem(resetKey, RESULTS_RESET_TOKEN);
      return true;
    }

    if (FileSystem?.documentDirectory) {
      const markerPath = `${FileSystem.documentDirectory}results-reset-${RESULTS_RESET_TOKEN}.txt`;
      const markerInfo = await FileSystem.getInfoAsync(markerPath).catch(() => ({ exists: false }));

      if (markerInfo.exists) {
        return false;
      }

      await ResultsService.clearAllResults();
      await FileSystem.writeAsStringAsync(markerPath, 'done');
      return true;
    }
  } catch (error) {
    console.warn('Unable to clear stored results automatically:', error);
  }

  return false;
};

const getTeamTracks = (team = {}, categoryName = '') => {
  const rawTracks =
    team.tracks ||
    team.track_name ||
    team.trackName ||
    team.track_information ||
    team.trackInformation ||
    '';

  if (Array.isArray(rawTracks)) {
    return rawTracks.filter(Boolean);
  }

  if (typeof rawTracks === 'string' && rawTracks.trim()) {
    return rawTracks
      .split(',')
      .map(track => track.trim())
      .filter(Boolean);
  }

  const categoryKey = normalizeCategoryKey(team.category || categoryName || team.name || '');
  return CATEGORY_TRACKS[categoryKey] || CATEGORY_TRACKS.LADIES_CATEGORY;
};

const getCategoryTracks = categoryName => {
  const categoryKey = normalizeCategoryKey(categoryName || '');
  return CATEGORY_TRACKS[categoryKey] || CATEGORY_TRACKS.LADIES_CATEGORY;
};

const buildDefaultTrackActivationConfig = () =>
  REPORT_DAYS.reduce((dayAcc, day) => {
    dayAcc[day.id] = Object.keys(CATEGORY_TRACKS).reduce((categoryAcc, categoryKey) => {
      categoryAcc[categoryKey] = (CATEGORY_TRACKS[categoryKey] || []).reduce((trackAcc, trackName) => {
        trackAcc[trackName] = true;
        return trackAcc;
      }, {});
      return categoryAcc;
    }, {});
    return dayAcc;
  }, {});

const buildDefaultCategoryActivationConfig = () =>
  REPORT_DAYS.reduce((dayAcc, day) => {
    dayAcc[day.id] = Object.keys(CATEGORY_TRACKS).reduce((categoryAcc, categoryKey) => {
      categoryAcc[categoryKey] = true;
      return categoryAcc;
    }, {});
    return dayAcc;
  }, {});

const TRACK_TIMER_MAX_SECONDS = 15 * 60;

const clampTrackTimerSeconds = value => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(TRACK_TIMER_MAX_SECONDS, Math.max(0, Math.round(numericValue)));
};

const formatTrackTimerLimit = totalSeconds => {
  if (totalSeconds === null || totalSeconds === undefined) {
    return 'Not set';
  }

  const clampedSeconds = clampTrackTimerSeconds(totalSeconds);
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}.0`;
};

const buildDefaultTrackTimerConfig = () =>
  REPORT_DAYS.reduce((dayAcc, day) => {
    dayAcc[day.id] = Object.keys(CATEGORY_TRACKS).reduce((categoryAcc, categoryKey) => {
      categoryAcc[categoryKey] = (CATEGORY_TRACKS[categoryKey] || []).reduce((trackAcc, trackName) => {
        trackAcc[trackName] = null;
        return trackAcc;
      }, {});
      return categoryAcc;
    }, {});
    return dayAcc;
  }, {});

const normalizeTrackActivationConfig = storedConfig => {
  const fallback = buildDefaultTrackActivationConfig();

  return REPORT_DAYS.reduce((dayAcc, day) => {
    dayAcc[day.id] = Object.keys(CATEGORY_TRACKS).reduce((categoryAcc, categoryKey) => {
      categoryAcc[categoryKey] = (CATEGORY_TRACKS[categoryKey] || []).reduce((trackAcc, trackName) => {
        const storedValue = storedConfig?.[day.id]?.[categoryKey]?.[trackName];
        trackAcc[trackName] = typeof storedValue === 'boolean' ? storedValue : true;
        return trackAcc;
      }, {});
      return categoryAcc;
    }, {});
    return dayAcc;
  }, fallback);
};

const normalizeTrackTimerConfig = storedConfig => {
  const fallback = buildDefaultTrackTimerConfig();

  return REPORT_DAYS.reduce((dayAcc, day) => {
    dayAcc[day.id] = Object.keys(CATEGORY_TRACKS).reduce((categoryAcc, categoryKey) => {
      categoryAcc[categoryKey] = (CATEGORY_TRACKS[categoryKey] || []).reduce((trackAcc, trackName) => {
        const storedValue = storedConfig?.[day.id]?.[categoryKey]?.[trackName];
        trackAcc[trackName] =
          storedValue === null || storedValue === undefined ? null : clampTrackTimerSeconds(storedValue);
        return trackAcc;
      }, {});
      return categoryAcc;
    }, {});
    return dayAcc;
  }, fallback);
};

const normalizeCategoryActivationConfig = storedConfig => {
  const fallback = buildDefaultCategoryActivationConfig();

  return REPORT_DAYS.reduce((dayAcc, day) => {
    dayAcc[day.id] = Object.keys(CATEGORY_TRACKS).reduce((categoryAcc, categoryKey) => {
      const storedValue = storedConfig?.[day.id]?.[categoryKey];
      categoryAcc[categoryKey] = typeof storedValue === 'boolean' ? storedValue : true;
      return categoryAcc;
    }, {});
    return dayAcc;
  }, fallback);
};

const isCategoryActiveForDay = (categoryActivationConfig, dayId, categoryName) => {
  const categoryKey = normalizeCategoryKey(categoryName || '');

  if (!categoryKey) {
    return true;
  }

  if (!dayId) {
    return true;
  }

  return categoryActivationConfig?.[dayId]?.[categoryKey] !== false;
};

const getActiveTracksForDayCategory = (trackActivationConfig, dayId, categoryName) => {
  const allTracks = getCategoryTracks(categoryName);

  if (!dayId) {
    return allTracks;
  }

  const categoryKey = normalizeCategoryKey(categoryName || '');
  const dayConfig = trackActivationConfig?.[dayId]?.[categoryKey];

  if (!dayConfig) {
    return allTracks;
  }

  return allTracks.filter(trackName => dayConfig[trackName] !== false);
};

const getTrackTimerLimitSeconds = (trackTimerConfig, dayId, categoryName, trackName) => {
  const normalizedTrackName = String(trackName || '').trim();

  if (!dayId || !normalizedTrackName) {
    return null;
  }

  const categoryKey = normalizeCategoryKey(categoryName || '');
  const storedValue = trackTimerConfig?.[dayId]?.[categoryKey]?.[normalizedTrackName];

  return storedValue === null || storedValue === undefined ? null : clampTrackTimerSeconds(storedValue);
};

const normalizeLeaderboardSyncBaseUrl = value => {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  const normalized = withProtocol.replace(/\/+$/, '');

  if (Platform.OS === 'android' && /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?(\/.*)?$/i.test(raw)) {
    return DEFAULT_ANDROID_LOCALHOST_SYNC_BASE_URL;
  }

  return normalized;
};

const normalizeStoredSettingsPassword = value => {
  const password = String(value || '').trim();

  if (!password || LEGACY_SETTINGS_PASSWORDS.includes(password)) {
    return DEFAULT_SETTINGS_PASSWORD;
  }

  return password;
};

const isAcceptedSettingsPassword = (input, currentPassword) => {
  const normalizedInput = String(input || '').trim();
  const normalizedCurrent = String(currentPassword || '').trim();

  return (
    normalizedInput.length > 0 &&
    (normalizedInput === normalizedCurrent || normalizedInput === DEFAULT_SETTINGS_PASSWORD)
  );
};

const loadStoredAppSettings = async () => {
  const fallback = {
    password: DEFAULT_SETTINGS_PASSWORD,
    pin: DEFAULT_SECURITY_PIN,
    categoryActivationConfig: buildDefaultCategoryActivationConfig(),
    trackActivationConfig: buildDefaultTrackActivationConfig(),
    trackTimerConfig: buildDefaultTrackTimerConfig(),
    themeMode: DEFAULT_THEME_MODE,
    leaderboardSyncBaseUrl: DEFAULT_LEADERBOARD_SYNC_BASE_URL,
  };

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);

      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      return {
        password: normalizeStoredSettingsPassword(parsed?.password),
        pin: normalizeSecurityPin(parsed?.pin),
        categoryActivationConfig: normalizeCategoryActivationConfig(parsed?.categoryActivationConfig),
        trackActivationConfig: normalizeTrackActivationConfig(parsed?.trackActivationConfig),
        trackTimerConfig: normalizeTrackTimerConfig(parsed?.trackTimerConfig),
        themeMode: normalizeThemeMode(parsed?.themeMode),
        leaderboardSyncBaseUrl: normalizeLeaderboardSyncBaseUrl(parsed?.leaderboardSyncBaseUrl),
      };
    }

    if (FileSystem?.documentDirectory) {
      const filePath = `${FileSystem.documentDirectory}${APP_SETTINGS_FILE_NAME}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath).catch(() => ({ exists: false }));

      if (!fileInfo.exists) {
        return fallback;
      }

      const raw = await FileSystem.readAsStringAsync(filePath);
      const parsed = JSON.parse(raw);
      return {
        password: normalizeStoredSettingsPassword(parsed?.password),
        pin: normalizeSecurityPin(parsed?.pin),
        categoryActivationConfig: normalizeCategoryActivationConfig(parsed?.categoryActivationConfig),
        trackActivationConfig: normalizeTrackActivationConfig(parsed?.trackActivationConfig),
        trackTimerConfig: normalizeTrackTimerConfig(parsed?.trackTimerConfig),
        themeMode: normalizeThemeMode(parsed?.themeMode),
        leaderboardSyncBaseUrl: normalizeLeaderboardSyncBaseUrl(parsed?.leaderboardSyncBaseUrl),
      };
    }
  } catch (error) {
    console.warn('Unable to load admin settings:', error);
  }

  return fallback;
};

const saveStoredAppSettings = async settings => {
  const payload = JSON.stringify({
    password: settings.password || DEFAULT_SETTINGS_PASSWORD,
    pin: normalizeSecurityPin(settings.pin),
    categoryActivationConfig: normalizeCategoryActivationConfig(settings.categoryActivationConfig),
    trackActivationConfig: normalizeTrackActivationConfig(settings.trackActivationConfig),
    trackTimerConfig: normalizeTrackTimerConfig(settings.trackTimerConfig),
    themeMode: normalizeThemeMode(settings.themeMode),
    leaderboardSyncBaseUrl: normalizeLeaderboardSyncBaseUrl(settings.leaderboardSyncBaseUrl),
  });

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, payload);
    return;
  }

  if (FileSystem?.documentDirectory) {
    const filePath = `${FileSystem.documentDirectory}${APP_SETTINGS_FILE_NAME}`;
    await FileSystem.writeAsStringAsync(filePath, payload);
  }
};

const parseRegistrationPayload = registration => {
  if (!registration || !registration.submission_json) {
    return registration || {};
  }

  try {
    return {
      ...registration,
      ...JSON.parse(registration.submission_json),
    };
  } catch (error) {
    return registration;
  }
};

const DISPUTE_PARTY_OPTIONS = [
  { key: 'byTeam', label: 'By Team' },
  { key: 'byOpponent', label: 'By Opponent' },
];

const DISPUTE_PARTY_LABEL_BY_KEY = DISPUTE_PARTY_OPTIONS.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

const DISPUTE_DETAIL_GROUPS = [
  {
    key: 'penalties',
    title: 'Penalties',
    items: [
      { key: 'buntingPoleDown', label: 'Bunting & Pole Down' },
      { key: 'seatbelt', label: 'Seatbelt' },
      { key: 'groundTouch', label: 'Ground Touch' },
    ],
  },
  {
    key: 'taskSkipped',
    title: 'Task Skipped',
    items: [
      { key: 'taskAttempted', label: 'Skipped After 3rd Attempt' },
      { key: 'taskSkipped', label: 'Task Skipped' },
    ],
  },
  {
    key: 'dnf',
    title: 'DNF',
    items: [
      { key: 'wrongCourse', label: 'Wrong Course' },
      { key: 'fourthAttempt', label: '4th Attempt' },
      { key: 'timeOver', label: 'Time Over' },
    ],
  },
  {
    key: 'other',
    title: 'Other',
    items: [
      { key: 'other', label: 'Other' },
    ],
  },
];

const DISPUTE_DETAIL_ITEM_MAP = DISPUTE_DETAIL_GROUPS.reduce((acc, group) => {
  group.items.forEach(item => {
    acc[item.key] = {
      ...item,
      sectionKey: group.key,
      sectionTitle: group.title,
    };
  });
  return acc;
}, {});

const getEmptyDisputeReasonState = () =>
  Object.keys(DISPUTE_DETAIL_ITEM_MAP).reduce((acc, key) => {
    acc[key] = {
      checked: false,
      detail: '',
    };
    return acc;
  }, {});

const createEmptyDisputeFormState = () =>
  DISPUTE_PARTY_OPTIONS.reduce((acc, party) => {
    acc[party.key] = getEmptyDisputeReasonState();
    return acc;
  }, {});

const safeParseDisputeJsonValue = value => {
  if (!value || typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const getNormalizedDisputeDetailEntries = source => {
  const rawDetails = safeParseDisputeJsonValue(source?.disputeDetails ?? source?.dispute_details ?? []);

  const normalizeEntry = (entry, fallbackPartyKey = '') => {
    const key = String(entry?.key || '').trim();
    const meta = DISPUTE_DETAIL_ITEM_MAP[key];
    const partyKey = String(
      entry?.partyKey ||
        entry?.party_key ||
        entry?.disputeCategory ||
        entry?.dispute_category ||
        fallbackPartyKey ||
        ''
    ).trim();

    if (!key || !meta) {
      return null;
    }

    return {
      key,
      label: entry?.label || meta.label,
      sectionKey: entry?.sectionKey || entry?.section_key || meta.sectionKey,
      sectionTitle: entry?.sectionTitle || entry?.section_title || meta.sectionTitle,
      partyKey,
      partyLabel: entry?.partyLabel || entry?.party_label || DISPUTE_PARTY_LABEL_BY_KEY[partyKey] || '',
      detail: String(entry?.detail || '').trim(),
    };
  };

  if (Array.isArray(rawDetails)) {
    const selectedLegacyParties = rawDetails
      .map(entry => String(entry?.key || '').trim())
      .filter(key => DISPUTE_PARTY_LABEL_BY_KEY[key]);
    const normalizedEntries = rawDetails.map(entry => normalizeEntry(entry)).filter(Boolean);
    const hasPartySpecificEntries = normalizedEntries.some(entry => entry.partyKey);

    if (hasPartySpecificEntries || !selectedLegacyParties.length) {
      return normalizedEntries;
    }

    return selectedLegacyParties.flatMap(partyKey =>
      normalizedEntries.map(entry => ({
        ...entry,
        partyKey,
        partyLabel: DISPUTE_PARTY_LABEL_BY_KEY[partyKey],
      }))
    );
  }

  if (rawDetails && typeof rawDetails === 'object') {
    return DISPUTE_PARTY_OPTIONS.flatMap(party => {
      const partyDetails = rawDetails[party.key];

      if (!partyDetails || typeof partyDetails !== 'object') {
        return [];
      }

      return Object.keys(partyDetails)
        .map(key => {
          const detailValue = partyDetails[key];

          if (typeof detailValue === 'string') {
            return normalizeEntry({ key, detail: detailValue }, party.key);
          }

          if (detailValue?.checked) {
            return normalizeEntry({ key, detail: detailValue?.detail }, party.key);
          }

          return null;
        })
        .filter(Boolean);
    });
  }

  return [];
};

const buildDisputeFormStateFromSource = source => {
  const nextState = createEmptyDisputeFormState();

  getNormalizedDisputeDetailEntries(source).forEach(entry => {
    const partyKey = entry.partyKey && nextState[entry.partyKey] ? entry.partyKey : DISPUTE_PARTY_OPTIONS[0].key;
    nextState[partyKey][entry.key] = {
      checked: true,
      detail: entry.detail,
    };
  });

  return nextState;
};

const buildDisputeEntriesFromState = disputeFormState =>
  DISPUTE_PARTY_OPTIONS.flatMap(party =>
    DISPUTE_DETAIL_GROUPS.flatMap(group =>
      group.items
        .map(item => {
          const itemState = disputeFormState?.[party.key]?.[item.key];

          if (!itemState?.checked) {
            return null;
          }

          return {
            key: item.key,
            label: item.label,
            sectionKey: group.key,
            sectionTitle: group.title,
            partyKey: party.key,
            partyLabel: party.label,
            detail: String(itemState.detail || '').trim(),
          };
        })
        .filter(Boolean)
    )
  );

const getDisputeResolutionLabelForStatus = status => {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (normalizedStatus === 'accepted') {
    return 'Dispute Accepted & Resolved';
  }

  if (normalizedStatus === 'rejected') {
    return 'Dispute Rejected & Resolved';
  }

  if (normalizedStatus === 'auto_submitted' || normalizedStatus === 'auto_submitted_from_dispute') {
    return 'Auto Submitted & Resolved';
  }

  return '';
};

const getNormalizedDisputeResolutions = source => {
  const rawResolutions = safeParseDisputeJsonValue(source?.disputeResolutions ?? source?.dispute_resolutions ?? {});
  const normalized = {};

  if (rawResolutions && typeof rawResolutions === 'object' && !Array.isArray(rawResolutions)) {
    DISPUTE_PARTY_OPTIONS.forEach(party => {
      const resolution = rawResolutions[party.key] || {};
      const status = String(
        resolution.status ||
          resolution.disputeResolutionStatus ||
          resolution.dispute_resolution_status ||
          ''
      ).trim();

      if (!status) {
        return;
      }

      normalized[party.key] = {
        status,
        label:
          resolution.label ||
          resolution.disputeResolutionLabel ||
          resolution.dispute_resolution_label ||
          getDisputeResolutionLabelForStatus(status),
        comment: String(resolution.comment || resolution.resolutionComment || resolution.resolution_comment || '').trim(),
        resolvedAt: resolution.resolvedAt || resolution.resolved_at || null,
      };
    });
  }

  const fallbackStatus = String(source?.disputeResolutionStatus || source?.dispute_resolution_status || '').trim();
  const fallbackLabel = String(source?.disputeResolutionLabel || source?.dispute_resolution_label || '').trim();

  if ((fallbackStatus || fallbackLabel) && !Object.keys(normalized).length) {
    const partyKeys = [...new Set(getNormalizedDisputeDetailEntries(source).map(entry => entry.partyKey).filter(Boolean))];
    (partyKeys.length ? partyKeys : DISPUTE_PARTY_OPTIONS.map(party => party.key)).forEach(partyKey => {
      normalized[partyKey] = {
        status: fallbackStatus,
        label: fallbackLabel || getDisputeResolutionLabelForStatus(fallbackStatus),
        comment: '',
        resolvedAt: null,
      };
    });
  }

  return normalized;
};

const getDisputePartyKeysWithDetails = source => {
  const keys = [...new Set(getNormalizedDisputeDetailEntries(source).map(entry => entry.partyKey).filter(Boolean))];
  return keys.length ? keys : DISPUTE_PARTY_OPTIONS.map(party => party.key);
};

const areAllDisputePartiesResolved = source => {
  const partyKeys = getDisputePartyKeysWithDetails(source);
  const resolutions = getNormalizedDisputeResolutions(source);
  return partyKeys.every(partyKey => Boolean(resolutions[partyKey]?.status));
};

const buildOverallDisputeResolutionStatus = resolutions => {
  const statuses = Object.values(resolutions || {})
    .map(resolution => String(resolution?.status || '').trim())
    .filter(Boolean);

  if (!statuses.length) {
    return '';
  }

  if (statuses.some(status => status === 'auto_submitted' || status === 'auto_submitted_from_dispute')) {
    return 'auto_submitted';
  }

  return statuses.some(status => status === 'accepted') ? 'accepted' : 'rejected';
};

  const formatDisputeEntriesInline = source =>
    getNormalizedDisputeDetailEntries(source)
      .map(entry => `${entry.partyLabel ? `${entry.partyLabel} - ` : ''}${entry.label}: ${entry.detail}`)
      .join(' • ');

const buildExportRows = data => [[
  data.trackName,
  data.srNo || '',
  data.stickerNumber,
  data.driverName,
  data.coDriverName,
  data.bustingCount,
  data.bustingPenaltyTime,
  data.seatbeltCount,
  data.seatbeltPenaltyTime,
  data.groundTouchCount,
  data.groundTouchPenaltyTime,
  data.lateStartStatus,
  data.lateStartPenaltyTime,
  data.attemptCount,
  data.attemptPenaltyTime,
  data.taskSkippedCount,
  data.taskSkippedPenaltyTime,
  data.isDNF ? 'Yes' : 'No',
  data.isDNS ? 'Yes' : 'No',
  data.wrongCourseSelected ? 'Yes' : 'No',
  data.fourthAttemptSelected ? 'Yes' : 'No',
  data.timeOverSelected ? 'Yes' : 'No',
  data.dnfPoints,
  data.totalPenaltiesTime,
  data.performanceTimeDisplay,
  data.totalTimeDisplay,
  new Date().toLocaleString(),
]];

const downloadResultCsv = async data => {
  const fileName = `${data.category} - ${data.trackName}.csv`;
  await CSVExporter.downloadFile(fileName, RECORD_EXPORT_HEADERS, buildExportRows(data));
};

const formatBoolValue = value => (value ? 'Yes' : 'No');

const RECORD_EXPORT_HEADERS = [
  'Track Name',
  'Sr.No.',
  'Sticker No.',
  'Driver Name',
  'Co-Driver Name',
  'Bunting & Pole (Count)',
  'Bunting & Pole (Time)',
  'Seatbelt (Count)',
  'Seatbelt (Time)',
  'Ground Touch (Count)',
  'Ground Touch (Time)',
  'Late Start Status',
  'Late Start Penalty (sec)',
  'Attempt (Count)',
  'Attempt (Time)',
  'Task Skipped (Count)',
  'Task Skipped (Time)',
  'DNF',
  'DNS',
  'Wrong Course',
  '4th Attempt',
  'Time Over',
  'DNF Points',
  'Total Penalties Time (sec)',
  'Performance Time (MM:SS:MS)',
  'Total Time (MM:SS:MS)',
  'Submission Date',
];

/**
 * Registration Form Modal Component
 * Displays form for player details and penalties
 */
const RegistrationForm = React.memo(function RegistrationForm({
  visible,
  category,
  initialRecord,
  selectedDay,
  trackTimerLimitSeconds = null,
  onBack = () => {},
  onSubmit,
  onHoldForDispute,
  onVerifyPin,
  layout,
  theme = APP_THEMES.dark,
}) {
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const [trackName, setTrackName] = useState('');
  const [srNo, setSrNo] = useState('');
  const [stickerNumber, setStickerNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [coDriverName, setCoDriverName] = useState('');
  const [bustingCount, setBustingCount] = useState('0');
  const [seatbeltCount, setSeatbeltCount] = useState('0');
  const [groundTouchCount, setGroundTouchCount] = useState('0');
  const [attemptCount, setAttemptCount] = useState('0');
  const [taskSkippedCount, setTaskSkippedCount] = useState('0');
  const [wrongCourseSelected, setWrongCourseSelected] = useState(false);
  const [fourthAttemptSelected, setFourthAttemptSelected] = useState(false);
  const [timeOverSelected, setTimeOverSelected] = useState(false);
  const [dnfSelection, setDnfSelection] = useState('');
  const [lateStartMode, setLateStartMode] = useState('');
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [hasTimerStarted, setHasTimerStarted] = useState(false);
  const [hasTimerStopped, setHasTimerStopped] = useState(false);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeFormState, setDisputeFormState] = useState(() => createEmptyDisputeFormState());
  const [resolutionCommentInput, setResolutionCommentInput] = useState('');
  const [isPinVerificationInProgress, setIsPinVerificationInProgress] = useState(false);
  const stopwatchStartTimestampRef = useRef(null);
  const stopwatchElapsedRef = useRef(0);

  const PENALTY_VALUES = {
    busting: 20,
    seatbelt: 30,
    groundTouch: 30,
    attempt: 30,
    taskSkipped: 60,
  };

  const calculatePenaltyTime = (count, multiplier) => {
    const numCount = parseInt(count, 10) || 0;
    return numCount * multiplier;
  };

  const bustingPenaltyTime = calculatePenaltyTime(bustingCount, PENALTY_VALUES.busting);
  const seatbeltPenaltyTime = calculatePenaltyTime(seatbeltCount, PENALTY_VALUES.seatbelt);
  const groundTouchPenaltyTime = calculatePenaltyTime(groundTouchCount, PENALTY_VALUES.groundTouch);
  const attemptPenaltyTime = calculatePenaltyTime(attemptCount, PENALTY_VALUES.attempt);
  const taskSkippedPenaltyTime = calculatePenaltyTime(taskSkippedCount, PENALTY_VALUES.taskSkipped);
  const dnfPoints = parseInt(dnfSelection, 10) || 0;
  const isDNF = wrongCourseSelected || fourthAttemptSelected || timeOverSelected;
  const isDNFPointsMissing = isDNF && !dnfPoints;
  const hasLateStartPenalty = lateStartMode === 'late_start';
  const lateStartPenaltyTime = hasLateStartPenalty ? 30 : 0;
  const lateStartStatus = lateStartMode === 'late_start_with_approval'
    ? 'Late Start with Approval'
    : lateStartMode === 'late_start'
      ? 'Late Start'
      : 'No';

  const totalPenaltiesTime =
    bustingPenaltyTime +
    seatbeltPenaltyTime +
    groundTouchPenaltyTime +
    attemptPenaltyTime +
    taskSkippedPenaltyTime;

  const totalPenaltiesMilliseconds = totalPenaltiesTime * 1000;
  const lateStartPenaltyMilliseconds = lateStartPenaltyTime * 1000;
  const totalTimeMilliseconds = totalPenaltiesMilliseconds + lateStartPenaltyMilliseconds + stopwatchTime;
  const normalizedTrackTimerLimitSeconds =
    trackTimerLimitSeconds === null || trackTimerLimitSeconds === undefined
      ? null
      : clampTrackTimerSeconds(trackTimerLimitSeconds);
  const trackTimerLimitMilliseconds =
    normalizedTrackTimerLimitSeconds === null ? null : normalizedTrackTimerLimitSeconds * 1000;
  const trackTimerLimitLabel =
    normalizedTrackTimerLimitSeconds === null ? 'Not set' : formatTrackTimerLimit(normalizedTrackTimerLimitSeconds);
  const isTrackTimerLocked = normalizedTrackTimerLimitSeconds !== null;
  const currentDisputeEntries = useMemo(
    () => getNormalizedDisputeDetailEntries(initialRecord),
    [initialRecord]
  );
  const resolvingDisputePartyKey = initialRecord?.source === 'dispute' ? initialRecord?.resolveDisputeCategory || '' : '';
  const safeCategoryName = category?.name || initialRecord?.category || 'Category';

  useEffect(() => {
    if (!isStopwatchRunning) {
      return undefined;
    }

    if (stopwatchStartTimestampRef.current === null) {
      stopwatchStartTimestampRef.current = Date.now() - stopwatchElapsedRef.current;
    }

    const interval = setInterval(() => {
      const nextElapsed = Math.max(0, Date.now() - stopwatchStartTimestampRef.current);

      if (nextElapsed !== stopwatchElapsedRef.current) {
        stopwatchElapsedRef.current = nextElapsed;
        setStopwatchTime(nextElapsed);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  useEffect(() => {
    if (visible && category) {
      resetForm();
    }
  }, [visible, category]);

  useEffect(() => {
    if (visible && initialRecord) {
      const recordTracks = getTeamTracks(initialRecord, category?.name);
      const defaultTrack =
        initialRecord.selectedTrack ||
        initialRecord.trackName ||
        initialRecord.track_name ||
        recordTracks[0] ||
        '';
      const initialStopwatchTime =
        initialRecord.completionTimeMilliseconds ??
        initialRecord.stopwatchTime ??
        0;
      setSrNo(String(initialRecord.srNo || ''));
      setStickerNumber(String(getTeamStickerNumber(initialRecord) || ''));
      setDriverName(initialRecord.driver_name || initialRecord.driverName || '');
      setCoDriverName(initialRecord.codriver_name || initialRecord.coDriverName || '');
      setTrackName(defaultTrack);
      setLateStartMode(initialRecord.lateStartMode || '');
      setBustingCount(String(initialRecord.bustingCount ?? 0));
      setSeatbeltCount(String(initialRecord.seatbeltCount ?? 0));
      setGroundTouchCount(String(initialRecord.groundTouchCount ?? 0));
      setAttemptCount(String(initialRecord.attemptCount ?? 0));
      setTaskSkippedCount(String(initialRecord.taskSkippedCount ?? 0));
      setWrongCourseSelected(Boolean(initialRecord.wrongCourseSelected));
      setFourthAttemptSelected(Boolean(initialRecord.fourthAttemptSelected));
      setTimeOverSelected(Boolean(initialRecord.timeOverSelected));
      setDnfSelection(initialRecord.dnfSelection ? String(initialRecord.dnfSelection) : '');
      setStopwatchTime(initialStopwatchTime);
      stopwatchElapsedRef.current = initialStopwatchTime;
      stopwatchStartTimestampRef.current = null;
      setHasTimerStarted(Boolean(initialStopwatchTime) || Boolean(initialRecord.isDNF));
      setHasTimerStopped(Boolean(initialStopwatchTime) || Boolean(initialRecord.isDNF));
      setIsStopwatchRunning(false);
      setDisputeFormState(buildDisputeFormStateFromSource(initialRecord));
      setResolutionCommentInput('');
    } else if (visible) {
      setDisputeFormState(createEmptyDisputeFormState());
      setResolutionCommentInput('');
    }
  }, [visible, initialRecord]);

  useEffect(() => {
    if (!isDNF) {
      return;
    }

    stopwatchElapsedRef.current = stopwatchTime;
    stopwatchStartTimestampRef.current = null;
    setIsStopwatchRunning(false);

    if (hasTimerStarted || stopwatchTime > 0) {
      setHasTimerStopped(true);
    }
  }, [isDNF, hasTimerStarted, stopwatchTime]);

  useEffect(() => {
    if (normalizedTrackTimerLimitSeconds === null) {
      return;
    }

    if (timeOverSelected || wrongCourseSelected || fourthAttemptSelected) {
      return;
    }

    if (!hasTimerStarted && stopwatchTime <= 0 && !isStopwatchRunning) {
      return;
    }

    if (trackTimerLimitMilliseconds === null || stopwatchTime < trackTimerLimitMilliseconds) {
      return;
    }

    setTimeOverSelected(true);
  }, [
    fourthAttemptSelected,
    hasTimerStarted,
    isStopwatchRunning,
    normalizedTrackTimerLimitSeconds,
    stopwatchTime,
    timeOverSelected,
    trackTimerLimitMilliseconds,
    wrongCourseSelected,
  ]);

  const toggleStopwatch = () => {
    try {
      if (isStopwatchRunning) {
        const nextElapsed =
          stopwatchStartTimestampRef.current !== null
            ? Math.max(0, Date.now() - stopwatchStartTimestampRef.current)
            : stopwatchElapsedRef.current;

        stopwatchElapsedRef.current = nextElapsed;
        stopwatchStartTimestampRef.current = null;
        setStopwatchTime(nextElapsed);
        setIsStopwatchRunning(false);
        setHasTimerStopped(true);
        return;
      }

      if (!hasTimerStarted && !hasTimerStopped) {
        stopwatchStartTimestampRef.current = Date.now() - stopwatchElapsedRef.current;
        setIsStopwatchRunning(true);
        setHasTimerStarted(true);
      }
    } catch (error) {
      console.error('Unable to toggle stopwatch:', error);
      Alert.alert('Error', 'Unable to start the timer.');
    }
  };

  const resetStopwatch = () => {
    stopwatchStartTimestampRef.current = null;
    stopwatchElapsedRef.current = 0;
    setStopwatchTime(0);
    setIsStopwatchRunning(false);
    setHasTimerStarted(false);
    setHasTimerStopped(false);
    setBustingCount('0');
    setSeatbeltCount('0');
    setGroundTouchCount('0');
    setAttemptCount('0');
    setTaskSkippedCount('0');
    setLateStartMode('');
    setWrongCourseSelected(false);
    setFourthAttemptSelected(false);
    setTimeOverSelected(false);
    setDnfSelection('');
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  const formatDuration = milliseconds => {
    const safeMilliseconds = Math.max(0, milliseconds || 0);
    const totalSeconds = Math.floor(safeMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const cs = Math.floor((safeMilliseconds % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${cs.toString().padStart(2, '0')}`;
  };

  const getDNFLabel = () => {
    if (wrongCourseSelected) {
      return 'DNF - Wrong Course';
    }

    if (fourthAttemptSelected) {
      return 'DNF - 4th Attempt';
    }

    if (timeOverSelected) {
      return 'DNF - Time Over';
    }

    return 'DNF';
  };

  const dnfDisplayLabel = getDNFLabel();
  const performanceTimeDisplay = isDNF ? dnfDisplayLabel : formatDuration(stopwatchTime);
  const totalTimeDisplay = isDNF ? dnfDisplayLabel : formatDuration(totalTimeMilliseconds);

  const resetForm = () => {
    setTrackName('');
    setSrNo('');
    setStickerNumber('');
    setDriverName('');
    setCoDriverName('');
    setBustingCount('0');
    setSeatbeltCount('0');
    setGroundTouchCount('0');
    setAttemptCount('0');
    setTaskSkippedCount('0');
    setWrongCourseSelected(false);
    setFourthAttemptSelected(false);
    setTimeOverSelected(false);
    setDnfSelection('');
    setLateStartMode('');
    stopwatchStartTimestampRef.current = null;
    stopwatchElapsedRef.current = 0;
    setStopwatchTime(0);
    setHasTimerStarted(false);
    setHasTimerStopped(false);
    setDisputeModalVisible(false);
    setDisputeFormState(createEmptyDisputeFormState());
    setResolutionCommentInput('');
  };

  const getDisputeResolutionStatus = formData => {
    if (initialRecord?.source !== 'dispute') {
      return '';
    }

    const sourceRecord = parseRegistrationPayload(initialRecord || {});
    const currentSignature = [
      formData?.bustingCount || 0,
      formData?.seatbeltCount || 0,
      formData?.groundTouchCount || 0,
      formData?.attemptCount || 0,
      formData?.taskSkippedCount || 0,
      formData?.lateStartMode || '',
      formData?.lateStartStatus || '',
      formData?.lateStartPenaltyTime || 0,
      Boolean(formData?.wrongCourseSelected),
      Boolean(formData?.fourthAttemptSelected),
      Boolean(formData?.timeOverSelected),
      Boolean(formData?.isDNF),
      formData?.dnfSelection || '',
      formData?.dnfPoints || 0,
      formData?.totalPenaltiesTime || 0,
    ].join('|');

    const originalSignature = [
      sourceRecord.bustingCount || sourceRecord.bunting_count || 0,
      sourceRecord.seatbeltCount || sourceRecord.seatbelt_count || 0,
      sourceRecord.groundTouchCount || sourceRecord.ground_touch_count || 0,
      sourceRecord.attemptCount || sourceRecord.attempt_count || 0,
      sourceRecord.taskSkippedCount || sourceRecord.task_skipped_count || 0,
      sourceRecord.lateStartMode || sourceRecord.late_start_mode || '',
      sourceRecord.lateStartStatus || sourceRecord.late_start_status || '',
      sourceRecord.lateStartPenaltyTime || sourceRecord.late_start_penalty_time || 0,
      Boolean(sourceRecord.wrongCourseSelected || sourceRecord.wrong_course_selected),
      Boolean(sourceRecord.fourthAttemptSelected || sourceRecord.fourth_attempt_selected),
      Boolean(sourceRecord.timeOverSelected || sourceRecord.time_over_selected),
      Boolean(sourceRecord.isDNF || sourceRecord.is_dnf),
      sourceRecord.dnfSelection || sourceRecord.dnf_selection || '',
      sourceRecord.dnfPoints || sourceRecord.dnf_points || 0,
      sourceRecord.totalPenaltiesTime || sourceRecord.total_penalties_time || 0,
    ].join('|');

    return currentSignature === originalSignature ? 'rejected' : 'accepted';
  };

  const buildFormData = () => {
    const isEditingDispute = initialRecord?.source === 'dispute';
    const resolvingPartyKey = isEditingDispute ? initialRecord?.resolveDisputeCategory || '' : '';
    const disputeResolutionStatus = isEditingDispute ? getDisputeResolutionStatus({
      bustingCount,
      seatbeltCount,
      groundTouchCount,
      attemptCount,
      taskSkippedCount,
      lateStartMode,
      lateStartStatus,
      lateStartPenaltyTime,
      wrongCourseSelected,
      fourthAttemptSelected,
      timeOverSelected,
      isDNF,
      dnfSelection,
      dnfPoints,
      totalPenaltiesTime,
    }) : '';
    const disputeResolutions = isEditingDispute ? getNormalizedDisputeResolutions(initialRecord) : {};
    const resolutionComment = resolvingPartyKey ? String(resolutionCommentInput || '').trim() : '';

    if (isEditingDispute && resolvingPartyKey) {
      disputeResolutions[resolvingPartyKey] = {
        status: disputeResolutionStatus,
        label: getDisputeResolutionLabelForStatus(disputeResolutionStatus),
        comment: resolutionComment,
        resolvedAt: new Date().toISOString(),
      };
    }

    const overallDisputeResolutionStatus = buildOverallDisputeResolutionStatus(disputeResolutions);

    return {
      disputeId: isEditingDispute ? (initialRecord?.disputeId || initialRecord?.id || null) : null,
      source: isEditingDispute ? 'dispute' : 'records',
      disputeDetails: isEditingDispute ? getNormalizedDisputeDetailEntries(initialRecord) : [],
      disputeResolutions,
      dispute_resolutions: disputeResolutions,
      resolveDisputeCategory: resolvingPartyKey,
      disputeResolutionStatus: overallDisputeResolutionStatus || disputeResolutionStatus || '',
      disputeResolutionLabel: getDisputeResolutionLabelForStatus(overallDisputeResolutionStatus || disputeResolutionStatus),
      selectedDayId: selectedDay?.id || initialRecord?.selectedDayId || initialRecord?.selected_day_id || '',
      selectedDayLabel: selectedDay?.dayLabel || initialRecord?.selectedDayLabel || initialRecord?.selected_day_label || '',
      selectedDayDate: selectedDay?.dateLabel || initialRecord?.selectedDayDate || initialRecord?.selected_day_date || '',
      trackName,
      category: category?.name || initialRecord?.category || '',
      srNo,
      stickerNumber,
      driverName,
      coDriverName,
      completionTime: isDNF ? 'DNF' : formatTime(stopwatchTime),
      completionTimeMilliseconds: stopwatchTime,
      performanceTimeDisplay,
      trackTimerLimitSeconds: normalizedTrackTimerLimitSeconds,
      trackTimerLimitDisplay: trackTimerLimitLabel,
      bustingCount,
      seatbeltCount,
      groundTouchCount,
      lateStartMode,
      lateStartStatus,
      lateStartPenaltyTime,
      attemptCount,
      taskSkippedCount,
      isDNF,
      isDNS: false,
      wrongCourseSelected,
      fourthAttemptSelected,
      timeOverSelected,
      dnfSelection,
      dnfPoints,
      bustingPenaltyTime,
      seatbeltPenaltyTime,
      groundTouchPenaltyTime,
      attemptPenaltyTime,
      taskSkippedPenaltyTime,
      totalPenaltiesTime,
      totalTimeMilliseconds,
      totalTimeDisplay,
    };
  };

  const validateSubmission = () => {
    if (!trackName.trim()) {
      Alert.alert('Error', 'Please select Track Name');
      return false;
    }
    if (!driverName.trim() || !stickerNumber.trim() || !coDriverName.trim()) {
      Alert.alert('Error', 'Selected record details are incomplete');
      return false;
    }
    if (!hasTimerStopped && !isDNF) {
      Alert.alert('Error', 'Stop the timer before continuing');
      return false;
    }
    if (isDNFPointsMissing) {
      Alert.alert('Error', 'Please select DNF points before continuing');
      return false;
    }
    return true;
  };

  const runPinVerification = async actionLabel => {
    if (typeof onVerifyPin !== 'function') {
      return true;
    }

    try {
      setIsPinVerificationInProgress(true);
      return await onVerifyPin(actionLabel);
    } finally {
      setIsPinVerificationInProgress(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateSubmission()) {
      return;
    }

    const didVerifyPin = await runPinVerification('submit this stopwatch record');

    if (!didVerifyPin) {
      return;
    }

    const formData = buildFormData();
    const didSubmit = await onSubmit(formData);
    if (didSubmit) {
      resetStopwatch();
      resetForm();
    }
  };

  const handleDispute = async () => {
    if (!validateSubmission()) {
      return;
    }

    setDisputeModalVisible(true);
  };

  const handleDisputeFieldToggle = (partyKey, key) => {
    setDisputeFormState(prev => {
      const nextChecked = !prev?.[partyKey]?.[key]?.checked;

      return {
        ...prev,
        [partyKey]: {
          ...(prev?.[partyKey] || getEmptyDisputeReasonState()),
          [key]: {
            checked: nextChecked,
            detail: nextChecked ? prev?.[partyKey]?.[key]?.detail || '' : '',
          },
        },
      };
    });
  };

  const handleDisputeDetailChange = (partyKey, key, value) => {
    setDisputeFormState(prev => ({
      ...prev,
      [partyKey]: {
        ...(prev?.[partyKey] || getEmptyDisputeReasonState()),
        [key]: {
          checked: true,
          detail: value,
        },
      },
    }));
  };

  const handleDisputeModalClose = () => {
    setDisputeModalVisible(false);
    setDisputeFormState(buildDisputeFormStateFromSource(initialRecord));
  };

  const handleConfirmDispute = async () => {
    const disputeEntries = buildDisputeEntriesFromState(disputeFormState);

    if (!disputeEntries.length) {
      Alert.alert('Dispute Details', 'Select at least one dispute reason and enter its details.');
      return;
    }

    const missingEntry = disputeEntries.find(entry => !entry.detail);

    if (missingEntry) {
      Alert.alert('Dispute Details', `Please enter details for ${missingEntry.label}.`);
      return;
    }

    const didVerifyPin = await runPinVerification('confirm this dispute record');

    if (!didVerifyPin) {
      return;
    }

    const didHold = await onHoldForDispute({
      ...buildFormData(),
      disputeDetails: disputeEntries,
    });
    if (didHold) {
      setDisputeModalVisible(false);
      resetStopwatch();
      resetForm();
    }
  };

  const penaltyControlsDisabled = !hasTimerStarted || isDNF;
  const submitDisabled = (!hasTimerStopped && !isDNF) || isDNFPointsMissing;
  const disputeDisabled = submitDisabled;
  const startButtonDisabled = hasTimerStopped || isDNF;
  const attemptCounterLabel = 'Skipped after 3rd attempt (30s)';
  const hasAnyResettableValue =
    stopwatchTime > 0 ||
    lateStartMode !== '' ||
    (parseInt(bustingCount, 10) || 0) > 0 ||
    (parseInt(seatbeltCount, 10) || 0) > 0 ||
    (parseInt(groundTouchCount, 10) || 0) > 0 ||
    (parseInt(attemptCount, 10) || 0) > 0 ||
    (parseInt(taskSkippedCount, 10) || 0) > 0 ||
    wrongCourseSelected ||
    fourthAttemptSelected ||
    timeOverSelected ||
    dnfSelection !== '';
  const resetButtonDisabled = isStopwatchRunning || isDNF || !hasAnyResettableValue;
  const showDisputeButton = initialRecord?.source !== 'dispute';
  const showBackButton = !hasTimerStarted || initialRecord?.source === 'dispute';
  const useLandscapeTabletLayout = responsiveLayout.isTabletLandscape;

  const formContent = (
    <>
      <View
        style={[
          styles.dashboardLayout,
          {
            flexDirection: responsiveLayout.useSplitLayout ? 'row' : 'column',
            gap: responsiveLayout.isSmallPhone ? 8 : 12,
          },
        ]}
      >
        <View
          style={[
            styles.dashboardLeftPanel,
            { width: responsiveLayout.useSplitLayout ? '37%' : '100%' },
          ]}
        >
          <View style={styles.vehicleSummaryCard}>
            <View style={styles.vehicleSummaryHeader}>
              <Text style={styles.vehicleSummaryLabel}>Vehicle Details</Text>
            </View>
            <View style={styles.vehicleSummaryInlineRow}>
              <Text style={styles.vehicleSummaryInlineText} adjustsFontSizeToFit minimumFontScale={0.7}>
                Serial No.: <Text style={styles.vehicleSummaryInlineValue}>{srNo ? String(srNo).padStart(2, '0') : '--'}</Text>
                {' | '}
                Sticker No.: <Text style={styles.vehicleSummaryInlineValue}>#{stickerNumber || '--'}</Text>
                {' | '}
                Driver Name: <Text style={styles.vehicleSummaryInlineValue}>{driverName || '--'}</Text>
                {' | '}
                Co-Driver Name: <Text style={styles.vehicleSummaryInlineValue}>{coDriverName || '--'}</Text>
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.timerHeroCard,
              {
                paddingHorizontal: responsiveLayout.isTablet ? 28 : responsiveLayout.isSmallPhone ? 12 : 18,
                paddingVertical: responsiveLayout.isTablet ? 30 : responsiveLayout.isSmallPhone ? 16 : 22,
                marginBottom: responsiveLayout.isSmallPhone ? 14 : 24,
              },
            ]}
          >
            <Text
              style={[
                styles.stopwatchDisplay,
                {
                  fontSize: responsiveLayout.isTablet ? 70 : responsiveLayout.isSmallPhone ? 38 : 48,
                  letterSpacing: responsiveLayout.isTablet ? 6 : responsiveLayout.isSmallPhone ? 1 : 2,
                  marginBottom: responsiveLayout.isSmallPhone ? 12 : 20,
                },
              ]}
            >
              {isDNF ? 'DNF' : formatTime(stopwatchTime)}
            </Text>
            <View
              style={[
                styles.stopwatchButtonsContainer,
                { gap: responsiveLayout.isSmallPhone ? 8 : 12 },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.stopwatchButton,
                  isStopwatchRunning
                    ? styles.stopwatchButtonStop
                    : styles.stopwatchButtonStart,
                  startButtonDisabled && styles.stopwatchButtonDisabled,
                  {
                    paddingVertical: responsiveLayout.isSmallPhone ? 12 : 16,
                    paddingHorizontal: responsiveLayout.isSmallPhone ? 14 : 24,
                    minWidth: responsiveLayout.isTablet ? 220 : responsiveLayout.isSmallPhone ? 136 : 180,
                  },
                ]}
                onPress={toggleStopwatch}
                disabled={startButtonDisabled}
                hitSlop={TOUCH_HIT_SLOP}
              >
                <Text
                  style={[
                    styles.stopwatchButtonText,
                    { fontSize: responsiveLayout.isSmallPhone ? 12 : 14 },
                  ]}
                >
                  {isStopwatchRunning ? 'Stop Timer' : 'Start Timer'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.stopwatchButton,
                  styles.stopwatchResetButton,
                  styles.stopwatchResetCompact,
                  resetButtonDisabled && styles.stopwatchButtonDisabled,
                  { minWidth: responsiveLayout.isTablet ? 110 : responsiveLayout.isSmallPhone ? 82 : 96 },
                ]}
                onPress={resetStopwatch}
                disabled={resetButtonDisabled}
                hitSlop={TOUCH_HIT_SLOP}
              >
                <Text
                  style={[
                    styles.stopwatchButtonText,
                    { fontSize: responsiveLayout.isSmallPhone ? 12 : 14 },
                  ]}
                >
                  Reset
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              style={[
                styles.timerLimitText,
                { marginTop: responsiveLayout.isSmallPhone ? 10 : 12 },
              ]}
            >
              {isTrackTimerLocked ? `Track Limit: ${trackTimerLimitLabel}` : 'Track Limit: Not set'}
            </Text>
          </View>
        </View>

        <ScrollView
          style={[
            styles.dashboardRightPanel,
            {
              width: responsiveLayout.useSplitLayout ? '61%' : '100%',
              padding: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 8 : 12,
            },
          ]}
          contentContainerStyle={[
            styles.dashboardRightPanelContent,
            useLandscapeTabletLayout && styles.dashboardRightPanelContentLandscape,
          ]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {initialRecord?.source === 'dispute' && currentDisputeEntries.length ? (
            <View style={[styles.section, styles.disputeInfoCard]}>
              <SectionHeader
                title="Dispute Details"
                containerStyle={[styles.sectionTitleContainer, { marginBottom: responsiveLayout.isSmallPhone ? 8 : 10 }]}
                titleStyle={[
                  styles.sectionTitle,
                  {
                    fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                    marginBottom: 0,
                  },
                ]}
              />
              {currentDisputeEntries.map(entry => (
                <View key={`hold-${entry.partyKey || 'dispute'}-${entry.key}`} style={styles.disputeInfoRow}>
                  <Text style={styles.disputeInfoLabel}>
                    {entry.partyLabel ? `${entry.partyLabel} - ${entry.label}` : entry.label}
                  </Text>
                  <Text style={styles.disputeInfoValue}>{entry.detail}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.section, { marginBottom: responsiveLayout.isSmallPhone ? 10 : 14 }]}>
            <SectionHeader
              title="Penalties"
              containerStyle={[styles.sectionTitleContainer, { marginBottom: responsiveLayout.isSmallPhone ? 8 : 10 }]}
              titleStyle={[
                styles.sectionTitle,
                {
                  fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                  marginBottom: 0,
                },
              ]}
            />
            <View style={[styles.penaltyGrid, { gap: responsiveLayout.isSmallPhone ? 8 : 10 }]}>
              <PenaltyCounter
                label="Bunting & Pole (20s)"
                count={bustingCount}
                onCountChange={setBustingCount}
                penaltyTime={bustingPenaltyTime}
                layout={responsiveLayout}
                disabled={penaltyControlsDisabled}
              />
              <PenaltyCounter
                label="Seatbelt (30s)"
                count={seatbeltCount}
                onCountChange={setSeatbeltCount}
                penaltyTime={seatbeltPenaltyTime}
                layout={responsiveLayout}
                disabled={penaltyControlsDisabled}
              />
              <PenaltyCounter
                label="Ground Touch (30s)"
                count={groundTouchCount}
                onCountChange={setGroundTouchCount}
                penaltyTime={groundTouchPenaltyTime}
                layout={responsiveLayout}
                disabled={penaltyControlsDisabled}
              />
            </View>
          </View>

          <View style={[styles.section, { marginBottom: responsiveLayout.isSmallPhone ? 10 : 14 }]}>
            <SectionHeader
              title="Task Skipped"
              containerStyle={[styles.sectionTitleContainer, { marginBottom: responsiveLayout.isSmallPhone ? 8 : 10 }]}
              titleStyle={[
                styles.sectionTitle,
                {
                  fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                  marginBottom: 0,
                },
              ]}
            />
            <View style={[styles.penaltyGrid, { gap: responsiveLayout.isSmallPhone ? 8 : 10 }]}>
              <PenaltyCounter
                label={attemptCounterLabel}
                count={attemptCount}
                onCountChange={setAttemptCount}
                penaltyTime={attemptPenaltyTime}
                layout={responsiveLayout}
                disabled={penaltyControlsDisabled}
              />
              <PenaltyCounter
                label="Task Skip (60s)"
                count={taskSkippedCount}
                onCountChange={setTaskSkippedCount}
                penaltyTime={taskSkippedPenaltyTime}
                layout={responsiveLayout}
                disabled={penaltyControlsDisabled}
              />
            </View>
          </View>

          <View style={[styles.section, { marginBottom: responsiveLayout.isSmallPhone ? 10 : 14 }]}>
            <SectionHeader
              title="DNF (Did Not Finish)"
              containerStyle={[styles.sectionTitleContainer, { marginBottom: responsiveLayout.isSmallPhone ? 8 : 10 }]}
              titleStyle={[
                styles.sectionTitle,
                {
                  fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                  marginBottom: 0,
                },
              ]}
            />
            <View style={[styles.penaltyGrid, { gap: responsiveLayout.isSmallPhone ? 8 : 10 }]}>
              <DNFSelector
                wrongCourseSelected={wrongCourseSelected}
                fourthAttemptSelected={fourthAttemptSelected}
                timeOverSelected={timeOverSelected}
                pointsValue={dnfSelection}
                onWrongCourseChange={setWrongCourseSelected}
                onFourthAttemptChange={setFourthAttemptSelected}
                onTimeOverChange={setTimeOverSelected}
                onPointsChange={setDnfSelection}
                timeOverLocked={isTrackTimerLocked}
                timeOverLimitLabel={trackTimerLimitLabel}
                layout={responsiveLayout}
                disabled={!hasTimerStarted && !isDNF}
              />
            </View>
          </View>

          {!responsiveLayout.useSplitLayout ? (
            <TimeSummarySection
              responsiveLayout={responsiveLayout}
              totalPenaltiesTime={totalPenaltiesTime}
              lateStartPenaltyTime={lateStartPenaltyTime}
              performanceTimeDisplay={performanceTimeDisplay}
              isDNF={isDNF}
              dnfSelection={dnfSelection}
              totalTimeDisplay={totalTimeDisplay}
              containerStyle={{
                marginBottom: responsiveLayout.isSmallPhone ? 10 : 12,
                padding: responsiveLayout.isSmallPhone ? 10 : 12,
              }}
            />
          ) : null}
        </ScrollView>
      </View>

      {responsiveLayout.useSplitLayout ? (
        <View style={[styles.tabletFooterPanel, { width: '37%' }]}>
          <TimeSummarySection
            responsiveLayout={responsiveLayout}
            totalPenaltiesTime={totalPenaltiesTime}
            lateStartPenaltyTime={lateStartPenaltyTime}
            performanceTimeDisplay={performanceTimeDisplay}
            isDNF={isDNF}
            dnfSelection={dnfSelection}
            totalTimeDisplay={totalTimeDisplay}
            containerStyle={{
              marginBottom: responsiveLayout.isSmallPhone ? 10 : 12,
              padding: responsiveLayout.isSmallPhone ? 10 : 12,
            }}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <>
      <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={() => {}}
      hardwareAccelerated={Platform.OS === 'android'}
      statusBarTranslucent={Platform.OS === 'android'}
    >
        {category ? (
          <View style={[styles.fullPageContainer, { backgroundColor: '#000000' }]}>
          <View
            style={[
              styles.fullPageContent,
              {
                backgroundColor: '#000000',
                width: '100%',
                maxWidth: responsiveLayout.shellMaxWidth,
                alignSelf: 'center',
              },
            ]}
          >
            <View
              style={[
                styles.formHeader,
                {
                  paddingHorizontal: responsiveLayout.isTablet ? 28 : responsiveLayout.shellPadding,
                  paddingTop: 60,
                },
              ]}
              pointerEvents="box-none"
            >
              <Text
                style={[
                  styles.formTitle,
                  { fontSize: responsiveLayout.isTablet ? 24 : responsiveLayout.isSmallPhone ? 18 : 20 },
                ]}
              >
                {safeCategoryName}
                <Text
                  style={{
                    color: theme.accent,
                    fontSize: responsiveLayout.isTablet ? 22 : responsiveLayout.isSmallPhone ? 16 : 18,
                    fontWeight: '600',
                  }}
                >
                  {' | '}
                  {trackName || 'Track'}
                </Text>
              </Text>
              {showBackButton ? (
                <TouchableOpacity
                  onPress={onBack}
                  activeOpacity={0.88}
                  hitSlop={{ top: 16, right: 16, bottom: 16, left: 16 }}
                  style={[
                    styles.stopwatchBackButton,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.stopwatchBackButtonText, { color: theme.textPrimary }]}>Back</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View
              style={[
                styles.formBody,
                {
                  paddingHorizontal: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 8 : 12,
                },
              ]}
              pointerEvents="box-none"
            >
              {useLandscapeTabletLayout ? (
                <ScrollView
                  style={styles.formBodyScroll}
                  contentContainerStyle={styles.formBodyScrollContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {formContent}
                </ScrollView>
              ) : (
                formContent
              )}
            </View>

            <View
              style={[
                styles.submitActionBar,
                {
                  paddingHorizontal: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 8 : 12,
                },
              ]}
            >
              {resolvingDisputePartyKey ? (
                <View style={styles.disputeResolutionCommentBlock}>
                  <Text style={styles.disputeInfoLabel}>
                    TKO Comment
                  </Text>
                  <TextInput
                    {...STABLE_TEXT_INPUT_PROPS}
                    value={resolutionCommentInput}
                    onChangeText={setResolutionCommentInput}
                    style={styles.disputeResolutionCommentInput}
                    placeholder="Add TKO comment"
                    placeholderTextColor="#8f9bad"
                    multiline
                  />
                </View>
              ) : null}
              <View style={[styles.submitActionButtonsRow, useLandscapeTabletLayout && styles.submitActionButtonsRowLandscape]}>
                {showDisputeButton ? (
                  <TouchableOpacity
                    style={[
                      styles.disputeButton,
                      useLandscapeTabletLayout && styles.submitActionButtonLandscape,
                      (disputeDisabled || isPinVerificationInProgress) && styles.submitButtonDisabled,
                      { paddingVertical: responsiveLayout.isSmallPhone ? 12 : 14, marginBottom: useLandscapeTabletLayout ? 0 : 10 },
                    ]}
                    onPress={handleDispute}
                    disabled={disputeDisabled || isPinVerificationInProgress}
                  >
                    {isPinVerificationInProgress ? (
                      <ActivityIndicator color={theme.primaryButtonText} />
                    ) : (
                      <Text style={[styles.submitButtonText, { fontSize: responsiveLayout.isSmallPhone ? 14 : 15 }]}>
                        Dispute
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    useLandscapeTabletLayout && styles.submitActionButtonLandscape,
                    (submitDisabled || isPinVerificationInProgress) && styles.submitButtonDisabled,
                    { paddingVertical: responsiveLayout.isSmallPhone ? 12 : 14 },
                  ]}
                  onPress={handleSubmit}
                  disabled={submitDisabled || isPinVerificationInProgress}
                >
                  {isPinVerificationInProgress ? (
                    <ActivityIndicator color={theme.primaryButtonText} />
                  ) : (
                    <Text style={[styles.submitButtonText, { fontSize: responsiveLayout.isSmallPhone ? 14 : 15 }]}>
                      SUBMIT
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        ) : null}
      </Modal>

      <Modal
        visible={disputeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleDisputeModalClose}
        hardwareAccelerated={Platform.OS === 'android'}
        statusBarTranslucent={Platform.OS === 'android'}
      >
          <View
          style={styles.disputeModalOverlay}
        >
          <KeyboardAvoidingView
            style={styles.authModalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'android' ? 32 : 0}
          >
            <ScrollView
              style={styles.authModalScroll}
              contentContainerStyle={styles.authModalScrollContent}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.disputeModalCard}>
            <Text style={styles.disputeModalTitle}>Dispute Details</Text>
            <Text style={styles.disputeModalSubtitle}>
              Select the dispute reasons and add details for each selected item.
            </Text>

            <ScrollView
              style={styles.disputeModalScroll}
              contentContainerStyle={styles.disputeModalContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {DISPUTE_PARTY_OPTIONS.map(party => (
                <View key={party.key} style={styles.disputeModalPartySection}>
                  <Text style={styles.disputeModalPartyTitle}>{party.label}</Text>
                  {DISPUTE_DETAIL_GROUPS.map(group => (
                    <View key={`${party.key}-${group.key}`} style={styles.disputeModalSection}>
                      <Text style={styles.disputeModalSectionTitle}>{group.title}</Text>
                      {group.items.map(item => {
                        const itemState = disputeFormState?.[party.key]?.[item.key] || { checked: false, detail: '' };

                        return (
                          <View key={`${party.key}-${item.key}`} style={styles.disputeModalOptionBlock}>
                            <TouchableOpacity
                              style={styles.disputeModalOptionHeader}
                              onPress={() => handleDisputeFieldToggle(party.key, item.key)}
                              activeOpacity={0.85}
                              hitSlop={TOUCH_HIT_SLOP}
                            >
                              <View
                                style={[
                                  styles.disputeCheckbox,
                                  itemState.checked && styles.disputeCheckboxChecked,
                                ]}
                              >
                                {itemState.checked ? <Text style={styles.disputeCheckboxTick}>✓</Text> : null}
                              </View>
                              <Text style={styles.disputeModalOptionLabel}>{item.label}</Text>
                            </TouchableOpacity>
                            {itemState.checked ? (
                              <TextInput
                                {...STABLE_TEXT_INPUT_PROPS}
                                value={itemState.detail}
                                onChangeText={value => handleDisputeDetailChange(party.key, item.key, value)}
                                style={styles.disputeModalInput}
                                placeholder={`Enter ${item.label.toLowerCase()} details`}
                                placeholderTextColor="#8f9bad"
                                multiline
                              />
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={styles.disputeModalActions}>
              <TouchableOpacity
                style={[
                  styles.settingsActionButton,
                  styles.settingsSecondaryButton,
                  styles.disputeModalActionButton,
                  isPinVerificationInProgress && styles.submitButtonDisabled,
                ]}
                onPress={handleDisputeModalClose}
                activeOpacity={0.85}
                hitSlop={TOUCH_HIT_SLOP}
                disabled={isPinVerificationInProgress}
              >
                <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.settingsActionButton,
                  styles.settingsPrimaryButton,
                  styles.disputeModalActionButton,
                  isPinVerificationInProgress && styles.submitButtonDisabled,
                ]}
                onPress={handleConfirmDispute}
                activeOpacity={0.85}
                hitSlop={TOUCH_HIT_SLOP}
                disabled={isPinVerificationInProgress}
              >
                {isPinVerificationInProgress ? (
                  <ActivityIndicator color="#18120a" />
                ) : (
                  <Text style={styles.settingsActionButtonText}>Confirm Dispute</Text>
                )}
              </TouchableOpacity>
            </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
});

const CategoryRecordsModal = React.memo(function CategoryRecordsModal({
  visible,
  category,
  categoryTracks,
  records,
  onClose,
  onStart,
  onDNSPress,
  onRecordActivate,
  onLateStartToggle,
  onLateStartSelect,
  selectedTrackFilter,
  onTrackCardSelect,
  onTrackCardBack,
  selectedLateStartEnabledByRecord,
  selectedLateStartByRecord,
  lateStartActionOrderByRecord,
  completedTracksByRecord,
  layout,
  theme = APP_THEMES.dark,
}) {
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const baseOrderedRecords = useMemo(
    () => [...records].sort(compareRecordsByStickerThenKey),
    [records]
  );
  const serialByRecordKey = useMemo(
    () =>
      new Map(
        baseOrderedRecords.map((record, index) => [getRecordKey(record), index + 1])
      ),
    [baseOrderedRecords]
  );
  const orderedRecords = useMemo(
    () =>
      [...baseOrderedRecords].sort((a, b) => {
        const aLateStart =
          Boolean(selectedLateStartEnabledByRecord[getRecordKey(a)]) && Boolean(selectedLateStartByRecord[getRecordKey(a)]);
        const bLateStart =
          Boolean(selectedLateStartEnabledByRecord[getRecordKey(b)]) && Boolean(selectedLateStartByRecord[getRecordKey(b)]);

        if (aLateStart !== bLateStart) {
          return aLateStart ? 1 : -1;
        }

        if (aLateStart && bLateStart) {
          const aLateStartOrder = lateStartActionOrderByRecord[getRecordKey(a)] ?? 0;
          const bLateStartOrder = lateStartActionOrderByRecord[getRecordKey(b)] ?? 0;

          if (aLateStartOrder !== bLateStartOrder) {
            return aLateStartOrder - bLateStartOrder;
          }
        }

        return compareRecordsByStickerThenKey(a, b);
      }),
    [baseOrderedRecords, lateStartActionOrderByRecord, selectedLateStartEnabledByRecord, selectedLateStartByRecord]
  );
  const filteredRecords = useMemo(
    () =>
      selectedTrackFilter
        ? orderedRecords.filter(record => {
            const recordKey = getRecordKey(record);
            const completedTracks = completedTracksByRecord[recordKey] || [];

            return (
              getTeamTracks(record, category?.name).includes(selectedTrackFilter) &&
              !completedTracks.includes(selectedTrackFilter)
            );
          })
        : [],
    [category?.name, completedTracksByRecord, orderedRecords, selectedTrackFilter]
  );
  const firstAvailableRecordKey = filteredRecords.length ? getRecordKey(filteredRecords[0]) : '';

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={onClose}
      hardwareAccelerated={Platform.OS === 'android'}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View
        style={[
          styles.recordsPageContainer,
          {
            backgroundColor: theme.background,
            paddingHorizontal: responsiveLayout.isTablet ? 24 : responsiveLayout.shellPadding,
            paddingTop: 60,
          },
        ]}
      >
        <View
          style={{
            width: '100%',
            maxWidth: responsiveLayout.shellMaxWidth,
            alignSelf: 'center',
            flex: 1,
          }}
        >
      <ModalHeader
        title={category?.name || 'Category Records'}
        subtitle={
          selectedTrackFilter
            ? `${filteredRecords.length} ${filteredRecords.length === 1 ? 'vehicle' : 'vehicles'} on ${selectedTrackFilter}`
            : `${categoryTracks.length} ${categoryTracks.length === 1 ? 'track' : 'tracks'}`
        }
        onClose={onClose}
        containerStyle={{ borderBottomColor: theme.border }}
        titleStyle={{ color: theme.textPrimary }}
        subtitleStyle={{ color: theme.textSecondary }}
      />

      {!selectedTrackFilter ? (
        categoryTracks.length > 0 ? (
          <View style={styles.trackCardsScreen}>
            <Text style={styles.trackCardsTitle}>Select Track</Text>
            <View style={styles.trackCardsGrid}>
              {categoryTracks.map(track => (
                <TouchableOpacity
                  key={track}
                  style={styles.trackCategoryCard}
                  onPress={() => onTrackCardSelect(track)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.trackCategoryCardLabel}>Track</Text>
                  <Text style={styles.trackCategoryCardTitle}>{track}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <EmptyStateCard
            title="No active tracks"
            message="No tracks are active for this category on the selected day."
            containerStyle={styles.emptyStateCard}
            titleStyle={styles.emptyStateTitle}
            messageStyle={styles.emptyStateText}
          />
        )
      ) : (
        <>
          <FlatList
            data={filteredRecords}
            keyExtractor={(item, index) => String(item.id || item.car_number || index)}
            contentContainerStyle={[
              styles.recordsListContent,
              { paddingBottom: responsiveLayout.isTablet ? 36 : 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            {...getVirtualizedListProps(responsiveLayout, {
              initialNumToRender: responsiveLayout.isTablet ? 10 : 8,
            })}
            ListEmptyComponent={
              <EmptyStateCard
                title="No vehicles found"
                message="No vehicles are mapped to this track yet."
                containerStyle={styles.emptyStateCard}
                titleStyle={styles.emptyStateTitle}
                messageStyle={styles.emptyStateText}
              />
            }
            renderItem={({ item, index }) => {
              const recordKey = getRecordKey(item);
              const selectedTrack = selectedTrackFilter;
              const isLateStartChecked = Boolean(selectedLateStartEnabledByRecord[recordKey]);
              const selectedLateStart = selectedLateStartByRecord[recordKey] || '';
              const completedTracks = completedTracksByRecord[recordKey] || [];
              const isActiveRecord = firstAvailableRecordKey === recordKey;
              const hasLockedSelection = Boolean(firstAvailableRecordKey) && !isActiveRecord;
              const canStart =
                isActiveRecord &&
                Boolean(selectedTrack) &&
                !completedTracks.includes(selectedTrack);
              const serialNo = serialByRecordKey.get(recordKey) || index + 1;

              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => (isActiveRecord ? onRecordActivate(item) : null)}
                  style={[
                    styles.recordCard,
                    !isActiveRecord && styles.recordCardDisabled,
                    hasLockedSelection && styles.recordCardLocked,
                  ]}
                >
                  <View
                    style={[
                      styles.recordTopRow,
                      {
                        paddingHorizontal: responsiveLayout.isTablet ? 22 : 18,
                        paddingVertical: responsiveLayout.isTablet ? 24 : 20,
                      },
                    ]}
                  >
                    <View style={styles.recordHeaderMain}>
                      <View style={styles.recordInfoGrid}>
                        <View style={[styles.recordInfoCard, styles.recordInfoCardCompact]}>
                          <Text style={styles.recordMetaLabel}>SR.</Text>
                          <Text style={styles.recordMetaValue}>
                            {String(serialNo).padStart(2, '0')}
                          </Text>
                        </View>

                        <View style={[styles.recordInfoCard, styles.recordInfoCardMedium]}>
                          <Text style={styles.recordMetaLabel}>Sticker No.</Text>
                          <Text style={styles.recordStickerValue}>
                            #{getTeamStickerNumber(item) || '--'}
                          </Text>
                        </View>

                        <View style={[styles.recordInfoCard, styles.recordInfoCardWide]}>
                          <Text style={styles.recordMetaLabel}>Driver Name</Text>
                          <Text style={styles.recordDriverName}>
                            {item.driver_name || item.driverName || 'Unknown Driver'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.recordActionPanel}>
                      <TouchableOpacity
                        style={[styles.dnsButton, !isActiveRecord && styles.dnsButtonDisabled]}
                        onPress={() => (isActiveRecord ? onDNSPress({ ...item, srNo: serialNo, selectedTrack, recordKey }) : null)}
                        disabled={!isActiveRecord}
                        activeOpacity={0.85}
                        hitSlop={TOUCH_HIT_SLOP}
                      >
                        <Text style={styles.dnsButtonText}>DNS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.startButton,
                          !canStart && styles.startButtonDisabled,
                          {
                            minWidth: responsiveLayout.isTablet ? 132 : responsiveLayout.isSmallPhone ? 96 : 116,
                            width: responsiveLayout.isSmallPhone ? '100%' : undefined,
                          },
                        ]}
                        onPress={() =>
                          canStart ? onStart({ ...item, srNo: serialNo, selectedTrack, recordKey }) : null
                        }
                        disabled={!canStart}
                        hitSlop={TOUCH_HIT_SLOP}
                      >
                        <Text style={styles.startButtonText}>Start</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.recordDivider} />

                  <View style={styles.recordSectionCard}>
                    <View style={styles.recordSectionHeader}>
                      <Text style={styles.recordTracksLabel}>Track</Text>
                      <Text style={styles.recordSectionHint}>Selected: {selectedTrack}</Text>
                    </View>
                    <View style={styles.trackChipContainer}>
                      <View
                        style={[
                          styles.trackChip,
                          styles.trackChipSelected,
                          completedTracks.includes(selectedTrack) && styles.trackChipCompleted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.trackChipText,
                            styles.trackChipTextSelected,
                            completedTracks.includes(selectedTrack) && styles.trackChipTextCompleted,
                          ]}
                        >
                          {selectedTrack}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.recordSectionCard}>
                    <View style={styles.recordSectionHeader}>
                      <Text style={styles.recordTracksLabel}>Late Start</Text>
                    </View>
                    <View style={styles.recordLateStartRow}>
                      <LateStartCheckbox
                        checked={isLateStartChecked}
                        onChange={checked => onLateStartToggle(item, checked)}
                        disabled={false}
                      />
                      <View style={styles.recordLateStartControl}>
                        <LateStartSelector
                          value={selectedLateStart}
                          onValueChange={value => onLateStartSelect(item, value)}
                          disabled={false}
                          approvalOnly={!isActiveRecord}
                          layout={responsiveLayout}
                        />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          <NavigationActionButton
            label="Change Track"
            onPress={onTrackCardBack}
            style={styles.trackCardsBackButton}
            textStyle={styles.trackCardsBackButtonText}
          />
        </>
      )}
        </View>
      </View>
    </Modal>
  );
});

const DisputeRecordsPanel = React.memo(function DisputeRecordsPanel({
  disputes,
  selectedDay,
  categoryOptions,
  loading,
  onRefresh,
  onEdit,
  onResolve,
  layout,
  theme = APP_THEMES.dark,
}) {
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('');
  const [selectedTrackKey, setSelectedTrackKey] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  useEffect(() => {
    setSelectedCategoryKey('');
    setSelectedTrackKey('');
  }, [selectedDay?.id]);

  useEffect(() => {
    setNowTimestamp(Date.now());

    const timerId = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const normalizedDisputes = useMemo(
    () => (disputes || []).map(parseRegistrationPayload),
    [disputes]
  );

  const daySpecificDisputes = useMemo(
    () => normalizedDisputes.filter(item => matchesStoredSelectedDay(item, selectedDay)),
    [normalizedDisputes, selectedDay]
  );

  const categoryLabelMap = useMemo(
    () =>
      (categoryOptions || []).reduce((acc, item) => {
        acc[item.key] = item.label;
        return acc;
      }, {}),
    [categoryOptions]
  );

  const disputeCategoryCards = useMemo(() => {
    const countsByCategory = daySpecificDisputes.reduce((acc, item) => {
      const categoryKey = normalizeCategoryKey(item.category || 'Uncategorized');
      acc[categoryKey] = (acc[categoryKey] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(countsByCategory)
      .map(categoryKey => ({
        key: categoryKey,
        label: categoryLabelMap[categoryKey] || String(categoryKey || 'Category').replace(/_/g, ' '),
        count: countsByCategory[categoryKey],
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryLabelMap, daySpecificDisputes]);

  const selectedCategoryDisputes = useMemo(
    () =>
      selectedCategoryKey
        ? daySpecificDisputes.filter(item => normalizeCategoryKey(item.category || 'Uncategorized') === selectedCategoryKey)
        : [],
    [daySpecificDisputes, selectedCategoryKey]
  );

  const disputeTrackCards = useMemo(() => {
    const countsByTrack = selectedCategoryDisputes.reduce((acc, item) => {
      const trackName = String(item.track_name || item.trackName || '').trim();

      if (!trackName) {
        return acc;
      }

      acc[trackName] = (acc[trackName] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(countsByTrack)
      .map(trackName => ({
        key: trackName,
        label: trackName,
        count: countsByTrack[trackName],
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedCategoryDisputes]);

  const selectedTrackDisputes = useMemo(
    () =>
      selectedTrackKey
        ? selectedCategoryDisputes
            .filter(item => String(item.track_name || item.trackName || '').trim() === selectedTrackKey)
            .sort((a, b) =>
              String(a.sticker_number || a.stickerNumber || '').localeCompare(
                String(b.sticker_number || b.stickerNumber || ''),
                undefined,
                { numeric: true }
              )
            )
        : [],
    [selectedCategoryDisputes, selectedTrackKey]
  );

  useEffect(() => {
    if (selectedCategoryKey && !disputeCategoryCards.some(item => item.key === selectedCategoryKey)) {
      setSelectedCategoryKey('');
      setSelectedTrackKey('');
    }
  }, [disputeCategoryCards, selectedCategoryKey]);

  useEffect(() => {
    if (selectedTrackKey && !disputeTrackCards.some(item => item.key === selectedTrackKey)) {
      setSelectedTrackKey('');
    }
  }, [disputeTrackCards, selectedTrackKey]);

  if (!selectedDay?.id) {
    return (
      <EmptyStateCard
        title="No day selected"
        message="Choose a day first, then open Settings to review disputed records."
        containerStyle={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        titleStyle={{ color: theme.textPrimary }}
        messageStyle={{ color: theme.textSecondary }}
      />
    );
  }

  return (
    <>
      <View style={[styles.settingsInfoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.settingsInfoTitle, { color: theme.accent }]}>Disputed Records</Text>
        <Text style={[styles.settingsInfoText, { color: theme.textSecondary }]}>
          {`${selectedDay.dayLabel} | ${selectedDay.dateLabel}. Open a disputed hold, review the stopwatch values, and submit when it is ready.`}
        </Text>
      </View>

      <View style={styles.resultsHeaderActions}>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.resultsHeaderButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          activeOpacity={0.85}
        >
          <Text style={[styles.resultsHeaderButtonText, { color: theme.accent }]}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {!selectedCategoryKey ? (
        <View style={styles.settingsMenuGrid}>
          {disputeCategoryCards.length === 0 ? (
            <EmptyStateCard
              title="No disputed records"
              message="Hold a stopwatch result as a dispute and it will appear here for the selected day."
              containerStyle={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              titleStyle={{ color: theme.textPrimary }}
              messageStyle={{ color: theme.textSecondary }}
            />
          ) : (
            disputeCategoryCards.map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => {
                  setSelectedCategoryKey(item.key);
                  setSelectedTrackKey('');
                }}
                activeOpacity={0.88}
              >
                <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Vehicle Category</Text>
                <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>{item.label}</Text>
                <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                  {item.count} {item.count === 1 ? 'disputed record' : 'disputed records'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : !selectedTrackKey ? (
        <>
          <NavigationActionButton
            label="Back to Categories"
            onPress={() => {
              setSelectedCategoryKey('');
              setSelectedTrackKey('');
            }}
            style={[styles.trackBackButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            textStyle={[styles.trackBackButtonText, { color: theme.accent }]}
          />

          <View style={styles.settingsTrackList}>
            {disputeTrackCards.length === 0 ? (
              <EmptyStateCard
                title="No disputed tracks"
                message="This category has no disputed tracks for the selected day."
                containerStyle={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                titleStyle={{ color: theme.textPrimary }}
                messageStyle={{ color: theme.textSecondary }}
              />
            ) : (
              disputeTrackCards.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.settingsTrackRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setSelectedTrackKey(item.key)}
                  activeOpacity={0.88}
                >
                  <View style={styles.settingsTrackInfo}>
                    <View style={styles.settingsTrackNameRow}>
                      <View style={[styles.settingsTrackMarker, styles.settingsTrackMarkerInactive]} />
                      <Text style={[styles.settingsTrackName, styles.settingsTrackNameInactive, { color: theme.textPrimary }]}>{item.label}</Text>
                    </View>
                    <Text style={[styles.settingsTrackStatus, styles.settingsTrackStatusInactive]}>
                      {item.count} {item.count === 1 ? 'disputed record' : 'disputed records'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      ) : (
        <>
          <NavigationActionButton
            label="Back to Tracks"
            onPress={() => setSelectedTrackKey('')}
            style={[styles.trackBackButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            textStyle={[styles.trackBackButtonText, { color: theme.accent }]}
          />

          <View style={styles.recordsListContent}>
            {selectedTrackDisputes.length === 0 ? (
              <EmptyStateCard
                title="No disputed records in this track"
                message="This track does not have disputed holds for the selected day."
                containerStyle={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                titleStyle={{ color: theme.textPrimary }}
                messageStyle={{ color: theme.textSecondary }}
              />
            ) : (
              selectedTrackDisputes.map(item => {
                const stickerNumber = item.sticker_number || item.stickerNumber || '--';
                const driverName = item.driver_name || item.driverName || '--';
                const coDriverName = item.codriver_name || item.coDriverName || '--';
                const disputeEntries = getNormalizedDisputeDetailEntries(item);
                const disputeResolutions = getNormalizedDisputeResolutions(item);
                const disputeStatus = getDisputeAutoSubmitStatus(item, nowTimestamp);
                const disputeId = item.id || `${stickerNumber}-${driverName}`;

                return (
                  <View key={`dispute-${disputeId}`} style={[styles.registrationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.registrationCardHeader}>
                      <View style={styles.registrationSrPill}>
                        <Text style={styles.registrationSrLabel}>Sticker</Text>
                        <Text style={styles.registrationSrValue}>#{stickerNumber}</Text>
                      </View>
                      <View style={styles.registrationTrackPill}>
                        <Text style={styles.registrationTrackLabel}>Track</Text>
                        <Text style={styles.registrationTrackValue}>{item.track_name || item.trackName || '--'}</Text>
                      </View>
                    </View>

                    <View style={styles.registrationInfoGrid}>
                      <View style={styles.registrationInfoCell}>
                        <Text style={styles.registrationInfoLabel}>Driver Name</Text>
                        <Text style={styles.registrationInfoValue}>{driverName}</Text>
                      </View>
                      <View style={styles.registrationInfoCell}>
                        <Text style={styles.registrationInfoLabel}>Co-Driver Name</Text>
                        <Text style={styles.registrationInfoValue}>{coDriverName}</Text>
                      </View>
                      <View style={styles.registrationInfoCell}>
                        <Text style={styles.registrationInfoLabel}>Status</Text>
                        <Text style={[styles.registrationInfoValue, styles.disputedStatusText, { color: theme.accent }]}>Disputed</Text>
                      </View>
                      <View style={styles.registrationInfoCell}>
                        <Text style={styles.registrationInfoLabel}>Remaining Time</Text>
                        <Text style={[styles.registrationInfoValue, { color: theme.accent }]}>
                          {disputeStatus.remainingLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.registrationSection}>
                      <Text style={styles.registrationSectionTitle}>Held Stopwatch Snapshot</Text>
                      <Text style={styles.registrationSectionText}>
                        Performance: {item.performance_time || item.performanceTimeDisplay || '--'}
                      </Text>
                      <Text style={styles.registrationSectionText}>
                        Total: {item.total_time || item.totalTimeDisplay || '--'}
                      </Text>
                    </View>

                    <View style={styles.registrationSection}>
                      <Text style={styles.registrationSectionTitle}>Dispute Details</Text>
                      {DISPUTE_PARTY_OPTIONS.map(party => {
                        const partyEntries = disputeEntries.filter(entry => entry.partyKey === party.key);
                        const partyResolution = disputeResolutions[party.key];
                        const isResolved = Boolean(partyResolution?.status);

                        return (
                          <View key={`${disputeId}-${party.key}`} style={styles.disputeResolveSubsection}>
                            <Text style={styles.disputeResolveSubsectionTitle}>{party.label}</Text>
                            {partyEntries.length ? (
                              partyEntries.map(entry => (
                                <Text key={`${disputeId}-${party.key}-${entry.key}`} style={styles.registrationSectionText}>
                                  {entry.label}: {entry.detail}
                                </Text>
                              ))
                            ) : (
                              <Text style={styles.registrationSectionText}>No dispute details added.</Text>
                            )}
                            <Text style={styles.registrationSectionText}>
                              Resolution: {partyResolution?.label || 'Pending'}
                            </Text>
                            {partyResolution?.comment ? (
                              <Text style={styles.registrationSectionText}>Comment: {partyResolution.comment}</Text>
                            ) : null}
                            <TouchableOpacity
                              style={[
                                styles.resultsHeaderButton,
                                styles.disputeCardButton,
                                (!partyEntries.length || isResolved) && styles.submitButtonDisabled,
                                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                              ]}
                              onPress={() =>
                                partyEntries.length && !isResolved
                                  ? onResolve(item, party.key)
                                  : null
                              }
                              activeOpacity={0.85}
                              disabled={!partyEntries.length || isResolved}
                            >
                              <Text style={[styles.resultsHeaderButtonText, { color: theme.accent }]}>
                                {isResolved ? 'Resolved' : 'Resolve'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </>
  );
});

const RegistrationResultsModal = React.memo(function RegistrationResultsModal({
  visible,
  registrations,
  loading,
  onClose,
  onRefresh,
  layout,
}) {
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const normalizedRegistrations = useMemo(
    () => (registrations || []).map(parseRegistrationPayload),
    [registrations]
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={onClose}
      hardwareAccelerated={Platform.OS === 'android'}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View
        style={[
          styles.recordsPageContainer,
          {
            paddingHorizontal: responsiveLayout.isTablet ? 24 : responsiveLayout.shellPadding,
            paddingTop: 60,
          },
        ]}
      >
        <View
          style={{
            width: '100%',
            maxWidth: responsiveLayout.shellMaxWidth,
            alignSelf: 'center',
            flex: 1,
          }}
        >
          <ModalHeader
            title="Submission Results"
            subtitle={
              loading
                ? 'Loading saved registrations...'
                : `${normalizedRegistrations.length} ${normalizedRegistrations.length === 1 ? 'record' : 'records'} stored in DB`
            }
            onClose={onClose}
            rightContent={
              <View style={styles.resultsHeaderActions}>
                <TouchableOpacity onPress={onRefresh} style={styles.resultsHeaderButton} activeOpacity={0.85}>
                  <Text style={styles.resultsHeaderButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            }
            titleStyle={{ color: theme.textPrimary }}
            subtitleStyle={{ color: theme.textSecondary }}
          />

          <FlatList
            data={normalizedRegistrations}
            keyExtractor={(item, index) => String(item.id || index)}
            contentContainerStyle={[
              styles.recordsListContent,
              { paddingBottom: responsiveLayout.isTablet ? 36 : 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={onRefresh}
            {...getVirtualizedListProps(responsiveLayout, {
              initialNumToRender: responsiveLayout.isTablet ? 8 : 6,
            })}
            ListEmptyComponent={
              <EmptyStateCard
                title="No saved submissions"
                message="Submit a vehicle result and the card will appear here from SQLite."
                containerStyle={styles.emptyStateCard}
                titleStyle={styles.emptyStateTitle}
                messageStyle={styles.emptyStateText}
              />
            }
            renderItem={({ item, index }) => {
              const srNo = item.sr_no || item.srNo || index + 1;
              const trackName = item.track_name || item.trackName || '--';
              const driverName = item.driver_name || item.driverName || '--';
              const coDriverName = item.codriver_name || item.coDriverName || '--';
              const stickerNumber = item.sticker_number || item.stickerNumber || '--';
              const taskSkippedCount = item.task_skipped_count ?? item.taskSkippedCount ?? 0;
              const totalPenaltiesTime = item.total_penalties_time ?? item.totalPenaltiesTime ?? 0;
              const performanceTime = item.performance_time || item.performanceTimeDisplay || '--';
              const totalTime = item.total_time || item.totalTimeDisplay || '--';
              const buntingCount = item.bunting_count ?? item.bustingCount ?? 0;
              const seatbeltCount = item.seatbelt_count ?? item.seatbeltCount ?? 0;
              const groundTouchCount = item.ground_touch_count ?? item.groundTouchCount ?? 0;
              const lateStartStatus = item.late_start_status || item.lateStartStatus || 'No';
              const attemptCount = item.attempt_count ?? item.attemptCount ?? 0;

              return (
                <View style={styles.registrationCard}>
                  <View style={styles.registrationCardHeader}>
                    <View style={styles.registrationSrPill}>
                      <Text style={styles.registrationSrLabel}>Sr. No.</Text>
                      <Text style={styles.registrationSrValue}>{String(srNo).padStart(2, '0')}</Text>
                    </View>
                    <View style={styles.registrationTrackPill}>
                      <Text style={styles.registrationTrackLabel}>Track</Text>
                      <Text style={styles.registrationTrackValue}>{trackName}</Text>
                    </View>
                  </View>

                  <View style={styles.registrationInfoGrid}>
                    <View style={styles.registrationInfoCell}>
                      <Text style={styles.registrationInfoLabel}>Driver Name</Text>
                      <Text style={styles.registrationInfoValue}>{driverName}</Text>
                    </View>
                    <View style={styles.registrationInfoCell}>
                      <Text style={styles.registrationInfoLabel}>Co-Driver Name</Text>
                      <Text style={styles.registrationInfoValue}>{coDriverName}</Text>
                    </View>
                    <View style={styles.registrationInfoCell}>
                      <Text style={styles.registrationInfoLabel}>Sticker Number</Text>
                      <Text style={styles.registrationInfoValue}>#{stickerNumber}</Text>
                    </View>
                  </View>

                  <View style={styles.registrationSection}>
                    <Text style={styles.registrationSectionTitle}>Penalties</Text>
                    <Text style={styles.registrationSectionText}>
                      Bunting: {buntingCount} | Seatbelt: {seatbeltCount} | Ground Touch: {groundTouchCount} | Late Start: {lateStartStatus} | Attempt: {attemptCount}
                    </Text>
                    <Text style={styles.registrationSectionText}>
                      Task Skipped: {taskSkippedCount}
                    </Text>
                  </View>

                  <View style={styles.registrationSection}>
                    <Text style={styles.registrationSectionTitle}>Times</Text>
                    <Text style={styles.registrationSectionText}>
                      Total Penalty Time: {totalPenaltiesTime}
                    </Text>
                    <Text style={styles.registrationSectionText}>
                      Performance Time: {performanceTime}
                    </Text>
                    <Text style={styles.registrationSectionText}>
                      Total Time: {totalTime}
                    </Text>
                  </View>

                  <View style={styles.registrationFooter}>
                    <Text style={styles.registrationFooterText}>
                      Category: {item.category || '--'}
                    </Text>
                    <Text style={styles.registrationFooterText}>
                      DNF: {formatBoolValue(item.is_dnf ?? item.isDnf)}
                    </Text>
                    <Text style={styles.registrationFooterText}>
                      DNS: {formatBoolValue(item.is_dns ?? item.isDns)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
});

/**
 * Main App Component
 * Displays the home screen with vehicle categories
 */
export default function App() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const authModalCompact = screenHeight < 560 || (screenWidth > screenHeight && screenHeight < 760);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeRecordKey, setActiveRecordKey] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [recordsVisible, setRecordsVisible] = useState(false);
  const [selectedCategoryTrack, setSelectedCategoryTrack] = useState('');
  const [selectedLateStartEnabledByRecord, setSelectedLateStartEnabledByRecord] = useState({});
  const [selectedLateStartByRecord, setSelectedLateStartByRecord] = useState({});
  const [lateStartActionOrderByRecord, setLateStartActionOrderByRecord] = useState({});
  const [completedTracksByRecord, setCompletedTracksByRecord] = useState({});
  const [searchText, setSearchText] = useState('');
  const deferredSearchText = useDeferredValue(searchText);
  const [dbReady, setDbReady] = useState(false);
  const [teams, setTeams] = useState([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState([]);
  const [reportsVisible, setReportsVisible] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const [appStage, setAppStage] = useState('splash');
  const [selectedDay, setSelectedDay] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState(DEFAULT_SETTINGS_PASSWORD);
  const [securityPin, setSecurityPin] = useState(DEFAULT_SECURITY_PIN);
  const [themeMode, setThemeMode] = useState(DEFAULT_THEME_MODE);
  const [leaderboardSyncBaseUrl, setLeaderboardSyncBaseUrl] = useState(DEFAULT_LEADERBOARD_SYNC_BASE_URL);
  const [categoryActivationConfig, setCategoryActivationConfig] = useState(() => buildDefaultCategoryActivationConfig());
  const [trackActivationConfig, setTrackActivationConfig] = useState(() => buildDefaultTrackActivationConfig());
  const [trackTimerConfig, setTrackTimerConfig] = useState(() => buildDefaultTrackTimerConfig());
  const [settingsPasswordModalVisible, setSettingsPasswordModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsView, setSettingsView] = useState('menu');
  const [themeVisible, setThemeVisible] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState('');
  const [settingsPasswordError, setSettingsPasswordError] = useState('');
  const [leaderboardSyncBaseUrlInput, setLeaderboardSyncBaseUrlInput] = useState('');
  const [leaderboardSyncError, setLeaderboardSyncError] = useState('');
  const [leaderboardSyncLoading, setLeaderboardSyncLoading] = useState(false);
  const [settingsConfigDayId, setSettingsConfigDayId] = useState(REPORT_DAYS[0]?.id || '');
  const [settingsConfigCategoryKey, setSettingsConfigCategoryKey] = useState('EXTREME');
  const [settingsTrackTimerTrack, setSettingsTrackTimerTrack] = useState('');
  const [settingsTrackTimerMinutes, setSettingsTrackTimerMinutes] = useState(0);
  const [settingsTrackTimerSeconds, setSettingsTrackTimerSeconds] = useState(0);
  const [disputeRecords, setDisputeRecords] = useState([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recordPinModalVisible, setRecordPinModalVisible] = useState(false);
  const [recordPinInput, setRecordPinInput] = useState('');
  const [recordPinError, setRecordPinError] = useState('');
  const [recordPinPurpose, setRecordPinPurpose] = useState('submit this record');
  const settingsPasswordInputRef = useRef(null);
  const currentPasswordInputRef = useRef(null);
  const newPasswordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const currentPinInputRef = useRef(null);
  const newPinInputRef = useRef(null);
  const confirmPinInputRef = useRef(null);
  const recordPinInputRef = useRef(null);
  const recordPinRequestRef = useRef(null);
  const splashLogoAnim = useRef(new Animated.Value(0)).current;
  const switchAnim = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0)).current;
  const ignitionSoundRef = useRef(null);
  const splashStartTriggeredRef = useRef(false);
  const ignitionSequenceTimerRef = useRef(null);
  const lateStartActionCounterRef = useRef(0);
  const disputeAutoSubmitInFlightRef = useRef(false);
  const recordFormOpenTimerRef = useRef(null);
  const theme = useMemo(() => APP_THEMES[normalizeThemeMode(themeMode)], [themeMode]);
  const isFullScreenOverlayVisible =
    formVisible ||
    recordsVisible ||
    reportsVisible ||
    leaderboardVisible ||
    settingsPasswordModalVisible ||
    settingsVisible ||
    themeVisible ||
    recordPinModalVisible;

  const clearPendingRecordFormOpen = useCallback(() => {
    if (recordFormOpenTimerRef.current) {
      clearTimeout(recordFormOpenTimerRef.current);
      recordFormOpenTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (appStage !== 'splash' && appStage !== 'day') {
      glowPulseAnim.stopAnimation();
      glowPulseAnim.setValue(0);
      return undefined;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulseAnim, {
          toValue: 1,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulseAnim, {
          toValue: 0,
          duration: 950,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      glowPulseAnim.stopAnimation();
      glowPulseAnim.setValue(0);
    };
  }, [appStage, glowPulseAnim]);

  useEffect(() => {
    return () => {
      if (recordFormOpenTimerRef.current) {
        clearTimeout(recordFormOpenTimerRef.current);
        recordFormOpenTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateSettings = async () => {
      const storedSettings = await loadStoredAppSettings();

      if (!isMounted) {
        return;
      }

      setSettingsPassword(storedSettings.password);
      setSecurityPin(storedSettings.pin);
      setCategoryActivationConfig(storedSettings.categoryActivationConfig);
      setTrackActivationConfig(storedSettings.trackActivationConfig);
      setTrackTimerConfig(storedSettings.trackTimerConfig);
      setThemeMode(storedSettings.themeMode);
      setLeaderboardSyncBaseUrl(storedSettings.leaderboardSyncBaseUrl || DEFAULT_LEADERBOARD_SYNC_BASE_URL);
      setLeaderboardSyncBaseUrlInput(storedSettings.leaderboardSyncBaseUrl || DEFAULT_LEADERBOARD_SYNC_BASE_URL);
      setSettingsLoaded(true);
    };

    hydrateSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    saveStoredAppSettings({
      password: settingsPassword,
      pin: securityPin,
      categoryActivationConfig,
      trackActivationConfig,
      trackTimerConfig,
      themeMode,
      leaderboardSyncBaseUrl,
    }).catch(error => {
      console.warn('Unable to save admin settings:', error);
    });
  }, [categoryActivationConfig, leaderboardSyncBaseUrl, securityPin, settingsLoaded, settingsPassword, themeMode, trackActivationConfig, trackTimerConfig]);

  useEffect(() => {
    if (appStage !== 'splash') {
      return undefined;
    }

    splashStartTriggeredRef.current = false;
    splashLogoAnim.setValue(0);
    switchAnim.setValue(0);
    if (ignitionSequenceTimerRef.current) {
      clearTimeout(ignitionSequenceTimerRef.current);
      ignitionSequenceTimerRef.current = null;
    }

    Animated.parallel([
      Animated.sequence([
        Animated.delay(220),
        Animated.spring(splashLogoAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 65,
        }),
      ]),
    ]).start();

    return () => {
      if (ignitionSequenceTimerRef.current) {
        clearTimeout(ignitionSequenceTimerRef.current);
        ignitionSequenceTimerRef.current = null;
      }
      Vibration.cancel();
      if (ignitionSoundRef.current) {
        ignitionSoundRef.current.unloadAsync().catch(() => {});
        ignitionSoundRef.current = null;
      }
    };
  }, [appStage, splashLogoAnim, switchAnim]);

  const playIgnitionSound = async () => {
    try {
      if (ignitionSoundRef.current) {
        return;
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(require('./assets/54789481-car-start-engine-start-diesel-engine-car-start-490819.mp3'), {
        shouldPlay: true,
        volume: 0.9,
      });

      ignitionSoundRef.current = sound;
    } catch (error) {
      console.warn('Unable to play ignition sound:', error);
    }
  };

  const stopIgnitionSound = async () => {
    try {
      if (!ignitionSoundRef.current) {
        return;
      }

      await ignitionSoundRef.current.stopAsync().catch(() => {});
      await ignitionSoundRef.current.unloadAsync().catch(() => {});
      ignitionSoundRef.current = null;
    } catch (error) {
      console.warn('Unable to stop ignition sound:', error);
    }
  };

  const playIgnitionVibration = () => {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      Vibration.cancel();
      Vibration.vibrate(IGNITION_VIBRATION_PATTERN, false);
    } catch (error) {
      console.warn('Unable to trigger ignition vibration:', error);
    }
  };

  const handleIgnitionPress = async () => {
    if (splashStartTriggeredRef.current) {
      return;
    }

    splashStartTriggeredRef.current = true;
    if (ignitionSequenceTimerRef.current) {
      clearTimeout(ignitionSequenceTimerRef.current);
      ignitionSequenceTimerRef.current = null;
    }

    switchAnim.stopAnimation();
    switchAnim.setValue(0);

    playIgnitionVibration();
    await playIgnitionSound();

    Animated.sequence([
      Animated.timing(switchAnim, {
        toValue: 0.38,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(switchAnim, {
        toValue: 0.72,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(switchAnim, {
        toValue: 1,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();

    ignitionSequenceTimerRef.current = setTimeout(async () => {
      ignitionSequenceTimerRef.current = null;
      switchAnim.stopAnimation();
      switchAnim.setValue(0);
      Vibration.cancel();
      await stopIgnitionSound();
      setAppStage('day');
    }, IGNITION_SOUND_DURATION_MS);
  };

  const refreshDisputes = async () => {
    try {
      setDisputesLoading(true);
      const disputes = await DisputesService.getAllDisputes();
      setDisputeRecords(disputes);
      return disputes;
    } finally {
      setDisputesLoading(false);
    }
  };

  const refreshCompletedTracks = async (teamRecords = teams, dayId = selectedDay?.id || '') => {
    const [results, disputes] = await Promise.all([
      ResultsService.getAllResults(),
      DisputesService.getAllDisputes(),
    ]);
    setCompletedTracksByRecord(buildCompletedTracksMap(teamRecords, results, dayId, disputes));
  };

  const processExpiredDisputes = useCallback(async () => {
    if (disputeAutoSubmitInFlightRef.current) {
      return { processedCount: 0, promotedCount: 0, removedDuplicateCount: 0, failedCount: 0 };
    }

    disputeAutoSubmitInFlightRef.current = true;

    try {
      const summary = await promoteExpiredDisputesToResults();

      if (summary.processedCount > 0) {
        await refreshCompletedTracks(teams, selectedDay?.id || '');
        await refreshDisputes();
        setLeaderboardRefreshKey(prev => prev + 1);
      }

      return summary;
    } finally {
      disputeAutoSubmitInFlightRef.current = false;
    }
  }, [selectedDay?.id, teams]);

  // Initialize database on app startup
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        // SQLite is not available on web in this app's DB wrapper.
        // On web, skip local DB and load directly from API service.
        if (Platform.OS !== 'web') {
          // Initialize the database
          await initializeDatabase();
          
          // Seed bundled local data on first launch
          await seedDatabase();
        }

        await ensureResultsClearedOnce();
        await ResultsService.cleanupDuplicateResults();
        await promoteExpiredDisputesToResults();
        
        // Load teams with native local DB preferred and API fallback
        const teamsData = await TeamsService.getAllTeams();
        console.log('Teams received on homepage load:', teamsData.length);
        // Load categories and add team counts
        const categoriesData = await CategoriesService.getAllCategories();
        const baseCategories = categoriesData.length > 0 ? categoriesData : categories;
        const categoriesWithTeamCounts = attachTeamCountsToCategories(baseCategories, teamsData);

        setTeams(teamsData);
        await refreshCompletedTracks(teamsData);
        await refreshDisputes();
        
        console.log('Categories with counts:', categoriesWithTeamCounts);
        setCategoriesWithCounts(categoriesWithTeamCounts);
        
        setDbReady(true);
      } catch (error) {
        console.error('Database setup error:', error);
        Alert.alert('Database Error', 'Failed to initialize database');
      }
    };

    setupDatabase();
  }, []);

  useEffect(() => {
    if (!dbReady) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      processExpiredDisputes().catch(error => {
        console.warn('Unable to auto-submit expired disputes:', error);
      });
    }, DISPUTE_AUTO_SUBMIT_POLL_MS);

    return () => clearInterval(intervalId);
  }, [dbReady, processExpiredDisputes]);

  // Category data with colors
  const categories = [
    {
      id: '1',
      name: 'Extreme',
      description: 'Ultimate performance',
      icon: '⚡',
      color: '#ff4757',
      imageSource: CATEGORY_IMAGE_SOURCES.EXTREME,
    },
    {
      id: '2',
      name: 'Diesel Modified',
      description: 'Enhanced diesel power',
      icon: '🚨',
      color: '#2f3542',
      imageSource: CATEGORY_IMAGE_SOURCES.DIESEL_MODIFIED,
    },
    {
      id: '3',
      name: 'Petrol Modified',
      description: 'Upgraded petrol engine',
      icon: '🔥',
      color: '#ff9f43',
      imageSource: CATEGORY_IMAGE_SOURCES.PETROL_MODIFIED,
    },
    {
      id: '4',
      name: 'Diesel Expert',
      description: 'Professional diesel builds',
      icon: '🛠️',
      color: '#0984e3',
      imageSource: CATEGORY_IMAGE_SOURCES.DIESEL_EXPERT,
    },
    {
      id: '5',
      name: 'Petrol Expert',
      description: 'Expert petrol tuning',
      icon: '⚙️',
      color: '#6c5ce7',
      imageSource: CATEGORY_IMAGE_SOURCES.PETROL_EXPERT,
    },
    {
      id: '6',
      name: 'Thar SUV',
      description: 'Mahindra Thar specialist',
      icon: '🏔️',
      color: '#00b894',
      imageSource: CATEGORY_IMAGE_SOURCES.THAR_SUV,
    },
    {
      id: '7',
      name: 'Jimny SUV',
      description: 'Maruti Jimny expert',
      icon: '🚗',
      color: '#1e90ff',
      imageSource: CATEGORY_IMAGE_SOURCES.JIMNY_SUV,
    },
    {
      id: '8',
      name: 'SUV Modified',
      description: 'Custom SUV builds',
      icon: '🚙',
      color: '#fdcb6e',
      imageSource: CATEGORY_IMAGE_SOURCES.SUV_MODIFIED,
    },
    {
      id: '9',
      name: 'Stock NDMS',
      description: 'Stock vehicle category',
      icon: '📋',
      color: '#74b9ff',
      imageSource: CATEGORY_IMAGE_SOURCES.STOCK_NDMS,
    },
    {
      id: '10',
      name: 'Ladies Category',
      description: 'Women drivers welcome',
      icon: '👩',
      color: '#a29bfe',
      imageSource: CATEGORY_IMAGE_SOURCES.LADIES_CATEGORY,
    },
  ];

  const settingsCategoryOptions = useMemo(() => {
    const seen = new Set();

    return categories.reduce((acc, category) => {
      const categoryKey = normalizeCategoryKey(category.name);

      if (seen.has(categoryKey) || !CATEGORY_TRACKS[categoryKey]) {
        return acc;
      }

      seen.add(categoryKey);
      acc.push({
        key: categoryKey,
        label: category.name,
      });
      return acc;
    }, []);
  }, [categories]);

  const selectedCategoryTracks = useMemo(
    () =>
      isCategoryActiveForDay(categoryActivationConfig, selectedDay?.id, selectedCategory?.name)
        ? getActiveTracksForDayCategory(trackActivationConfig, selectedDay?.id, selectedCategory?.name)
        : [],
    [categoryActivationConfig, selectedCategory?.name, selectedDay?.id, trackActivationConfig]
  );

  const dayScopedCategories = useMemo(() => {
    const sourceCategories = categoriesWithCounts.length > 0 ? categoriesWithCounts : categories;

    return sourceCategories
      .map(category => {
        const activeTracks = getActiveTracksForDayCategory(trackActivationConfig, selectedDay?.id, category.name);
        const isCategoryActive = isCategoryActiveForDay(categoryActivationConfig, selectedDay?.id, category.name);

        return {
          ...category,
          isCategoryActive,
          trackCount: activeTracks.length,
          activeTracks,
        };
      })
      .filter(category => category.isCategoryActive && category.trackCount > 0);
  }, [categories, categoriesWithCounts, categoryActivationConfig, selectedDay?.id, trackActivationConfig]);

  const activeSettingsCategoryOptions = useMemo(
    () =>
      settingsCategoryOptions.filter(category =>
        isCategoryActiveForDay(categoryActivationConfig, selectedDay?.id, category.key)
      ),
    [categoryActivationConfig, selectedDay?.id, settingsCategoryOptions]
  );

  const reportCategoryOptions = useMemo(
    () =>
      activeSettingsCategoryOptions.map(category => ({
        key: category.key,
        label: category.label,
        tracks: getActiveTracksForDayCategory(trackActivationConfig, selectedDay?.id, category.key),
      })),
    [activeSettingsCategoryOptions, selectedDay?.id, trackActivationConfig]
  );

  const leaderboardCategoryOptions = useMemo(
    () =>
      activeSettingsCategoryOptions.map(category => ({
        key: category.key,
        label: category.label,
        tracks: CATEGORY_TRACKS[category.key] || [],
      })),
    [activeSettingsCategoryOptions]
  );

  const configurationTracks = useMemo(
    () => CATEGORY_TRACKS[settingsConfigCategoryKey] || [],
    [settingsConfigCategoryKey]
  );

  const selectedTrackTimerLimitSeconds = useMemo(() => {
    const categoryName = selectedCategory?.name || selectedRecord?.category || '';
    const trackName =
      selectedRecord?.selectedTrack ||
      selectedRecord?.trackName ||
      selectedRecord?.track_name ||
      '';

    return getTrackTimerLimitSeconds(trackTimerConfig, selectedDay?.id, categoryName, trackName);
  }, [selectedCategory?.name, selectedDay?.id, selectedRecord?.category, selectedRecord?.selectedTrack, selectedRecord?.trackName, selectedRecord?.track_name, trackTimerConfig]);

  const appliedSettingsTrackTimerSeconds = useMemo(
    () => getTrackTimerLimitSeconds(trackTimerConfig, settingsConfigDayId, settingsConfigCategoryKey, settingsTrackTimerTrack),
    [settingsConfigCategoryKey, settingsConfigDayId, settingsTrackTimerTrack, trackTimerConfig]
  );

  useEffect(() => {
    if (!settingsCategoryOptions.length) {
      return;
    }

    if (!settingsCategoryOptions.some(option => option.key === settingsConfigCategoryKey)) {
      setSettingsConfigCategoryKey(settingsCategoryOptions[0].key);
    }
  }, [settingsCategoryOptions, settingsConfigCategoryKey]);

  useEffect(() => {
    if (!configurationTracks.length) {
      setSettingsTrackTimerTrack('');
      return;
    }

    if (!configurationTracks.includes(settingsTrackTimerTrack)) {
      setSettingsTrackTimerTrack(configurationTracks[0]);
    }
  }, [configurationTracks, settingsTrackTimerTrack]);

  useEffect(() => {
    const nextTotalSeconds = appliedSettingsTrackTimerSeconds ?? 0;

    setSettingsTrackTimerMinutes(Math.floor(nextTotalSeconds / 60));
    setSettingsTrackTimerSeconds(nextTotalSeconds % 60);
  }, [appliedSettingsTrackTimerSeconds, settingsTrackTimerTrack]);

  useEffect(() => {
    if (!selectedCategoryTrack) {
      return;
    }

    if (!selectedCategoryTracks.includes(selectedCategoryTrack)) {
      setSelectedCategoryTrack('');
      setActiveRecordKey('');
    }
  }, [selectedCategoryTrack, selectedCategoryTracks]);

  useEffect(() => {
    if (!selectedCategory || isCategoryActiveForDay(categoryActivationConfig, selectedDay?.id, selectedCategory.name)) {
      return;
    }

    setSelectedCategory(null);
    setSelectedRecord(null);
    setSelectedCategoryTrack('');
    setActiveRecordKey('');
    setRecordsVisible(false);
    setFormVisible(false);
  }, [categoryActivationConfig, selectedCategory, selectedDay?.id]);

  useEffect(() => {
    refreshCompletedTracks().catch(error => {
      console.warn('Unable to refresh completed tracks for selected day:', error);
    });
  }, [selectedDay?.id]);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    const normalizedSearch = deferredSearchText.toLowerCase();

    return dayScopedCategories.filter(cat =>
      cat.name.toLowerCase().includes(normalizedSearch)
    );
  }, [dayScopedCategories, deferredSearchText]);

  /**
   * Handle card press - Opens registration form
   */
  const handleCategoryPress = useCallback((category) => {
    setSelectedCategory(category);
    setSelectedCategoryTrack('');
    setActiveRecordKey('');
    setRecordsVisible(true);
  }, []);

  const handleDaySelect = day => {
    clearPendingRecordFormOpen();
    setSelectedDay(day);
    setSelectedCategory(null);
    setSelectedRecord(null);
    setActiveRecordKey('');
    setFormVisible(false);
    setRecordsVisible(false);
    setReportsVisible(false);
    setLeaderboardVisible(false);
    setReportMenuVisible(false);
    setSettingsVisible(false);
    setSettingsView('menu');
    setThemeVisible(false);
    setSelectedCategoryTrack('');
    setSearchText('');
    setAppStage('main');
  };

  const handleBackToDayPage = () => {
    clearPendingRecordFormOpen();
    setSearchText('');
    setRecordsVisible(false);
    setFormVisible(false);
    setReportsVisible(false);
    setLeaderboardVisible(false);
    setReportMenuVisible(false);
    setSettingsVisible(false);
    setSettingsView('menu');
    setThemeVisible(false);
    setSelectedCategory(null);
    setSelectedRecord(null);
    setSelectedCategoryTrack('');
    setActiveRecordKey('');
    setAppStage('day');
  };

  const handleSettingsOpen = () => {
    clearPendingRecordFormOpen();
    setReportMenuVisible(false);
    setLeaderboardVisible(false);
    setSettingsPasswordInput('');
    setSettingsPasswordError('');
    setSettingsConfigDayId(selectedDay?.id || REPORT_DAYS[0]?.id || '');
    setSettingsConfigCategoryKey(normalizeCategoryKey(selectedCategory?.name || 'Extreme'));
    setSettingsPasswordModalVisible(true);
  };

  const handleOpenConfiguration = () => {
    setSettingsView('config');
  };

  const handleOpenTrackVisibilitySettings = () => {
    setSettingsView('config-visibility');
  };

  const handleOpenTrackTimerSettings = () => {
    setSettingsView('config-track-timer');
  };

  const handleOpenDisputes = async () => {
    try {
      await refreshDisputes();
      setSettingsView('disputes');
    } catch (error) {
      console.error('Unable to open disputes view:', error);
      Alert.alert('Error', 'Unable to load disputed records.');
    }
  };

  const handleThemeOpen = () => {
    setReportMenuVisible(false);
    setLeaderboardVisible(false);
    setThemeVisible(true);
  };

  const getPreviousSettingsView = currentView => {
    if (currentView === 'pin' || currentView === 'change-pin' || currentView === 'password') {
      return 'security';
    }

    if (currentView === 'config-visibility' || currentView === 'config-track-timer') {
      return 'config';
    }

    return 'menu';
  };

  const handleSettingsPasswordSubmit = () => {
    try {
      if (!isAcceptedSettingsPassword(settingsPasswordInput, settingsPassword)) {
        setSettingsPasswordError('Wrong password. Please try again.');
        return;
      }

      setSettingsPasswordModalVisible(false);
      setSettingsPasswordInput('');
      setSettingsPasswordError('');
      setSettingsView('menu');
      setSettingsVisible(true);
    } catch (error) {
      console.error('Unable to open settings:', error);
      Alert.alert('Error', 'Unable to open settings right now.');
    }
  };

  const handleOpenChangePassword = () => {
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setChangePasswordError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setSettingsView('password');
  };

  const handleOpenPinVerification = () => {
    setSettingsView('pin');
  };

  const handleOpenChangePin = () => {
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setChangePinError('');
    setSettingsView('change-pin');
  };

  const handleOpenSecurity = () => {
    setSettingsView('security');
  };

  const handleOpenLeaderboardSyncSettings = () => {
    setLeaderboardSyncBaseUrlInput(leaderboardSyncBaseUrl);
    setLeaderboardSyncError('');
    setSettingsView('leaderboard-sync');
  };

  const handleLeaderboardSyncSave = () => {
    const normalizedBaseUrl = normalizeLeaderboardSyncBaseUrl(leaderboardSyncBaseUrlInput);

    if (!normalizedBaseUrl) {
      setLeaderboardSyncBaseUrl('');
      setLeaderboardSyncBaseUrlInput('');
      setLeaderboardSyncError('');
      setSettingsView('menu');
      return;
    }

    if (!/^https?:\/\/.+/i.test(normalizedBaseUrl)) {
      setLeaderboardSyncError('Enter a valid URL such as http://192.168.1.10:3000');
      return;
    }

    setLeaderboardSyncBaseUrl(normalizedBaseUrl);
    setLeaderboardSyncBaseUrlInput(normalizedBaseUrl);
    setLeaderboardSyncError('');
    setSettingsView('menu');
  };

  const handleLeaderboardSyncClear = () => {
    setLeaderboardSyncBaseUrlInput('');
    setLeaderboardSyncBaseUrl('');
    setLeaderboardSyncError('');
    setSettingsView('menu');
  };

  const getLeaderboardSyncActionBaseUrl = () => {
    const normalizedInputUrl = normalizeLeaderboardSyncBaseUrl(leaderboardSyncBaseUrlInput);

    if (normalizedInputUrl && !/^https?:\/\/.+/i.test(normalizedInputUrl)) {
      setLeaderboardSyncError('Enter a valid URL such as http://192.168.1.10:3000');
      return null;
    }

    return normalizedInputUrl || leaderboardSyncBaseUrl;
  };

  const handlePushLeaderboardData = async () => {
    const syncBaseUrl = getLeaderboardSyncActionBaseUrl();

    if (syncBaseUrl === null) {
      return;
    }

    try {
      setLeaderboardSyncLoading(true);
      setLeaderboardSyncError('');
      const exportResult = await LeaderboardService.exportLeaderboardData({ syncBaseUrl });

      if (exportResult?.syncResult?.synced) {
        const endpointLabel = exportResult?.syncResult?.endpoint ? `\n\nEndpoint: ${exportResult.syncResult.endpoint}` : '';
        Alert.alert('Push Complete', `This tablet's leaderboard data has been pushed.${endpointLabel}`);
      } else if (exportResult?.syncResult?.status === 404 || exportResult?.syncResult?.status === 405) {
        Alert.alert(
          'Push Failed',
          'The leaderboard endpoint is not usable on the server. Make sure the backend accepts POST requests and is reachable from this tablet.'
        );
      } else {
        Alert.alert(
          'Push Failed',
          exportResult?.syncResult?.message || 'Leaderboard data could not be pushed right now.'
        );
      }
    } catch (error) {
      console.error('Unable to push leaderboard data:', error);
      Alert.alert('Push Failed', error?.message || 'Unable to push leaderboard data');
    } finally {
      setLeaderboardSyncLoading(false);
    }
  };

  const handlePullLeaderboardData = async () => {
    const syncBaseUrl = getLeaderboardSyncActionBaseUrl();

    if (syncBaseUrl === null) {
      return;
    }

    try {
      setLeaderboardSyncLoading(true);
      setLeaderboardSyncError('');
      const importResult = await LeaderboardService.importLeaderboardData({ syncBaseUrl });

      if (!importResult?.imported) {
        Alert.alert(
          'Pull Failed',
          importResult?.fetchResult?.message || 'Leaderboard data could not be pulled right now.'
        );
        return;
      }

      await refreshCompletedTracks(teams, selectedDay?.id || '');
      await refreshDisputes();
      setLeaderboardRefreshKey(prev => prev + 1);

      const summary = importResult.summary || {};
      const endpointLabel = importResult?.fetchResult?.endpoint ? `\n\nEndpoint: ${importResult.fetchResult.endpoint}` : '';
      Alert.alert(
        'Pull Complete',
        `Pulled ${summary.resultsImported || 0} results and ${summary.disputesImported || 0} disputes.\nSkipped ${
          summary.resultsSkipped || 0
        } duplicate results.${endpointLabel}`
      );
    } catch (error) {
      console.error('Unable to pull leaderboard data:', error);
      Alert.alert('Pull Failed', error?.message || 'Unable to pull leaderboard data');
    } finally {
      setLeaderboardSyncLoading(false);
    }
  };

  const closeRecordPinModal = didVerify => {
    const pendingRequest = recordPinRequestRef.current;
    recordPinRequestRef.current = null;
    setRecordPinModalVisible(false);
    setRecordPinPurpose('submit this record');
    setRecordPinInput('');
    setRecordPinError('');

    if (pendingRequest?.resolve) {
      pendingRequest.resolve(Boolean(didVerify));
    }
  };

  const openRecordPinModalAsync = ({ purpose = 'submit this record' } = {}) =>
    new Promise(resolve => {
      recordPinRequestRef.current = { resolve };
      setRecordPinPurpose(purpose);
      setRecordPinInput('');
      setRecordPinError('');
      setRecordPinModalVisible(true);
    });

  const handleRecordPinSubmit = () => {
    if (!isValidSecurityPin(recordPinInput)) {
      setRecordPinError(PIN_RULE_MESSAGE);
      return;
    }

    if (recordPinInput !== securityPin) {
      setRecordPinError('Incorrect PIN. Please try again.');
      return;
    }

    closeRecordPinModal(true);
  };

  const handleVerifyPinForRecord = async actionLabel => openRecordPinModalAsync({ purpose: actionLabel });

  const handleChangePinSave = () => {
    if (currentPinInput !== securityPin) {
      setChangePinError('Current PIN does not match.');
      return;
    }

    if (!isValidSecurityPin(newPinInput)) {
      setChangePinError(PIN_RULE_MESSAGE);
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setChangePinError('New PIN and confirm PIN must match exactly.');
      return;
    }

    setSecurityPin(newPinInput);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setChangePinError('');
    setSettingsView('security');
    Alert.alert('Success', 'PIN updated successfully.');
  };

  const handleChangePasswordSave = () => {
    if (!isAcceptedSettingsPassword(currentPasswordInput, settingsPassword)) {
      setChangePasswordError('Current password does not match.');
      return;
    }

    if (!newPasswordInput.trim()) {
      setChangePasswordError('Please enter a new password.');
      return;
    }

    if (!isStrongPassword(newPasswordInput.trim())) {
      setChangePasswordError(PASSWORD_RULE_MESSAGE);
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError('New password and confirm new password must match exactly.');
      return;
    }

    setSettingsPassword(newPasswordInput.trim());
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setChangePasswordError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setSettingsView('menu');
    Alert.alert('Success', 'Password updated successfully.');
  };

  const handleTrackActivationToggle = (dayId, categoryKey, trackName) => {
    setTrackActivationConfig(prev => {
      const nextValue = !(prev?.[dayId]?.[categoryKey]?.[trackName] !== false);

      return {
        ...prev,
        [dayId]: {
          ...(prev?.[dayId] || {}),
          [categoryKey]: {
            ...(prev?.[dayId]?.[categoryKey] || {}),
            [trackName]: nextValue,
          },
        },
      };
    });
  };

  const adjustSettingsTrackTimer = (unit, delta) => {
    const currentTotalSeconds = settingsTrackTimerMinutes * 60 + settingsTrackTimerSeconds;
    const nextTotalSeconds =
      unit === 'minutes'
        ? currentTotalSeconds + delta * 60
        : currentTotalSeconds + delta;
    const clampedSeconds = clampTrackTimerSeconds(nextTotalSeconds);

    setSettingsTrackTimerMinutes(Math.floor(clampedSeconds / 60));
    setSettingsTrackTimerSeconds(clampedSeconds % 60);
  };

  const handleApplyTrackTimer = () => {
    if (!settingsConfigDayId || !settingsConfigCategoryKey || !settingsTrackTimerTrack) {
      Alert.alert('Track Timer', 'Select day, category, and track before applying a timer.');
      return;
    }

    const nextTotalSeconds = clampTrackTimerSeconds(settingsTrackTimerMinutes * 60 + settingsTrackTimerSeconds);

    setTrackTimerConfig(prev => ({
      ...prev,
      [settingsConfigDayId]: {
        ...(prev?.[settingsConfigDayId] || {}),
        [settingsConfigCategoryKey]: {
          ...(prev?.[settingsConfigDayId]?.[settingsConfigCategoryKey] || {}),
          [settingsTrackTimerTrack]: nextTotalSeconds,
        },
      },
    }));

    Alert.alert('Track Timer Saved', `${settingsTrackTimerTrack} is now set to ${formatTrackTimerLimit(nextTotalSeconds)}.`);
  };

  const handleClearTrackTimer = () => {
    if (!settingsConfigDayId || !settingsConfigCategoryKey || !settingsTrackTimerTrack) {
      return;
    }

    setTrackTimerConfig(prev => ({
      ...prev,
      [settingsConfigDayId]: {
        ...(prev?.[settingsConfigDayId] || {}),
        [settingsConfigCategoryKey]: {
          ...(prev?.[settingsConfigDayId]?.[settingsConfigCategoryKey] || {}),
          [settingsTrackTimerTrack]: null,
        },
      },
    }));
    setSettingsTrackTimerMinutes(0);
    setSettingsTrackTimerSeconds(0);
    Alert.alert('Track Timer Cleared', `${settingsTrackTimerTrack} no longer has a time limit.`);
  };

  const handleCategoryActivationToggle = (dayId, categoryKey) => {
    setCategoryActivationConfig(prev => {
      const nextValue = !(prev?.[dayId]?.[categoryKey] !== false);

      return {
        ...prev,
        [dayId]: {
          ...(prev?.[dayId] || {}),
          [categoryKey]: nextValue,
        },
      };
    });
  };

  const handleRecordStart = record => {
    try {
      const safeRecord = record || {};
      const recordKey = safeRecord.recordKey || getRecordKey(safeRecord);
      const trackName = String(safeRecord.selectedTrack || selectedCategoryTrack || '').trim();
      const categoryName = String(safeRecord.category || selectedCategory?.name || '').trim();
      const stickerNumber = String(getTeamStickerNumber(safeRecord) || '').trim();
      const driverName = String(safeRecord.driver_name || safeRecord.driverName || '').trim();
      const coDriverName = String(safeRecord.codriver_name || safeRecord.coDriverName || '').trim();

      if (!trackName || !categoryName || !stickerNumber || !driverName || !coDriverName) {
        Alert.alert('Error', 'Selected record is missing details required to open the stopwatch.');
        return;
      }

      clearPendingRecordFormOpen();

      setSelectedRecord({
        ...safeRecord,
        category: safeRecord.category || selectedCategory?.name || '',
        selectedTrack: trackName,
        lateStartMode: selectedLateStartEnabledByRecord[recordKey]
          ? selectedLateStartByRecord[recordKey] || ''
          : '',
      });
      setActiveRecordKey(recordKey);
      setRecordsVisible(false);
      setFormVisible(true);
    } catch (error) {
      console.error('Unable to open record form:', error);
      Alert.alert('Error', 'Unable to open the record form.');
    }
  };

  const handleRecordActivate = record => {
    const recordKey = getRecordKey(record);
    setActiveRecordKey(recordKey);
    setSelectedLateStartByRecord(prev => ({
      ...prev,
      [recordKey]: prev[recordKey] || '',
    }));
    setSelectedLateStartEnabledByRecord(prev => ({
      ...prev,
      [recordKey]: prev[recordKey] || false,
    }));
  };

  const handleTrackCardSelect = track => {
    setSelectedCategoryTrack(track);
    setActiveRecordKey('');
  };

  const handleTrackCardBack = () => {
    setSelectedCategoryTrack('');
    setActiveRecordKey('');
  };

  const handleLateStartToggle = (record, checked) => {
    const recordKey = getRecordKey(record);

    setSelectedLateStartEnabledByRecord(prev => ({
      ...prev,
      [recordKey]: checked,
    }));

    if (!checked) {
      setSelectedLateStartByRecord(prev => ({
        ...prev,
        [recordKey]: '',
      }));
      setLateStartActionOrderByRecord(prev => {
        const next = { ...prev };
        delete next[recordKey];
        return next;
      });
    }
  };

  const handleLateStartSelect = (record, lateStartMode) => {
    const recordKey = getRecordKey(record);

    if (!selectedLateStartEnabledByRecord[recordKey]) {
      return;
    }

    setSelectedLateStartByRecord(prev => ({
      ...prev,
      [recordKey]: lateStartMode,
    }));

    if (lateStartMode) {
      lateStartActionCounterRef.current += 1;
      setLateStartActionOrderByRecord(prev => ({
        ...prev,
        [recordKey]: lateStartActionCounterRef.current,
      }));
      setActiveRecordKey('');
    }
  };

  const handleDNSRecordSubmit = async record => {
    try {
      const safeRecord = record || {};
      const didVerifyPin = await handleVerifyPinForRecord('submit this DNS record');

      if (!didVerifyPin) {
        return false;
      }

      const nullValue = 'null';
      const fileName = `${selectedCategory?.name || 'Category'} - ${safeRecord.selectedTrack || 'Track'} - DNS.csv`;
      const dayPayload = {
        selected_day_id: selectedDay?.id || '',
        selectedDayId: selectedDay?.id || '',
        selected_day_label: selectedDay?.dayLabel || '',
        selectedDayLabel: selectedDay?.dayLabel || '',
        selected_day_date: selectedDay?.dateLabel || '',
        selectedDayDate: selectedDay?.dateLabel || '',
      };
      const dnsResultData = {
        track_name: safeRecord.selectedTrack || '',
        sticker_number: getTeamStickerNumber(safeRecord) || '',
        driver_name: safeRecord.driver_name || safeRecord.driverName || '',
        codriver_name: safeRecord.codriver_name || safeRecord.coDriverName || '',
        category: selectedCategory?.name || '',
        bunting_count: 0,
        seatbelt_count: 0,
        ground_touch_count: 0,
        late_start_count: 0,
        attempt_count: 0,
        task_skipped_count: 0,
        wrong_course_count: 0,
        fourth_attempt_count: 0,
        is_dns: true,
        total_penalties_time: 0,
        performance_time: '0',
        total_time: '0',
        ...dayPayload,
        submission_json: JSON.stringify({
          ...safeRecord,
          category: selectedCategory?.name || '',
          ...dayPayload,
          is_dns: true,
          bunting_count: 0,
          seatbelt_count: 0,
          ground_touch_count: 0,
          late_start_count: 0,
          attempt_count: 0,
          task_skipped_count: 0,
          wrong_course_count: 0,
          fourth_attempt_count: 0,
          total_penalties_time: 0,
          performance_time: '0',
          total_time: '0',
        }),
      };

      const row = [[
        safeRecord.selectedTrack || nullValue,
        nullValue,
        getTeamStickerNumber(safeRecord) || nullValue,
        safeRecord.driver_name || safeRecord.driverName || nullValue,
        safeRecord.codriver_name || safeRecord.coDriverName || nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
        nullValue,
      ]];

      const isDuplicate = await ResultsService.isDuplicateResult(dnsResultData);
      if (isDuplicate) {
        Alert.alert('Duplicate Record', 'This DNS record already exists for the same category, track, and sticker number.');
        return false;
      }

      await CSVExporter.downloadFile(fileName, RECORD_EXPORT_HEADERS, row);

      await ResultsService.addResult(dnsResultData);
      await refreshCompletedTracks(teams, selectedDay?.id || '');
      setLeaderboardRefreshKey(prev => prev + 1);

      const recordKey = safeRecord.recordKey || getRecordKey(safeRecord);

      setSelectedLateStartByRecord(prev => ({
        ...prev,
        [recordKey]: '',
      }));

      setSelectedLateStartEnabledByRecord(prev => ({
        ...prev,
        [recordKey]: false,
      }));

      Alert.alert(
        'DNS Submitted',
        `Driver: ${safeRecord.driver_name || safeRecord.driverName || 'Unknown Driver'}\nCategory: ${selectedCategory?.name || ''}\nTrack: ${safeRecord.selectedTrack || ''}\nTotal Time: 0`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedRecord(null);
              setActiveRecordKey('');
              setRecordsVisible(true);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Unable to submit DNS record:', error);
      Alert.alert('Error', 'Failed to generate file: ' + (error?.message || 'Unknown error'));
      return false;
    }
  };

const buildRegistrationData = formData => ({
    sr_no: formData.srNo || null,
    srNo: formData.srNo || null,
    track_name: formData.trackName,
    trackName: formData.trackName,
    track_timer_limit_seconds: formData.trackTimerLimitSeconds ?? null,
    trackTimerLimitSeconds: formData.trackTimerLimitSeconds ?? null,
    track_timer_limit_display: formData.trackTimerLimitDisplay || null,
    trackTimerLimitDisplay: formData.trackTimerLimitDisplay || null,
    sticker_number: formData.stickerNumber,
    stickerNumber: formData.stickerNumber,
    driver_name: formData.driverName,
    driverName: formData.driverName,
    codriver_name: formData.coDriverName,
    coDriverName: formData.coDriverName,
    category: formData.category,
    selected_day_id: formData.selectedDayId || '',
    selectedDayId: formData.selectedDayId || '',
    selected_day_label: formData.selectedDayLabel || '',
    selectedDayLabel: formData.selectedDayLabel || '',
    selected_day_date: formData.selectedDayDate || '',
    selectedDayDate: formData.selectedDayDate || '',
    bunting_count: formData.bustingCount || 0,
    bustingCount: formData.bustingCount || 0,
    seatbelt_count: formData.seatbeltCount || 0,
    seatbeltCount: formData.seatbeltCount || 0,
    ground_touch_count: formData.groundTouchCount || 0,
    groundTouchCount: formData.groundTouchCount || 0,
    late_start_count: formData.lateStartMode ? 1 : 0,
    lateStartCount: formData.lateStartMode ? 1 : 0,
    late_start_mode: formData.lateStartMode || null,
    lateStartMode: formData.lateStartMode || null,
    late_start_status: formData.lateStartStatus || 'No',
    lateStartStatus: formData.lateStartStatus || 'No',
    late_start_penalty_time: formData.lateStartPenaltyTime || 0,
    lateStartPenaltyTime: formData.lateStartPenaltyTime || 0,
    attempt_count: formData.attemptCount || 0,
    attemptCount: formData.attemptCount || 0,
    attempt_penalty_time: formData.attemptPenaltyTime || 0,
    task_skipped_count: formData.taskSkippedCount || 0,
    taskSkippedCount: formData.taskSkippedCount || 0,
    task_skipped_penalty_time: formData.taskSkippedPenaltyTime || 0,
    wrong_course_count: formData.wrongCourseSelected ? 1 : 0,
    wrongCourseCount: formData.wrongCourseSelected ? 1 : 0,
    wrong_course_selected: formData.wrongCourseSelected || false,
    fourth_attempt_count: formData.fourthAttemptSelected ? 1 : 0,
    fourthAttemptCount: formData.fourthAttemptSelected ? 1 : 0,
    fourth_attempt_selected: formData.fourthAttemptSelected || false,
    time_over_selected: formData.timeOverSelected || false,
    is_dnf: formData.isDNF || false,
    is_dns: formData.isDNS || false,
    dnf_selection: formData.dnfSelection || null,
    dnf_points: formData.dnfPoints || 0,
    bunting_penalty_time: formData.bustingPenaltyTime || 0,
    seatbelt_penalty_time: formData.seatbeltPenaltyTime || 0,
    ground_touch_penalty_time: formData.groundTouchPenaltyTime || 0,
    total_penalties_time: formData.totalPenaltiesTime || 0,
    dispute_details: formData.disputeDetails || formData.dispute_details || [],
    disputeDetails: formData.disputeDetails || formData.dispute_details || [],
    dispute_resolutions: formData.disputeResolutions || formData.dispute_resolutions || {},
    disputeResolutions: formData.disputeResolutions || formData.dispute_resolutions || {},
    dispute_resolution_status: formData.disputeResolutionStatus || null,
    disputeResolutionStatus: formData.disputeResolutionStatus || null,
    dispute_resolution_label: formData.disputeResolutionLabel || null,
    disputeResolutionLabel: formData.disputeResolutionLabel || null,
    performance_time: formData.performanceTimeDisplay || null,
    performanceTimeDisplay: formData.performanceTimeDisplay || null,
    total_time: formData.totalTimeDisplay || null,
    totalTimeDisplay: formData.totalTimeDisplay || null,
    submission_json: JSON.stringify(formData),
  });

  const clearActiveRecordState = (recordKey, showDisputes = false) => {
    if (recordKey) {
      setSelectedLateStartByRecord(prev => ({
        ...prev,
        [recordKey]: '',
      }));

      setSelectedLateStartEnabledByRecord(prev => ({
        ...prev,
        [recordKey]: false,
      }));
    }

    setFormVisible(false);
    setSelectedRecord(null);
    setActiveRecordKey('');
    setRecordsVisible(!showDisputes);
    if (showDisputes) {
      setSettingsVisible(true);
      setSettingsView('disputes');
    }
  };

  const finalizeRecordSubmission = async formData => {
    try {
      const safeFormData = formData || {};
      const completedTrack = safeFormData.trackName;
      const isDisputeRecord = safeFormData.source === 'dispute';
      const recordKey = selectedRecord?.recordKey || getRecordKey(selectedRecord || {});
      const registrationData = buildRegistrationData(safeFormData);

      if (isDisputeRecord && safeFormData.disputeId) {
        const updatedDisputeSnapshot = {
          ...selectedRecord,
          ...registrationData,
          id: safeFormData.disputeId,
          disputeId: safeFormData.disputeId,
          source: 'dispute',
          dispute_details: registrationData.dispute_details || [],
          disputeDetails: registrationData.disputeDetails || [],
          dispute_resolutions: registrationData.dispute_resolutions || {},
          disputeResolutions: registrationData.disputeResolutions || {},
          submission_json: JSON.stringify({
            ...safeFormData,
            source: 'dispute',
            disputeId: safeFormData.disputeId,
            dispute_details: registrationData.dispute_details || [],
            disputeDetails: registrationData.disputeDetails || [],
            dispute_resolutions: registrationData.dispute_resolutions || {},
            disputeResolutions: registrationData.disputeResolutions || {},
          }),
        };

        if (!areAllDisputePartiesResolved(updatedDisputeSnapshot)) {
          await DisputesService.saveDispute(updatedDisputeSnapshot);
          await refreshDisputes();
          clearActiveRecordState(recordKey, true);
          setLeaderboardRefreshKey(prev => prev + 1);
          return true;
        }
      }

      if (!isDisputeRecord) {
        const didDownload = await downloadResultCsv(safeFormData)
          .then(() => true)
          .catch(error => {
            Alert.alert('Error', 'Failed to generate file: ' + error.message);
            console.error('File generation error:', error);
            return false;
          });

        if (!didDownload) {
          return false;
        }
      }

      const isDuplicate = await ResultsService.isDuplicateResult(registrationData);
      if (isDuplicate) {
        Alert.alert('Duplicate Record', 'This result already exists for the same category, track, and sticker number.');
        return false;
      }

      const savedId = await ResultsService.addResult(registrationData);

      if (!savedId) {
        Alert.alert('Error', 'Registration was not saved to the database');
        return false;
      }

      if (isDisputeRecord && safeFormData.disputeId) {
        await DisputesService.deleteDisputeById(safeFormData.disputeId);
        await refreshDisputes();
      }

      if (recordKey && completedTrack) {
        clearActiveRecordState(recordKey, isDisputeRecord);
      } else {
        clearActiveRecordState('', isDisputeRecord);
      }

      await refreshCompletedTracks(teams, selectedDay?.id || '');
      setLeaderboardRefreshKey(prev => prev + 1);
      return true;
    } catch (error) {
      console.error('Unable to finalize record submission:', error);
      Alert.alert('Error', 'Registration could not be completed.');
      return false;
    }
  };

  const holdRecordForDispute = async formData => {
    try {
      const safeFormData = formData || {};
      const disputePayload = {
        id: safeFormData.disputeId || undefined,
        track_name: safeFormData.trackName,
        sticker_number: safeFormData.stickerNumber,
        driver_name: safeFormData.driverName,
        codriver_name: safeFormData.coDriverName,
        category: safeFormData.category,
        selected_day_id: safeFormData.selectedDayId || '',
        selectedDayId: safeFormData.selectedDayId || '',
        selected_day_label: safeFormData.selectedDayLabel || '',
        selectedDayLabel: safeFormData.selectedDayLabel || '',
        selected_day_date: safeFormData.selectedDayDate || '',
        selectedDayDate: safeFormData.selectedDayDate || '',
        dispute_details: safeFormData.disputeDetails || [],
        dispute_resolutions: safeFormData.disputeResolutions || safeFormData.dispute_resolutions || {},
        total_penalties_time: safeFormData.totalPenaltiesTime || 0,
        performance_time: safeFormData.performanceTimeDisplay || null,
        total_time: safeFormData.totalTimeDisplay || null,
        submission_json: JSON.stringify(safeFormData),
      };

      await DisputesService.saveDispute(disputePayload);
      await refreshDisputes();
      await refreshCompletedTracks(teams, selectedDay?.id || '');
      setLeaderboardRefreshKey(prev => prev + 1);
      clearActiveRecordState(selectedRecord?.recordKey || getRecordKey(selectedRecord || {}), false);
      return true;
    } catch (error) {
      console.error('Unable to move record to disputes:', error);
      Alert.alert('Error', 'Record could not be moved to disputes');
      return false;
    }
  };

  const handleDisputeEdit = disputeRecord => {
    try {
      const safeDisputeRecord = disputeRecord || {};
      const disputeCategory =
        (categoriesWithCounts.length > 0 ? categoriesWithCounts : categories).find(
          item => normalizeCategoryKey(item.name) === normalizeCategoryKey(safeDisputeRecord.category || '')
        ) || {
          id: `dispute-${normalizeCategoryKey(safeDisputeRecord.category || 'category')}`,
      name: safeDisputeRecord.category || 'Category',
        };

      setReportsVisible(false);
      setReportMenuVisible(false);
      setRecordsVisible(false);
      setSelectedCategory(disputeCategory);
      setSelectedRecord(safeDisputeRecord);
      setFormVisible(true);
      setSettingsVisible(true);
      setSettingsView('disputes');
    } catch (error) {
      console.error('Unable to edit dispute record:', error);
      Alert.alert('Error', 'Unable to open dispute details.');
    }
  };

  const handleDisputeSubcategoryResolve = (disputeRecord, partyKey) => {
    handleDisputeEdit({
      ...(disputeRecord || {}),
      disputeId: disputeRecord?.id || disputeRecord?.disputeId,
      source: 'dispute',
      resolveDisputeCategory: partyKey,
    });
  };

  /**
   * Handle form submission
   */
  const handleFormSubmit = async (formData) => {
    try {
      return await finalizeRecordSubmission(formData);
    } catch (error) {
      if (error?.code === 'DUPLICATE_RESULT') {
        Alert.alert('Duplicate Record', 'This result already exists for the same category, track, and sticker number.');
        return false;
      }
      console.error('Unable to submit form:', error);
      Alert.alert('Error', 'Registration was not saved to the database');
      return false;
    }
  };

  /**
   * Render individual category item
   */
  const renderCategoryItem = useCallback(
    ({ item }) => (
      <View
        style={{
          width: responsiveLayout.categoryCardWidth,
          paddingHorizontal: responsiveLayout.gridGap / 2,
          marginBottom: responsiveLayout.gridGap,
        }}
      >
        <CategoryCard
          category={item}
          teamCount={item.teamCount || 0}
          onPress={() => handleCategoryPress(item)}
          layout={responsiveLayout}
        />
      </View>
    ),
    [handleCategoryPress, responsiveLayout]
  );

  const selectedCategoryRecords = useMemo(
    () => (selectedCategory ? getTeamsForCategory(teams, selectedCategory.name) : []),
    [selectedCategory, teams]
  );

  const settingsPageTitle =
    settingsView === 'menu'
      ? 'Settings'
      : settingsView === 'config'
        ? 'Configuration'
        : settingsView === 'config-visibility'
          ? 'Track Visibility'
          : settingsView === 'config-track-timer'
            ? 'Track Timer'
            : settingsView === 'security'
              ? 'Security'
              : settingsView === 'pin'
                ? 'Pin Verification'
                : settingsView === 'change-pin'
                  ? 'Change PIN'
                  : settingsView === 'disputes'
                    ? 'Disputes'
                    : settingsView === 'leaderboard-sync'
                      ? 'Leaderboard Sync'
                    : 'Change Password';

  const settingsPageSubtitle =
    settingsView === 'config'
      ? 'Choose which configuration tool you want to manage for the selected day.'
      : settingsView === 'config-visibility'
        ? 'Control which tracks are visible for each day and category.'
        : settingsView === 'config-track-timer'
          ? 'Assign a dedicated stopwatch limit to each day, category, and track.'
          : settingsView === 'security'
            ? 'Manage the protected tools used to verify race-day actions.'
            : settingsView === 'pin'
              ? 'Require a 4-digit PIN before Submit, DNS, and Confirm Dispute can continue.'
                : settingsView === 'change-pin'
                  ? 'Update the 4-digit PIN used to approve protected record actions.'
                  : settingsView === 'disputes'
                    ? 'Review and resolve disputed stopwatch records for the selected day.'
                    : settingsView === 'leaderboard-sync'
                      ? 'Set the website base URL used to push and pull leaderboard data from this installed build.'
                    : settingsView === 'password'
                      ? 'Update the password used to open Settings.'
                    : 'Protected tools for race-day configuration.';

  if (appStage === 'splash') {
    return (
      <View style={styles.splashScreen}>
          <Animated.View
            style={[
              styles.splashLogoGround,
              {
                opacity: splashLogoAnim,
                transform: [
                  {
                    scale: splashLogoAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.72, 1],
                    }),
                  },
                  {
                    translateY: splashLogoAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.splashLogoSideGlowLeft} />
            <View style={styles.splashLogoSideGlowRight} />
            <Animated.View
              style={[
                styles.splashLogoAmberGlow,
                {
                  opacity: switchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 0.8],
                  }),
                  transform: [
                    {
                      scale: switchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.72, 1.06],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.Image
              source={require('./assets/welcome-logo-transparent.png')}
              style={[
                styles.splashLogo,
                {
                  opacity: glowPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.84, 1],
                  }),
                  transform: [
                    {
                      scale: glowPulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1.03, 1.09],
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={styles.splashTitle}>TKO - GROUND ZERO</Text>
          <Animated.View
            style={[
              styles.splashSwitchRow,
              {
                opacity: splashLogoAnim,
                transform: [
                  {
                    translateY: splashLogoAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.92}
              disabled={splashStartTriggeredRef.current}
              onPress={handleIgnitionPress}
              style={styles.ignitionButtonHitbox}
            >
              <View style={styles.ignitionPanel}>
                <Text style={styles.ignitionPanelLabel}>IGNITION SWITCH</Text>
              </View>
              <View style={styles.ignitionButton}>
                <View style={styles.ignitionButtonOuterRing} />
                <View style={styles.ignitionButtonInnerRing} />
                <View style={styles.ignitionButtonCore} />
                <View style={styles.ignitionAccentRingOuter} />
                <View style={styles.ignitionAccentRingInner} />
                <View style={styles.ignitionDialMarkers}>
                  <View style={[styles.ignitionDialMark, styles.ignitionDialMarkOff]} />
                  <View style={[styles.ignitionDialMark, styles.ignitionDialMarkAcc]} />
                  <View style={[styles.ignitionDialMark, styles.ignitionDialMarkOn]} />
                  <View style={[styles.ignitionDialMark, styles.ignitionDialMarkStart]} />
                  <Text style={[styles.ignitionDialText, styles.ignitionDialOffText]}>OFF</Text>
                  <Text style={[styles.ignitionDialText, styles.ignitionDialAccText]}>ACC</Text>
                  <Text style={[styles.ignitionDialText, styles.ignitionDialOnText]}>ON</Text>
                  <Text style={[styles.ignitionDialText, styles.ignitionDialStartText]}>START</Text>
                </View>
                <Animated.View
                  style={[
                    styles.ignitionButtonCenter,
                    {
                      transform: [
                        {
                          scale: switchAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.02],
                          }),
                        },
                        {
                          rotate: switchAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['214deg', '360deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.keyShadow} />
                  <View style={styles.keyHandle}>
                    <View style={styles.keyHandleGloss} />
                  </View>
                  <View style={styles.keyHub} />
                </Animated.View>
              </View>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.splashSubtitle}>Turn the key to fire up TKO Ground Zero</Text>
      </View>
    );
  }

  if (appStage === 'day') {
    const useDaySplitLayout = responsiveLayout.isTabletLandscape;

    return (
      <View
        style={[
          styles.dayScreen,
          {
            backgroundColor: theme.background,
            paddingHorizontal: responsiveLayout.shellPadding,
            paddingTop: useDaySplitLayout ? 24 : 60,
            paddingBottom: useDaySplitLayout ? 20 : 28,
          },
        ]}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: '100%',
              maxWidth: responsiveLayout.shellMaxWidth,
              alignSelf: 'center',
              flexDirection: useDaySplitLayout ? 'row' : 'column',
              alignItems: useDaySplitLayout ? 'center' : 'stretch',
              justifyContent: 'center',
              gap: useDaySplitLayout ? 28 : 18,
            }}
          >
            <View
              style={[
                styles.dayScreenHeader,
                {
                  backgroundColor: theme.background,
                  width: useDaySplitLayout ? '46%' : '100%',
                  marginBottom: useDaySplitLayout ? 0 : 30,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.splashLogoGround,
                  {
                    opacity: glowPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.88, 1],
                    }),
                    transform: [
                      {
                        scale: glowPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.04],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.splashLogoSideGlowLeft} />
                <View style={styles.splashLogoSideGlowRight} />
                <View style={[styles.splashLogoAmberGlow, styles.dayLogoAmberGlow]} />
                <Image
                  source={require('./assets/welcome-logo-transparent.png')}
                  style={styles.splashLogo}
                  resizeMode="contain"
                />
              </Animated.View>
              <Animated.View
                style={[
                  styles.dayEventTitleShell,
                  {
                    width: '100%',
                    maxWidth: useDaySplitLayout ? 520 : 560,
                    minHeight: useDaySplitLayout ? 76 : 88,
                    paddingHorizontal: useDaySplitLayout ? 18 : 20,
                    paddingVertical: useDaySplitLayout ? 14 : 16,
                    opacity: glowPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.82, 1],
                    }),
                    transform: [
                      {
                        scale: glowPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.02],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.dayEventTitleStack}>
                  <Text
                    style={[
                      styles.dayEventTitle,
                      {
                        fontSize: useDaySplitLayout ? 20 : 22,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    KARAD OFFROAD SEASON 2 - 2026
                  </Text>
                </View>
              </Animated.View>
            </View>

            <View
              style={[
                styles.dayList,
                {
                  width: '100%',
                  maxWidth: useDaySplitLayout ? 560 : 520,
                  flex: useDaySplitLayout ? 1 : 0,
                },
              ]}
            >
              {REPORT_DAYS.map(day => (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayCard,
                    {
                      paddingHorizontal: useDaySplitLayout ? 18 : 16,
                      paddingVertical: useDaySplitLayout ? 14 : 16,
                      minHeight: useDaySplitLayout ? 84 : 92,
                    },
                  ]}
                  activeOpacity={0.88}
                  onPress={() => handleDaySelect(day)}
                >
                  <View style={styles.dayCardTextBlock}>
                    <Text
                      style={[
                        styles.dayCardLabel,
                        {
                          fontSize: useDaySplitLayout ? 17 : 18,
                        },
                      ]}
                    >
                      {String(day.dayLabel || '').toUpperCase()}
                    </Text>
                    <Text
                      style={[
                        styles.dayCardDate,
                        {
                          fontSize: useDaySplitLayout ? 13 : 14,
                        },
                      ]}
                    >
                      {day.dateLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      {!isFullScreenOverlayVisible ? (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.topHeader,
          {
            backgroundColor: theme.backgroundStrong,
            paddingHorizontal: responsiveLayout.shellPadding,
            paddingTop: 60,
            paddingBottom: responsiveLayout.isTablet ? 18 : 16,
          },
        ]}
      >
        <View style={styles.topHeaderRow}>
          <View style={styles.topHeaderInfoBlock}>
            <Text
              style={[
                styles.exploreTitle,
                { color: theme.textPrimary },
                { fontSize: responsiveLayout.isTablet ? 32 : responsiveLayout.isSmallPhone ? 24 : 28 },
              ]}
            >
              TKO - GROUND ZERO
            </Text>
            {selectedDay ? (
              <View style={styles.selectedDayRow}>
                <Text style={[styles.selectedDayLabel, { color: theme.accent }]}>
                  {selectedDay.dayLabel} • {selectedDay.dateLabel}
                </Text>
                <NavigationActionButton
                  label="Back"
                  icon="<"
                  onPress={handleBackToDayPage}
                  style={[
                    styles.topHeaderButton,
                    styles.backHeaderButton,
                    { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
                  ]}
                  textStyle={styles.topHeaderButtonText}
                  iconStyle={styles.backHeaderButtonIcon}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            alignSelf: 'center',
            width: Math.min(
              responsiveLayout.shellMaxWidth,
              responsiveLayout.screenWidth - responsiveLayout.shellPadding * 2
            ),
            marginVertical: responsiveLayout.isTablet ? 20 : 16,
            paddingHorizontal: responsiveLayout.isTablet ? 18 : 14,
            paddingVertical: responsiveLayout.isTablet ? 12 : 10,
          },
        ]}
      >
        <Text style={[styles.searchIcon, { color: theme.accent }]}>🔍</Text>
        <TextInput
          style={[
            styles.searchInput,
            { color: theme.textPrimary },
            { fontSize: responsiveLayout.isTablet ? 16 : 14 },
          ]}
          placeholder="Search Categories..."
          placeholderTextColor={theme.textTertiary}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Categories Section */}
      <View
        style={[
          styles.sectionHeader,
          {
            alignSelf: 'center',
            width: Math.min(
              responsiveLayout.shellMaxWidth,
              responsiveLayout.screenWidth - responsiveLayout.shellPadding * 2
            ),
            marginBottom: responsiveLayout.isTablet ? 20 : 16,
          },
        ]}
      >
        <View style={styles.sectionHeaderLeft}>
          <Text style={[styles.sectionTitle, { fontSize: responsiveLayout.isTablet ? 20 : 18, color: theme.textPrimary }]}>
            Categories
          </Text>
        </View>
        <View style={styles.sectionHeaderActions}>
          <View style={styles.reportMenuContainer}>
            <TouchableOpacity
              style={[
                styles.topHeaderButton,
                styles.reportDotsButton,
                { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
                {
                  minWidth: responsiveLayout.isTablet ? 66 : 60,
                  minHeight: responsiveLayout.isTablet ? 66 : 60,
                },
              ]}
              onPress={() => setReportMenuVisible(prev => !prev)}
              activeOpacity={0.85}
            >
              <View style={styles.menuBars}>
                <View style={[styles.menuBar, { backgroundColor: theme.accent }]} />
                <View style={[styles.menuBar, { backgroundColor: theme.accent }]} />
                <View style={[styles.menuBar, { backgroundColor: theme.accent }]} />
              </View>
            </TouchableOpacity>

            {reportMenuVisible ? (
              <View style={[styles.reportMenuDropdown, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <TouchableOpacity
                  style={[styles.reportMenuItem, { backgroundColor: theme.surface }]}
                  onPress={() => {
                    setReportMenuVisible(false);
                    setLeaderboardVisible(false);
                    setReportsVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.reportMenuItemText, { color: theme.textPrimary }]}>Reports</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportMenuItem, { backgroundColor: theme.surface }]}
                  onPress={() => {
                    setReportMenuVisible(false);
                    setReportsVisible(false);
                    setLeaderboardVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.reportMenuItemText, { color: theme.textPrimary }]}>Leaderboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportMenuItem, { backgroundColor: theme.surface }]}
                  onPress={handleSettingsOpen}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.reportMenuItemText, { color: theme.textPrimary }]}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportMenuItem, { backgroundColor: theme.surface }]}
                  onPress={handleThemeOpen}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.reportMenuItemText, { color: theme.textPrimary }]}>Theme</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Categories Grid */}
      <FlatList
        key={`categories-${responsiveLayout.categoryColumns}`}
        data={filteredCategories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        numColumns={responsiveLayout.categoryColumns}
        scrollEnabled={true}
        style={{ alignSelf: 'center', width: '100%', maxWidth: responsiveLayout.shellMaxWidth }}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: Math.max(responsiveLayout.shellPadding - responsiveLayout.gridGap / 2, 0),
            paddingBottom: responsiveLayout.isTablet ? 28 : 20,
          },
        ]}
        columnWrapperStyle={
          responsiveLayout.categoryColumns > 1
            ? {
                justifyContent: 'space-between',
                alignItems: 'stretch',
              }
            : undefined
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...getVirtualizedListProps(responsiveLayout, {
          initialNumToRender: Math.max(
            responsiveLayout.categoryColumns * 2,
            responsiveLayout.listInitialNumToRender
          ),
        })}
      />

        </View>
      ) : null}

      {recordsVisible ? (
        <FlowErrorBoundary
          resetKey={`records-${selectedCategory?.id || selectedCategory?.name || 'none'}-${selectedCategoryTrack}`}
          onRetry={() => {
            setRecordsVisible(false);
            setSelectedRecord(null);
            setSelectedCategoryTrack('');
            setActiveRecordKey('');
          }}
        >
          <CategoryRecordsModal
            visible={recordsVisible}
            category={selectedCategory}
            categoryTracks={selectedCategoryTracks}
            records={selectedCategoryRecords}
            selectedTrackFilter={selectedCategoryTrack}
            onTrackCardSelect={handleTrackCardSelect}
            onTrackCardBack={handleTrackCardBack}
            selectedLateStartEnabledByRecord={selectedLateStartEnabledByRecord}
            selectedLateStartByRecord={selectedLateStartByRecord}
            lateStartActionOrderByRecord={lateStartActionOrderByRecord}
            completedTracksByRecord={completedTracksByRecord}
            onClose={() => {
              setRecordsVisible(false);
              setSelectedCategory(null);
              setSelectedCategoryTrack('');
              setActiveRecordKey('');
            }}
            onDNSPress={handleDNSRecordSubmit}
            onRecordActivate={handleRecordActivate}
            onLateStartToggle={handleLateStartToggle}
            onLateStartSelect={handleLateStartSelect}
            onStart={handleRecordStart}
            layout={responsiveLayout}
            theme={theme}
          />
        </FlowErrorBoundary>
      ) : null}

      {reportsVisible ? (
        <ReportScreen
          visible={reportsVisible}
          onClose={() => setReportsVisible(false)}
          selectedDay={selectedDay}
          categoryOptions={reportCategoryOptions}
          theme={theme}
        />
      ) : null}

      {leaderboardVisible ? (
        <LeaderboardScreen
          visible={leaderboardVisible}
          onClose={() => setLeaderboardVisible(false)}
          categoryOptions={leaderboardCategoryOptions}
          teams={teams}
          dataRefreshKey={leaderboardRefreshKey}
          theme={theme}
        />
      ) : null}

      {settingsPasswordModalVisible ? (
      <Modal
        visible={settingsPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSettingsPasswordModalVisible(false);
          setSettingsPasswordInput('');
          setSettingsPasswordError('');
        }}
        hardwareAccelerated={Platform.OS === 'android'}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View
          style={[
            styles.settingsOverlay,
            { backgroundColor: theme.overlay },
          ]}
        >
          <ScrollView
            style={styles.authModalScroll}
            contentContainerStyle={styles.authModalScrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.settingsPasswordCard,
                styles.authModalCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.settingsPasswordTitle, { color: theme.textPrimary }]}>
                Settings Access
              </Text>
              <Text style={[styles.settingsPasswordSubtitle, { color: theme.textSecondary }]}>
                Enter password to open protected settings.
              </Text>
              <TextInput
                {...STABLE_TEXT_INPUT_PROPS}
                ref={settingsPasswordInputRef}
                autoFocus
                value={settingsPasswordInput}
                onChangeText={value => {
                  setSettingsPasswordInput(value);
                  if (settingsPasswordError) {
                    setSettingsPasswordError('');
                  }
                }}
                autoCapitalize="none"
                style={[
                  styles.settingsInput,
                  { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.textPrimary },
                  settingsPasswordError ? styles.settingsInputError : null,
                ]}
                placeholder="Enter password"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSettingsPasswordSubmit}
              />
              {settingsPasswordError ? (
                <Text style={styles.settingsPasswordErrorText}>{settingsPasswordError}</Text>
              ) : null}
              <View style={styles.settingsPasswordActions}>
                <TouchableOpacity
                  style={[styles.settingsActionButton, styles.settingsSecondaryButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => {
                    setSettingsPasswordModalVisible(false);
                    setSettingsPasswordInput('');
                    setSettingsPasswordError('');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText, { color: theme.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingsActionButton, styles.settingsPrimaryButton, { backgroundColor: theme.accent }]}
                  onPress={handleSettingsPasswordSubmit}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>Open</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
      ) : null}

      {settingsVisible ? (
      <Modal
        visible={settingsVisible}
        transparent={false}
        animationType="none"
        onRequestClose={() => {
          if (settingsView === 'menu') {
            setSettingsVisible(false);
          } else {
            setSettingsView(getPreviousSettingsView(settingsView));
          }
        }}
        hardwareAccelerated={Platform.OS === 'android'}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View style={[styles.fullPageContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.settingsPageHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <View style={styles.settingsPageHeaderLeft}>
              <Text style={[styles.settingsPageTitle, { color: theme.textPrimary }]}>
                {settingsPageTitle}
              </Text>
              <Text style={[styles.settingsPageSubtitle, { color: theme.textSecondary }]}>
                {settingsPageSubtitle}
              </Text>
            </View>
            {settingsView === 'menu' ? (
              <NavigationActionButton
                label="Close"
                onPress={() => setSettingsVisible(false)}
                style={[styles.settingsCloseButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                textStyle={[styles.settingsCloseButtonText, { color: theme.accent }]}
              />
            ) : (
              <NavigationActionButton
                label="Back"
                onPress={() => setSettingsView(getPreviousSettingsView(settingsView))}
                style={[styles.settingsCloseButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                textStyle={[styles.settingsCloseButtonText, { color: theme.accent }]}
              />
            )}
          </View>

          <ScrollView
            style={[styles.fullPageContent, { backgroundColor: theme.background }]}
            contentContainerStyle={styles.settingsPageContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {settingsView === 'menu' ? (
              <View style={styles.settingsMenuGrid}>
                <TouchableOpacity
                  style={[
                    styles.settingsMenuCard,
                    styles.settingsMenuCardFeatured,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  onPress={handleOpenLeaderboardSyncSettings}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Network</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Leaderboard Sync</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]} numberOfLines={2}>
                    {leaderboardSyncBaseUrl
                      ? `Current sync host: ${leaderboardSyncBaseUrl}`
                      : 'No custom sync host set. Tap to configure the website address.'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenConfiguration}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Admin</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Configuration</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Manage track visibility and dedicated track timer rules for each day.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenDisputes}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Records</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Disputes</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Open disputed stopwatch holds by category and track for the selected day.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenSecurity}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Security</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Security</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Manage PIN verification for record actions and update the password required to access Settings.
                  </Text>
                </TouchableOpacity>

              </View>
            ) : null}

            {settingsView === 'security' ? (
              <View style={styles.settingsMenuGrid}>
                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenPinVerification}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Verification</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Pin Verification</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Require a 4-digit PIN before Submit, DNS, and Confirm Dispute can save a record, and manage PIN updates.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenChangePassword}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Access</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Change Password</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Update the password required to open protected settings.
                  </Text>
                </TouchableOpacity>

              </View>
            ) : null}

            {settingsView === 'config' ? (
              <View style={styles.settingsMenuGrid}>
                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenTrackVisibilitySettings}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Configuration</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Track Visibility</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Activate or deactivate vehicle categories and tracks for each selected day.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenTrackTimerSettings}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Configuration</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Track Timer</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Set a dedicated stopwatch limit for each day, category, and track.
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {settingsView === 'config-visibility' ? (
              <>
                <View style={styles.settingsInfoCard}>
                  <Text style={[styles.settingsInfoTitle, { color: theme.accent }]}>Visibility Rules</Text>
                  <Text style={[styles.settingsInfoText, { color: theme.textSecondary }]}>
                    Activate or deactivate vehicle categories for each day, then control which tracks stay visible inside each category.
                  </Text>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Select Day</Text>
                  <View style={styles.settingsChipWrap}>
                    {REPORT_DAYS.map(day => {
                      const selected = settingsConfigDayId === day.id;

                      return (
                        <TouchableOpacity
                          key={day.id}
                          style={[
                            styles.settingsChip,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                            selected && [styles.settingsChipSelected, { backgroundColor: theme.accent, borderColor: theme.accent }],
                          ]}
                          onPress={() => setSettingsConfigDayId(day.id)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.settingsChipText,
                              { color: theme.textPrimary },
                              selected && [styles.settingsChipTextSelected, { color: theme.accentText }],
                            ]}
                          >
                            {day.dayLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Vehicle Categories</Text>
                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    {REPORT_DAYS.find(day => day.id === settingsConfigDayId)?.dayLabel || 'Selected Day'} Â· Category visibility
                  </Text>
                  <View style={styles.settingsTrackList}>
                    {settingsCategoryOptions.map(option => {
                      const isActive = categoryActivationConfig?.[settingsConfigDayId]?.[option.key] !== false;

                      return (
                        <View
                          key={`${settingsConfigDayId}-${option.key}-category`}
                          style={[styles.settingsTrackRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        >
                          <View style={styles.settingsTrackInfo}>
                            <View style={styles.settingsTrackNameRow}>
                              <View
                                style={[
                                  styles.settingsTrackMarker,
                                  isActive ? styles.settingsTrackMarkerActive : styles.settingsTrackMarkerInactive,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.settingsTrackName,
                                  isActive ? styles.settingsTrackNameActive : styles.settingsTrackNameInactive,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.settingsTrackStatus,
                                isActive ? styles.settingsTrackStatusActive : styles.settingsTrackStatusInactive,
                              ]}
                            >
                              {isActive ? 'Activated for the selected day' : 'Deactivated for the selected day'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.settingsToggleButton}
                            onPress={() => handleCategoryActivationToggle(settingsConfigDayId, option.key)}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.settingsToggleButtonLabel,
                                isActive ? styles.settingsToggleButtonLabelActivated : styles.settingsToggleButtonLabelDeactivated,
                              ]}
                            >
                              {isActive ? 'Activated' : 'Deactivated'}
                            </Text>
                            <View
                              style={[
                                styles.settingsToggleSwitch,
                                isActive ? styles.settingsToggleSwitchActivated : styles.settingsToggleSwitchDeactivated,
                              ]}
                            >
                              <View
                                style={[
                                  styles.settingsToggleKnob,
                                  isActive ? styles.settingsToggleKnobActivated : styles.settingsToggleKnobDeactivated,
                                ]}
                              />
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Select Category</Text>
                  <View style={styles.settingsChipWrap}>
                    {settingsCategoryOptions.map(option => {
                      const selected = settingsConfigCategoryKey === option.key;

                      return (
                        <TouchableOpacity
                          key={option.key}
                          style={[
                            styles.settingsChip,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                            selected && [styles.settingsChipSelected, { backgroundColor: theme.accent, borderColor: theme.accent }],
                          ]}
                          onPress={() => setSettingsConfigCategoryKey(option.key)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.settingsChipText,
                              { color: theme.textPrimary },
                              selected && [styles.settingsChipTextSelected, { color: theme.accentText }],
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Tracks</Text>
                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    {REPORT_DAYS.find(day => day.id === settingsConfigDayId)?.dayLabel || 'Selected Day'} Â·{' '}
                    {settingsCategoryOptions.find(option => option.key === settingsConfigCategoryKey)?.label || 'Category'}
                  </Text>

                  <View style={styles.settingsTrackList}>
                    {configurationTracks.map(trackName => {
                      const isActive =
                        trackActivationConfig?.[settingsConfigDayId]?.[settingsConfigCategoryKey]?.[trackName] !== false;

                      return (
                        <View
                          key={`${settingsConfigDayId}-${settingsConfigCategoryKey}-${trackName}`}
                          style={[styles.settingsTrackRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        >
                          <View style={styles.settingsTrackInfo}>
                            <View style={styles.settingsTrackNameRow}>
                              <View
                                style={[
                                  styles.settingsTrackMarker,
                                  isActive ? styles.settingsTrackMarkerActive : styles.settingsTrackMarkerInactive,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.settingsTrackName,
                                  isActive ? styles.settingsTrackNameActive : styles.settingsTrackNameInactive,
                                ]}
                              >
                                {trackName}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.settingsTrackStatus,
                                isActive ? styles.settingsTrackStatusActive : styles.settingsTrackStatusInactive,
                              ]}
                            >
                              {isActive ? 'Activated for selected day and category' : 'Deactivated for selected day and category'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.settingsToggleButton}
                            onPress={() => handleTrackActivationToggle(settingsConfigDayId, settingsConfigCategoryKey, trackName)}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.settingsToggleButtonLabel,
                                isActive ? styles.settingsToggleButtonLabelActivated : styles.settingsToggleButtonLabelDeactivated,
                              ]}
                            >
                              {isActive ? 'Activated' : 'Deactivated'}
                            </Text>
                            <View
                              style={[
                                styles.settingsToggleSwitch,
                                isActive ? styles.settingsToggleSwitchActivated : styles.settingsToggleSwitchDeactivated,
                              ]}
                            >
                              <View
                                style={[
                                  styles.settingsToggleKnob,
                                  isActive ? styles.settingsToggleKnobActivated : styles.settingsToggleKnobDeactivated,
                                ]}
                              />
                            </View>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : null}

            {settingsView === 'config-track-timer' ? (
              <>
                <View style={styles.settingsInfoCard}>
                  <Text style={[styles.settingsInfoTitle, { color: theme.accent }]}>Track Timer</Text>
                  <Text style={[styles.settingsInfoText, { color: theme.textSecondary }]}>
                    Pick a day, category, and track, then apply a stopwatch limit between 0:00.0 and 15:00.0. When a running record reaches that limit, Time Over DNF is applied automatically and the user only needs to choose 20 or 50 points before submitting.
                  </Text>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Select Day</Text>
                  <View style={styles.settingsChipWrap}>
                    {REPORT_DAYS.map(day => {
                      const selected = settingsConfigDayId === day.id;

                      return (
                        <TouchableOpacity
                          key={`timer-${day.id}`}
                          style={[
                            styles.settingsChip,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                            selected && [styles.settingsChipSelected, { backgroundColor: theme.accent, borderColor: theme.accent }],
                          ]}
                          onPress={() => setSettingsConfigDayId(day.id)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.settingsChipText,
                              { color: theme.textPrimary },
                              selected && [styles.settingsChipTextSelected, { color: theme.accentText }],
                            ]}
                          >
                            {day.dayLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Select Category</Text>
                  <View style={styles.settingsChipWrap}>
                    {settingsCategoryOptions.map(option => {
                      const selected = settingsConfigCategoryKey === option.key;

                      return (
                        <TouchableOpacity
                          key={`timer-category-${option.key}`}
                          style={[
                            styles.settingsChip,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                            selected && [styles.settingsChipSelected, { backgroundColor: theme.accent, borderColor: theme.accent }],
                          ]}
                          onPress={() => setSettingsConfigCategoryKey(option.key)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.settingsChipText,
                              { color: theme.textPrimary },
                              selected && [styles.settingsChipTextSelected, { color: theme.accentText }],
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Select Track</Text>
                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    {REPORT_DAYS.find(day => day.id === settingsConfigDayId)?.dayLabel || 'Selected Day'} Â·{' '}
                    {settingsCategoryOptions.find(option => option.key === settingsConfigCategoryKey)?.label || 'Category'}
                  </Text>
                  <View style={styles.settingsTrackList}>
                    {configurationTracks.map(trackName => {
                      const isSelected = settingsTrackTimerTrack === trackName;
                      const appliedLimitSeconds = getTrackTimerLimitSeconds(
                        trackTimerConfig,
                        settingsConfigDayId,
                        settingsConfigCategoryKey,
                        trackName
                      );

                      return (
                        <TouchableOpacity
                          key={`timer-track-${settingsConfigDayId}-${settingsConfigCategoryKey}-${trackName}`}
                          style={[
                            styles.settingsTrackRow,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                            isSelected && styles.settingsTrackRowSelected,
                          ]}
                          onPress={() => setSettingsTrackTimerTrack(trackName)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.settingsTrackInfo}>
                            <View style={styles.settingsTrackNameRow}>
                              <View
                                style={[
                                  styles.settingsTrackMarker,
                                  isSelected ? styles.settingsTrackMarkerActive : styles.settingsTrackMarkerInactive,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.settingsTrackName,
                                  isSelected ? styles.settingsTrackNameActive : { color: theme.textPrimary },
                                ]}
                              >
                                {trackName}
                              </Text>
                            </View>
                            <Text style={[styles.settingsTrackStatus, { color: theme.textSecondary }]}>
                              {appliedLimitSeconds === null
                                ? 'Timer not set'
                                : `Applied limit: ${formatTrackTimerLimit(appliedLimitSeconds)}`}
                            </Text>
                          </View>
                          <Text style={[styles.settingsSelectedBadge, isSelected && styles.settingsSelectedBadgeActive]}>
                            {isSelected ? 'Selected' : 'Choose'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.settingsFormCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Timer Limit</Text>
                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    Selected Track: {settingsTrackTimerTrack || 'None'} Â· Applied: {formatTrackTimerLimit(appliedSettingsTrackTimerSeconds)}
                  </Text>
                  <Text style={[styles.settingsTrackTimerPreview, { color: theme.accent }]}>
                    {formatTrackTimerLimit(settingsTrackTimerMinutes * 60 + settingsTrackTimerSeconds)}
                  </Text>

                  <View style={styles.settingsTimerCounterGrid}>
                    <View style={[styles.settingsTimerCounterCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                      <Text style={[styles.settingsTimerCounterLabel, { color: theme.textSecondary }]}>Minutes</Text>
                      <View style={styles.settingsTimerCounterControls}>
                        <TouchableOpacity
                          style={[styles.settingsTimerAdjustButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => adjustSettingsTrackTimer('minutes', -1)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.settingsTimerAdjustButtonText, { color: theme.accent }]}>-</Text>
                        </TouchableOpacity>
                        <Text style={[styles.settingsTimerCounterValue, { color: theme.textPrimary }]}>
                          {settingsTrackTimerMinutes.toString().padStart(2, '0')}
                        </Text>
                        <TouchableOpacity
                          style={[styles.settingsTimerAdjustButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => adjustSettingsTrackTimer('minutes', 1)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.settingsTimerAdjustButtonText, { color: theme.accent }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.settingsTimerCounterCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                      <Text style={[styles.settingsTimerCounterLabel, { color: theme.textSecondary }]}>Seconds</Text>
                      <View style={styles.settingsTimerCounterControls}>
                        <TouchableOpacity
                          style={[styles.settingsTimerAdjustButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => adjustSettingsTrackTimer('seconds', -1)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.settingsTimerAdjustButtonText, { color: theme.accent }]}>-</Text>
                        </TouchableOpacity>
                        <Text style={[styles.settingsTimerCounterValue, { color: theme.textPrimary }]}>
                          {settingsTrackTimerSeconds.toString().padStart(2, '0')}
                        </Text>
                        <TouchableOpacity
                          style={[styles.settingsTimerAdjustButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => adjustSettingsTrackTimer('seconds', 1)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.settingsTimerAdjustButtonText, { color: theme.accent }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    Minimum 0:00.0 Â· Maximum 15:00.0
                  </Text>

                  <View style={styles.settingsTrackTimerActionRow}>
                    <TouchableOpacity
                      style={[styles.settingsActionButton, styles.settingsSecondaryButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                      onPress={handleClearTrackTimer}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText, { color: theme.textPrimary }]}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.settingsActionButton, styles.settingsPrimaryButton, { backgroundColor: theme.accent }]}
                      onPress={handleApplyTrackTimer}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>Apply Timer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}

            {settingsView === 'pin' ? (
              <>
                <View
                  style={[
                    styles.settingsInfoCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.settingsInfoTitle, { color: theme.accent }]}>
                    Protected Actions
                  </Text>
                  <Text style={[styles.settingsInfoText, { color: theme.textSecondary }]}>
                    Stopwatch records only continue after the correct 4-digit PIN is entered for Submit, DNS, and Confirm Dispute.
                  </Text>
                </View>

                <View
                  style={[
                    styles.settingsFormCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>PIN Details</Text>
                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    PIN protection is active across all race-day record approvals.
                  </Text>
                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    Default PIN: {DEFAULT_SECURITY_PIN}
                  </Text>
                  <TouchableOpacity
                    style={[styles.settingsActionButton, styles.settingsPrimaryButton, styles.settingsFormSaveButton, { backgroundColor: theme.accent }]}
                    onPress={handleOpenChangePin}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>
                      Change PIN
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {settingsView === 'disputes' ? (
              <DisputeRecordsPanel
                disputes={disputeRecords}
                selectedDay={selectedDay}
                categoryOptions={activeSettingsCategoryOptions}
                loading={disputesLoading}
                onRefresh={refreshDisputes}
                onEdit={handleDisputeEdit}
                onResolve={handleDisputeSubcategoryResolve}
                layout={responsiveLayout}
                theme={theme}
              />
            ) : null}

            {settingsView === 'change-pin' ? (
              <View style={[styles.settingsFormCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Update PIN</Text>
                <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                  Enter the current PIN, then confirm the new 4-digit PIN twice.
                </Text>
                <TextInput
                  {...STABLE_TEXT_INPUT_PROPS}
                  ref={currentPinInputRef}
                  autoFocus
                  value={currentPinInput}
                  onChangeText={value => {
                    const normalizedValue = value.replace(/\D/g, '').slice(0, 4);
                    setCurrentPinInput(normalizedValue);
                    if (changePinError) {
                      setChangePinError('');
                    }
                  }}
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                  style={[
                    styles.settingsInput,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.textPrimary },
                    changePinError ? styles.settingsInputError : null,
                  ]}
                  placeholder="Current PIN"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry
                  maxLength={4}
                  returnKeyType="next"
                  onSubmitEditing={() => newPinInputRef.current?.focus()}
                />
                <TextInput
                  {...STABLE_TEXT_INPUT_PROPS}
                  ref={newPinInputRef}
                  value={newPinInput}
                  onChangeText={value => {
                    const normalizedValue = value.replace(/\D/g, '').slice(0, 4);
                    setNewPinInput(normalizedValue);
                    if (changePinError) {
                      setChangePinError('');
                    }
                  }}
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                  style={[
                    styles.settingsInput,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.textPrimary },
                    changePinError ? styles.settingsInputError : null,
                  ]}
                  placeholder="New PIN"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry
                  maxLength={4}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPinInputRef.current?.focus()}
                />
                <TextInput
                  {...STABLE_TEXT_INPUT_PROPS}
                  ref={confirmPinInputRef}
                  value={confirmPinInput}
                  onChangeText={value => {
                    const normalizedValue = value.replace(/\D/g, '').slice(0, 4);
                    setConfirmPinInput(normalizedValue);
                    if (changePinError) {
                      setChangePinError('');
                    }
                  }}
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                  style={[
                    styles.settingsInput,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.textPrimary },
                    changePinError ? styles.settingsInputError : null,
                  ]}
                  placeholder="Confirm new PIN"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry
                  maxLength={4}
                  returnKeyType="done"
                  onSubmitEditing={handleChangePinSave}
                />
                <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>{PIN_RULE_MESSAGE}</Text>
                {changePinError ? (
                  <Text style={styles.settingsPasswordErrorText}>{changePinError}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.settingsActionButton, styles.settingsPrimaryButton, styles.settingsFormSaveButton, { backgroundColor: theme.accent }]}
                  onPress={handleChangePinSave}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>Save PIN</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {settingsView === 'leaderboard-sync' ? (
              <>
              <View style={[styles.settingsFormCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Leaderboard Sync URL</Text>
                <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                  Enter the base URL of the website that should receive and share leaderboard data.
                  Example: http://192.168.1.10:3000
                </Text>
                <TextInput
                  {...STABLE_TEXT_INPUT_PROPS}
                  autoFocus
                  value={leaderboardSyncBaseUrlInput}
                  onChangeText={value => {
                    setLeaderboardSyncBaseUrlInput(value);
                    if (leaderboardSyncError) {
                      setLeaderboardSyncError('');
                    }
                  }}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="http://192.168.1.10:3000"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.settingsInput,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.textPrimary },
                    leaderboardSyncError ? styles.settingsInputError : null,
                  ]}
                  returnKeyType="done"
                  onSubmitEditing={handleLeaderboardSyncSave}
                />
                {leaderboardSyncError ? (
                  <Text style={styles.settingsPasswordErrorText}>{leaderboardSyncError}</Text>
                ) : null}
                <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                  Leave blank to stop custom syncing and fall back to built-in targets.
                </Text>
                <View style={styles.settingsTrackTimerActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.settingsActionButton,
                      styles.settingsSecondaryButton,
                      { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    ]}
                    onPress={handleLeaderboardSyncClear}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText, { color: theme.textPrimary }]}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.settingsActionButton,
                      styles.settingsPrimaryButton,
                      { backgroundColor: theme.accent },
                    ]}
                    onPress={handleLeaderboardSyncSave}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>Save URL</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.settingsFormCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Leaderboard Data</Text>
                <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                  Push sends this tablet's saved results to the sync server. Pull imports the combined results from all
                  tablets into this tablet.
                </Text>
                {leaderboardSyncLoading ? (
                  <View style={styles.settingsLoadingRow}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                      Syncing leaderboard data...
                    </Text>
                  </View>
                ) : null}
                <View style={styles.settingsTrackTimerActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.settingsActionButton,
                      styles.settingsSecondaryButton,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      leaderboardSyncLoading ? styles.settingsActionButtonDisabled : null,
                    ]}
                    onPress={handlePullLeaderboardData}
                    activeOpacity={0.85}
                    disabled={leaderboardSyncLoading}
                  >
                    <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText, { color: theme.textPrimary }]}>
                      Pull Data
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.settingsActionButton,
                      styles.settingsPrimaryButton,
                      { backgroundColor: theme.accent },
                      leaderboardSyncLoading ? styles.settingsActionButtonDisabled : null,
                    ]}
                    onPress={handlePushLeaderboardData}
                    activeOpacity={0.85}
                    disabled={leaderboardSyncLoading}
                  >
                    <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>Push Data</Text>
                  </TouchableOpacity>
                </View>
              </View>
              </>
            ) : null}

            {settingsView === 'password' ? (
              <View style={[styles.settingsFormCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Update Password</Text>
                <View
                  style={[
                    styles.settingsPasswordInputRow,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border },
                    changePasswordError ? styles.settingsInputError : null,
                  ]}
                >
                  <TextInput
                    {...STABLE_TEXT_INPUT_PROPS}
                    ref={currentPasswordInputRef}
                    autoFocus
                    value={currentPasswordInput}
                    onChangeText={value => {
                      setCurrentPasswordInput(value);
                      if (changePasswordError) {
                        setChangePasswordError('');
                      }
                    }}
                    autoCapitalize="none"
                    style={[styles.settingsPasswordTextInput, { color: theme.textPrimary }]}
                    placeholder="Current password"
                    placeholderTextColor={theme.textTertiary}
                    secureTextEntry={!showCurrentPassword}
                    returnKeyType="next"
                    onSubmitEditing={() => newPasswordInputRef.current?.focus()}
                  />
                  <TouchableOpacity
                    style={styles.settingsPasswordToggle}
                    onPress={() => setShowCurrentPassword(prev => !prev)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.settingsPasswordToggleText, { color: theme.accent }]}>
                      {showCurrentPassword ? 'Hide' : 'View'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.settingsPasswordInputRow,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border },
                    changePasswordError ? styles.settingsInputError : null,
                  ]}
                >
                  <TextInput
                    {...STABLE_TEXT_INPUT_PROPS}
                    ref={newPasswordInputRef}
                    value={newPasswordInput}
                    onChangeText={value => {
                      setNewPasswordInput(value);
                      if (changePasswordError) {
                        setChangePasswordError('');
                      }
                    }}
                    autoCapitalize="none"
                    style={[styles.settingsPasswordTextInput, { color: theme.textPrimary }]}
                    placeholder="New password"
                    placeholderTextColor={theme.textTertiary}
                    secureTextEntry={!showNewPassword}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  />
                  <TouchableOpacity
                    style={styles.settingsPasswordToggle}
                    onPress={() => setShowNewPassword(prev => !prev)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.settingsPasswordToggleText, { color: theme.accent }]}>
                      {showNewPassword ? 'Hide' : 'View'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.settingsPasswordInputRow,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border },
                    changePasswordError ? styles.settingsInputError : null,
                  ]}
                >
                  <TextInput
                    {...STABLE_TEXT_INPUT_PROPS}
                    ref={confirmPasswordInputRef}
                    value={confirmPasswordInput}
                    onChangeText={value => {
                      setConfirmPasswordInput(value);
                      if (changePasswordError) {
                        setChangePasswordError('');
                      }
                    }}
                    autoCapitalize="none"
                    style={[styles.settingsPasswordTextInput, { color: theme.textPrimary }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.textTertiary}
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleChangePasswordSave}
                  />
                  <TouchableOpacity
                    style={styles.settingsPasswordToggle}
                    onPress={() => setShowConfirmPassword(prev => !prev)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.settingsPasswordToggleText, { color: theme.accent }]}>
                      {showConfirmPassword ? 'Hide' : 'View'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                  {PASSWORD_RULE_MESSAGE}
                </Text>
                {changePasswordError ? (
                  <Text style={styles.settingsPasswordErrorText}>{changePasswordError}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.settingsActionButton, styles.settingsPrimaryButton, styles.settingsFormSaveButton, { backgroundColor: theme.accent }]}
                  onPress={handleChangePasswordSave}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>Save Password</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
      ) : null}

      {recordPinModalVisible ? (
      <Modal
        visible={recordPinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => closeRecordPinModal(false)}
        hardwareAccelerated={Platform.OS === 'android'}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View
          style={[
            styles.settingsOverlay,
            { backgroundColor: theme.overlay },
          ]}
        >
          <ScrollView
            style={styles.authModalScroll}
            contentContainerStyle={styles.authModalScrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.settingsPasswordCard,
                styles.authModalCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.settingsPasswordTitle, { color: theme.textPrimary }]}>
                Enter PIN
              </Text>
              <Text style={[styles.settingsPasswordSubtitle, { color: theme.textSecondary }]}>
                Enter the 4-digit PIN to {recordPinPurpose}.
              </Text>
              <TextInput
                {...STABLE_TEXT_INPUT_PROPS}
                ref={recordPinInputRef}
                autoFocus
                value={recordPinInput}
                onChangeText={value => {
                  const normalizedValue = value.replace(/\D/g, '').slice(0, 4);
                  setRecordPinInput(normalizedValue);
                  if (recordPinError) {
                    setRecordPinError('');
                  }
                }}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                style={[
                  styles.settingsInput,
                  styles.recordPinInput,
                  { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.textPrimary },
                  recordPinError ? styles.settingsInputError : null,
                ]}
                placeholder="Enter PIN"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleRecordPinSubmit}
              />
              {recordPinError ? (
                <Text style={styles.settingsPasswordErrorText}>{recordPinError}</Text>
              ) : null}
              <View style={styles.settingsPasswordActions}>
                <TouchableOpacity
                  style={[styles.settingsActionButton, styles.settingsSecondaryButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => closeRecordPinModal(false)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText, { color: theme.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingsActionButton, styles.settingsPrimaryButton, { backgroundColor: theme.accent }]}
                  onPress={handleRecordPinSubmit}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>Verify</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
      ) : null}

      {themeVisible ? (
      <Modal
        visible={themeVisible}
        transparent={false}
        animationType="none"
        onRequestClose={() => setThemeVisible(false)}
        hardwareAccelerated={Platform.OS === 'android'}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View style={[styles.fullPageContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.settingsPageHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <View style={styles.settingsPageHeaderLeft}>
              <Text style={[styles.settingsPageTitle, { color: theme.textPrimary }]}>Theme</Text>
              <Text style={[styles.settingsPageSubtitle, { color: theme.textSecondary }]}>
                Choose between a brighter day theme and the darker night theme.
              </Text>
            </View>
            <NavigationActionButton
              label="Back"
              onPress={() => setThemeVisible(false)}
              style={[styles.settingsCloseButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              textStyle={[styles.settingsCloseButtonText, { color: theme.accent }]}
            />
          </View>

          <ScrollView
            style={[styles.fullPageContent, { backgroundColor: theme.background }]}
            contentContainerStyle={styles.settingsPageContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.settingsFormCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Theme Mode</Text>
              <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                Pick the look you want for the app.
              </Text>
              <View style={styles.settingsChipWrap}>
                <TouchableOpacity
                  style={[
                    styles.settingsChip,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    themeMode === 'light' && [styles.settingsChipSelected, { backgroundColor: theme.accent, borderColor: theme.accent }],
                  ]}
                  onPress={() => setThemeMode('light')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.settingsChipText,
                      { color: theme.textPrimary },
                      themeMode === 'light' && [styles.settingsChipTextSelected, { color: theme.accentText }],
                    ]}
                  >
                    Light
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.settingsChip,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    themeMode === 'dark' && [styles.settingsChipSelected, { backgroundColor: theme.accent, borderColor: theme.accent }],
                  ]}
                  onPress={() => setThemeMode('dark')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.settingsChipText,
                      { color: theme.textPrimary },
                      themeMode === 'dark' && [styles.settingsChipTextSelected, { color: theme.accentText }],
                    ]}
                  >
                    Dark
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
      ) : null}

      {/* Registration Form Modal */}
      {formVisible ? (
        <FlowErrorBoundary
          resetKey={`form-${selectedRecord?.recordKey || selectedRecord?.id || 'none'}`}
          onRetry={() => {
            setFormVisible(false);
            setSelectedRecord(null);
            setActiveRecordKey('');
            setRecordsVisible(true);
          }}
        >
          <RegistrationForm
            key={`form-${selectedRecord?.recordKey || selectedRecord?.id || selectedCategoryTrack || 'new'}`}
            visible={formVisible}
            category={selectedCategory}
            initialRecord={selectedRecord}
            selectedDay={selectedDay}
            trackTimerLimitSeconds={selectedTrackTimerLimitSeconds}
            onBack={() => {
              const shouldReturnToDisputes = selectedRecord?.source === 'dispute';
              setFormVisible(false);
              setSelectedRecord(null);
              setActiveRecordKey('');
              setRecordsVisible(!shouldReturnToDisputes);
              if (shouldReturnToDisputes) {
                setSettingsVisible(true);
                setSettingsView('disputes');
              }
            }}
            onSubmit={handleFormSubmit}
            onHoldForDispute={holdRecordForDispute}
            onVerifyPin={handleVerifyPinForRecord}
            layout={responsiveLayout}
            theme={theme}
          />
        </FlowErrorBoundary>
      ) : null}
    </>
  );
}

