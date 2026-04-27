import { Dimensions } from 'react-native';

export const MIN_TOUCH_TARGET = 48;
export const TOUCH_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };

export const getResponsiveLayout = (screenWidth, screenHeight) => {
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

export const INITIAL_LAYOUT = getResponsiveLayout(
  Dimensions.get('window').width,
  Dimensions.get('window').height
);

export const normalizeCategoryKey = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const CATEGORY_CARD_PALETTES = {
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
