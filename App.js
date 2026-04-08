import React, { useState, useEffect, useRef } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { initializeDatabase, seedDatabase } from './src/db/database';
import { TeamsService, CategoriesService, ResultsService } from './src/services/dataService';
import ReportScreen from './src/screens/ReportScreen';

const HEADING_FONT = Platform.select({
  ios: 'Biome',
  android: 'Biome',
  web: 'Biome',
  default: 'Biome',
});

const BODY_FONT = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  web: 'Arial',
  default: 'sans-serif',
});

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

// Get device dimensions for responsive design
const { width, height } = Dimensions.get('window');
const IS_TABLET = width >= 768;
const IS_SMALL_PHONE = width < 390;
const USE_SPLIT_LAYOUT = width >= 900;
const USE_TWO_COLUMN_PENALTIES = width >= 360;
const CARD_WIDTH = width >= 600 ? (width - 76) / 2 : (width - 44) / 2;

const getResponsiveLayout = (screenWidth, screenHeight) => {
  const shortestSide = Math.min(screenWidth, screenHeight);
  const isTablet = shortestSide >= 600;
  const isSmallPhone = screenWidth < 390;
  const isLandscape = screenWidth > screenHeight;
  const categoryColumns = screenWidth >= 1220 ? 4 : screenWidth >= 820 ? 3 : 2;
  const penaltyColumns = screenWidth >= 1180 ? 3 : screenWidth >= 520 ? 2 : 1;
  const useSplitLayout = screenWidth >= 960;
  const shellMaxWidth = isTablet ? Math.min(screenWidth - 32, 1180) : screenWidth;
  const shellPadding = isTablet ? 24 : isSmallPhone ? 12 : 16;
  const gridGap = isTablet ? 16 : 12;
  const usableWidth = Math.max(shellMaxWidth - shellPadding * 2, 0);
  const categoryCardWidth =
    usableWidth > 0
      ? (usableWidth - gridGap * (categoryColumns - 1)) / categoryColumns
      : screenWidth;

  return {
    screenWidth,
    screenHeight,
    isTablet,
    isSmallPhone,
    isLandscape,
    categoryColumns,
    penaltyColumns,
    useSplitLayout,
    shellMaxWidth,
    shellPadding,
    gridGap,
    categoryCardWidth,
  };
};

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
    background: '#fff9f2',
    border: '#ffbf78',
    iconBackground: '#ff9f43',
    badgeBackground: '#d87b24',
    secondaryBadgeBackground: '#ffe7ca',
    secondaryBadgeBorder: '#ffc27d',
    secondaryBadgeText: '#b06115',
    title: '#7f4800',
    description: '#9d6a2f',
  },
  DIESEL_EXPERT: {
    background: '#f5fbff',
    border: '#8ec4ff',
    iconBackground: '#0984e3',
    badgeBackground: '#0a65af',
    secondaryBadgeBackground: '#dff0ff',
    secondaryBadgeBorder: '#93c8f5',
    secondaryBadgeText: '#0a65af',
    title: '#0f4677',
    description: '#4a79a3',
  },
  PETROL_EXPERT: {
    background: '#f8f5ff',
    border: '#b59cff',
    iconBackground: '#7a5af8',
    badgeBackground: '#5c42c5',
    secondaryBadgeBackground: '#ebe4ff',
    secondaryBadgeBorder: '#c4b3ff',
    secondaryBadgeText: '#5c42c5',
    title: '#3b297b',
    description: '#6e5bab',
  },
  THAR_SUV: {
    background: '#f3fffb',
    border: '#77d9bb',
    iconBackground: '#00b894',
    badgeBackground: '#098a71',
    secondaryBadgeBackground: '#dff8f0',
    secondaryBadgeBorder: '#8dddc7',
    secondaryBadgeText: '#098a71',
    title: '#0f5d4d',
    description: '#4b8478',
  },
  JIMNY_SUV: {
    background: '#f4faff',
    border: '#90bef2',
    iconBackground: '#2d98ff',
    badgeBackground: '#216fc0',
    secondaryBadgeBackground: '#e0efff',
    secondaryBadgeBorder: '#97c4f5',
    secondaryBadgeText: '#216fc0',
    title: '#174974',
    description: '#4f78a1',
  },
  SUV_MODIFIED: {
    background: '#fffdf2',
    border: '#f0d278',
    iconBackground: '#e1a800',
    badgeBackground: '#b17c00',
    secondaryBadgeBackground: '#fff1c9',
    secondaryBadgeBorder: '#efcf6a',
    secondaryBadgeText: '#9a6b00',
    title: '#705100',
    description: '#94723b',
  },
  STOCK_NDMS: {
    background: '#f5faff',
    border: '#9bc5ef',
    iconBackground: '#74b9ff',
    badgeBackground: '#4d8fcc',
    secondaryBadgeBackground: '#e1f0ff',
    secondaryBadgeBorder: '#9fc8ef',
    secondaryBadgeText: '#3f80bc',
    title: '#24537f',
    description: '#5b7fa3',
  },
  LADIES: {
    background: '#fff6fb',
    border: '#ef9dc4',
    iconBackground: '#e86aa6',
    badgeBackground: '#bf4f83',
    secondaryBadgeBackground: '#ffdff0',
    secondaryBadgeBorder: '#ef9dc4',
    secondaryBadgeText: '#bf4f83',
    title: '#8a2854',
    description: '#aa5f83',
  },
  LADIES_CATEGORY: {
    background: '#fff6fb',
    border: '#ef9dc4',
    iconBackground: '#e86aa6',
    badgeBackground: '#bf4f83',
    secondaryBadgeBackground: '#ffdff0',
    secondaryBadgeBorder: '#ef9dc4',
    secondaryBadgeText: '#bf4f83',
    title: '#8a2854',
    description: '#aa5f83',
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
              width: responsiveLayout.isTablet ? 40 : responsiveLayout.isSmallPhone ? 32 : 36,
              height: responsiveLayout.isTablet ? 40 : responsiveLayout.isSmallPhone ? 32 : 36,
            },
          ]}
          onPress={handleDecrement}
          disabled={disabled}
          activeOpacity={0.8}
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
              width: responsiveLayout.isTablet ? 56 : responsiveLayout.isSmallPhone ? 36 : 42,
              height: responsiveLayout.isTablet ? 40 : responsiveLayout.isSmallPhone ? 32 : 36,
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
              width: responsiveLayout.isTablet ? 40 : responsiveLayout.isSmallPhone ? 32 : 36,
              height: responsiveLayout.isTablet ? 40 : responsiveLayout.isSmallPhone ? 32 : 36,
            },
          ]}
          onPress={handleIncrement}
          disabled={disabled}
          activeOpacity={0.8}
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
  onClose,
  onSubmit,
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

  useEffect(() => {
    let interval;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchTime(prevTime => prevTime + 10);
      }, 10);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning]);

  useEffect(() => {
    if (visible && category) {
      resetForm();
    }
  }, [visible, category]);

  useEffect(() => {
    if (visible && initialRecord) {
      const recordTracks = getTeamTracks(initialRecord, category?.name);
      const defaultTrack = initialRecord.selectedTrack || recordTracks[0] || '';
      setSrNo(String(initialRecord.srNo || ''));
      setStickerNumber(String(getTeamStickerNumber(initialRecord) || ''));
      setDriverName(initialRecord.driver_name || initialRecord.driverName || '');
      setCoDriverName(initialRecord.codriver_name || initialRecord.coDriverName || '');
      setTrackName(defaultTrack);
      setLateStartMode(initialRecord.lateStartMode || '');
      setStopwatchTime(0);
    }
  }, [visible, initialRecord]);

  useEffect(() => {
    if (!isDNF) {
      return;
    }

    setIsStopwatchRunning(false);

    if (hasTimerStarted || stopwatchTime > 0) {
      setHasTimerStopped(true);
    }
  }, [isDNF, hasTimerStarted, stopwatchTime]);

  const toggleStopwatch = () => {
    if (isStopwatchRunning) {
      setIsStopwatchRunning(false);
      setHasTimerStopped(true);
      return;
    }

    if (!hasTimerStarted && !hasTimerStopped) {
      setIsStopwatchRunning(true);
      setHasTimerStarted(true);
    }
  };

  const resetStopwatch = () => {
    setStopwatchTime(0);
    setIsStopwatchRunning(false);
    setHasTimerStarted(false);
    setHasTimerStopped(false);
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
    setStopwatchTime(0);
    setHasTimerStarted(false);
    setHasTimerStopped(false);
  };

  const handleClose = () => {
    resetForm();
    resetStopwatch();
    onClose();
  };

  const generateAndDownloadExcel = async (data) => {
    try {
      const headers = [
        ...RECORD_EXPORT_HEADERS,
      ];

      const rows = [[
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

      const fileName = `${data.category} - ${data.trackName}.csv`;
      await CSVExporter.downloadFile(fileName, headers, rows);
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to generate file: ' + error.message);
      console.error('File generation error:', error);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!trackName.trim()) {
      Alert.alert('Error', 'Please select Track Name');
      return;
    }
    if (!driverName.trim() || !stickerNumber.trim() || !coDriverName.trim()) {
      Alert.alert('Error', 'Selected record details are incomplete');
      return;
    }
    if (!hasTimerStopped && !isDNF) {
      Alert.alert('Error', 'Stop the timer before submitting');
      return;
    }
    if (isDNFPointsMissing) {
      Alert.alert('Error', 'Please select DNF points before submitting');
      return;
    }

    const formData = {
      trackName,
      category: category?.name || '',
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
    };

    const didDownload = await generateAndDownloadExcel(formData);

    if (!didDownload) {
      return;
    }

    await onSubmit(formData);
    resetStopwatch();
    resetForm();
  };

  const penaltyControlsDisabled = !hasTimerStarted || isDNF;
  const submitDisabled = (!hasTimerStopped && !isDNF) || isDNFPointsMissing;
  const startButtonDisabled = hasTimerStopped || isDNF;
  const resetButtonDisabled = isStopwatchRunning || stopwatchTime === 0;

  return (
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
                  paddingTop: responsiveLayout.isTablet ? 24 : 16,
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
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.formBody,
                {
                  paddingHorizontal: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 8 : 12,
                },
              ]}
            >
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
                  contentContainerStyle={styles.dashboardRightPanelContent}
                  showsVerticalScrollIndicator={false}
                >
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
            </View>

            <View
              style={[
                styles.submitActionBar,
                {
                  paddingHorizontal: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 8 : 12,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  submitDisabled && styles.submitButtonDisabled,
                  { paddingVertical: responsiveLayout.isSmallPhone ? 12 : 14 },
                ]}
                onPress={handleSubmit}
                disabled={submitDisabled}
              >
                <Text style={[styles.submitButtonText, { fontSize: responsiveLayout.isSmallPhone ? 14 : 15 }]}>
                  Submit & Download CSV
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
};

const CategoryRecordsModal = ({
  visible,
  category,
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
  completedTracksByRecord,
  activeRecordKey,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const categoryTracks = getCategoryTracks(category?.name);
  const orderedRecords = [...records].sort((a, b) => {
    const aLateStart =
      Boolean(selectedLateStartEnabledByRecord[getRecordKey(a)]) && Boolean(selectedLateStartByRecord[getRecordKey(a)]);
    const bLateStart =
      Boolean(selectedLateStartEnabledByRecord[getRecordKey(b)]) && Boolean(selectedLateStartByRecord[getRecordKey(b)]);

    if (aLateStart === bLateStart) {
      return 0;
    }

    return aLateStart ? 1 : -1;
  });
  const filteredRecords = selectedTrackFilter
    ? orderedRecords.filter(record => {
        const recordKey = getRecordKey(record);
        const completedTracks = completedTracksByRecord[recordKey] || [];

        return (
          getTeamTracks(record, category?.name).includes(selectedTrackFilter) &&
          !completedTracks.includes(selectedTrackFilter)
        );
      })
    : [];

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
            paddingTop: responsiveLayout.isTablet ? 28 : 20,
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
          <Text style={styles.recordsTitle}>{category?.name || 'Category Records'}</Text>
          <Text style={styles.recordsSubtitle}>
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
        <>
          <FlatList
            data={filteredRecords}
            keyExtractor={(item, index) => String(item.id || item.car_number || index)}
            contentContainerStyle={[
              styles.recordsListContent,
              { paddingBottom: responsiveLayout.isTablet ? 36 : 24 },
            ]}
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
          <TouchableOpacity style={styles.trackCardsBackButton} onPress={onTrackCardBack} activeOpacity={0.85}>
            <Text style={styles.trackCardsBackButtonText}>Change Track</Text>
          </TouchableOpacity>
        </>
      )}
        </View>
      </View>
    </Modal>
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
            paddingTop: responsiveLayout.isTablet ? 28 : 20,
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
                <Text style={styles.closeButton}>âœ•</Text>
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
  const [completedTracksByRecord, setCompletedTracksByRecord] = useState({});
  const [searchText, setSearchText] = useState('');
  const [dbReady, setDbReady] = useState(false);
  const [teams, setTeams] = useState([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState([]);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const [appStage, setAppStage] = useState('splash');
  const [selectedDay, setSelectedDay] = useState(null);
  const splashLogoAnim = useRef(new Animated.Value(0)).current;
  const ignitionAnim = useRef(new Animated.Value(0)).current;
  const sparkAnim = useRef(new Animated.Value(0)).current;
  const ignitionSoundRef = useRef(null);

  useEffect(() => {
    if (appStage !== 'splash') {
      return undefined;
    }

    splashLogoAnim.setValue(0);
    ignitionAnim.setValue(0);
    sparkAnim.setValue(0);

    const playIgnitionSound = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          require('./assets/ignition-start.wav'),
          {
            shouldPlay: true,
            volume: 0.85,
          }
        );

        ignitionSoundRef.current = sound;
      } catch (error) {
        console.warn('Unable to play ignition sound:', error);
      }
    };

    playIgnitionSound();

    Animated.parallel([
      Animated.spring(splashLogoAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 65,
      }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(ignitionAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(ignitionAnim, {
          toValue: 0.35,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(sparkAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(sparkAnim, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const splashTimer = setTimeout(() => {
      setAppStage('day');
    }, 1500);

    return () => {
      clearTimeout(splashTimer);
      if (ignitionSoundRef.current) {
        ignitionSoundRef.current.unloadAsync().catch(() => {});
        ignitionSoundRef.current = null;
      }
    };
  }, [appStage, ignitionAnim, sparkAnim, splashLogoAnim]);

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

        await ResultsService.cleanupDuplicateResults();
        
        // Load teams with native local DB preferred and API fallback
        const teamsData = await TeamsService.getAllTeams();
        console.log('Teams received on homepage load:', teamsData.length);
        // Load categories and add team counts
        const categoriesData = await CategoriesService.getAllCategories();
        const baseCategories = categoriesData.length > 0 ? categoriesData : categories;
        const categoriesWithTeamCounts = attachTeamCountsToCategories(baseCategories, teamsData);

        setTeams(teamsData);
        
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

  // Filter categories based on search
  const filteredCategories = categoriesWithCounts.length > 0 
    ? categoriesWithCounts.filter(cat =>
        cat.name.toLowerCase().includes(searchText.toLowerCase())
      )
    : categories.filter(cat =>
        cat.name.toLowerCase().includes(searchText.toLowerCase())
      );

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
    setSelectedCategoryTrack('');
    setSearchText('');
    setReportMenuVisible(false);
    setResultsVisible(false);
    setAppStage('main');
  };

  const handleBackToSplash = () => {
    setSelectedDay(null);
    setSearchText('');
    setReportMenuVisible(false);
    setResultsVisible(false);
    setRecordsVisible(false);
    setFormVisible(false);
    setSelectedCategory(null);
    setSelectedCategoryTrack('');
    setActiveRecordKey('');
    setAppStage('splash');
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
  };

  const handleDNSRecordSubmit = async record => {
    const nullValue = 'null';
    const fileName = `${selectedCategory?.name || 'Category'} - ${record.selectedTrack || 'Track'} - DNS.csv`;
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
      submission_json: JSON.stringify({
        ...record,
        category: selectedCategory?.name || '',
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

      const recordKey = record.recordKey || getRecordKey(record);
      const completedTrack = record.selectedTrack || '';

      if (recordKey && completedTrack) {
        setCompletedTracksByRecord(prev => ({
          ...prev,
          [recordKey]: [...new Set([...(prev[recordKey] || []), completedTrack])],
        }));
      }

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

  /**
   * Handle form submission
   */
  const handleFormSubmit = async (formData) => {
    const completedTrack = formData.trackName;
    const recordKey = selectedRecord?.recordKey || getRecordKey(selectedRecord || {});
    const registrationData = {
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
    };

    try {
      const isDuplicate = await ResultsService.isDuplicateResult(registrationData);
      if (isDuplicate) {
        Alert.alert('Duplicate Record', 'This result already exists for the same category, track, and sticker number.');
        return;
      }

      const savedId = await ResultsService.addResult(registrationData);

      if (!savedId) {
        Alert.alert('Error', 'Registration was not saved to the database');
        return;
      }

      if (recordKey && completedTrack) {
        setCompletedTracksByRecord(prev => ({
          ...prev,
          [recordKey]: [...new Set([...(prev[recordKey] || []), completedTrack])],
        }));

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
      setRecordsVisible(false);
      setResultsVisible(true);
    } catch (error) {
      if (error?.code === 'DUPLICATE_RESULT') {
        Alert.alert('Duplicate Record', 'This result already exists for the same category, track, and sticker number.');
        return;
      }
      Alert.alert('Error', 'Registration was not saved to the database');
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

  const selectedCategoryRecords = selectedCategory
    ? getTeamsForCategory(teams, selectedCategory.name)
    : [];

  if (appStage === 'splash') {
    return (
      <View style={styles.splashScreen}>
        <Animated.View
          style={[
            styles.splashIgnitionHalo,
            {
              opacity: ignitionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.9],
              }),
              transform: [
                {
                  scale: ignitionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.78, 1.08],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.splashIgnitionBar,
            {
              opacity: ignitionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.18, 0.75],
              }),
              transform: [
                {
                  scaleX: sparkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1.15],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.splashSparkLeft,
            {
              opacity: sparkAnim,
              transform: [
                {
                  translateX: sparkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, -52],
                  }),
                },
                {
                  translateY: sparkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
                {
                  scale: sparkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.splashSparkRight,
            {
              opacity: sparkAnim,
              transform: [
                {
                  translateX: sparkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 52],
                  }),
                },
                {
                  translateY: sparkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
                {
                  scale: sparkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        />
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
          <Animated.Image
            source={require('./assets/welcome-logo-transparent.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </Animated.View>
        <Text style={styles.splashTitle}>TKO-Ground Zero</Text>
        <Text style={styles.splashSubtitle}>Loading report flow...</Text>
      </View>
    );
  }

  if (appStage === 'day') {
    return (
      <View style={styles.dayScreen}>
        <View style={styles.dayScreenHeader}>
          <View style={styles.dayLogoRing}>
            <Image
              source={require('./assets/welcome-logo-transparent.png')}
              style={styles.dayScreenLogo}
              resizeMode="contain"
            />
          </View>
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
                <Text style={styles.dayCardLabel}>{day.dayLabel}</Text>
                <Text style={styles.dayCardDate}>{day.dateLabel}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View
        style={[
          styles.topHeader,
          {
            paddingHorizontal: responsiveLayout.shellPadding,
            paddingTop: responsiveLayout.isTablet ? 24 : 16,
            paddingBottom: responsiveLayout.isTablet ? 18 : 16,
          },
        ]}
      >
        <View style={styles.topHeaderRow}>
          <Text
            style={[
              styles.exploreTitle,
              { fontSize: responsiveLayout.isTablet ? 32 : responsiveLayout.isSmallPhone ? 24 : 28 },
            ]}
          >
            TKO-Ground Zero
          </Text>
        </View>
        {selectedDay ? (
          <Text style={styles.selectedDayLabel}>
            {selectedDay.dayLabel} • {selectedDay.dateLabel}
          </Text>
        ) : null}
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
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
            { fontSize: responsiveLayout.isTablet ? 16 : 14 },
          ]}
          placeholder="Search categories..."
          placeholderTextColor="#bbb"
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
          <Text style={[styles.sectionTitle, { fontSize: responsiveLayout.isTablet ? 20 : 18 }]}>
            Categories
          </Text>
        </View>
        <View style={styles.sectionHeaderActions}>
          <View style={styles.reportMenuContainer}>
            <TouchableOpacity
              style={[
                styles.topHeaderButton,
                styles.reportDotsButton,
                {
                  minWidth: responsiveLayout.isTablet ? 66 : 60,
                  minHeight: responsiveLayout.isTablet ? 66 : 60,
                },
              ]}
              onPress={() => setReportMenuVisible(prev => !prev)}
              activeOpacity={0.85}
            >
              <Text style={[styles.topHeaderButtonText, styles.reportDotsText]}>...</Text>
            </TouchableOpacity>

            {reportMenuVisible ? (
              <View style={styles.reportMenuDropdown}>
                <TouchableOpacity
                  style={styles.reportMenuItem}
                  onPress={() => {
                    setReportMenuVisible(false);
                    setResultsVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.reportMenuItemText}>Report</Text>
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
        showsVerticalScrollIndicator={false}
      />

      <CategoryRecordsModal
        visible={recordsVisible}
        category={selectedCategory}
        records={selectedCategoryRecords}
        activeRecordKey={activeRecordKey}
        selectedTrackFilter={selectedCategoryTrack}
        onTrackCardSelect={handleTrackCardSelect}
        onTrackCardBack={handleTrackCardBack}
        selectedLateStartEnabledByRecord={selectedLateStartEnabledByRecord}
        selectedLateStartByRecord={selectedLateStartByRecord}
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
      />

      <ReportScreen
        visible={resultsVisible}
        onClose={() => setResultsVisible(false)}
      />

      {/* Registration Form Modal */}
      <RegistrationForm
        visible={formVisible}
        category={selectedCategory}
        initialRecord={selectedRecord}
        onClose={() => {
          setFormVisible(false);
          setSelectedRecord(null);
          setActiveRecordKey('');
          setRecordsVisible(true);
        }}
        onSubmit={handleFormSubmit}
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

  splashIgnitionHalo: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderColor: '#ff8a1f',
    shadowColor: '#ff8a1f',
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  splashIgnitionBar: {
    position: 'absolute',
    width: 220,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ff8a1f',
    opacity: 0.22,
    shadowColor: '#ff8a1f',
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    top: '58%',
  },

  splashSparkLeft: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffb15a',
    shadowColor: '#ff8a1f',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    top: '58%',
    left: '50%',
    marginLeft: -70,
  },

  splashSparkRight: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ff8a1f',
    shadowColor: '#ff8a1f',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    top: '58%',
    left: '50%',
    marginLeft: 56,
  },

  splashLogoGround: {
    width: 250,
    height: 250,
    borderRadius: 125,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1c1c1c',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    marginBottom: 18,
    overflow: 'hidden',
  },

  splashLogo: {
    width: 212,
    height: 212,
  },

  splashTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff6ea',
    letterSpacing: 0.3,
    fontFamily: HEADING_FONT,
  },

  splashSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#ffbe7a',
    letterSpacing: 0.5,
    fontFamily: BODY_FONT,
  },

  dayScreen: {
    flex: 1,
    backgroundColor: '#080b10',
    paddingHorizontal: 16,
    paddingTop: 28,
  },

  dayScreenHeader: {
    alignItems: 'center',
    marginBottom: 22,
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
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#0b111a',
  },

  topHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  exploreTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },

  selectedDayLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
  },

  topHeaderButton: {
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
    color: '#fff6ea',
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
    backgroundColor: '#111722',
  },

  reportMenuItemText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffb15a',
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
    paddingTop: IS_TABLET ? 28 : 20,
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
    minHeight: 44,
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
    minHeight: 44,
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
    minHeight: 44,
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

  // Form header
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IS_TABLET ? 28 : 20,
    paddingTop: IS_TABLET ? 24 : 16,
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
    paddingBottom: 10,
    backgroundColor: '#1a2432',
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
    width: IS_TABLET ? 40 : IS_SMALL_PHONE ? 32 : 36,
    height: IS_TABLET ? 40 : IS_SMALL_PHONE ? 32 : 36,
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
    width: IS_TABLET ? 56 : IS_SMALL_PHONE ? 36 : 42,
    height: IS_TABLET ? 40 : IS_SMALL_PHONE ? 32 : 36,
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
    minHeight: 48,
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
