import { Dimensions, Platform, StyleSheet } from 'react-native';

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

const INITIAL_LAYOUT = getResponsiveLayout(Dimensions.get('window').width, Dimensions.get('window').height);
const IS_TABLET = INITIAL_LAYOUT.isTablet;
const IS_SMALL_PHONE = INITIAL_LAYOUT.isSmallPhone;
const USE_SPLIT_LAYOUT = INITIAL_LAYOUT.useSplitLayout;
const USE_TWO_COLUMN_PENALTIES = INITIAL_LAYOUT.penaltyColumns > 1;
const CARD_WIDTH = INITIAL_LAYOUT.categoryCardWidth;

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

  vehicleSummaryCard: {
    backgroundColor: '#000000',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  vehicleSummaryHeader: {
    marginBottom: 10,
  },

  vehicleSummaryLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffb15a',
    fontFamily: HEADING_FONT,
  },

  vehicleSummaryGrid: {
    gap: 10,
  },

  vehicleSummaryInlineRow: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#0c111a',
    borderWidth: 1,
    borderColor: 'rgba(42, 52, 65, 0.9)',
  },

  vehicleSummaryInlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cdbf9a',
    lineHeight: 16,
    fontFamily: BODY_FONT,
  },

  vehicleSummaryInlineValue: {
    color: '#fff6ea',
    fontWeight: '800',
  },

  vehicleSummaryItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#0c111a',
    borderWidth: 1,
    borderColor: 'rgba(42, 52, 65, 0.9)',
  },

  vehicleSummaryItemLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    letterSpacing: 0.06,
    fontFamily: BODY_FONT,
  },

  vehicleSummaryItemValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800',
    color: '#fff6ea',
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
    borderWidth: 1,
    borderColor: '#cfdcf0',
    minHeight: IS_TABLET ? 320 : 276,
    borderRadius: 22,
    paddingHorizontal: IS_TABLET ? 12 : 10,
    paddingVertical: IS_TABLET ? 12 : 10,
    elevation: 5, // Android shadow
    shadowColor: '#1f3b73', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    alignSelf: 'center',
    overflow: 'hidden',
  },

  cardContent: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },

  // Icon box with color
  iconBox: {
    width: '100%',
    flex: 1,
    minHeight: IS_TABLET ? 188 : 156,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },

  // Category icon
  categoryIcon: {
    fontSize: IS_TABLET ? 34 : 30,
  },

  categoryImageIcon: {
    width: IS_TABLET ? '130%' : '120%',
    height: IS_TABLET ? '112%' : '108%',
    alignSelf: 'center',
  },

  categoryImageIconSuvModified: {
    width: IS_TABLET ? '106%' : '100%',
    height: IS_TABLET ? '98%' : '94%',
  },

  categoryImageIconPetrolModified: {
    width: IS_TABLET ? '110%' : '103%',
    height: IS_TABLET ? '98%' : '95%',
  },

  categoryImageIconPetrolExpert: {
    width: IS_TABLET ? '170%' : '160%',
    height: IS_TABLET ? '142%' : '136%',
  },

  countPanel: {
    width: '100%',
    marginTop: 'auto',
    marginBottom: 0,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e4e8f0',
    paddingHorizontal: IS_TABLET ? 6 : 5,
    paddingTop: IS_TABLET ? 6 : 5,
    paddingBottom: IS_TABLET ? 4 : 3,
    minHeight: IS_TABLET ? 50 : 46,
  },

  countStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },

  countStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: IS_TABLET ? 36 : 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: IS_TABLET ? 5 : 4,
    paddingVertical: IS_TABLET ? 4 : 3,
  },

  countStatSecondary: {
    borderWidth: 1,
  },

  countStatsDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#d7dce6',
    marginHorizontal: IS_TABLET ? 6 : 5,
  },

  countStatValue: {
    fontSize: IS_TABLET ? 14 : 13,
    fontWeight: '800',
    color: '#172238',
    lineHeight: IS_TABLET ? 16 : 15,
  },

  countStatValueOnPrimary: {
    color: '#fff8f1',
  },

  countStatLabel: {
    fontSize: IS_TABLET ? 8 : 7,
    color: '#707b8f',
    fontWeight: '700',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  countStatLabelOnPrimary: {
    color: '#fff8f1',
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

  disputeResolutionCommentBlock: {
    marginTop: 0,
    marginBottom: 10,
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

  flowErrorBoundaryCard: {
    flex: 1,
    backgroundColor: '#111722',
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  flowErrorBoundaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff6ea',
    textAlign: 'center',
    fontFamily: HEADING_FONT,
  },

  flowErrorBoundaryText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#cdbf9a',
    textAlign: 'center',
    fontFamily: BODY_FONT,
  },

  flowErrorBoundaryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ff7a00',
  },

  flowErrorBoundaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#120a05',
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

  timerLimitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
    textAlign: 'center',
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
    paddingVertical: 20,
  },

  authModalOverlayKeyboardOpen: {
    justifyContent: 'flex-start',
  },

  authModalOverlayCompact: {
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingBottom: 12,
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

  authModalKeyboardAvoid: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },

  authModalKeyboardAvoidCompact: {
    justifyContent: 'flex-start',
  },

  authModalKeyboardAvoidContent: {
    width: '100%',
  },

  authModalScroll: {
    width: '100%',
  },

  authModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },

  authModalScrollContentCompact: {
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 12,
  },

  authModalCard: {
    width: '100%',
    alignSelf: 'center',
    marginTop: 12,
  },

  authModalCardCompact: {
    maxWidth: 400,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },

  authModalTitleCompact: {
    fontSize: 19,
  },

  authModalSubtitleCompact: {
    marginTop: 6,
    fontSize: 13,
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

  recordPinInput: {
    letterSpacing: 8,
    textAlign: 'center',
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

  disputeModalPartySection: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#0c111a',
  },

  disputeModalPartyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff6ea',
    marginBottom: 12,
    fontFamily: HEADING_FONT,
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
    height: 72,
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

  settingsMenuCardFeatured: {
    borderColor: '#ff7a00',
    shadowColor: '#ff7a00',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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

  settingsTrackRowSelected: {
    borderColor: '#ffb15a',
    borderWidth: 2,
  },

  settingsSelectedBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },

  settingsSelectedBadgeActive: {
    color: '#ffb15a',
  },

  settingsTrackTimerPreview: {
    marginTop: 14,
    fontSize: 32,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
    textAlign: 'center',
  },

  settingsTimerCounterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    marginBottom: 12,
  },

  settingsTimerCounterCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },

  settingsTimerCounterLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },

  settingsTimerCounterControls: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  settingsTimerAdjustButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingsTimerAdjustButtonText: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: BODY_FONT,
    lineHeight: 28,
  },

  settingsTimerCounterValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },

  settingsTrackTimerActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },

  settingsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },

  settingsActionButtonDisabled: {
    opacity: 0.55,
  },

  settingsFormSaveButton: {
    marginTop: 18,
  },

  // Form header
  formHeader: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IS_TABLET ? 28 : 20,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#000000',
    zIndex: 8,
    elevation: 8,
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

  stopwatchBackButton: {
    minHeight: 48,
    minWidth: 104,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 20,
    elevation: 12,
  },

  stopwatchBackButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
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

  disputeResolveSubsection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#0c111a',
  },

  disputeResolveSubsectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffb15a',
    marginBottom: 8,
    fontFamily: BODY_FONT,
  },

  disputeResolutionCommentInput: {
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3441',
    backgroundColor: '#111722',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 10,
    color: '#fff6ea',
    fontSize: 13,
    textAlignVertical: 'top',
    fontFamily: BODY_FONT,
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

  dnfCheckboxRowDisabled: {
    opacity: 0.72,
  },

  dnfRadio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#ffb599',
    backgroundColor: '#111722',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  dnfRadioSelected: {
    borderColor: '#ff5a1f',
  },

  dnfRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#ff5a1f',
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

  dnfCheckboxContent: {
    flex: 1,
  },

  dnfCheckboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  dnfCheckboxLabelDisabled: {
    color: '#6b7280',
  },

  dnfCheckboxHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#9a3412',
    fontFamily: BODY_FONT,
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

export default styles;

