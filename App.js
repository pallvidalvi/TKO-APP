import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  Vibration,
  useWindowDimensions,
  NativeModules,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { initializeDatabase, seedDatabase } from './src/db/database';
import { TeamsService, CategoriesService, ResultsService, DisputesService } from './src/services/dataService';
import ReportScreen from './src/screens/ReportScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';

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

// Platform-specific imports
let FileSystem = null;
let Sharing = null;

// Only import FileSystem and Sharing on native platforms (not web)
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system/legacy');
  Sharing = require('expo-sharing');
}

const VISION_CAMERA_ERROR_MESSAGE =
  'Face recognition needs a development build or release build with Vision Camera installed. Expo Go does not support this module.';

const loadFaceDetector = () => {
  if (Platform.OS === 'web') {
    return null;
  }

  const hasVisionCameraNativeModule = Boolean(
    NativeModules?.VisionCamera ||
      NativeModules?.VisionCameraProxy ||
      NativeModules?.CameraViewManager
  );

  if (!hasVisionCameraNativeModule) {
    return null;
  }

  try {
    return require('react-native-vision-camera-face-detector');
  } catch (error) {
    console.warn('Face detector module is unavailable in the current runtime:', error);
    return null;
  }
};

const faceDetectorModule = loadFaceDetector();
const loadVisionCamera = () => {
  if (Platform.OS === 'web') {
    return null;
  }

  const hasVisionCameraNativeModule = Boolean(NativeModules?.CameraView);

  if (!hasVisionCameraNativeModule) {
    return null;
  }

  try {
    return require('react-native-vision-camera');
  } catch (error) {
    console.warn('Vision Camera module is unavailable in the current runtime:', error);
    return null;
  }
};

const visionCameraModule = loadVisionCamera();
const VisionCameraView = visionCameraModule?.Camera || null;
const useVisionCameraDevice = visionCameraModule?.useCameraDevice || (() => null);
const useVisionCameraPermission =
  visionCameraModule?.useCameraPermission ||
  (() => ({
    hasPermission: false,
    requestPermission: async () => false,
  }));

const isFaceRecognitionRuntimeSupported = ({ visionCameraView, visionCameraDevice }) =>
  Boolean(visionCameraView && visionCameraDevice && faceDetectorModule?.detectFaces);

const detectFaces = async (...args) => {
  if (!faceDetectorModule?.detectFaces) {
    const unsupportedError = new Error(VISION_CAMERA_ERROR_MESSAGE);
    unsupportedError.code = 'camera-module-not-found';
    throw unsupportedError;
  }

  return faceDetectorModule.detectFaces(...args);
};

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
  const categoryColumns = screenWidth >= 1280 ? 4 : screenWidth >= 920 ? 3 : 2;
  const penaltyColumns = screenWidth >= 980 ? 3 : screenWidth >= 600 ? 2 : 1;
  const useSplitLayout = isTabletLandscape && screenWidth >= 960;
  const shellMaxWidth = isTablet ? Math.min(screenWidth - 24, 1320) : screenWidth;
  const shellPadding = isLargeTablet ? 28 : isTablet ? 24 : isSmallPhone ? 12 : 16;
  const gridGap = isLargeTablet ? 18 : isTablet ? 16 : 12;
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
  };
};

const INITIAL_LAYOUT = getResponsiveLayout(Dimensions.get('window').width, Dimensions.get('window').height);
const IS_TABLET = INITIAL_LAYOUT.isTablet;
const IS_SMALL_PHONE = INITIAL_LAYOUT.isSmallPhone;
const USE_SPLIT_LAYOUT = INITIAL_LAYOUT.useSplitLayout;
const USE_TWO_COLUMN_PENALTIES = INITIAL_LAYOUT.penaltyColumns > 1;
const CARD_WIDTH = INITIAL_LAYOUT.categoryCardWidth;

const CATEGORY_TRACKS = {
  EXTREME: ['CHANDOLI', 'TADOBA', 'SUNDARBAN', 'RANTHAMBORE', 'KANHA'],
  DIESEL_MODIFIED: ['SHIVNERI', 'RAIGAD', 'PARATAPGAD', 'HARIHAR', 'VASOTA', 'LOHGAD', 'SARASGAD'],
  PETROL_MODIFIED: ['SHIVNERI', 'RAIGAD', 'PARATAPGAD', 'HARIHAR', 'VASOTA', 'LOHGAD', 'SARASGAD'],
  DIESEL_EXPERT: ['KRISHNA', 'KOYANA', 'GODAVARI', 'GANGA', 'YAMUNA', 'SARASWATI', 'CHANDRABHAGA'],
  PETROL_EXPERT: ['KRISHNA', 'KOYANA', 'GODAVARI', 'GANGA', 'YAMUNA', 'SARASWATI', 'CHANDRABHAGA'],
  THAR_SUV: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
  JIMNY_SUV: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
  SUV_MODIFIED: ['K2', 'EVEREST', 'SAHYADRI', 'HIMALAYA', 'KALASUBAI', 'VALMIKI', 'SATPUDA'],
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
  DIESEL_MODIFIED: require('./assets/DieselModified.png'),
  PETROL_MODIFIED: require('./assets/PetrolModified.png'),
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
const DEFAULT_SETTINGS_PASSWORD = 'Pritisangam@MH50';
const APP_SETTINGS_STORAGE_KEY = 'tko_admin_settings_v1';
const APP_SETTINGS_FILE_NAME = 'tko-admin-settings.json';
const DEFAULT_THEME_MODE = 'dark';
const MAX_ENROLLED_FACES = 5;
const FACE_IMAGE_DIRECTORY_NAME = 'face-recognition';
const FACE_MATCH_DEFAULT_THRESHOLD = 0.24;
const FACE_DETECTION_OPTIONS = Object.freeze({
  performanceMode: 'accurate',
  landmarkMode: 'all',
  classificationMode: 'none',
  contourMode: 'none',
  minFaceSize: 0.2,
});
const REQUIRED_FACE_LANDMARK_KEYS = ['LEFT_EYE', 'RIGHT_EYE', 'NOSE_BASE', 'MOUTH_LEFT', 'MOUTH_RIGHT'];

const APP_THEMES = {
  dark: {
    mode: 'dark',
    background: '#1a2432',
    backgroundStrong: '#0b111a',
    surface: '#111722',
    surfaceAlt: '#182131',
    surfaceMuted: '#1f2a3b',
    border: '#2a3441',
    textPrimary: '#fff6ea',
    textSecondary: '#cdbf9a',
    textTertiary: '#8f9bad',
    accent: '#ffb15a',
    accentStrong: '#b45d16',
    accentSoft: '#2b2013',
    accentText: '#18120a',
    primaryButton: '#3565df',
    primaryButtonText: '#fff6ea',
    inputBackground: '#0c111a',
    timerBackground: '#161f36',
    timerText: '#66a5ff',
    overlay: 'rgba(0, 0, 0, 0.58)',
    shadow: '#000000',
  },
  light: {
    mode: 'light',
    background: '#efe6d8',
    backgroundStrong: '#e3d7c4',
    surface: '#fffaf2',
    surfaceAlt: '#f5ede1',
    surfaceMuted: '#f0e4d3',
    border: '#d7c7b1',
    textPrimary: '#1d2430',
    textSecondary: '#6d5a44',
    textTertiary: '#847563',
    accent: '#b86b22',
    accentStrong: '#c7772b',
    accentSoft: '#f7ead8',
    accentText: '#fffaf2',
    primaryButton: '#2f61d7',
    primaryButtonText: '#fffaf2',
    inputBackground: '#fffdf8',
    timerBackground: '#dfeafb',
    timerText: '#244d92',
    overlay: 'rgba(30, 24, 16, 0.22)',
    shadow: '#6a5843',
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

const getPointDistance = (firstPoint, secondPoint) => {
  if (!firstPoint || !secondPoint) {
    return 0;
  }

  const deltaX = Number(secondPoint.x || 0) - Number(firstPoint.x || 0);
  const deltaY = Number(secondPoint.y || 0) - Number(firstPoint.y || 0);
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};

const getPointMidpoint = (firstPoint, secondPoint) => ({
  x: (Number(firstPoint?.x || 0) + Number(secondPoint?.x || 0)) / 2,
  y: (Number(firstPoint?.y || 0) + Number(secondPoint?.y || 0)) / 2,
});

const resolveRequiredFaceLandmarks = face => {
  const landmarks = face?.landmarks || {};
  const resolved = {};

  for (const key of REQUIRED_FACE_LANDMARK_KEYS) {
    if (!landmarks[key]) {
      return null;
    }

    resolved[key] = landmarks[key];
  }

  return resolved;
};

const getNormalizedFeaturePoint = (point, leftEye, rightEye, eyeDistance) => {
  const eyeMidpoint = getPointMidpoint(leftEye, rightEye);
  const eyeAngle = Math.atan2(
    Number(rightEye?.y || 0) - Number(leftEye?.y || 0),
    Number(rightEye?.x || 0) - Number(leftEye?.x || 0)
  );
  const relativeX = Number(point?.x || 0) - eyeMidpoint.x;
  const relativeY = Number(point?.y || 0) - eyeMidpoint.y;
  const cosValue = Math.cos(-eyeAngle);
  const sinValue = Math.sin(-eyeAngle);

  return {
    x: (relativeX * cosValue - relativeY * sinValue) / eyeDistance,
    y: (relativeX * sinValue + relativeY * cosValue) / eyeDistance,
  };
};

const buildFaceTemplate = face => {
  const landmarks = resolveRequiredFaceLandmarks(face);

  if (!landmarks) {
    return null;
  }

  const leftEye = landmarks.LEFT_EYE;
  const rightEye = landmarks.RIGHT_EYE;
  const eyeDistance = getPointDistance(leftEye, rightEye);

  if (!eyeDistance || eyeDistance < 1) {
    return null;
  }

  const orderedPoints = [
    leftEye,
    rightEye,
    landmarks.NOSE_BASE,
    landmarks.MOUTH_LEFT,
    landmarks.MOUTH_RIGHT,
  ];
  const vector = [];

  for (let currentIndex = 0; currentIndex < orderedPoints.length; currentIndex += 1) {
    for (let compareIndex = currentIndex + 1; compareIndex < orderedPoints.length; compareIndex += 1) {
      vector.push(getPointDistance(orderedPoints[currentIndex], orderedPoints[compareIndex]) / eyeDistance);
    }
  }

  [landmarks.NOSE_BASE, landmarks.MOUTH_LEFT, landmarks.MOUTH_RIGHT].forEach(point => {
    const normalizedPoint = getNormalizedFeaturePoint(point, leftEye, rightEye, eyeDistance);
    vector.push(normalizedPoint.x, normalizedPoint.y);
  });

  vector.push(Number(face?.yawAngle || 0) / 45);
  vector.push(Number(face?.rollAngle || 0) / 45);
  vector.push(Number(face?.pitchAngle || 0) / 45);

  return {
    version: 1,
    vector,
  };
};

const getFaceTemplateDistance = (firstTemplate, secondTemplate) => {
  if (!firstTemplate?.vector || !secondTemplate?.vector) {
    return Number.POSITIVE_INFINITY;
  }

  const featureCount = Math.min(firstTemplate.vector.length, secondTemplate.vector.length);

  if (!featureCount) {
    return Number.POSITIVE_INFINITY;
  }

  let sum = 0;

  for (let index = 0; index < featureCount; index += 1) {
    const delta = Number(firstTemplate.vector[index] || 0) - Number(secondTemplate.vector[index] || 0);
    sum += delta * delta;
  }

  return Math.sqrt(sum / featureCount);
};

const getDynamicFaceMatchThreshold = enrolledFaces => {
  const templates = (enrolledFaces || [])
    .map(face => face?.template)
    .filter(template => Array.isArray(template?.vector) && template.vector.length);

  if (templates.length < 2) {
    return FACE_MATCH_DEFAULT_THRESHOLD;
  }

  const distances = [];

  for (let firstIndex = 0; firstIndex < templates.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < templates.length; secondIndex += 1) {
      const distance = getFaceTemplateDistance(templates[firstIndex], templates[secondIndex]);

      if (Number.isFinite(distance)) {
        distances.push(distance);
      }
    }
  }

  if (!distances.length) {
    return FACE_MATCH_DEFAULT_THRESHOLD;
  }

  const maxDistance = Math.max(...distances);
  const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;

  return Math.min(0.42, Math.max(FACE_MATCH_DEFAULT_THRESHOLD, maxDistance * 1.18, averageDistance * 1.4));
};

const getFaceMatchResult = (enrolledFaces, candidateTemplate) => {
  const threshold = getDynamicFaceMatchThreshold(enrolledFaces);
  let bestMatch = null;

  (enrolledFaces || []).forEach(face => {
    const distance = getFaceTemplateDistance(face?.template, candidateTemplate);

    if (!Number.isFinite(distance)) {
      return;
    }

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = {
        face,
        distance,
      };
    }
  });

  return {
    matched: Boolean(bestMatch && bestMatch.distance <= threshold),
    threshold,
    bestMatch,
  };
};

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

const normalizeEnrolledFaceRecords = storedFaces =>
  (Array.isArray(storedFaces) ? storedFaces : [])
    .map((face, index) => ({
      id: String(face?.id || `face-${index + 1}`),
      label: normalizeFaceLabel(face?.label, index),
      uri: String(face?.uri || ''),
      createdAt: String(face?.createdAt || new Date().toISOString()),
      template: {
        version: Number(face?.template?.version || 1),
        vector: Array.isArray(face?.template?.vector)
          ? face.template.vector
              .map(value => Number(value))
              .filter(value => Number.isFinite(value))
          : [],
      },
    }))
    .filter(face => face.uri && face.template.vector.length);

const getDefaultFaceRecognitionSettings = () => ({
  enrolledFaces: [],
});

const normalizeFaceLabel = (value = '', fallbackIndex = 0) => {
  const trimmedValue = String(value || '').trim();
  return trimmedValue || `Face ${fallbackIndex + 1}`;
};

const loadStoredAppSettings = async () => {
  const fallback = {
    password: DEFAULT_SETTINGS_PASSWORD,
    categoryActivationConfig: buildDefaultCategoryActivationConfig(),
    trackActivationConfig: buildDefaultTrackActivationConfig(),
    themeMode: DEFAULT_THEME_MODE,
    faceRecognition: getDefaultFaceRecognitionSettings(),
  };

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);

      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      return {
        password: parsed?.password || DEFAULT_SETTINGS_PASSWORD,
        categoryActivationConfig: normalizeCategoryActivationConfig(parsed?.categoryActivationConfig),
        trackActivationConfig: normalizeTrackActivationConfig(parsed?.trackActivationConfig),
        themeMode: normalizeThemeMode(parsed?.themeMode),
        faceRecognition: {
          enrolledFaces: normalizeEnrolledFaceRecords(parsed?.faceRecognition?.enrolledFaces),
        },
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
        password: parsed?.password || DEFAULT_SETTINGS_PASSWORD,
        categoryActivationConfig: normalizeCategoryActivationConfig(parsed?.categoryActivationConfig),
        trackActivationConfig: normalizeTrackActivationConfig(parsed?.trackActivationConfig),
        themeMode: normalizeThemeMode(parsed?.themeMode),
        faceRecognition: {
          enrolledFaces: normalizeEnrolledFaceRecords(parsed?.faceRecognition?.enrolledFaces),
        },
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
    categoryActivationConfig: normalizeCategoryActivationConfig(settings.categoryActivationConfig),
    trackActivationConfig: normalizeTrackActivationConfig(settings.trackActivationConfig),
    themeMode: normalizeThemeMode(settings.themeMode),
    faceRecognition: {
      enrolledFaces: normalizeEnrolledFaceRecords(settings.faceRecognition?.enrolledFaces),
    },
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
      { key: 'taskAttempted', label: 'Task Attempted' },
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

const createEmptyDisputeFormState = () =>
  Object.keys(DISPUTE_DETAIL_ITEM_MAP).reduce((acc, key) => {
    acc[key] = {
      checked: false,
      detail: '',
    };
    return acc;
  }, {});

const getNormalizedDisputeDetailEntries = source => {
  const rawDetails = source?.disputeDetails ?? source?.dispute_details ?? [];

  if (Array.isArray(rawDetails)) {
    return rawDetails
      .map(entry => {
        const key = String(entry?.key || '').trim();
        const meta = DISPUTE_DETAIL_ITEM_MAP[key];

        if (!key || !meta) {
          return null;
        }

        return {
          key,
          label: entry?.label || meta.label,
          sectionKey: entry?.sectionKey || meta.sectionKey,
          sectionTitle: entry?.sectionTitle || meta.sectionTitle,
          detail: String(entry?.detail || '').trim(),
        };
      })
      .filter(Boolean);
  }

  if (rawDetails && typeof rawDetails === 'object') {
    return Object.keys(rawDetails)
      .map(key => {
        const meta = DISPUTE_DETAIL_ITEM_MAP[key];
        const detailValue = rawDetails[key];

        if (!meta) {
          return null;
        }

        if (typeof detailValue === 'string') {
          return {
            key,
            label: meta.label,
            sectionKey: meta.sectionKey,
            sectionTitle: meta.sectionTitle,
            detail: detailValue.trim(),
          };
        }

        if (detailValue?.checked) {
          return {
            key,
            label: meta.label,
            sectionKey: meta.sectionKey,
            sectionTitle: meta.sectionTitle,
            detail: String(detailValue?.detail || '').trim(),
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  return [];
};

const buildDisputeFormStateFromSource = source => {
  const nextState = createEmptyDisputeFormState();

  getNormalizedDisputeDetailEntries(source).forEach(entry => {
    nextState[entry.key] = {
      checked: true,
      detail: entry.detail,
    };
  });

  return nextState;
};

const buildDisputeEntriesFromState = disputeFormState =>
  DISPUTE_DETAIL_GROUPS.flatMap(group =>
    group.items
      .map(item => {
        const itemState = disputeFormState?.[item.key];

        if (!itemState?.checked) {
          return null;
        }

        return {
          key: item.key,
          label: item.label,
          sectionKey: group.key,
          sectionTitle: group.title,
          detail: String(itemState.detail || '').trim(),
        };
      })
      .filter(Boolean)
  );

const formatDisputeEntriesInline = source =>
  getNormalizedDisputeDetailEntries(source)
    .map(entry => `${entry.label}: ${entry.detail}`)
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
 * CategoryCard Component
 * Displays individual category with animation on press and team count
 */
const CategoryCard = ({ category, onPress, teamCount = 0, cardStyle, layout }) => {
  const [scaleAnim] = useState(new Animated.Value(1));
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = layout || getResponsiveLayout(screenWidth, screenHeight);
  const categoryKey = normalizeCategoryKey(category.name || category.category || '');
  const palette = CATEGORY_CARD_PALETTES[categoryKey] || {
    background: '#ffffff',
    border: '#c7d5f5',
    iconBackground: category.color || '#5b7cfa',
    badgeBackground: '#4263cf',
    secondaryBadgeBackground: '#e8efff',
    secondaryBadgeBorder: '#9fb4ef',
    secondaryBadgeText: '#4263cf',
    title: '#1f2d5a',
    description: '#5f6f97',
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[
          styles.card,
          {
            width: '100%',
            minHeight: responsiveLayout.isTablet ? 210 : 180,
            paddingHorizontal: responsiveLayout.isTablet ? 16 : 12,
            paddingVertical: responsiveLayout.isTablet ? 18 : 14,
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
          cardStyle,
        ]}
      >
        <View style={styles.cardContent}>
          <View
            style={[
              styles.iconBox,
              {
                width: responsiveLayout.isTablet ? 64 : 56,
                height: responsiveLayout.isTablet ? 64 : 56,
              },
              { backgroundColor: palette.iconBackground },
            ]}
          >
            {category.imageSource ? (
              <Image source={category.imageSource} style={styles.categoryImageIcon} resizeMode="contain" />
            ) : (
              <Text style={[styles.categoryIcon, { fontSize: responsiveLayout.isTablet ? 34 : 30 }]}>
                {category.icon}
              </Text>
            )}
          </View>

          <View style={styles.textContent}>
            <Text
              style={[
                styles.categoryName,
                { fontSize: responsiveLayout.isTablet ? 16 : 14, color: palette.title },
              ]}
            >
              {category.name}
            </Text>
            <Text
              style={[
                styles.categoryDescription,
                {
                  fontSize: responsiveLayout.isTablet ? 12 : 11,
                  lineHeight: responsiveLayout.isTablet ? 18 : 16,
                  color: palette.description,
                },
              ]}
            >
              {category.description}
            </Text>
          </View>

          <View style={styles.countBadgeRow}>
            <View
              style={[
                styles.countBadge,
                {
                  minWidth: responsiveLayout.isTablet ? 68 : 60,
                  backgroundColor: palette.badgeBackground,
                },
              ]}
            >
              <Text style={styles.countText}>{teamCount}</Text>
              <Text style={styles.countLabel}>Teams</Text>
            </View>
            <View
              style={[
                styles.countBadge,
                styles.countBadgeSecondary,
                {
                  minWidth: responsiveLayout.isTablet ? 68 : 60,
                  backgroundColor: palette.secondaryBadgeBackground,
                  borderColor: palette.secondaryBadgeBorder,
                },
              ]}
            >
              <Text style={[styles.countText, { color: palette.secondaryBadgeText }]}>{category.trackCount || 0}</Text>
              <Text style={[styles.countLabel, { color: palette.secondaryBadgeText }]}>Tracks</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Custom Dropdown Component
 * Provides a simple dropdown selector for options
 */
const CustomDropdown = ({ label, value, options, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.85}
        hitSlop={TOUCH_HIT_SLOP}
      >
        <Text style={styles.dropdownButtonText}>{value}</Text>
        <Text style={styles.dropdownArrow}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.dropdownMenu}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.dropdownItem}
              onPress={() => {
                onValueChange(option);
                setIsOpen(false);
              }}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  value === option && styles.dropdownItemSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const DNF_OPTIONS = ['20 points', '50 points'];

const DNFSelector = ({
  wrongCourseSelected,
  fourthAttemptSelected,
  timeOverSelected,
  pointsValue,
  onWrongCourseChange,
  onFourthAttemptChange,
  onTimeOverChange,
  onPointsChange,
  disabled = false,
  layout,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = layout || getResponsiveLayout(screenWidth, screenHeight);
  const [isOpen, setIsOpen] = useState(false);
  const hasSelection = wrongCourseSelected || fourthAttemptSelected || timeOverSelected;

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  };

  const handleSelect = option => {
    onPointsChange(option);
    setIsOpen(false);
  };

  return (
    <View
      style={[
        styles.dnfCard,
        {
          paddingHorizontal: responsiveLayout.isTablet ? 14 : responsiveLayout.isSmallPhone ? 8 : 10,
          paddingVertical: responsiveLayout.isTablet ? 12 : responsiveLayout.isSmallPhone ? 8 : 10,
        },
        disabled && styles.dnfCardDisabled,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.dnfToggleButton,
          hasSelection && styles.dnfToggleButtonActive,
          disabled && styles.dnfToggleButtonDisabled,
        ]}
        onPress={handleToggle}
        disabled={disabled}
        activeOpacity={0.85}
        hitSlop={TOUCH_HIT_SLOP}
      >
        <Text style={[styles.dnfToggleButtonText, hasSelection && styles.dnfToggleButtonTextActive]}>
          {hasSelection ? 'DNF Selected' : 'DNF'}
        </Text>
        <Text style={[styles.dnfToggleButtonArrow, hasSelection && styles.dnfToggleButtonTextActive]}>
          {isOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {isOpen ? (
        <View style={styles.dnfDropdownMenu}>
          <TouchableOpacity
            style={styles.dnfCheckboxRow}
            onPress={() => onWrongCourseChange(!wrongCourseSelected)}
            activeOpacity={0.85}
            hitSlop={TOUCH_HIT_SLOP}
          >
            <View style={[styles.dnfCheckbox, wrongCourseSelected && styles.dnfCheckboxSelected]}>
              <Text style={styles.dnfCheckboxTick}>{wrongCourseSelected ? '✓' : ''}</Text>
            </View>
            <Text style={styles.dnfCheckboxLabel}>Wrong Course</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dnfCheckboxRow}
            onPress={() => onFourthAttemptChange(!fourthAttemptSelected)}
            activeOpacity={0.85}
            hitSlop={TOUCH_HIT_SLOP}
          >
            <View style={[styles.dnfCheckbox, fourthAttemptSelected && styles.dnfCheckboxSelected]}>
              <Text style={styles.dnfCheckboxTick}>{fourthAttemptSelected ? '✓' : ''}</Text>
            </View>
            <Text style={styles.dnfCheckboxLabel}>4th Attempt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dnfCheckboxRow}
            onPress={() => onTimeOverChange(!timeOverSelected)}
            activeOpacity={0.85}
            hitSlop={TOUCH_HIT_SLOP}
          >
            <View style={[styles.dnfCheckbox, timeOverSelected && styles.dnfCheckboxSelected]}>
              <Text style={styles.dnfCheckboxTick}>{timeOverSelected ? '✓' : ''}</Text>
            </View>
            <Text style={styles.dnfCheckboxLabel}>Time Over</Text>
          </TouchableOpacity>

          <View style={styles.dnfPointsSection}>
            <Text style={styles.dnfPointsLabel}>Points</Text>
          {DNF_OPTIONS.map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.dnfDropdownItem,
                !hasSelection && styles.dnfDropdownItemDisabled,
              ]}
              onPress={() => handleSelect(option)}
              disabled={!hasSelection}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
            >
              <Text
                style={[
                  styles.dnfDropdownItemText,
                  pointsValue === option && styles.dnfDropdownItemTextSelected,
                  !hasSelection && styles.dnfDropdownItemTextDisabled,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
          </View>
          {hasSelection || pointsValue ? (
            <TouchableOpacity
              style={[styles.dnfDropdownItem, styles.dnfClearButton]}
              onPress={() => {
                onWrongCourseChange(false);
                onFourthAttemptChange(false);
                onTimeOverChange(false);
                onPointsChange('');
                setIsOpen(false);
              }}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
            >
              <Text style={styles.dnfClearButtonText}>Clear DNF</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const LATE_START_OPTIONS = [
  { value: 'late_start', label: 'Late Start with Penalty' },
  { value: 'late_start_with_approval', label: 'Late Start with Approval' },
];

const LateStartSelector = ({
  value,
  onValueChange,
  disabled = false,
  layout,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = layout || getResponsiveLayout(screenWidth, screenHeight);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = LATE_START_OPTIONS.find(option => option.value === value);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  };

  const handleSelect = nextValue => {
    onValueChange(nextValue);
    setIsOpen(false);
  };

  return (
    <View style={[styles.lateStartSelectorContainer, disabled && styles.lateStartSelectorDisabled]}>
      <TouchableOpacity
        style={[
          styles.lateStartSelectorButton,
          selectedOption && styles.lateStartSelectorButtonActive,
        ]}
        onPress={handleToggle}
        disabled={disabled}
        activeOpacity={0.85}
        hitSlop={TOUCH_HIT_SLOP}
      >
        <Text
          style={[
            styles.lateStartSelectorButtonText,
            selectedOption && styles.lateStartSelectorButtonTextActive,
          ]}
        >
          {selectedOption ? selectedOption.label : 'Late Start'}
        </Text>
        <Text
          style={[
            styles.lateStartSelectorArrow,
            selectedOption && styles.lateStartSelectorButtonTextActive,
          ]}
        >
          {isOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {isOpen ? (
        <View style={styles.lateStartSelectorMenu}>
          {LATE_START_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={styles.lateStartSelectorItem}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
            >
              <Text
                style={[
                  styles.lateStartSelectorItemText,
                  value === option.value && styles.lateStartSelectorItemTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
          {value ? (
            <TouchableOpacity
              style={[styles.lateStartSelectorItem, styles.lateStartSelectorClearItem]}
              onPress={() => handleSelect('')}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
            >
              <Text style={styles.lateStartSelectorClearText}>Clear Late Start</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const LateStartCheckbox = ({
  checked,
  onChange,
  disabled = false,
}) => (
  <TouchableOpacity
    style={[styles.lateStartCheckboxRow, disabled && styles.lateStartCheckboxRowDisabled]}
    onPress={() => {
      if (!disabled) {
        onChange(!checked);
      }
    }}
    disabled={disabled}
    activeOpacity={0.85}
    hitSlop={TOUCH_HIT_SLOP}
  >
    <View style={[styles.lateStartCheckbox, checked && styles.lateStartCheckboxChecked]}>
      <Text style={styles.lateStartCheckboxTick}>{checked ? '✓' : ''}</Text>
    </View>
    <Text style={styles.lateStartCheckboxLabel}>Late Start</Text>
  </TouchableOpacity>
);

/**
 * PenaltyCounter Component
 * Provides increment/decrement buttons with manual input for penalty counts
 */
const PenaltyCounter = ({
  label,
  count,
  onCountChange,
  penaltyTime,
  layout,
  disabled = false,
  showPenaltyTime = true,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = layout || getResponsiveLayout(screenWidth, screenHeight);
  const penaltyCardWidth =
    responsiveLayout.penaltyColumns === 1
      ? '100%'
      : responsiveLayout.penaltyColumns === 2
        ? '48.5%'
        : '31.5%';

  const handleIncrement = () => {
    onCountChange(String((parseInt(count) || 0) + 1));
  };

  const handleDecrement = () => {
    const newValue = Math.max(0, (parseInt(count) || 0) - 1);
    onCountChange(String(newValue));
  };

  return (
    <View
      style={[
        styles.penaltyCard,
        {
          width: penaltyCardWidth,
          paddingHorizontal: responsiveLayout.isTablet ? 12 : responsiveLayout.isSmallPhone ? 8 : 10,
          paddingVertical: responsiveLayout.isTablet ? 10 : responsiveLayout.isSmallPhone ? 7 : 8,
          minHeight: responsiveLayout.isTablet ? 88 : responsiveLayout.isSmallPhone ? 74 : 82,
        },
      ]}
    >
      <Text
        style={[
          styles.penaltyCardLabel,
          {
            fontSize: responsiveLayout.isTablet ? 14 : responsiveLayout.isSmallPhone ? 11 : 12,
            marginBottom: responsiveLayout.isSmallPhone ? 6 : 8,
          },
        ]}
      >
        {label}
      </Text>
      <View style={styles.penaltyCardControls}>
        <TouchableOpacity
          style={[
            styles.counterButton,
            disabled && styles.counterButtonDisabled,
            {
              width: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
              height: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
            },
          ]}
          onPress={handleDecrement}
          disabled={disabled}
          activeOpacity={0.8}
          hitSlop={TOUCH_HIT_SLOP}
        >
          <Text
            style={[
              styles.counterButtonText,
              { fontSize: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 16 : 18 },
            ]}
          >
            -
          </Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.counterInput,
            {
              width: responsiveLayout.isTablet ? 60 : 54,
              height: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
              fontSize: responsiveLayout.isTablet ? 22 : responsiveLayout.isSmallPhone ? 15 : 16,
            },
          ]}
          value={count}
          editable={false}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="0"
          placeholderTextColor="#ccc"
        />
        <TouchableOpacity
          style={[
            styles.counterButton,
            disabled && styles.counterButtonDisabled,
            {
              width: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
              height: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
            },
          ]}
          onPress={handleIncrement}
          disabled={disabled}
          activeOpacity={0.8}
          hitSlop={TOUCH_HIT_SLOP}
        >
          <Text
            style={[
              styles.counterButtonText,
              { fontSize: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 16 : 18 },
            ]}
          >
            +
          </Text>
        </TouchableOpacity>
        {showPenaltyTime ? (
          <View
            style={[
              styles.penaltyValuePill,
              {
                minWidth: responsiveLayout.isTablet ? 48 : responsiveLayout.isSmallPhone ? 34 : 40,
                paddingHorizontal: responsiveLayout.isSmallPhone ? 4 : 6,
              },
            ]}
          >
            <Text style={[styles.penaltyValue, { fontSize: responsiveLayout.isSmallPhone ? 11 : 12 }]}>
              {penaltyTime}s
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

/**
 * Registration Form Modal Component
 * Displays form for player details and penalties
 */
const RegistrationForm = ({
  visible,
  category,
  initialRecord,
  selectedDay,
  onClose,
  onSubmit,
  onHoldForDispute,
  onVerifyFace,
  enrolledFaceCount = 0,
  theme = APP_THEMES.dark,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
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
  const [isFaceVerificationInProgress, setIsFaceVerificationInProgress] = useState(false);
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
  const currentDisputeEntries = useMemo(
    () => getNormalizedDisputeDetailEntries(initialRecord),
    [initialRecord]
  );

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
    } else if (visible) {
      setDisputeFormState(createEmptyDisputeFormState());
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

  const toggleStopwatch = () => {
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
    setDetailsExpanded(false);
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
  };

  const handleClose = () => {
    setDisputeModalVisible(false);
    resetForm();
    resetStopwatch();
    onClose();
  };

  const buildFormData = () => ({
    disputeId: initialRecord?.disputeId || initialRecord?.id || null,
    source: initialRecord?.source || 'records',
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
  });

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

  const runFaceVerification = async actionLabel => {
    if (typeof onVerifyFace !== 'function') {
      return true;
    }

    try {
      setIsFaceVerificationInProgress(true);
      return await onVerifyFace(actionLabel);
    } finally {
      setIsFaceVerificationInProgress(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateSubmission()) {
      return;
    }

    const didVerifyFace = await runFaceVerification('submit this stopwatch record');

    if (!didVerifyFace) {
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

    const didVerifyFace = await runFaceVerification('open this stopwatch dispute');

    if (!didVerifyFace) {
      return;
    }

    setDisputeModalVisible(true);
  };

  const handleDisputeFieldToggle = key => {
    setDisputeFormState(prev => {
      const nextChecked = !prev?.[key]?.checked;

      return {
        ...prev,
        [key]: {
          checked: nextChecked,
          detail: nextChecked ? prev?.[key]?.detail || '' : '',
        },
      };
    });
  };

  const handleDisputeDetailChange = (key, value) => {
    setDisputeFormState(prev => ({
      ...prev,
      [key]: {
        checked: true,
        detail: value,
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
  const resetButtonDisabled = isStopwatchRunning || !hasAnyResettableValue;
  const showDisputeButton = initialRecord?.source !== 'dispute';
  const faceEnrollmentIncomplete = enrolledFaceCount < MAX_ENROLLED_FACES;
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
          <View style={styles.detailsAccordion}>
            <TouchableOpacity
              style={styles.detailsAccordionHeader}
              onPress={() => setDetailsExpanded(prev => !prev)}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
            >
              <View style={styles.detailsTrackPill}>
                <Text style={styles.detailsTrackPillText}>
                  {trackName || 'Track'}
                </Text>
              </View>
              <View style={styles.detailsAccordionTrigger}>
                <Text style={styles.detailsAccordionTriggerText}>Details</Text>
                <Text style={styles.detailsAccordionTriggerIcon}>
                  {detailsExpanded ? '▴' : '▾'}
                </Text>
              </View>
            </TouchableOpacity>

            {detailsExpanded ? (
              <View style={styles.heroInfoCard}>
                <Text style={styles.heroMetaText}>
                  Sticker: <Text style={styles.heroMetaStrong}>#{stickerNumber || '--'}</Text>
                  {' | '}
                  Driver: <Text style={styles.heroMetaStrong}>{driverName || '--'}</Text>
                </Text>
                <Text style={styles.heroSecondaryMetaText}>
                  Co-Driver: <Text style={styles.heroMetaStrong}>{coDriverName || '--'}</Text>
                  {' | '}
                  Sr. No.: <Text style={styles.heroMetaStrong}>
                    {srNo ? String(srNo).padStart(2, '0') : '--'}
                  </Text>
                </Text>
              </View>
            ) : null}
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
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                    marginBottom: responsiveLayout.isSmallPhone ? 8 : 10,
                  },
                ]}
              >
                Dispute Details
              </Text>
              {currentDisputeEntries.map(entry => (
                <View key={`hold-${entry.key}`} style={styles.disputeInfoRow}>
                  <Text style={styles.disputeInfoLabel}>{entry.label}</Text>
                  <Text style={styles.disputeInfoValue}>{entry.detail}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.section, { marginBottom: responsiveLayout.isSmallPhone ? 10 : 14 }]}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                  marginBottom: responsiveLayout.isSmallPhone ? 8 : 10,
                },
              ]}
            >
              Penalties
            </Text>
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
            <Text
              style={[
                styles.sectionTitle,
                {
                  fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                  marginBottom: responsiveLayout.isSmallPhone ? 8 : 10,
                },
              ]}
            >
              Task Skipped
            </Text>
            <View style={[styles.penaltyGrid, { gap: responsiveLayout.isSmallPhone ? 8 : 10 }]}>
              <PenaltyCounter
                label="Task Attempt (30s)"
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
            <Text
              style={[
                styles.sectionTitle,
                {
                  fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 14 : 15,
                  marginBottom: responsiveLayout.isSmallPhone ? 8 : 10,
                },
              ]}
            >
              DNF (Did Not Finish)
            </Text>
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
                layout={responsiveLayout}
                disabled={!hasTimerStarted && !isDNF}
              />
            </View>
          </View>

          {!responsiveLayout.useSplitLayout ? (
            <View
              style={[
                styles.summarySection,
                {
                  marginBottom: responsiveLayout.isSmallPhone ? 10 : 12,
                  padding: responsiveLayout.isSmallPhone ? 10 : 12,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryTitle,
                  {
                    fontSize: responsiveLayout.isTablet ? 16 : responsiveLayout.isSmallPhone ? 14 : 15,
                    marginBottom: responsiveLayout.isSmallPhone ? 8 : 10,
                  },
                ]}
              >
                Time Summary
              </Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Total Penalties Time:</Text>
                <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{totalPenaltiesTime} sec</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Late Start Penalty:</Text>
                <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{lateStartPenaltyTime} sec</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Performance Time:</Text>
                <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>
                  {performanceTimeDisplay}
                </Text>
              </View>
              {isDNF ? (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>DNF Points:</Text>
                  <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{dnfSelection}</Text>
                </View>
              ) : null}
              <View style={styles.summaryDivider} />
              <View
                style={[
                  styles.summaryRowTotal,
                  {
                    paddingVertical: responsiveLayout.isSmallPhone ? 8 : 10,
                    paddingHorizontal: responsiveLayout.isSmallPhone ? 10 : 12,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.summaryLabelTotal,
                    { fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 15 : 16 },
                  ]}
                >
                  TOTAL TIME:
                </Text>
                <Text
                  style={[
                    styles.summaryValueTotal,
                    { fontSize: responsiveLayout.isTablet ? 26 : responsiveLayout.isSmallPhone ? 20 : 22 },
                  ]}
                >
                  {totalTimeDisplay}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      {responsiveLayout.useSplitLayout ? (
        <View style={[styles.tabletFooterPanel, { width: '37%' }]}>
          <View
            style={[
              styles.summarySection,
              {
                marginBottom: responsiveLayout.isSmallPhone ? 10 : 12,
                padding: responsiveLayout.isSmallPhone ? 10 : 12,
              },
            ]}
          >
            <Text
              style={[
                styles.summaryTitle,
                {
                  fontSize: responsiveLayout.isTablet ? 16 : responsiveLayout.isSmallPhone ? 14 : 15,
                  marginBottom: responsiveLayout.isSmallPhone ? 8 : 10,
                },
              ]}
            >
              Time Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Total Penalties Time:</Text>
              <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{totalPenaltiesTime} sec</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Late Start Penalty:</Text>
              <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{lateStartPenaltyTime} sec</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Performance Time:</Text>
              <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>
                {performanceTimeDisplay}
              </Text>
            </View>
            {isDNF ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>DNF Points:</Text>
                <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{dnfSelection}</Text>
              </View>
            ) : null}
            <View style={styles.summaryDivider} />
            <View
              style={[
                styles.summaryRowTotal,
                {
                  paddingVertical: responsiveLayout.isSmallPhone ? 8 : 10,
                  paddingHorizontal: responsiveLayout.isSmallPhone ? 10 : 12,
                },
              ]}
            >
              <Text
                style={[
                  styles.summaryLabelTotal,
                  { fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 15 : 16 },
                ]}
              >
                TOTAL TIME:
              </Text>
              <Text
                style={[
                  styles.summaryValueTotal,
                  { fontSize: responsiveLayout.isTablet ? 26 : responsiveLayout.isSmallPhone ? 20 : 22 },
                ]}
              >
                {totalTimeDisplay}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent={false}
        animationType="fade"
        onRequestClose={handleClose}
      >
        {category ? (
          <View style={styles.fullPageContainer}>
          <View
            style={[
              styles.fullPageContent,
              {
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
            >
              <Text
                style={[
                  styles.formTitle,
                  { fontSize: responsiveLayout.isTablet ? 24 : responsiveLayout.isSmallPhone ? 18 : 20 },
                ]}
              >
                {category.name}
              </Text>
              {!hasTimerStarted ? (
                <TouchableOpacity onPress={handleClose} hitSlop={TOUCH_HIT_SLOP}>
                  <Text style={styles.closeButton}>✕</Text>
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
              {faceEnrollmentIncomplete ? (
                <View
                  style={[
                    styles.faceVerificationNotice,
                    {
                      backgroundColor: theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.faceVerificationNoticeTitle, { color: theme.accent }]}>
                    Face Verification Required
                  </Text>
                  <Text style={[styles.faceVerificationNoticeText, { color: theme.textSecondary }]}>
                    Enroll all {MAX_ENROLLED_FACES} faces in Settings before a stopwatch record can be saved.
                  </Text>
                </View>
              ) : null}
              <View style={[styles.submitActionButtonsRow, useLandscapeTabletLayout && styles.submitActionButtonsRowLandscape]}>
                {showDisputeButton ? (
                  <TouchableOpacity
                    style={[
                      styles.disputeButton,
                      useLandscapeTabletLayout && styles.submitActionButtonLandscape,
                      disputeDisabled && styles.submitButtonDisabled,
                      { paddingVertical: responsiveLayout.isSmallPhone ? 12 : 14, marginBottom: useLandscapeTabletLayout ? 0 : 10 },
                    ]}
                    onPress={handleDispute}
                    disabled={disputeDisabled}
                  >
                    {isFaceVerificationInProgress ? (
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
                    submitDisabled && styles.submitButtonDisabled,
                    { paddingVertical: responsiveLayout.isSmallPhone ? 12 : 14 },
                  ]}
                  onPress={handleSubmit}
                  disabled={submitDisabled}
                >
                  {isFaceVerificationInProgress ? (
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
      >
        <View style={styles.disputeModalOverlay}>
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
              {DISPUTE_DETAIL_GROUPS.map(group => (
                <View key={group.key} style={styles.disputeModalSection}>
                  <Text style={styles.disputeModalSectionTitle}>{group.title}</Text>
                  {group.items.map(item => {
                    const itemState = disputeFormState[item.key] || { checked: false, detail: '' };

                    return (
                      <View key={item.key} style={styles.disputeModalOptionBlock}>
                        <TouchableOpacity
                          style={styles.disputeModalOptionHeader}
                          onPress={() => handleDisputeFieldToggle(item.key)}
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
                            value={itemState.detail}
                            onChangeText={value => handleDisputeDetailChange(item.key, value)}
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
            </ScrollView>

            <View style={styles.disputeModalActions}>
              <TouchableOpacity
                style={[styles.settingsActionButton, styles.settingsSecondaryButton, styles.disputeModalActionButton]}
                onPress={handleDisputeModalClose}
                activeOpacity={0.85}
                hitSlop={TOUCH_HIT_SLOP}
              >
                <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsActionButton, styles.settingsPrimaryButton, styles.disputeModalActionButton]}
                onPress={handleConfirmDispute}
                activeOpacity={0.85}
                hitSlop={TOUCH_HIT_SLOP}
              >
                <Text style={styles.settingsActionButtonText}>Confirm Dispute</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const CategoryRecordsModal = ({
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
  activeRecordKey,
  theme = APP_THEMES.dark,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const orderedRecords = useMemo(
    () =>
      [...records].sort((a, b) => {
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

        const aSticker = getStickerSortValue(a);
        const bSticker = getStickerSortValue(b);

        if (aSticker.numeric && bSticker.numeric && aSticker.value !== bSticker.value) {
          return aSticker.value - bSticker.value;
        }

        if (aSticker.value !== bSticker.value) {
          return String(aSticker.value).localeCompare(String(bSticker.value), undefined, { numeric: true });
        }
        
        return String(getRecordKey(a)).localeCompare(String(getRecordKey(b)));
      }),
    [lateStartActionOrderByRecord, records, selectedLateStartEnabledByRecord, selectedLateStartByRecord]
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

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
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
      <View style={[styles.recordsHeader, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.recordsTitle, { color: theme.textPrimary }]}>{category?.name || 'Category Records'}</Text>
          <Text style={[styles.recordsSubtitle, { color: theme.textSecondary }]}>
            {selectedTrackFilter
              ? `${filteredRecords.length} ${filteredRecords.length === 1 ? 'vehicle' : 'vehicles'} on ${selectedTrackFilter}`
              : `${categoryTracks.length} ${categoryTracks.length === 1 ? 'track' : 'tracks'}`}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

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
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No active tracks</Text>
            <Text style={styles.emptyStateText}>
              No tracks are active for this category on the selected day.
            </Text>
          </View>
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
            ListEmptyComponent={
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No vehicles found</Text>
                <Text style={styles.emptyStateText}>
                  {'No vehicles are mapped to this track yet.'}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const recordKey = getRecordKey(item);
              const selectedTrack = selectedTrackFilter;
              const isLateStartChecked = Boolean(selectedLateStartEnabledByRecord[recordKey]);
              const selectedLateStart = selectedLateStartByRecord[recordKey] || '';
              const completedTracks = completedTracksByRecord[recordKey] || [];
              const isActiveRecord = activeRecordKey === recordKey;
              const hasLockedSelection = Boolean(activeRecordKey) && !isActiveRecord;
              const canStart =
                isActiveRecord &&
                Boolean(selectedTrack) &&
                !completedTracks.includes(selectedTrack);

              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => onRecordActivate(item)}
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
                            {String(index + 1).padStart(2, '0')}
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
                        onPress={() => (isActiveRecord ? onDNSPress({ ...item, srNo: index + 1, selectedTrack, recordKey }) : null)}
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
                          canStart ? onStart({ ...item, srNo: index + 1, selectedTrack, recordKey }) : null
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
                        disabled={!isActiveRecord}
                      />
                      <View style={styles.recordLateStartControl}>
                        <LateStartSelector
                          value={selectedLateStart}
                          onValueChange={value => onLateStartSelect(item, value)}
                          disabled={!isActiveRecord || !isLateStartChecked}
                          layout={responsiveLayout}
                        />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={styles.trackCardsBackButton} onPress={onTrackCardBack} activeOpacity={0.85} hitSlop={TOUCH_HIT_SLOP}>
            <Text style={styles.trackCardsBackButtonText}>Change Track</Text>
          </TouchableOpacity>
        </>
      )}
        </View>
      </View>
    </Modal>
  );
};

const DisputeRecordsPanel = ({
  disputes,
  selectedDay,
  categoryOptions,
  loading,
  onRefresh,
  onEdit,
  theme = APP_THEMES.dark,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('');
  const [selectedTrackKey, setSelectedTrackKey] = useState('');

  useEffect(() => {
    setSelectedCategoryKey('');
    setSelectedTrackKey('');
  }, [selectedDay?.id]);

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
      <View style={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.emptyStateTitle, { color: theme.textPrimary }]}>No day selected</Text>
        <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>Choose a day first, then open Settings to review disputed records.</Text>
      </View>
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
            <View style={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.emptyStateTitle, { color: theme.textPrimary }]}>No disputed records</Text>
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>Hold a stopwatch result as a dispute and it will appear here for the selected day.</Text>
            </View>
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
          <TouchableOpacity
            style={[styles.trackBackButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => {
              setSelectedCategoryKey('');
              setSelectedTrackKey('');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.trackBackButtonText, { color: theme.accent }]}>Back to Categories</Text>
          </TouchableOpacity>

          <View style={styles.settingsTrackList}>
            {disputeTrackCards.length === 0 ? (
              <View style={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.emptyStateTitle, { color: theme.textPrimary }]}>No disputed tracks</Text>
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>This category has no disputed tracks for the selected day.</Text>
              </View>
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
          <TouchableOpacity
            style={[styles.trackBackButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setSelectedTrackKey('')}
            activeOpacity={0.85}
          >
            <Text style={[styles.trackBackButtonText, { color: theme.accent }]}>Back to Tracks</Text>
          </TouchableOpacity>

          <View style={styles.recordsListContent}>
            {selectedTrackDisputes.length === 0 ? (
              <View style={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.emptyStateTitle, { color: theme.textPrimary }]}>No disputed records in this track</Text>
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>This track does not have disputed holds for the selected day.</Text>
              </View>
            ) : (
              selectedTrackDisputes.map(item => {
                const stickerNumber = item.sticker_number || item.stickerNumber || '--';
                const driverName = item.driver_name || item.driverName || '--';
                const coDriverName = item.codriver_name || item.coDriverName || '--';
                const disputeEntries = getNormalizedDisputeDetailEntries(item);

                return (
                  <View key={`dispute-${item.id || stickerNumber}-${driverName}`} style={[styles.registrationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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

                    {disputeEntries.length ? (
                      <View style={styles.registrationSection}>
                        <Text style={styles.registrationSectionTitle}>Dispute Details</Text>
                        {disputeEntries.map(entry => (
                          <Text key={`${item.id || stickerNumber}-${entry.key}`} style={styles.registrationSectionText}>
                            {entry.label}: {entry.detail}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.disputeCardActions}>
                      <TouchableOpacity
                        style={[styles.resultsHeaderButton, styles.disputeCardButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                        onPress={() => onEdit({ ...item, disputeId: item.id, source: 'dispute' })}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.resultsHeaderButtonText, { color: theme.accent }]}>Resolve Hold</Text>
                      </TouchableOpacity>
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
};

const RegistrationResultsModal = ({
  visible,
  registrations,
  loading,
  onClose,
  onRefresh,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const normalizedRegistrations = (registrations || []).map(parseRegistrationPayload);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
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
          <View style={styles.recordsHeader}>
            <View>
              <Text style={styles.recordsTitle}>Submission Results</Text>
              <Text style={styles.recordsSubtitle}>
                {loading
                  ? 'Loading saved registrations...'
                  : `${normalizedRegistrations.length} ${normalizedRegistrations.length === 1 ? 'record' : 'records'} stored in DB`}
              </Text>
            </View>
            <View style={styles.resultsHeaderActions}>
              <TouchableOpacity onPress={onRefresh} style={styles.resultsHeaderButton} activeOpacity={0.85}>
                <Text style={styles.resultsHeaderButtonText}>Refresh</Text>
              </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.closeButton, { color: theme.textPrimary }]}>âœ•</Text>
        </TouchableOpacity>
      </View>
          </View>

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
            ListEmptyComponent={
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>No saved submissions</Text>
                <Text style={styles.emptyStateText}>
                  Submit a vehicle result and the card will appear here from SQLite.
                </Text>
              </View>
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
};

/**
 * Main App Component
 * Displays the home screen with vehicle categories
 */
export default function App() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
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
  const [dbReady, setDbReady] = useState(false);
  const [teams, setTeams] = useState([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState([]);
  const [reportsVisible, setReportsVisible] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const [appStage, setAppStage] = useState('splash');
  const [selectedDay, setSelectedDay] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState(DEFAULT_SETTINGS_PASSWORD);
  const [themeMode, setThemeMode] = useState(DEFAULT_THEME_MODE);
  const [categoryActivationConfig, setCategoryActivationConfig] = useState(() => buildDefaultCategoryActivationConfig());
  const [trackActivationConfig, setTrackActivationConfig] = useState(() => buildDefaultTrackActivationConfig());
  const [enrolledFaces, setEnrolledFaces] = useState([]);
  const [settingsPasswordModalVisible, setSettingsPasswordModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsView, setSettingsView] = useState('menu');
  const [themeVisible, setThemeVisible] = useState(false);
  const [faceSettingsBusy, setFaceSettingsBusy] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState('');
  const [settingsPasswordError, setSettingsPasswordError] = useState('');
  const [settingsConfigDayId, setSettingsConfigDayId] = useState(REPORT_DAYS[0]?.id || '');
  const [settingsConfigCategoryKey, setSettingsConfigCategoryKey] = useState('EXTREME');
  const [faceRegistrationName, setFaceRegistrationName] = useState('');
  const [disputeRecords, setDisputeRecords] = useState([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [faceScannerVisible, setFaceScannerVisible] = useState(false);
  const [faceScannerBusy, setFaceScannerBusy] = useState(false);
  const [faceScannerError, setFaceScannerError] = useState('');
  const [faceScannerPurpose, setFaceScannerPurpose] = useState('verify this record');
  const settingsPasswordInputRef = useRef(null);
  const currentPasswordInputRef = useRef(null);
  const newPasswordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const faceScannerCameraRef = useRef(null);
  const faceScannerRequestRef = useRef(null);
  const splashLogoAnim = useRef(new Animated.Value(0)).current;
  const switchAnim = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0)).current;
  const ignitionSoundRef = useRef(null);
  const splashStartTriggeredRef = useRef(false);
  const ignitionSequenceTimerRef = useRef(null);
  const lateStartActionCounterRef = useRef(0);
  const theme = useMemo(() => APP_THEMES[normalizeThemeMode(themeMode)], [themeMode]);
  const visionCameraDevice = useVisionCameraDevice('front');
  const faceRecognitionSupported = isFaceRecognitionRuntimeSupported({
    visionCameraView: VisionCameraView,
    visionCameraDevice,
  });
  const {
    hasPermission: hasVisionCameraPermission,
    requestPermission: requestVisionCameraPermission,
  } = useVisionCameraPermission();

  useEffect(() => {
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
    };
  }, [glowPulseAnim]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSettings = async () => {
      const storedSettings = await loadStoredAppSettings();

      if (!isMounted) {
        return;
      }

      setSettingsPassword(storedSettings.password);
      setCategoryActivationConfig(storedSettings.categoryActivationConfig);
      setTrackActivationConfig(storedSettings.trackActivationConfig);
      setThemeMode(storedSettings.themeMode);
      setEnrolledFaces(storedSettings.faceRecognition?.enrolledFaces || []);
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
      categoryActivationConfig,
      trackActivationConfig,
      themeMode,
      faceRecognition: {
        enrolledFaces,
      },
    }).catch(error => {
      console.warn('Unable to save admin settings:', error);
    });
  }, [categoryActivationConfig, enrolledFaces, settingsLoaded, settingsPassword, themeMode, trackActivationConfig]);

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
        
        console.log('🏆 Categories with counts:', categoriesWithTeamCounts);
        setCategoriesWithCounts(categoriesWithTeamCounts);
        
        setDbReady(true);
      } catch (error) {
        console.error('❌ Database setup error:', error);
        Alert.alert('Database Error', 'Failed to initialize database');
      }
    };

    setupDatabase();
  }, []);

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
        tracks: getActiveTracksForDayCategory(trackActivationConfig, selectedDay?.id, category.label),
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

  useEffect(() => {
    if (!settingsCategoryOptions.length) {
      return;
    }

    if (!settingsCategoryOptions.some(option => option.key === settingsConfigCategoryKey)) {
      setSettingsConfigCategoryKey(settingsCategoryOptions[0].key);
    }
  }, [settingsCategoryOptions, settingsConfigCategoryKey]);

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
    const normalizedSearch = searchText.toLowerCase();

    return dayScopedCategories.filter(cat =>
      cat.name.toLowerCase().includes(normalizedSearch)
    );
  }, [dayScopedCategories, searchText]);

  /**
   * Handle card press - Opens registration form
   */
  const handleCategoryPress = (category) => {
    setSelectedCategory(category);
    setSelectedCategoryTrack('');
    setActiveRecordKey('');
    setRecordsVisible(true);
  };

  const handleDaySelect = day => {
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
    setReportMenuVisible(false);
    setLeaderboardVisible(false);
    setSettingsPasswordInput('');
    setSettingsPasswordError('');
    setSettingsConfigDayId(selectedDay?.id || REPORT_DAYS[0]?.id || '');
    setSettingsConfigCategoryKey(normalizeCategoryKey(selectedCategory?.name || 'Extreme'));
    setSettingsPasswordModalVisible(true);
  };

  const handleOpenDisputes = async () => {
    await refreshDisputes();
    setSettingsView('disputes');
  };

  const handleThemeOpen = () => {
    setReportMenuVisible(false);
    setLeaderboardVisible(false);
    setThemeVisible(true);
  };

  const getPreviousSettingsView = currentView => {
    if (currentView === 'face' || currentView === 'password') {
      return 'security';
    }

    return 'menu';
  };

  const handleSettingsPasswordSubmit = () => {
    if (settingsPasswordInput !== settingsPassword) {
      setSettingsPasswordError('Wrong password. Please try again.');
      return;
    }

    setSettingsPasswordModalVisible(false);
    setSettingsPasswordInput('');
    setSettingsPasswordError('');
    setSettingsView('menu');
    setSettingsVisible(true);
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

  const handleOpenSecurity = () => {
    setFaceRegistrationName('');
    setSettingsView('security');
  };

  const relabelEnrolledFaces = faces =>
    (faces || []).map((face, index) => ({
      ...face,
      label: normalizeFaceLabel(face?.label, index),
    }));

  const closeFaceScanner = result => {
    const pendingRequest = faceScannerRequestRef.current;
    faceScannerRequestRef.current = null;
    setFaceScannerBusy(false);
    setFaceScannerError('');
    setFaceScannerVisible(false);

    if (pendingRequest?.resolve) {
      pendingRequest.resolve(result || null);
    }
  };

  const openFaceScannerAsync = ({ purpose = 'verify this record' } = {}) =>
    new Promise(resolve => {
      faceScannerRequestRef.current = { resolve };
      setFaceScannerPurpose(purpose);
      setFaceScannerError('');
      setFaceScannerBusy(false);
      setFaceScannerVisible(true);
    });

  const ensureFaceImageDirectoryAsync = async () => {
    if (!FileSystem?.documentDirectory) {
      return null;
    }

    const directoryPath = `${FileSystem.documentDirectory}${FACE_IMAGE_DIRECTORY_NAME}`;
    await FileSystem.makeDirectoryAsync(directoryPath, { intermediates: true }).catch(() => {});
    return directoryPath;
  };

  const deleteFaceImageAsync = async imageUri => {
    if (!imageUri || !FileSystem) {
      return;
    }

    await FileSystem.deleteAsync(imageUri, { idempotent: true }).catch(() => {});
  };

  const persistCapturedFaceAsync = async sourceUri => {
    if (!sourceUri || !FileSystem?.documentDirectory) {
      return sourceUri;
    }

    const directoryPath = await ensureFaceImageDirectoryAsync();
    const extensionMatch = String(sourceUri).match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i);
    const extension = extensionMatch?.[1] ? `.${extensionMatch[1].toLowerCase()}` : '.jpg';
    const targetUri = `${directoryPath}/face-${Date.now()}${extension}`;
    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    });
    return targetUri;
  };

  const requestCameraAccessAsync = async () => {
    if (!faceRecognitionSupported) {
      Alert.alert('Face Recognition Unavailable', VISION_CAMERA_ERROR_MESSAGE);
      return false;
    }

    if (VisionCameraView && visionCameraDevice) {
      if (hasVisionCameraPermission) {
        return true;
      }

      const visionPermission = await requestVisionCameraPermission();
      const granted = visionPermission === true || visionPermission === 'granted';

      if (!granted) {
        Alert.alert('Camera Permission', 'Camera access is required for face recognition.');
      }

      return granted;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Camera Permission', 'Camera permission is required for face recognition.');
      return false;
    }

    return true;
  };

  const processCapturedFaceUriAsync = async (capturedUri, { persistImage = false, purpose = 'verify this record' } = {}) => {
    if (!capturedUri) {
      Alert.alert('Face Recognition', 'Could not read the captured face image. Please try again.');
      return null;
    }

    let detectedFaces = [];

    try {
      detectedFaces = await detectFaces({
        image: capturedUri,
        options: FACE_DETECTION_OPTIONS,
      });
    } catch (error) {
      console.warn('Unable to detect faces in captured image:', error);

      if (error?.code === 'camera-module-not-found') {
        Alert.alert('Face Recognition Unavailable', VISION_CAMERA_ERROR_MESSAGE);
        return null;
      }
    }

    if (detectedFaces.length !== 1) {
      Alert.alert(
        'Face Recognition',
        detectedFaces.length > 1
          ? 'Multiple faces were detected. Please try again with only one face in the frame.'
          : `No face was detected to ${purpose}. Please try again.`
      );
      return null;
    }

    const template = buildFaceTemplate(detectedFaces[0]);

    if (!template) {
      Alert.alert('Face Recognition', 'The face could not be processed clearly. Please try again facing the camera.');
      return null;
    }

    const storedUri = persistImage ? await persistCapturedFaceAsync(capturedUri) : capturedUri;

    return {
      uri: storedUri,
      template,
    };
  };

  const handleFaceScannerCapture = async () => {
    if (!faceScannerCameraRef.current || faceScannerBusy) {
      return;
    }

    try {
      setFaceScannerBusy(true);
      setFaceScannerError('');
      const capturedPhoto = await faceScannerCameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      const capturedUri = capturedPhoto?.path ? `file://${capturedPhoto.path}` : '';
      closeFaceScanner(capturedUri || null);
    } catch (error) {
      console.warn('Unable to capture face from scanner:', error);
      setFaceScannerBusy(false);
      setFaceScannerError('Capture failed. Hold steady and try again.');
    }
  };

  const captureFaceTemplateAsync = async ({ persistImage = false, purpose = 'verify this record' } = {}) => {
    const hasPermission = await requestCameraAccessAsync();

    if (!hasPermission) {
      return null;
    }

    if (VisionCameraView && visionCameraDevice) {
      const capturedUri = await openFaceScannerAsync({ purpose });

      if (!capturedUri) {
        return null;
      }

      return processCapturedFaceUriAsync(capturedUri, { persistImage, purpose });
    }

    const captureResult = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      exif: false,
    });

    if (captureResult.canceled) {
      return null;
    }

    const capturedAsset = captureResult.assets?.[0];

    return processCapturedFaceUriAsync(capturedAsset?.uri, { persistImage, purpose });
  };

  const handleOpenFaceRecognition = () => {
    setFaceRegistrationName('');
    setSettingsView('face');
  };

  const handleEnrollFace = async () => {
    if (faceSettingsBusy) {
      return;
    }

    if (enrolledFaces.length >= MAX_ENROLLED_FACES) {
      Alert.alert('Face Recognition', `Only ${MAX_ENROLLED_FACES} enrolled faces are allowed.`);
      return;
    }

    const normalizedFaceName = faceRegistrationName.trim();

    if (!normalizedFaceName) {
      Alert.alert('Face Recognition', 'Enter a name before registering a face.');
      return;
    }

    if (!faceRecognitionSupported) {
      Alert.alert('Face Recognition Unavailable', VISION_CAMERA_ERROR_MESSAGE);
      return;
    }

    try {
      setFaceSettingsBusy(true);
      const capturedFace = await captureFaceTemplateAsync({
        persistImage: true,
        purpose: 'enroll a face',
      });

      if (!capturedFace) {
        return;
      }

      setEnrolledFaces(prev =>
        relabelEnrolledFaces([
          ...prev,
          {
            id: `face-${Date.now()}`,
            label: normalizedFaceName,
            uri: capturedFace.uri,
            createdAt: new Date().toISOString(),
            template: capturedFace.template,
          },
        ])
      );
      setFaceRegistrationName('');
      Alert.alert('Face Recognition', 'Face enrolled successfully.');
    } finally {
      setFaceSettingsBusy(false);
    }
  };

  const handleRemoveEnrolledFace = async faceId => {
    const faceToRemove = enrolledFaces.find(face => face.id === faceId);

    if (!faceToRemove) {
      return;
    }

    try {
      setFaceSettingsBusy(true);
      await deleteFaceImageAsync(faceToRemove.uri);
      setEnrolledFaces(prev => relabelEnrolledFaces(prev.filter(face => face.id !== faceId)));
    } finally {
      setFaceSettingsBusy(false);
    }
  };

  const handleClearEnrolledFaces = async () => {
    try {
      setFaceSettingsBusy(true);
      await Promise.all(enrolledFaces.map(face => deleteFaceImageAsync(face.uri)));
      setEnrolledFaces([]);
    } finally {
      setFaceSettingsBusy(false);
    }
  };

  const handleVerifyFaceForRecord = async actionLabel => {
    if (!faceRecognitionSupported) {
      Alert.alert('Face Recognition Unavailable', VISION_CAMERA_ERROR_MESSAGE);
      return false;
    }

    if (enrolledFaces.length < MAX_ENROLLED_FACES) {
      Alert.alert(
        'Face Recognition',
        `Enroll ${MAX_ENROLLED_FACES} faces in Settings > Face Recognition before you can save stopwatch records.`
      );
      return false;
    }

    const capturedFace = await captureFaceTemplateAsync({
      persistImage: false,
      purpose: actionLabel,
    });

    if (!capturedFace) {
      return false;
    }

    const matchResult = getFaceMatchResult(enrolledFaces, capturedFace.template);

    if (!matchResult.matched) {
      Alert.alert('Face Recognition', 'Face did not match. Try again.');
      return false;
    }

    return true;
  };

  const handleChangePasswordSave = () => {
    if (currentPasswordInput !== settingsPassword) {
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

  const handleRecordStart = (record) => {
    const recordKey = record.recordKey || getRecordKey(record);
    setSelectedRecord({
      ...record,
      selectedTrack: selectedCategoryTrack,
      lateStartMode: selectedLateStartEnabledByRecord[recordKey]
        ? selectedLateStartByRecord[recordKey] || ''
        : '',
    });
    setActiveRecordKey(recordKey);
    setRecordsVisible(false);
    setFormVisible(true);
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

    if (activeRecordKey !== recordKey) {
      return;
    }

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

    if (activeRecordKey !== recordKey || !selectedLateStartEnabledByRecord[recordKey]) {
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
    const nullValue = 'null';
    const fileName = `${selectedCategory?.name || 'Category'} - ${record.selectedTrack || 'Track'} - DNS.csv`;
    const dayPayload = {
      selected_day_id: selectedDay?.id || '',
      selectedDayId: selectedDay?.id || '',
      selected_day_label: selectedDay?.dayLabel || '',
      selectedDayLabel: selectedDay?.dayLabel || '',
      selected_day_date: selectedDay?.dateLabel || '',
      selectedDayDate: selectedDay?.dateLabel || '',
    };
    const dnsResultData = {
      track_name: record.selectedTrack || '',
      sticker_number: getTeamStickerNumber(record) || '',
      driver_name: record.driver_name || record.driverName || '',
      codriver_name: record.codriver_name || record.coDriverName || '',
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
        ...record,
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
      record.selectedTrack || nullValue,
      nullValue,
      getTeamStickerNumber(record) || nullValue,
      record.driver_name || record.driverName || nullValue,
      record.codriver_name || record.coDriverName || nullValue,
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

    try {
      const isDuplicate = await ResultsService.isDuplicateResult(dnsResultData);
      if (isDuplicate) {
        Alert.alert('Duplicate Record', 'This DNS record already exists for the same category, track, and sticker number.');
        return;
      }

      await CSVExporter.downloadFile(fileName, RECORD_EXPORT_HEADERS, row);

      await ResultsService.addResult(dnsResultData);
      await refreshCompletedTracks(teams, selectedDay?.id || '');

      const recordKey = record.recordKey || getRecordKey(record);

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
        `Driver: ${record.driver_name || record.driverName || 'Unknown Driver'}\nCategory: ${selectedCategory?.name || ''}\nTrack: ${record.selectedTrack || ''}\nTotal Time: 0`,
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
      Alert.alert('Error', 'Failed to generate file: ' + error.message);
    }
  };

const buildRegistrationData = formData => ({
    sr_no: formData.srNo || null,
    srNo: formData.srNo || null,
    track_name: formData.trackName,
    trackName: formData.trackName,
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
    const completedTrack = formData.trackName;
    const isDisputeRecord = formData.source === 'dispute' || Boolean(formData.disputeId);
    const recordKey = selectedRecord?.recordKey || getRecordKey(selectedRecord || {});
    const registrationData = buildRegistrationData(formData);

    if (!isDisputeRecord) {
      const didDownload = await downloadResultCsv(formData).then(() => true).catch(error => {
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

    if (formData.disputeId) {
      await DisputesService.deleteDisputeById(formData.disputeId);
      await refreshDisputes();
    }

    if (recordKey && completedTrack) {
      clearActiveRecordState(recordKey, false);
    } else {
      clearActiveRecordState('', false);
    }

    await refreshCompletedTracks(teams, selectedDay?.id || '');
    return true;
  };

  const holdRecordForDispute = async formData => {
    try {
      const disputePayload = {
        id: formData.disputeId || undefined,
        track_name: formData.trackName,
        sticker_number: formData.stickerNumber,
        driver_name: formData.driverName,
        codriver_name: formData.coDriverName,
        category: formData.category,
        selected_day_id: formData.selectedDayId || '',
        selectedDayId: formData.selectedDayId || '',
        selected_day_label: formData.selectedDayLabel || '',
        selectedDayLabel: formData.selectedDayLabel || '',
        selected_day_date: formData.selectedDayDate || '',
        selectedDayDate: formData.selectedDayDate || '',
        dispute_details: formData.disputeDetails || [],
        total_penalties_time: formData.totalPenaltiesTime || 0,
        performance_time: formData.performanceTimeDisplay || null,
        total_time: formData.totalTimeDisplay || null,
        submission_json: JSON.stringify(formData),
      };

      await DisputesService.saveDispute(disputePayload);
      await refreshDisputes();
      await refreshCompletedTracks(teams, selectedDay?.id || '');
      clearActiveRecordState(selectedRecord?.recordKey || getRecordKey(selectedRecord || {}), false);
      return true;
    } catch (error) {
      Alert.alert('Error', 'Record could not be moved to disputes');
      return false;
    }
  };

  const handleDisputeEdit = disputeRecord => {
    const disputeCategory =
      (categoriesWithCounts.length > 0 ? categoriesWithCounts : categories).find(
        item => normalizeCategoryKey(item.name) === normalizeCategoryKey(disputeRecord.category || '')
      ) || {
        id: `dispute-${normalizeCategoryKey(disputeRecord.category || 'category')}`,
        name: disputeRecord.category || 'Category',
      };

    setReportsVisible(false);
    setReportMenuVisible(false);
    setRecordsVisible(false);
    setSelectedCategory(disputeCategory);
    setSelectedRecord(disputeRecord);
    setFormVisible(true);
    setSettingsVisible(true);
    setSettingsView('disputes');
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
      Alert.alert('Error', 'Registration was not saved to the database');
      return false;
    }
  };

  /**
   * Render individual category item
   */
  const renderCategoryItem = ({ item }) => (
    <View style={{ width: responsiveLayout.categoryCardWidth, marginBottom: responsiveLayout.gridGap }}>
      <CategoryCard
        category={item}
        teamCount={item.teamCount || 0}
        onPress={() => handleCategoryPress(item)}
        layout={responsiveLayout}
      />
    </View>
  );

  const selectedCategoryRecords = useMemo(
    () => (selectedCategory ? getTeamsForCategory(teams, selectedCategory.name) : []),
    [selectedCategory, teams]
  );

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
    return (
      <View style={[styles.dayScreen, { backgroundColor: theme.background }]}>
          <View style={[styles.dayScreenHeader, { backgroundColor: theme.background }]}>
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
                  style={styles.dayEventTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  KARAD OFFROAD SEASON 2 - 2026
                </Text>
              </View>
            </Animated.View>
          </View>

          <View style={styles.dayList}>
            {REPORT_DAYS.map(day => (
              <TouchableOpacity
                key={day.id}
                style={styles.dayCard}
                activeOpacity={0.88}
                onPress={() => handleDaySelect(day)}
              >
                <View style={styles.dayCardTextBlock}>
                  <Text style={styles.dayCardLabel}>{String(day.dayLabel || '').toUpperCase()}</Text>
                  <Text style={styles.dayCardDate}>{day.dateLabel}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
    );
  }

  return (
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
                <TouchableOpacity
                  style={[
                    styles.topHeaderButton,
                    styles.backHeaderButton,
                    { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
                  ]}
                  onPress={handleBackToDayPage}
                  activeOpacity={0.85}
                >
                  <Text style={styles.backHeaderButtonIcon}>‹</Text>
                  <Text style={styles.topHeaderButtonText}>Back</Text>
                </TouchableOpacity>
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
        <Text style={styles.searchIcon}>🔍</Text>
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
            paddingHorizontal: responsiveLayout.shellPadding,
            paddingBottom: responsiveLayout.isTablet ? 28 : 20,
          },
        ]}
        columnWrapperStyle={{
          justifyContent: 'space-between',
          marginBottom: responsiveLayout.gridGap,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <CategoryRecordsModal
        visible={recordsVisible}
        category={selectedCategory}
        categoryTracks={selectedCategoryTracks}
        records={selectedCategoryRecords}
        activeRecordKey={activeRecordKey}
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
        theme={theme}
      />

      <ReportScreen
        visible={reportsVisible}
        onClose={() => setReportsVisible(false)}
        selectedDay={selectedDay}
        categoryOptions={reportCategoryOptions}
        theme={theme}
      />

      <LeaderboardScreen
        visible={leaderboardVisible}
        onClose={() => setLeaderboardVisible(false)}
        categoryOptions={leaderboardCategoryOptions}
        teams={teams}
        theme={theme}
      />

      <Modal
        visible={settingsPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSettingsPasswordModalVisible(false);
          setSettingsPasswordInput('');
          setSettingsPasswordError('');
        }}
      >
        <View style={[styles.settingsOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.settingsPasswordCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.settingsPasswordTitle, { color: theme.textPrimary }]}>Settings Access</Text>
            <Text style={[styles.settingsPasswordSubtitle, { color: theme.textSecondary }]}>
              Enter password to open protected settings.
            </Text>
            <TextInput
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
              autoCorrect={false}
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
        </View>
      </Modal>

      <Modal
        visible={settingsVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          if (settingsView === 'menu') {
            setSettingsVisible(false);
          } else {
            setSettingsView(getPreviousSettingsView(settingsView));
          }
        }}
      >
        <View style={[styles.fullPageContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.settingsPageHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <View style={styles.settingsPageHeaderLeft}>
              <Text style={[styles.settingsPageTitle, { color: theme.textPrimary }]}>
                {settingsView === 'menu'
                  ? 'Settings'
                  : settingsView === 'config'
                    ? 'Configuration'
                    : settingsView === 'security'
                      ? 'Security'
                    : settingsView === 'face'
                      ? 'Face Recognition'
                    : settingsView === 'disputes'
                      ? 'Disputes'
                      : 'Change Password'}
              </Text>
              <Text style={[styles.settingsPageSubtitle, { color: theme.textSecondary }]}>
                {settingsView === 'config'
                  ? 'Control which tracks are visible for each day and category.'
                  : settingsView === 'security'
                    ? 'Manage the protected tools used to verify race-day actions.'
                  : settingsView === 'face'
                    ? `Register named faces used to approve stopwatch submit and dispute actions.`
                  : settingsView === 'disputes'
                    ? 'Review and resolve disputed stopwatch records for the selected day.'
                  : settingsView === 'password'
                      ? 'Update the password used to open Settings.'
                      : 'Protected tools for race-day configuration.'}
              </Text>
            </View>
            {settingsView === 'menu' ? (
              <TouchableOpacity
                style={[styles.settingsCloseButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                onPress={() => setSettingsVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={[styles.settingsCloseButtonText, { color: theme.accent }]}>Close</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.settingsCloseButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                onPress={() => setSettingsView(getPreviousSettingsView(settingsView))}
                activeOpacity={0.85}
              >
                <Text style={[styles.settingsCloseButtonText, { color: theme.accent }]}>Back</Text>
              </TouchableOpacity>
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
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setSettingsView('config')}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Admin</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Configuration</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Activate or deactivate vehicle categories and tracks for each day.
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
                    Add face recognition and update the password required to access Settings.
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {settingsView === 'security' ? (
              <View style={styles.settingsMenuGrid}>
                <TouchableOpacity
                  style={[styles.settingsMenuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleOpenFaceRecognition}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.settingsMenuCardEyebrow, { color: theme.accent }]}>Verification</Text>
                  <Text style={[styles.settingsMenuCardTitle, { color: theme.textPrimary }]}>Add Face Recognition</Text>
                  <Text style={[styles.settingsMenuCardText, { color: theme.textSecondary }]}>
                    Register named faces that must match before stopwatch submit or dispute records can be saved.
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
                    {REPORT_DAYS.find(day => day.id === settingsConfigDayId)?.dayLabel || 'Selected Day'} · Category visibility
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
                    {REPORT_DAYS.find(day => day.id === settingsConfigDayId)?.dayLabel || 'Selected Day'} ·{' '}
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

            {settingsView === 'face' ? (
              <>
                <View
                  style={[
                    styles.faceSettingsSummaryCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.faceSettingsSummaryTitle, { color: theme.textPrimary }]}>
                    Enrolled Faces
                  </Text>
                  <View style={styles.faceSettingsSummaryRow}>
                    <Text style={[styles.faceSettingsCount, { color: theme.accent }]}>
                      {enrolledFaces.length}/{MAX_ENROLLED_FACES}
                    </Text>
                    {faceSettingsBusy ? (
                      <ActivityIndicator color={theme.accent} />
                    ) : null}
                  </View>
                  <Text style={[styles.faceSettingsSummaryText, { color: theme.textSecondary }]}>
                    A matching enrolled face is required before stopwatch Submit or Dispute can continue. Records stay blocked until all {MAX_ENROLLED_FACES} faces are added.
                  </Text>
                </View>

                <View
                  style={[
                    styles.settingsFormCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.settingsSectionTitle, { color: theme.textPrimary }]}>Register Face</Text>
                  <Text style={[styles.settingsSectionHint, { color: theme.textSecondary }]}>
                    Enter the person name first, then tap Add Face Recognition to capture and save their face locally.
                  </Text>
                  {!faceRecognitionSupported ? (
                    <Text style={[styles.settingsSectionHint, { color: theme.accent, marginTop: 10 }]}>
                      Face recognition is only available in a development build or release build. Open the installed app instead of Expo Go to register faces.
                    </Text>
                  ) : null}
                  <TextInput
                    style={[
                      styles.settingsInput,
                      { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.textPrimary },
                    ]}
                    value={faceRegistrationName}
                    onChangeText={setFaceRegistrationName}
                    placeholder="Enter person name"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!faceSettingsBusy && faceRecognitionSupported}
                  />
                </View>

                <View style={styles.faceSettingsActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.settingsActionButton,
                      styles.settingsPrimaryButton,
                      styles.faceSettingsActionButton,
                      { backgroundColor: theme.accent },
                      (!faceRecognitionSupported || faceSettingsBusy || enrolledFaces.length >= MAX_ENROLLED_FACES) &&
                        styles.faceSettingsActionButtonDisabled,
                    ]}
                    onPress={handleEnrollFace}
                    activeOpacity={0.85}
                    disabled={!faceRecognitionSupported || faceSettingsBusy || enrolledFaces.length >= MAX_ENROLLED_FACES}
                  >
                    <Text style={[styles.settingsActionButtonText, { color: theme.accentText }]}>
                      Add Face Recognition
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.settingsActionButton,
                      styles.settingsSecondaryButton,
                      styles.faceSettingsActionButton,
                      { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                      (faceSettingsBusy || !enrolledFaces.length) && styles.faceSettingsActionButtonDisabled,
                    ]}
                    onPress={handleClearEnrolledFaces}
                    activeOpacity={0.85}
                    disabled={faceSettingsBusy || !enrolledFaces.length}
                  >
                    <Text style={[styles.settingsActionButtonText, styles.settingsSecondaryButtonText, { color: theme.textPrimary }]}>
                      Clear All
                    </Text>
                  </TouchableOpacity>
                </View>

                {enrolledFaces.length ? (
                  <View style={styles.faceSettingsList}>
                    {enrolledFaces.map(face => (
                      <View
                        key={face.id}
                        style={[
                          styles.faceSettingsCard,
                          { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                      >
                        <Image
                          source={{ uri: face.uri }}
                          style={[styles.faceSettingsImage, { backgroundColor: theme.surfaceAlt }]}
                        />
                        <View style={styles.faceSettingsCardBody}>
                          <Text style={[styles.faceSettingsCardTitle, { color: theme.textPrimary }]}>
                            {face.label}
                          </Text>
                          <Text style={[styles.faceSettingsCardText, { color: theme.textSecondary }]}>
                            Added {new Date(face.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.faceSettingsRemoveButton,
                            { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                            faceSettingsBusy && styles.faceSettingsActionButtonDisabled,
                          ]}
                          onPress={() => handleRemoveEnrolledFace(face.id)}
                          activeOpacity={0.85}
                          disabled={faceSettingsBusy}
                        >
                          <Text style={[styles.faceSettingsRemoveButtonText, { color: theme.accent }]}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.faceSettingsEmptyState,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.faceSettingsEmptyTitle, { color: theme.textPrimary }]}>
                      No faces enrolled yet
                    </Text>
                    <Text style={[styles.faceSettingsEmptyText, { color: theme.textSecondary }]}>
                      Enter a person name, then tap Add Face Recognition and capture each approved person one by one until all {MAX_ENROLLED_FACES} slots are filled.
                    </Text>
                  </View>
                )}
              </>
            ) : null}

            {settingsView === 'disputes' ? (
              <DisputeRecordsPanel
                disputes={disputeRecords}
                selectedDay={selectedDay}
                categoryOptions={settingsCategoryOptions}
                loading={disputesLoading}
                onRefresh={refreshDisputes}
                onEdit={handleDisputeEdit}
                theme={theme}
              />
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
                    autoCorrect={false}
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
                    ref={newPasswordInputRef}
                    value={newPasswordInput}
                    onChangeText={value => {
                      setNewPasswordInput(value);
                      if (changePasswordError) {
                        setChangePasswordError('');
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
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
                    ref={confirmPasswordInputRef}
                    value={confirmPasswordInput}
                    onChangeText={value => {
                      setConfirmPasswordInput(value);
                      if (changePasswordError) {
                        setChangePasswordError('');
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
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

      <Modal
        visible={themeVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setThemeVisible(false)}
      >
        <View style={[styles.fullPageContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.settingsPageHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <View style={styles.settingsPageHeaderLeft}>
              <Text style={[styles.settingsPageTitle, { color: theme.textPrimary }]}>Theme</Text>
              <Text style={[styles.settingsPageSubtitle, { color: theme.textSecondary }]}>
                Choose between a brighter day theme and the darker night theme.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.settingsCloseButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              onPress={() => setThemeVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.settingsCloseButtonText, { color: theme.accent }]}>Back</Text>
            </TouchableOpacity>
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

      <Modal
        visible={faceScannerVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => closeFaceScanner(null)}
      >
        <View style={styles.faceScannerScreen}>
          {VisionCameraView && visionCameraDevice ? (
            <VisionCameraView
              ref={faceScannerCameraRef}
              style={StyleSheet.absoluteFill}
              device={visionCameraDevice}
              isActive={faceScannerVisible}
              photo
            />
          ) : (
            <View style={styles.faceScannerUnavailableState}>
              <Text style={styles.faceScannerUnavailableTitle}>Face Scanner Unavailable</Text>
              <Text style={styles.faceScannerUnavailableText}>{VISION_CAMERA_ERROR_MESSAGE}</Text>
            </View>
          )}

          <View style={styles.faceScannerOverlay}>
            <TouchableOpacity
              style={styles.faceScannerCloseButton}
              onPress={() => closeFaceScanner(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.faceScannerCloseButtonText}>Close</Text>
            </TouchableOpacity>

            <View style={styles.faceScannerContent}>
              <Text style={styles.faceScannerTitle}>Face Lock</Text>
              <Text style={styles.faceScannerSubtitle}>
                Align your face inside the frame to {faceScannerPurpose}.
              </Text>

              <View style={styles.faceScannerFrame}>
                <View style={styles.faceScannerFrameInner} />
                <Text style={styles.faceScannerFrameLabel}>Hold steady and look straight ahead</Text>
              </View>

              {faceScannerError ? (
                <Text style={styles.faceScannerErrorText}>{faceScannerError}</Text>
              ) : null}

              <View style={styles.faceScannerActionRow}>
                <TouchableOpacity
                  style={[styles.faceScannerActionButton, styles.faceScannerActionButtonSecondary]}
                  onPress={() => closeFaceScanner(null)}
                  activeOpacity={0.85}
                  disabled={faceScannerBusy}
                >
                  <Text style={styles.faceScannerActionButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.faceScannerActionButton,
                    styles.faceScannerActionButtonPrimary,
                    faceScannerBusy && styles.faceScannerActionButtonDisabled,
                  ]}
                  onPress={handleFaceScannerCapture}
                  activeOpacity={0.85}
                  disabled={faceScannerBusy || !VisionCameraView || !visionCameraDevice}
                >
                  {faceScannerBusy ? (
                    <ActivityIndicator color="#18120a" />
                  ) : (
                    <Text style={styles.faceScannerActionButtonPrimaryText}>Scan Face</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Registration Form Modal */}
      <RegistrationForm
        visible={formVisible}
        category={selectedCategory}
        initialRecord={selectedRecord}
        selectedDay={selectedDay}
        onClose={() => {
          setFormVisible(false);
          setSelectedRecord(null);
          setActiveRecordKey('');
          if (selectedRecord?.source === 'dispute') {
            setRecordsVisible(false);
            setSettingsVisible(true);
            setSettingsView('disputes');
          } else {
            setRecordsVisible(true);
          }
        }}
        onSubmit={handleFormSubmit}
        onHoldForDispute={holdRecordForDispute}
        onVerifyFace={handleVerifyFaceForRecord}
        enrolledFaceCount={enrolledFaces.length}
        theme={theme}
      />
    </View>
  );
}

/**
 * Styles
 * All styles defined using StyleSheet for optimal performance
 */
const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#080b10',
  },

  splashScreen: {
    flex: 1,
    backgroundColor: '#040405',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  splashLogoGround: {
    width: 288,
    height: 288,
    borderRadius: 144,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderWidth: 2,
    borderColor: '#d4a441',
    shadowColor: '#f1b94d',
    shadowOpacity: 0.5,
    shadowRadius: 46,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
    marginBottom: 22,
    overflow: 'hidden',
  },

  splashLogoSideGlowLeft: {
    position: 'absolute',
    left: -34,
    width: 118,
    height: 204,
    borderRadius: 59,
    backgroundColor: 'rgba(255, 196, 64, 0.32)',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 234, 170, 0.42)',
    transform: [{ rotate: '-18deg' }],
    shadowColor: '#ffd36b',
    shadowOpacity: 0.82,
    shadowRadius: 36,
    shadowOffset: { width: -8, height: 0 },
    elevation: 12,
  },

  splashLogoSideGlowRight: {
    position: 'absolute',
    right: -34,
    width: 118,
    height: 204,
    borderRadius: 59,
    backgroundColor: 'rgba(255, 204, 82, 0.32)',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 236, 176, 0.42)',
    transform: [{ rotate: '18deg' }],
    shadowColor: '#ffd778',
    shadowOpacity: 0.82,
    shadowRadius: 36,
    shadowOffset: { width: 8, height: 0 },
    elevation: 12,
  },

  splashLogoAmberGlow: {
    position: 'absolute',
    width: 244,
    height: 244,
    borderRadius: 122,
    backgroundColor: 'rgba(255, 193, 62, 0.38)',
    borderWidth: 1.8,
    borderColor: 'rgba(255, 232, 158, 0.52)',
    shadowColor: '#ffd05c',
    shadowOpacity: 1,
    shadowRadius: 52,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },

  dayLogoAmberGlow: {
    opacity: 0.82,
    transform: [{ scale: 1.02 }],
  },

  splashLogo: {
    width: 272,
    height: 272,
  },

  splashTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff6ea',
    letterSpacing: 0.3,
    fontFamily: 'monospace',
  },

  splashSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#ffbe7a',
    letterSpacing: 0.5,
    fontFamily: BODY_FONT,
  },

  splashSwitchRow: {
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ignitionButtonHitbox: {
    width: 260,
    height: 228,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ignitionPanel: {
    position: 'absolute',
    top: 4,
    alignItems: 'center',
  },

  ignitionPanelLabel: {
    fontSize: 15,
    color: '#ffd59a',
    fontWeight: '800',
    letterSpacing: 2.4,
    fontFamily: TITLE_FONT,
  },

  ignitionButton: {
    width: 178,
    height: 178,
    borderRadius: 89,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e251d',
    borderWidth: 2,
    borderColor: '#8e6a36',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 10, height: 12 },
    elevation: 10,
    marginTop: 34,
  },

  ignitionButtonOuterRing: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    borderColor: '#4f3e2a',
    backgroundColor: '#3a3026',
  },

  ignitionButtonInnerRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: '#6f5735',
    backgroundColor: '#4a3d2d',
    shadowColor: '#ffd7a0',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  ignitionButtonCore: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#1f1a15',
    borderWidth: 1.5,
    borderColor: '#7c6037',
  },

  ignitionAccentRingOuter: {
    position: 'absolute',
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 2,
    borderColor: '#ffbf63',
    opacity: 0.62,
  },

  ignitionAccentRingInner: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    borderColor: '#ffbf63',
    opacity: 0.62,
  },

  ignitionDialMarkers: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },

  ignitionDialMark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffba58',
    shadowColor: '#ffad33',
    shadowOpacity: 0.75,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  ignitionDialMarkOff: {
    left: 26,
    top: 51,
  },

  ignitionDialMarkAcc: {
    left: 65,
    top: 20,
  },

  ignitionDialMarkOn: {
    left: 119,
    top: 26,
  },

  ignitionDialMarkStart: {
    left: 153,
    top: 85,
  },

  ignitionDialText: {
    position: 'absolute',
    width: 44,
    color: '#ffbf63',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.35,
    fontFamily: BODY_FONT,
    textShadowColor: 'rgba(255, 168, 44, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
    textAlign: 'center',
  },

  ignitionDialOffText: {
    left: 4,
    top: 40,
  },

  ignitionDialAccText: {
    left: 48,
    top: 4,
  },

  ignitionDialOnText: {
    left: 103,
    top: 14,
  },

  ignitionDialStartText: {
    left: 128,
    top: 74,
  },

  ignitionButtonCenter: {
    position: 'absolute',
    width: 150,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    top: 72,
  },

  keyShadow: {
    position: 'absolute',
    width: 154,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 18, height: 12 },
  },

  keyHandle: {
    position: 'absolute',
    width: 150,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#3b2a16',
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  keyHandleGloss: {
    position: 'absolute',
    top: 2,
    left: 10,
    right: 10,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 198, 112, 0.2)',
  },

  keyHub: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#171412',
    borderWidth: 1,
    borderColor: '#8f6937',
  },

  dayScreen: {
    flex: 1,
    backgroundColor: '#080b10',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 28,
  },

  dayScreenHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },

  dayEventTitleShell: {
    marginTop: 14,
    width: '96%',
    maxWidth: 560,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1.4,
    borderColor: 'rgba(255, 149, 44, 0.95)',
    backgroundColor: '#100302',
    shadowColor: '#ff7a18',
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
    overflow: 'visible',
  },

  dayEventTitleStack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  dayEventTitle: {
    width: '100%',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
    fontFamily: TITLE_FONT,
    color: '#ffffff',
  },

  dayScreenLogo: {
    width: 96,
    height: 96,
  },

  dayLogoRing: {
    width: 122,
    height: 122,
    borderRadius: 61,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1c1c1c',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  dayScreenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  dayScreenSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },

  dayList: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 12,
  },

  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111722',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 92,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  dayCardTextBlock: {
    flex: 1,
    paddingRight: 14,
  },

  dayCardLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  dayCardDate: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },

  // Top Header styles
  topHeader: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: '#0b111a',
  },

  topHeaderRow: {
    width: '100%',
  },

  topHeaderInfoBlock: {
    width: '100%',
  },

  exploreTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff6ea',
    fontFamily: 'monospace',
  },

  selectedDayLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffb15a',
    letterSpacing: 0.3,
    fontFamily: BODY_FONT,
    flex: 1,
  },

  selectedDayRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  topHeaderButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 2,
  },

  backHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },

  backHeaderButtonIcon: {
    fontSize: 20,
    lineHeight: 20,
    color: '#ffb15a',
    fontWeight: '900',
    marginTop: -1,
    fontFamily: BODY_FONT,
  },

  reportDotsButton: {
    width: 60,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reportDotsText: {
    fontSize: 26,
    lineHeight: 26,
    marginTop: -2,
    color: '#ffb15a',
  },

  menuBars: {
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuBar: {
    width: 22,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: '#ffb15a',
  },

  topHeaderButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
  },

  // Search Bar styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
    backgroundColor: '#111722',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3441',
  },

  searchIcon: {
    fontSize: 16,
    marginRight: 10,
    color: '#ffb15a',
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#fff6ea',
    padding: 0,
    fontFamily: BODY_FONT,
  },

  // Section Header styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    position: 'relative',
  },

  sectionHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },

  sectionHeaderActions: {
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: HEADING_FONT,
  },

  reportMenuContainer: {
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    zIndex: 30,
  },

  reportMenuDropdown: {
    position: 'absolute',
    bottom: 72,
    right: 0,
    minWidth: 150,
    backgroundColor: '#111722',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3441',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
    zIndex: 20,
  },

  reportMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#111722',
  },

  reportMenuItemText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },

  viewAll: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },

  // List content styles
  listContent: {
    paddingHorizontal: 6,
    paddingBottom: 20,
  },

  columnWrapper: {
    justifyContent: 'space-between',
    marginHorizontal: IS_TABLET ? 14 : 10,
    marginBottom: IS_TABLET ? 16 : 12,
  },

  // Card styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#111722',
    borderWidth: 1.5,
    borderColor: '#cfdcf0',
    minHeight: IS_TABLET ? 210 : 180,
    borderRadius: 22,
    paddingHorizontal: IS_TABLET ? 16 : 12,
    paddingVertical: IS_TABLET ? 18 : 14,
    elevation: 5, // Android shadow
    shadowColor: '#1f3b73', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },

  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Icon box with color
  iconBox: {
    width: IS_TABLET ? 64 : 56,
    height: IS_TABLET ? 64 : 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  // Category icon
  categoryIcon: {
    fontSize: IS_TABLET ? 34 : 30,
  },

  categoryImageIcon: {
    width: '92%',
    height: '92%',
  },

  // Text content container
  textContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },

  // Category name
  categoryName: {
    fontSize: IS_TABLET ? 16 : 14,
    fontWeight: '700',
    color: '#fff6ea',
    marginBottom: 6,
    textAlign: 'center',
  },

  // Category description
  categoryDescription: {
    fontSize: IS_TABLET ? 12 : 11,
    color: '#999',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: IS_TABLET ? 18 : 16,
  },

  // Count badge
  countBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },

  countBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: IS_TABLET ? 68 : 60,
  },

  countBadgeSecondary: {
    backgroundColor: '#111722',
    borderWidth: 1,
  },

  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
  },

  countTextSecondary: {
    color: '#4263cf',
  },

  countLabel: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
    marginTop: 2,
  },

  countLabelSecondary: {
    color: '#4263cf',
  },

  recordsPageContainer: {
    flex: 1,
    backgroundColor: '#080b10',
    paddingHorizontal: IS_TABLET ? 24 : 16,
    paddingTop: 60,
    paddingBottom: IS_TABLET ? 28 : 20,
  },

  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  resultsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  resultsHeaderButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1a2432',
    borderWidth: 1,
    borderColor: '#2a3441',
  },

  resultsHeaderButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffb15a',
  },

  recordsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff6ea',
  },

  recordsSubtitle: {
    fontSize: 14,
    color: '#cdbf9a',
    marginTop: 4,
  },

  recordsListContent: {
    paddingBottom: IS_TABLET ? 36 : 24,
  },

  registrationCard: {
    backgroundColor: '#111722',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },

  registrationCardHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  registrationSrPill: {
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#1a2432',
    borderWidth: 1,
    borderColor: '#2a3441',
  },

  registrationSrLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },

  registrationSrValue: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: '#1f56c4',
    fontFamily: HEADING_FONT,
  },

  registrationTrackPill: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
  },

  registrationTrackLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },

  registrationTrackValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  registrationInfoGrid: {
    gap: 10,
    marginBottom: 12,
  },

  registrationInfoCell: {
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  registrationInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: BODY_FONT,
  },

  registrationInfoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff6ea',
    fontFamily: BODY_FONT,
  },

  disputedStatusText: {
    color: '#ffb15a',
  },

  registrationSection: {
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },

  registrationSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: BODY_FONT,
  },

  registrationSectionText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#e8f0ff',
    marginTop: 2,
    fontFamily: BODY_FONT,
  },

  disputeInfoCard: {
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  disputeInfoRow: {
    marginTop: 6,
  },

  disputeInfoLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffb15a',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },

  disputeInfoValue: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: '#fff6ea',
    fontFamily: BODY_FONT,
  },

  registrationFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  registrationFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffb15a',
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: BODY_FONT,
  },

  trackCardsScreen: {
    flex: 1,
    paddingTop: 8,
  },

  trackCardsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff6ea',
    marginBottom: 16,
  },

  trackCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  trackCategoryCard: {
    width: IS_TABLET ? '31.8%' : '48%',
    minHeight: 110,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },

  trackCategoryCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  trackCategoryCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff6ea',
    lineHeight: 24,
  },

  trackCardsBackButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
  },

  trackCardsBackButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffb15a',
  },

  trackBackButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
  },

  trackBackButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
  },

  recordCard: {
    backgroundColor: '#111722',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a3441',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  recordCardDisabled: {
    opacity: 0.72,
  },

  recordCardLocked: {
    backgroundColor: '#0f1520',
    borderColor: '#2a3441',
  },

  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingHorizontal: IS_TABLET ? 22 : 18,
    paddingVertical: IS_TABLET ? 24 : 20,
    gap: 14,
  },

  recordHeaderMain: {
    flex: 1,
  },

  recordInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  recordInfoCard: {
    backgroundColor: '#0f1520',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    minHeight: 76,
  },

  recordInfoCardCompact: {
    width: IS_TABLET ? 92 : 78,
  },

  recordInfoCardMedium: {
    width: IS_TABLET ? 170 : 148,
  },

  recordInfoCardWide: {
    flex: 1,
    minWidth: IS_TABLET ? 240 : 180,
  },

  recordActionPanel: {
    justifyContent: 'center',
    alignItems: 'stretch',
    width: IS_TABLET ? 150 : 124,
  },

  recordMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  recordMetaValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff6ea',
  },

  recordStickerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#cdbf9a',
  },

  recordDriverName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff6ea',
    lineHeight: 24,
  },

  startButton: {
    backgroundColor: '#27ae60',
    borderRadius: 14,
    paddingHorizontal: IS_TABLET ? 24 : 20,
    paddingVertical: 16,
    minWidth: IS_TABLET ? 128 : 110,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
    shadowColor: '#1c8c4d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },

  startButtonDisabled: {
    backgroundColor: '#b8c2cc',
  },

  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  recordDivider: {
    height: 1,
    backgroundColor: '#ecf0f1',
  },

  recordSectionCard: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 16,
  },

  recordSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  recordTracksLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  recordSectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffb15a',
    flexShrink: 1,
    marginLeft: 12,
  },

  trackChipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },

  trackChip: {
    backgroundColor: '#e8f3fc',
    borderWidth: 1,
    borderColor: '#c6e1f7',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 42,
    justifyContent: 'center',
  },

  trackChipSelected: {
    backgroundColor: '#ff8a1f',
    borderColor: '#1f56c4',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },

  trackChipCompleted: {
    backgroundColor: '#ccefd7',
    borderColor: '#60b77e',
  },

  trackChipDisabled: {
    opacity: 0.45,
  },

  trackChipText: {
    fontSize: 14,
    color: '#2c7dbf',
    fontWeight: '600',
    flexShrink: 1,
  },

  trackChipTextSelected: {
    color: '#fff6ea',
    fontWeight: '800',
  },

  trackChipTextCompleted: {
    color: '#257245',
  },

  recordLateStartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  lateStartCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },

  lateStartCheckboxRowDisabled: {
    opacity: 0.55,
  },

  lateStartCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#f5c542',
    backgroundColor: '#111722',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  lateStartCheckboxChecked: {
    backgroundColor: '#f5c542',
    borderColor: '#d09a00',
  },

  lateStartCheckboxTick: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff6ea',
  },

  lateStartCheckboxLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8a5a00',
  },

  dnsButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f4a4a4',
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 12,
  },

  dnsButtonDisabled: {
    opacity: 0.55,
  },

  dnsButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b0333d',
  },

  recordLateStartControl: {
    flex: 1,
    minWidth: 0,
  },

  lateStartSelectorContainer: {
    width: '100%',
  },

  lateStartSelectorDisabled: {
    opacity: 0.55,
  },

  lateStartSelectorButton: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f5c542',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  lateStartSelectorButtonActive: {
    backgroundColor: '#f5c542',
    borderColor: '#d09a00',
  },

  lateStartSelectorButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#8a5a00',
  },

  lateStartSelectorButtonTextActive: {
    color: '#fff6ea',
  },

  lateStartSelectorArrow: {
    fontSize: 13,
    color: '#8a5a00',
    marginLeft: 10,
  },

  lateStartSelectorMenu: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f5d77d',
    backgroundColor: '#111722',
  },

  lateStartSelectorItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f6e7b4',
  },

  lateStartSelectorItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  lateStartSelectorItemTextSelected: {
    color: '#b7791f',
  },

  lateStartSelectorClearItem: {
    borderBottomWidth: 0,
    backgroundColor: '#fffaf0',
  },

  lateStartSelectorClearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8a5a00',
  },

  emptyStateCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff6ea',
    marginBottom: 8,
    fontFamily: HEADING_FONT,
  },

  emptyStateText: {
    fontSize: 14,
    color: '#cdbf9a',
    textAlign: 'center',
    fontFamily: BODY_FONT,
  },

  // Stopwatch styles
  timerHeroCard: {
    backgroundColor: '#161f36',
    borderRadius: 24,
    paddingHorizontal: IS_TABLET ? 28 : IS_SMALL_PHONE ? 12 : 18,
    paddingVertical: IS_TABLET ? 30 : IS_SMALL_PHONE ? 16 : 22,
    marginBottom: IS_SMALL_PHONE ? 14 : 24,
    alignItems: 'center',
  },

  stopwatchDisplay: {
    fontSize: IS_TABLET ? 70 : IS_SMALL_PHONE ? 38 : 48,
    fontWeight: '300',
    color: '#66a5ff',
    letterSpacing: IS_TABLET ? 6 : IS_SMALL_PHONE ? 1 : 2,
    fontVariant: ['tabular-nums'],
    marginBottom: IS_SMALL_PHONE ? 12 : 20,
    fontFamily: HEADING_FONT,
  },

  stopwatchButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 0,
    gap: IS_SMALL_PHONE ? 8 : 12,
    flexWrap: 'wrap',
  },

  stopwatchButton: {
    paddingVertical: IS_SMALL_PHONE ? 12 : 16,
    paddingHorizontal: IS_SMALL_PHONE ? 14 : 24,
    borderRadius: 14,
    minWidth: IS_TABLET ? 220 : IS_SMALL_PHONE ? 136 : 180,
    flexGrow: 1,
    alignItems: 'center',
  },

  stopwatchButtonStart: {
    backgroundColor: '#25c05a',
  },

  stopwatchButtonStop: {
    backgroundColor: '#e74c3c',
  },

  stopwatchResetButton: {
    backgroundColor: '#4f6d8a',
  },

  stopwatchButtonDisabled: {
    backgroundColor: '#b8c2cc',
  },

  stopwatchResetCompact: {
    minWidth: IS_TABLET ? 110 : IS_SMALL_PHONE ? 82 : 96,
    flexGrow: 0,
  },

  stopwatchButtonText: {
    color: '#fff6ea',
    fontSize: IS_SMALL_PHONE ? 12 : 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#111722',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },

  // Full page modal styles
  fullPageContainer: {
    flex: 1,
    backgroundColor: '#1a2432',
  },

  fullPageContent: {
    flex: 1,
    backgroundColor: '#1a2432',
  },

  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  settingsPasswordCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#111722',
    padding: 20,
  },

  settingsPasswordTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  settingsPasswordSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },

  settingsPasswordActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  settingsInput: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#0c111a',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#fff6ea',
    fontSize: 14,
    fontFamily: BODY_FONT,
  },

  settingsPasswordInputRow: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#0c111a',
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingsPasswordTextInput: {
    flex: 1,
    color: '#fff6ea',
    fontSize: 14,
    fontFamily: BODY_FONT,
    paddingVertical: 14,
    paddingRight: 12,
  },

  settingsPasswordToggle: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingsPasswordToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
  },

  settingsInputError: {
    borderColor: '#d13f49',
  },

  settingsPasswordErrorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#ff8f96',
    fontFamily: BODY_FONT,
  },

  settingsActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },

  settingsPrimaryButton: {
    backgroundColor: '#ffb15a',
  },

  settingsSecondaryButton: {
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#182131',
  },

  settingsActionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18120a',
    fontFamily: BODY_FONT,
  },

  disputeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },

  disputeModalCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    maxHeight: '88%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#111722',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },

  disputeModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  disputeModalSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },

  disputeModalScroll: {
    marginTop: 14,
  },

  disputeModalContent: {
    paddingBottom: 10,
  },

  disputeModalSection: {
    marginBottom: 16,
  },

  disputeModalSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffb15a',
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: BODY_FONT,
  },

  disputeModalOptionBlock: {
    marginBottom: 12,
  },

  disputeModalOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  disputeModalOptionLabel: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff6ea',
    fontFamily: BODY_FONT,
    flex: 1,
  },

  disputeCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#ffb15a',
    backgroundColor: '#0c111a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disputeCheckboxChecked: {
    backgroundColor: '#ffb15a',
    borderColor: '#ffb15a',
  },

  disputeCheckboxTick: {
    fontSize: 13,
    fontWeight: '900',
    color: '#18120a',
    fontFamily: BODY_FONT,
  },

  disputeModalInput: {
    marginTop: 10,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#0c111a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff6ea',
    fontSize: 14,
    textAlignVertical: 'top',
    fontFamily: BODY_FONT,
  },

  disputeModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  disputeModalActionButton: {
    marginTop: 0,
  },

  settingsSecondaryButtonText: {
    color: '#fff6ea',
  },

  settingsPageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3441',
    backgroundColor: '#111722',
  },

  settingsPageHeaderLeft: {
    flex: 1,
    paddingRight: 14,
  },

  settingsPageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  settingsPageSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },

  settingsCloseButton: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#182131',
    borderWidth: 1,
    borderColor: '#2a3441',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingsCloseButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
  },

  settingsPageContent: {
    padding: 20,
    paddingBottom: 36,
  },

  settingsMenuGrid: {
    gap: 14,
  },

  settingsMenuCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#111722',
    padding: 18,
  },

  settingsMenuCardEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffb15a',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },

  settingsMenuCardTitle: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '900',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  settingsMenuCardText: {
    marginTop: 8,
    fontSize: 14,
    color: '#cdbf9a',
    lineHeight: 20,
    fontFamily: BODY_FONT,
  },

  faceScannerScreen: {
    flex: 1,
    backgroundColor: '#050505',
  },

  faceScannerUnavailableState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#050505',
  },

  faceScannerUnavailableTitle: {
    fontSize: 24,
    fontFamily: TITLE_FONT,
    color: '#fff6ea',
    marginBottom: 12,
    textAlign: 'center',
  },

  faceScannerUnavailableText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: BODY_FONT,
    color: '#cdbf9a',
    textAlign: 'center',
  },

  faceScannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.28)',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },

  faceScannerCloseButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 17, 26, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },

  faceScannerCloseButtonText: {
    color: '#fff6ea',
    fontSize: 14,
    fontFamily: BODY_FONT,
  },

  faceScannerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  faceScannerTitle: {
    fontSize: 30,
    fontFamily: TITLE_FONT,
    color: '#fff6ea',
    marginBottom: 8,
  },

  faceScannerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: BODY_FONT,
    color: '#f1d8b1',
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 26,
  },

  faceScannerFrame: {
    width: 260,
    height: 340,
    borderRadius: 132,
    borderWidth: 3,
    borderColor: '#ffb15a',
    backgroundColor: 'rgba(255, 177, 90, 0.08)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 28,
    shadowColor: '#ffb15a',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },

  faceScannerFrameInner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(255, 246, 234, 0.35)',
  },

  faceScannerFrameLabel: {
    fontSize: 13,
    fontFamily: BODY_FONT,
    color: '#fff6ea',
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  faceScannerErrorText: {
    marginTop: 18,
    fontSize: 14,
    fontFamily: BODY_FONT,
    color: '#ffd5c9',
    textAlign: 'center',
  },

  faceScannerActionRow: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    marginTop: 28,
  },

  faceScannerActionButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },

  faceScannerActionButtonPrimary: {
    backgroundColor: '#ffb15a',
    marginLeft: 10,
  },

  faceScannerActionButtonSecondary: {
    backgroundColor: 'rgba(12, 17, 26, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginRight: 10,
  },

  faceScannerActionButtonDisabled: {
    opacity: 0.55,
  },

  faceScannerActionButtonPrimaryText: {
    color: '#18120a',
    fontSize: 16,
    fontFamily: BODY_FONT,
  },

  faceScannerActionButtonSecondaryText: {
    color: '#fff6ea',
    fontSize: 16,
    fontFamily: BODY_FONT,
  },

  settingsInfoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#6b4d20',
    backgroundColor: '#1f1710',
    padding: 18,
    marginBottom: 18,
  },

  settingsInfoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffd39a',
    fontFamily: HEADING_FONT,
  },

  settingsInfoText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#f2d5a6',
    fontFamily: BODY_FONT,
  },

  settingsSection: {
    marginBottom: 22,
  },

  settingsSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  settingsSectionHint: {
    marginTop: 6,
    fontSize: 13,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },

  settingsChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },

  settingsChip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#111722',
  },

  settingsChipSelected: {
    backgroundColor: '#ffb15a',
    borderColor: '#ffb15a',
  },

  settingsChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: BODY_FONT,
  },

  settingsChipTextSelected: {
    color: '#18120a',
  },

  settingsTrackList: {
    marginTop: 14,
    gap: 12,
  },

  settingsTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#111722',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },

  settingsTrackInfo: {
    flex: 1,
  },

  settingsTrackNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingsTrackMarker: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 10,
  },

  settingsTrackMarkerActive: {
    backgroundColor: '#25c05a',
    shadowColor: '#25c05a',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  settingsTrackMarkerInactive: {
    backgroundColor: '#d13f49',
    shadowColor: '#d13f49',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  settingsTrackName: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },

  settingsTrackNameActive: {
    color: '#7df0a2',
  },

  settingsTrackNameInactive: {
    color: '#ff848c',
  },

  settingsTrackStatus: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: BODY_FONT,
  },

  settingsTrackStatusActive: {
    color: '#9be5b2',
  },

  settingsTrackStatusInactive: {
    color: '#ff9da4',
  },

  settingsToggleButton: {
    minWidth: 120,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#0d131d',
  },

  settingsToggleButtonLabel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BODY_FONT,
    marginBottom: 6,
  },

  settingsToggleButtonLabelActivated: {
    color: '#7df0a2',
  },

  settingsToggleButtonLabelDeactivated: {
    color: '#ff8f96',
  },

  settingsToggleSwitch: {
    width: 70,
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'center',
    flexDirection: 'row',
  },

  settingsToggleSwitchActivated: {
    justifyContent: 'flex-end',
    backgroundColor: '#25c05a',
  },

  settingsToggleSwitchDeactivated: {
    justifyContent: 'flex-start',
    backgroundColor: '#b0333d',
  },

  settingsToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    color: '#fff6ea',
    backgroundColor: '#fff6ea',
  },

  settingsToggleKnobActivated: {
    shadowColor: '#167739',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  settingsToggleKnobDeactivated: {
    shadowColor: '#6c1d25',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  settingsFormCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#111722',
    padding: 18,
  },

  settingsFormSaveButton: {
    marginTop: 18,
  },

  faceVerificationNotice: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },

  faceVerificationNoticeTitle: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },

  faceVerificationNoticeText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: BODY_FONT,
  },

  faceSettingsSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 18,
  },

  faceSettingsSummaryTitle: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },

  faceSettingsSummaryRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  faceSettingsCount: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },

  faceSettingsSummaryText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: BODY_FONT,
  },

  faceSettingsActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },

  faceSettingsActionButton: {
    marginTop: 0,
  },

  faceSettingsActionButtonDisabled: {
    opacity: 0.5,
  },

  faceSettingsList: {
    gap: 12,
  },

  faceSettingsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  faceSettingsImage: {
    width: 78,
    height: 78,
    borderRadius: 14,
  },

  faceSettingsCardBody: {
    flex: 1,
  },

  faceSettingsCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },

  faceSettingsCardText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: BODY_FONT,
  },

  faceSettingsRemoveButton: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  faceSettingsRemoveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: BODY_FONT,
  },

  faceSettingsEmptyState: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },

  faceSettingsEmptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },

  faceSettingsEmptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: BODY_FONT,
  },

  // Form header
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IS_TABLET ? 28 : 20,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#1a2432',
  },

  formTitle: {
    fontSize: IS_TABLET ? 24 : 20,
    fontWeight: '700',
    color: '#224b9b',
    flex: 1,
  },

  closeButton: {
    fontSize: 28,
    color: '#6c757d',
    fontWeight: '300',
  },

  formBody: {
    flex: 1,
    paddingHorizontal: IS_TABLET ? 20 : IS_SMALL_PHONE ? 8 : 12,
    paddingBottom: 12,
    minHeight: 0,
  },

  formBodyScroll: {
    flex: 1,
    minHeight: 0,
  },

  formBodyScrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },

  dashboardLayout: {
    flex: 1,
    flexDirection: USE_SPLIT_LAYOUT ? 'row' : 'column',
    gap: IS_SMALL_PHONE ? 8 : 12,
    alignItems: 'stretch',
    minHeight: 0,
  },

  dashboardLeftPanel: {
    width: USE_SPLIT_LAYOUT ? '37%' : '100%',
    flexShrink: 0,
  },

  dashboardRightPanel: {
    flex: 1,
    width: USE_SPLIT_LAYOUT ? '61%' : '100%',
    backgroundColor: '#111722',
    borderRadius: 24,
    padding: IS_TABLET ? 18 : IS_SMALL_PHONE ? 8 : 12,
    borderWidth: 1,
    borderColor: '#e5edf8',
    minHeight: 0,
  },

  dashboardRightPanelContent: {
    paddingBottom: 8,
  },

  dashboardRightPanelContentLandscape: {
    paddingBottom: 24,
  },

  detailsAccordion: {
    backgroundColor: '#111722',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dfe7f4',
  },

  detailsAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IS_SMALL_PHONE ? 10 : 14,
    paddingVertical: IS_SMALL_PHONE ? 8 : 10,
    backgroundColor: '#111722',
  },

  detailsTrackPill: {
    backgroundColor: '#3565df',
    borderRadius: 999,
    paddingHorizontal: IS_SMALL_PHONE ? 14 : 18,
    paddingVertical: IS_SMALL_PHONE ? 6 : 8,
  },

  detailsTrackPillText: {
    fontSize: IS_SMALL_PHONE ? 12 : 13,
    fontWeight: '800',
    color: '#fff6ea',
  },

  detailsAccordionTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  detailsAccordionTriggerText: {
    fontSize: IS_SMALL_PHONE ? 13 : 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 6,
  },

  detailsAccordionTriggerIcon: {
    fontSize: 14,
    color: '#111827',
  },

  heroInfoCard: {
    backgroundColor: '#111722',
    paddingHorizontal: IS_TABLET ? 18 : IS_SMALL_PHONE ? 10 : 14,
    paddingVertical: IS_TABLET ? 12 : IS_SMALL_PHONE ? 8 : 10,
    borderTopWidth: 1,
    borderTopColor: '#edf2fb',
  },

  heroMetaText: {
    fontSize: IS_TABLET ? 16 : IS_SMALL_PHONE ? 12 : 14,
    color: '#cdbf9a',
    marginBottom: 4,
  },

  heroSecondaryMetaText: {
    fontSize: IS_TABLET ? 14 : IS_SMALL_PHONE ? 12 : 13,
    color: '#cdbf9a',
  },

  heroMetaStrong: {
    color: '#1f2740',
    fontWeight: '700',
  },

  // Form section
  section: {
    marginBottom: IS_SMALL_PHONE ? 10 : 14,
  },

  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  sectionTitle: {
    fontSize: IS_TABLET ? 18 : IS_SMALL_PHONE ? 14 : 15,
    fontWeight: '800',
    color: '#63799a',
    flex: 1,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#e5edf8',
    paddingBottom: 8,
    marginBottom: IS_SMALL_PHONE ? 8 : 10,
  },

  editIcon: {
    fontSize: 18,
  },

  // Form group
  formGroup: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 8,
  },

  // Text input
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff6ea',
    backgroundColor: '#111722',
  },

  disabledInput: {
    backgroundColor: '#f8f9fa',
    color: '#007bff',
    fontWeight: '600',
  },

  // Dropdown styles
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: MIN_TOUCH_TARGET,
    backgroundColor: '#111722',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  dropdownButtonText: {
    fontSize: 14,
    color: '#fff6ea',
    fontWeight: '500',
  },

  dropdownArrow: {
    fontSize: 12,
    color: '#6c757d',
  },

  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#111722',
    overflow: 'hidden',
  },

  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  dropdownItemText: {
    fontSize: 14,
    color: '#495057',
  },

  dropdownItemSelected: {
    color: '#007bff',
    fontWeight: '600',
  },

  submitPanel: {
    marginTop: 4,
  },

  submitActionBar: {
    paddingHorizontal: IS_TABLET ? 20 : IS_SMALL_PHONE ? 8 : 12,
    paddingTop: 6,
    paddingBottom: 35,
    flexShrink: 0,
    backgroundColor: '#1a2432',
  },

  submitActionButtonsRow: {
    width: '100%',
  },

  submitActionButtonsRowLandscape: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },

  submitActionButtonLandscape: {
    flex: 1,
    width: undefined,
  },

  disputeButton: {
    backgroundColor: '#b45d16',
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  tabletFooterPanel: {
    marginTop: 10,
    width: '37%',
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  confirmButton: {
    flex: 1,
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff6ea',
  },

  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff6ea',
  },

  submitButton: {
    backgroundColor: '#3565df',
    borderRadius: 16,
    paddingVertical: IS_SMALL_PHONE ? 12 : 14,
    alignItems: 'center',
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  submitButtonText: {
    fontSize: IS_SMALL_PHONE ? 14 : 15,
    fontWeight: '700',
    color: '#fff6ea',
  },

  submitButtonDisabled: {
    backgroundColor: '#b8c2cc',
  },

  disputeCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  disputeCardButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disputeCardSubmitButton: {
    flex: 1,
  },

  // Penalty Row Styles
  penaltyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: IS_SMALL_PHONE ? 8 : 10,
  },

  penaltyCard: {
    width: USE_TWO_COLUMN_PENALTIES ? '48.5%' : '100%',
    backgroundColor: '#fbfcff',
    borderWidth: 1,
    borderColor: '#dce6f4',
    borderRadius: 16,
    paddingHorizontal: IS_TABLET ? 12 : IS_SMALL_PHONE ? 8 : 10,
    paddingVertical: IS_TABLET ? 10 : IS_SMALL_PHONE ? 7 : 8,
    minHeight: IS_TABLET ? 88 : IS_SMALL_PHONE ? 74 : 82,
  },

  penaltyCardLabel: {
    fontSize: IS_TABLET ? 14 : IS_SMALL_PHONE ? 11 : 12,
    fontWeight: '700',
    color: '#4c5c77',
    marginBottom: IS_SMALL_PHONE ? 6 : 8,
  },

  penaltyCardControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  counterButton: {
    width: IS_TABLET ? 54 : MIN_TOUCH_TARGET,
    height: IS_TABLET ? 54 : MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#3565df',
  },

  counterButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },

  counterButtonText: {
    fontSize: IS_TABLET ? 20 : IS_SMALL_PHONE ? 16 : 18,
    fontWeight: '700',
    color: '#fff6ea',
  },

  counterInput: {
    width: IS_TABLET ? 60 : 54,
    height: IS_TABLET ? 54 : MIN_TOUCH_TARGET,
    textAlign: 'center',
    fontSize: IS_TABLET ? 22 : IS_SMALL_PHONE ? 15 : 16,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },

  penaltyValuePill: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: IS_TABLET ? 48 : IS_SMALL_PHONE ? 34 : 40,
    paddingHorizontal: IS_SMALL_PHONE ? 4 : 6,
    paddingVertical: 4,
    backgroundColor: '#dfeafd',
    borderRadius: 8,
  },

  penaltyValue: {
    fontSize: IS_SMALL_PHONE ? 11 : 12,
    fontWeight: '700',
    color: '#3565df',
  },

  dnfCard: {
    width: '100%',
    backgroundColor: '#fff7f3',
    borderWidth: 1,
    borderColor: '#ffd5c7',
    borderRadius: 16,
  },

  dnfCardDisabled: {
    opacity: 0.65,
  },

  dnfToggleButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#ffb599',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dnfToggleButtonActive: {
    backgroundColor: '#ff5a1f',
    borderColor: '#ff5a1f',
  },

  dnfToggleButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },

  dnfToggleButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#b23b13',
  },

  dnfToggleButtonTextActive: {
    color: '#fff6ea',
  },

  dnfToggleButtonArrow: {
    fontSize: 13,
    color: '#b23b13',
    marginLeft: 12,
  },

  dnfDropdownMenu: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ffd5c7',
    backgroundColor: '#111722',
  },

  dnfCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe4da',
  },

  dnfCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#ffb599',
    backgroundColor: '#111722',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  dnfCheckboxSelected: {
    backgroundColor: '#ff5a1f',
    borderColor: '#ff5a1f',
  },

  dnfCheckboxTick: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff6ea',
  },

  dnfCheckboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  dnfPointsSection: {
    paddingTop: 4,
  },

  dnfPointsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9a3412',
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },

  dnfDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ffe4da',
  },

  dnfDropdownItemDisabled: {
    backgroundColor: '#f9fafb',
  },

  dnfDropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  dnfDropdownItemTextSelected: {
    color: '#ff5a1f',
  },

  dnfDropdownItemTextDisabled: {
    color: '#9ca3af',
  },

  dnfClearButton: {
    borderBottomWidth: 0,
    backgroundColor: '#fff7f3',
  },

  dnfClearButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b23b13',
  },

  // Summary Section Styles
  summarySection: {
    marginBottom: IS_SMALL_PHONE ? 10 : 12,
    padding: IS_SMALL_PHONE ? 10 : 12,
    backgroundColor: '#fffdf2',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f2b619',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },

  summaryTitle: {
    fontSize: IS_TABLET ? 16 : IS_SMALL_PHONE ? 14 : 15,
    fontWeight: '700',
    color: '#9c4900',
    marginBottom: IS_SMALL_PHONE ? 8 : 10,
    textAlign: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: IS_SMALL_PHONE ? 6 : 8,
    paddingBottom: IS_SMALL_PHONE ? 6 : 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },

  summaryLabel: {
    fontSize: IS_SMALL_PHONE ? 13 : 14,
    fontWeight: '500',
    color: '#1f1f1f',
    flex: 1,
  },

  summaryValue: {
    fontSize: IS_SMALL_PHONE ? 13 : 14,
    fontWeight: '500',
    color: '#1f1f1f',
    marginLeft: 10,
  },

  summaryDivider: {
    height: 2,
    backgroundColor: '#ffc107',
    marginVertical: IS_SMALL_PHONE ? 6 : 8,
  },

  summaryRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: IS_SMALL_PHONE ? 8 : 10,
    paddingHorizontal: IS_SMALL_PHONE ? 10 : 12,
    backgroundColor: '#ff5a1f',
    borderRadius: 16,
    elevation: 3,
  },

  summaryLabelTotal: {
    fontSize: IS_TABLET ? 18 : IS_SMALL_PHONE ? 15 : 16,
    fontWeight: '800',
    color: '#fff6ea',
    flex: 1,
  },

  summaryValueTotal: {
    fontSize: IS_TABLET ? 26 : IS_SMALL_PHONE ? 20 : 22,
    fontWeight: '800',
    color: '#fff6ea',
    marginLeft: 10,
  },

  // Dropdown List Styles
  dropdownListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  dropdownListItem: {
    flex: 1,
    minWidth: '45%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    backgroundColor: '#111722',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dropdownListItemSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },

  disabledDropdownListItem: {
    backgroundColor: '#f8f9fa',
    opacity: 0.7,
  },

  dropdownListItemText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
    textAlign: 'center',
  },

  dropdownListItemTextSelected: {
    color: '#fff6ea',
    fontWeight: '600',
  },

  // Accordion Styles
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 8,
    marginBottom: 12,
  },

  accordionTitleContainer: {
    flex: 1,
    marginRight: 10,
  },

  accordionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007bff',
  },

  accordionArrow: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
    marginRight: 10,
  },

  accordionContent: {
    paddingBottom: 12,
    backgroundColor: '#111722',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
});
