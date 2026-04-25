import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Keyboard,
} from 'react-native';
import {
  ResultsService,
  DisputesService,
  LeaderboardService,
  promoteExpiredDisputesToResults,
} from '../services/dataService';
import TouchableOpacity from '../components/FastTouchableOpacity';
import {
  DISPUTE_AUTO_SUBMIT_POLL_MS,
  getDayIdentity,
  getDisputeAutoSubmitStatus,
  getResultIdentityKey,
  getResultTimeValue,
  isDnfResult,
  isDnsResult,
  normalizeCategoryKey,
  normalizeValue,
  parseRegistrationPayload,
  rankTrackResults,
} from '../utils/scoring';
import { CloseActionButton, NavigationActionButton } from '../components/NavigationActionButton';

const HEADING_FONT = Platform.select({
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

const DEFAULT_THEME = {
  background: '#050505',
  backgroundStrong: '#0b0b0b',
  surface: '#111111',
  surfaceAlt: '#171717',
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
  overlay: 'rgba(0, 0, 0, 0.72)',
  shadow: '#000000',
};

const getResponsiveLayout = (screenWidth, screenHeight) => {
  const shortestSide = Math.min(screenWidth, screenHeight);
  const isTablet = shortestSide >= 600;
  const isLargeTablet = shortestSide >= 720;
  const isLandscape = screenWidth > screenHeight;
  const shellPadding = isLargeTablet ? 28 : isTablet ? 24 : 16;
  const shellMaxWidth = isTablet
    ? Math.min(screenWidth - (isLandscape ? 40 : 32), isLargeTablet ? 1240 : 1160)
    : screenWidth;

  return {
    isTablet,
    isLargeTablet,
    shellPadding,
    shellMaxWidth,
    stickerWidth: isLargeTablet ? 116 : isTablet ? 104 : 92,
    nameWidth: isLargeTablet ? 196 : isTablet ? 182 : 154,
    pointsWidth: isLargeTablet ? 120 : isTablet ? 110 : 96,
    trackWidth: isLargeTablet ? 224 : isTablet ? 210 : 176,
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

const getVehicleIdentityKey = source => {
  const categoryKey = normalizeCategoryKey(source?.category || '');
  const stickerKey = normalizeValue(
    source?.sticker_number ||
      source?.stickerNumber ||
      source?.car_number ||
      source?.carNumber ||
      ''
  );
  const driverKey = normalizeValue(source?.driver_name || source?.driverName || '');

  return [categoryKey, stickerKey || driverKey].join('|');
};

const getVehicleDisplayData = source => ({
  stickerNumber:
    source?.sticker_number ||
    source?.stickerNumber ||
    source?.car_number ||
    source?.carNumber ||
    '--',
  driverName: source?.driver_name || source?.driverName || '--',
  coDriverName: source?.codriver_name || source?.coDriverName || '--',
});

const getDayOrder = item => {
  const rawCandidates = [
    item?.selected_day_id,
    item?.selectedDayId,
    item?.selected_day_label,
    item?.selectedDayLabel,
  ];

  for (const candidate of rawCandidates) {
    const match = String(candidate || '').match(/(\d+)/);

    if (match) {
      return Number(match[1]);
    }
  }

  return Number.MAX_SAFE_INTEGER;
};

const getDayShortLabel = item => {
  const rawLabel = String(item?.selected_day_label || item?.selectedDayLabel || '').trim();

  if (rawLabel) {
    const match = rawLabel.match(/day\s*(\d+)/i);
    return match ? `D${match[1]}` : rawLabel;
  }

  const rawId = String(item?.selected_day_id || item?.selectedDayId || '').trim();
  const rawIdMatch = rawId.match(/(\d+)/);

  if (rawIdMatch) {
    return `D${rawIdMatch[1]}`;
  }

  const rawDate = String(item?.selected_day_date || item?.selectedDayDate || '').trim();
  return rawDate || 'Day';
};

const getTimingLabel = (item, nowTimestamp) => {
  if (item?.isDisputed) {
    const disputeStatus = getDisputeAutoSubmitStatus(item, nowTimestamp);
    return `HOLD ${disputeStatus.remainingLabel}`;
  }

  if (isDnsResult(item)) {
    return 'DNS';
  }

  if (isDnfResult(item)) {
    return 'DNF';
  }

  return item?.total_time || item?.totalTimeDisplay || '--';
};

const compareRows = (a, b) => {
  if (a.totalPoints !== b.totalPoints) {
    return b.totalPoints - a.totalPoints;
  }

  if (a.totalTimingMs !== b.totalTimingMs) {
    return a.totalTimingMs - b.totalTimingMs;
  }

  return String(a.stickerNumber || '').localeCompare(String(b.stickerNumber || ''), undefined, {
    numeric: true,
  });
};

const normalizeDetailValue = value => {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  return String(value);
};

const getYesNoLabel = value => (value ? 'Yes' : 'No');

const buildDetailSections = record => [
  {
    title: 'Timing Summary',
    items: [
      { label: 'Performance Time', value: record?.performance_time || record?.performanceTimeDisplay },
      { label: 'Total Penalties', value: record?.total_penalties_time || record?.totalPenaltiesTime },
      { label: 'Total Time', value: record?.total_time || record?.totalTimeDisplay },
    ],
  },
  {
    title: 'Late Start',
    items: [
      { label: 'Status', value: record?.late_start_status || record?.lateStartStatus },
      { label: 'Mode', value: record?.late_start_mode || record?.lateStartMode },
      { label: 'Count', value: record?.late_start_count || record?.lateStartCount },
      { label: 'Penalty Time', value: record?.late_start_penalty_time || record?.lateStartPenaltyTime },
    ],
  },
  {
    title: 'Penalty Breakdown',
    items: [
      { label: 'Bunting Count', value: record?.bunting_count ?? record?.bustingCount },
      { label: 'Bunting Penalty', value: record?.bunting_penalty_time ?? record?.bustingPenaltyTime },
      { label: 'Seatbelt Count', value: record?.seatbelt_count ?? record?.seatbeltCount },
      { label: 'Seatbelt Penalty', value: record?.seatbelt_penalty_time ?? record?.seatbeltPenaltyTime },
      { label: 'Ground Touch Count', value: record?.ground_touch_count ?? record?.groundTouchCount },
      { label: 'Ground Touch Penalty', value: record?.ground_touch_penalty_time ?? record?.groundTouchPenaltyTime },
      { label: 'Attempt Count', value: record?.attempt_count ?? record?.attemptCount },
      { label: 'Attempt Penalty', value: record?.attempt_penalty_time ?? record?.attemptPenaltyTime },
      { label: 'Task Skipped Count', value: record?.task_skipped_count ?? record?.taskSkippedCount },
      { label: 'Task Skipped Penalty', value: record?.task_skipped_penalty_time ?? record?.taskSkippedPenaltyTime },
    ],
  },
  {
    title: 'DNF / DNS',
    items: [
      { label: 'Result Type', value: record?.isDisputed ? 'Hold' : isDnsResult(record) ? 'DNS' : isDnfResult(record) ? 'DNF' : record?.late_start_status || 'Completed' },
      { label: 'Wrong Course', value: getYesNoLabel(record?.wrong_course_selected ?? record?.wrongCourseSelected) },
      { label: '4th Attempt', value: getYesNoLabel(record?.fourth_attempt_selected ?? record?.fourthAttemptSelected) },
      { label: 'Time Over', value: getYesNoLabel(record?.time_over_selected ?? record?.timeOverSelected) },
      { label: 'DNF Selection', value: record?.dnf_selection ?? record?.dnfSelection },
      { label: 'DNF Points', value: record?.dnf_points ?? record?.dnfPoints },
    ],
  },
];

const buildDetailIndex = (resultRows = [], disputeRows = []) => {
  const index = new Map();

  const addRecord = (record, sourceType) => {
    const parsedRecord = parseRegistrationPayload(record);
    const key = getResultIdentityKey(parsedRecord);
    const existing = index.get(key) || {};
    index.set(key, {
      ...existing,
      [sourceType]: {
        ...parsedRecord,
        isDisputed: sourceType === 'dispute' ? true : Boolean(parsedRecord?.isDisputed),
      },
    });
  };

  resultRows.forEach(record => addRecord(record, 'result'));
  disputeRows.forEach(record => addRecord(record, 'dispute'));

  return index;
};

const LeaderboardScreen = ({
  visible,
  onClose,
  categoryOptions = [],
  teams = [],
  dataRefreshKey = 0,
  theme = DEFAULT_THEME,
  settingsPassword = '',
  leaderboardSyncBaseUrl = '',
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [exportPasswordModalVisible, setExportPasswordModalVisible] = useState(false);
  const [exportPasswordInput, setExportPasswordInput] = useState('');
  const [exportPasswordError, setExportPasswordError] = useState('');
  const [passwordKeyboardHeight, setPasswordKeyboardHeight] = useState(0);

  const loadResults = useCallback(async (showLoading = true, shouldProcessExpiredDisputes = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      if (shouldProcessExpiredDisputes) {
        await promoteExpiredDisputesToResults();
      }

      const [rows, disputeRows] = await Promise.all([
        ResultsService.getAllResults(),
        DisputesService.getAllDisputes(),
      ]);
      setResults(rows);
      setDisputes(disputeRows);

    } catch (error) {
      console.error('Error loading leaderboard data:', error);
      Alert.alert('Leaderboard Error', 'Unable to load leaderboard data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [categoryOptions, teams]);

  useEffect(() => {
    if (visible) {
      loadResults();
      return;
    }

    setSelectedCategory('');
  }, [dataRefreshKey, loadResults, visible]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    setNowTimestamp(Date.now());

    const clockIntervalId = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    const disputeIntervalId = setInterval(() => {
      promoteExpiredDisputesToResults()
        .then(summary => {
          if (summary.processedCount > 0) {
            loadResults(false, false);
          }
        })
        .catch(error => {
          console.warn('Unable to auto-submit expired disputes in leaderboard:', error);
        });
    }, DISPUTE_AUTO_SUBMIT_POLL_MS);

    return () => {
      clearInterval(clockIntervalId);
      clearInterval(disputeIntervalId);
    };
  }, [loadResults, visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleKeyboardShow = event => {
      setPasswordKeyboardHeight(event?.endCoordinates?.height || 0);
    };

    const handleKeyboardHide = () => {
      setPasswordKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const normalizedResults = useMemo(() => results.map(parseRegistrationPayload), [results]);

  const normalizedDisputes = useMemo(
    () =>
      disputes.map(dispute => ({
        ...parseRegistrationPayload(dispute),
        isDisputed: true,
      })),
    [disputes]
  );

  const detailIndex = useMemo(() => buildDetailIndex(results, disputes), [results, disputes]);

  const uniqueResults = useMemo(() => {
    const seen = new Set();

    return [...normalizedResults, ...normalizedDisputes].filter(item => {
      const identityKey = getResultIdentityKey(item);

      if (seen.has(identityKey)) {
        return false;
      }

      seen.add(identityKey);
      return true;
    });
  }, [normalizedDisputes, normalizedResults]);

  const categoryCards = useMemo(() => {
    return categoryOptions
      .map(option => {
        const vehicleKeys = new Set();

        teams
          .filter(team => normalizeCategoryKey(team.category || '') === option.key)
          .forEach(team => vehicleKeys.add(getVehicleIdentityKey(team)));

        uniqueResults
          .filter(item => normalizeCategoryKey(item.category || '') === option.key)
          .forEach(item => vehicleKeys.add(getVehicleIdentityKey(item)));

        return {
          ...option,
          vehicleCount: vehicleKeys.size,
          trackCount: (option.tracks || []).length,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryOptions, teams, uniqueResults]);

  const selectedCategoryConfig =
    categoryCards.find(item => item.key === selectedCategory) || null;

  const openTrackDetails = useCallback(
    ({ row, trackLabel, summary, entry }) => {
      const sourceGroup = detailIndex.get(entry.key) || {};
      const record = entry?.rankLabel === 'Hold'
        ? sourceGroup.dispute || sourceGroup.result || null
        : sourceGroup.result || sourceGroup.dispute || null;

      setSelectedDetail({
        categoryLabel: selectedCategoryConfig?.label || 'Leaderboard',
        trackLabel,
        row,
        summary,
        entry,
        record,
      });
    },
    [detailIndex, selectedCategoryConfig?.label]
  );

  const closeTrackDetails = useCallback(() => {
    setSelectedDetail(null);
  }, []);

  const handleExportLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const exportResult = await LeaderboardService.exportLeaderboardData({
        focusCategory: selectedCategory || categoryCards[0]?.key || '',
        syncBaseUrl: leaderboardSyncBaseUrl,
      });
      if (exportResult?.syncResult?.synced) {
        Alert.alert('Published', 'Leaderboard data has been sent to the website.');
      } else if (exportResult?.syncResult?.status === 404) {
        Alert.alert(
          'Saved locally',
          'Leaderboard snapshot was created, but the sync endpoint returned 404. The generated data is still available in the app.'
        );
      } else {
        Alert.alert(
          'Saved locally',
          'Leaderboard snapshot was created, but the website sync is currently unavailable.'
        );
      }
    } catch (error) {
      console.error('Unable to export leaderboard data:', error);
      Alert.alert('Publish failed', error?.message || 'Unable to publish leaderboard data');
    } finally {
      setLoading(false);
    }
  }, [categoryCards, leaderboardSyncBaseUrl, selectedCategory]);

  const openExportPasswordModal = useCallback(() => {
    setExportPasswordInput('');
    setExportPasswordError('');
    setPasswordKeyboardHeight(0);
    setExportPasswordModalVisible(true);
  }, []);

  const closeExportPasswordModal = useCallback(() => {
    setExportPasswordModalVisible(false);
    setExportPasswordInput('');
    setExportPasswordError('');
    setPasswordKeyboardHeight(0);
  }, []);

  const handleExportPasswordSubmit = useCallback(() => {
    if (exportPasswordInput !== settingsPassword) {
      setExportPasswordError('Incorrect password. Please try again.');
      return;
    }

    setExportPasswordModalVisible(false);
    setExportPasswordInput('');
    setExportPasswordError('');
    setPasswordKeyboardHeight(0);
    handleExportLeaderboard();
  }, [exportPasswordInput, handleExportLeaderboard, settingsPassword]);

  const leaderboardRows = useMemo(() => {
    if (!selectedCategoryConfig) {
      return [];
    }

    const rowsByVehicle = new Map();
    const tracks = selectedCategoryConfig.tracks || [];

    const ensureVehicleRow = source => {
      const vehicleKey = getVehicleIdentityKey(source);

      if (!rowsByVehicle.has(vehicleKey)) {
        rowsByVehicle.set(vehicleKey, {
          vehicleKey,
          ...getVehicleDisplayData(source),
          totalPoints: 0,
          totalTimingMs: Number.POSITIVE_INFINITY,
          trackMap: tracks.reduce((acc, trackLabel) => {
            acc[normalizeValue(trackLabel)] = {
              trackLabel,
              totalPoints: 0,
              entries: [],
            };
            return acc;
          }, {}),
        });
      }

      return rowsByVehicle.get(vehicleKey);
    };

    teams
      .filter(team => normalizeCategoryKey(team.category || '') === selectedCategoryConfig.key)
      .forEach(team => {
        ensureVehicleRow({
          category: team.category,
          car_number: team.car_number || team.carNumber,
          driver_name: team.driver_name || team.driverName,
          codriver_name: team.codriver_name || team.coDriverName,
        });
      });

    const categoryResults = uniqueResults.filter(
      item => normalizeCategoryKey(item.category || '') === selectedCategoryConfig.key
    );

    const trackSessions = new Map();

    categoryResults.forEach(item => {
      ensureVehicleRow(item);

      const trackName = String(item.track_name || item.trackName || '').trim();
      const trackKey = normalizeValue(trackName);

      if (!trackKey) {
        return;
      }

      const dayIdentity = getDayIdentity(item);
      const dayKey = dayIdentity.dayId || dayIdentity.dayLabel || dayIdentity.dayDate || 'undated';
      const sessionKey = `${trackKey}|${dayKey}`;

      if (!trackSessions.has(sessionKey)) {
        trackSessions.set(sessionKey, {
          trackKey,
          items: [],
        });
      }

      trackSessions.get(sessionKey).items.push(item);
    });

    trackSessions.forEach(session => {
      rankTrackResults(session.items).forEach(item => {
        const row = ensureVehicleRow(item);
        const trackKey = session.trackKey;
        const trackSummary = row.trackMap[trackKey];
        const timingMs = getResultTimeValue(item);
        const pointsValue =
          typeof item.reportPoints === 'number' && Number.isFinite(item.reportPoints)
            ? item.reportPoints
            : 0;

        if (!row.trackMap[trackKey]) {
          row.trackMap[trackKey] = {
            trackLabel: item.track_name || item.trackName || 'Track',
            totalPoints: 0,
            entries: [],
          };
        }

        if (!Number.isFinite(row.totalTimingMs)) {
          row.totalTimingMs = 0;
        }

        if (item.reportPoints !== null && item.reportPoints !== undefined) {
          row.totalPoints += pointsValue;
          row.trackMap[trackKey].totalPoints += pointsValue;
        }

        if (Number.isFinite(timingMs)) {
          row.totalTimingMs += timingMs;
        }

        row.trackMap[trackKey].entries.push({
          key: getResultIdentityKey(item),
          dayLabel: getDayShortLabel(item),
          dayOrder: getDayOrder(item),
          timingLabel: getTimingLabel(item, nowTimestamp),
          pointsLabel:
            item.reportPoints === null || item.reportPoints === undefined ? '--' : `${item.reportPoints} pts`,
          rankLabel: item.reportRankLabel || '--',
        });
      });
    });

    return Array.from(rowsByVehicle.values())
      .map(row => ({
        ...row,
        totalTimingMs: Number.isFinite(row.totalTimingMs) ? row.totalTimingMs : Number.POSITIVE_INFINITY,
        trackSummaries: tracks.map(trackLabel => {
          const summary = row.trackMap[normalizeValue(trackLabel)] || {
            trackLabel,
            totalPoints: 0,
            entries: [],
          };

          return {
            ...summary,
            entries: [...summary.entries].sort((a, b) => a.dayOrder - b.dayOrder),
          };
        }),
      }))
      .sort(compareRows);
  }, [nowTimestamp, selectedCategoryConfig, teams, uniqueResults]);

  const tableWidth = useMemo(() => {
    const trackCount = selectedCategoryConfig?.tracks?.length || 0;

    return (
      responsiveLayout.stickerWidth +
      responsiveLayout.nameWidth +
      responsiveLayout.nameWidth +
      responsiveLayout.pointsWidth +
      trackCount * responsiveLayout.trackWidth
    );
  }, [responsiveLayout, selectedCategoryConfig]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      hardwareAccelerated={Platform.OS === 'android'}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingHorizontal: responsiveLayout.shellPadding,
            paddingTop: 60,
            paddingBottom: responsiveLayout.isTablet ? 28 : 20,
          },
        ]}
      >
        <View style={[styles.shell, { maxWidth: responsiveLayout.shellMaxWidth }]}>
          <View style={styles.header}>
            <View style={styles.headerTextBlock}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Leaderboard</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {loading
                  ? 'Loading points table...'
                  : 'Overall category points aggregated across all saved days.'}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={loadResults}
                activeOpacity={0.85}
              >
                <Text style={[styles.actionButtonText, { color: theme.accent }]}>Refresh</Text>
              </TouchableOpacity>
              <CloseActionButton
                onPress={onClose}
                style={[styles.actionButton, styles.closeActionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                textStyle={[styles.closeButton, { color: theme.textPrimary }]}
              />
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.primaryButton} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Preparing category points table...
              </Text>
            </View>
          ) : null}

          {!selectedCategory ? (
            <FlatList
              data={categoryCards}
              keyExtractor={item => item.key}
              contentContainerStyle={styles.categoryRow}
              {...getVirtualizedListProps(responsiveLayout, {
                initialNumToRender: responsiveLayout.isTablet ? 8 : 6,
              })}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setSelectedCategory(item.key)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.categoryCardLabel, { color: theme.textSecondary }]}>Category</Text>
                  <Text style={[styles.categoryCardTitle, { color: theme.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.categoryCardCount, { color: theme.textSecondary }]}>
                    {item.vehicleCount} {item.vehicleCount === 1 ? 'vehicle' : 'vehicles'} | {item.trackCount}{' '}
                    {item.trackCount === 1 ? 'track' : 'tracks'}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No categories available</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Add category records and saved results to build the leaderboard.
                  </Text>
                </View>
              }
            />
          ) : (
            <View style={styles.resultsStage}>
              <View style={styles.stageHeader}>
                <View style={styles.stageHeaderText}>
                  <Text style={[styles.stageTitle, { color: theme.textPrimary }]}>
                    {selectedCategoryConfig?.label || 'Leaderboard'}
                  </Text>
                  <Text style={[styles.stageSubtitle, { color: theme.textSecondary }]}>
                    {leaderboardRows.length} {leaderboardRows.length === 1 ? 'vehicle' : 'vehicles'} sorted by total
                    points. Each track cell shows day-wise timing and points.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={openExportPasswordModal}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.actionButtonText, { color: theme.accent }]}>Export</Text>
                  </TouchableOpacity>
                  <NavigationActionButton
                    label="Back to Categories"
                    onPress={() => setSelectedCategory('')}
                    style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    textStyle={[styles.backButtonText, { color: theme.accent }]}
                  />
                </View>
              </View>

              <View style={[styles.legendCard, { backgroundColor: theme.surfaceAlt || theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.legendTitle, { color: theme.textPrimary }]}>Cell Format</Text>
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                  `Track total points` on top, then day-wise rows like `D1: 02:14:32 | 100 pts | P1`. If a track was not
                  played, the cell shows `NA`. Disputed holds display their remaining auto-submit timer.
                </Text>
              </View>

              {!leaderboardRows.length ? (
                <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No vehicles in this leaderboard</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Save results for this category to build its point table.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  contentContainerStyle={styles.horizontalTableScroll}
                >
                  <View style={{ width: tableWidth }}>
                    <View style={[styles.tableHeaderRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text
                        style={[
                          styles.tableHeaderCell,
                          styles.headerStickerCell,
                          { width: responsiveLayout.stickerWidth, color: theme.textSecondary },
                        ]}
                      >
                        Sticker
                      </Text>
                      <Text
                        style={[
                          styles.tableHeaderCell,
                          styles.headerNameCell,
                          { width: responsiveLayout.nameWidth, color: theme.textSecondary },
                        ]}
                      >
                        Driver
                      </Text>
                      <Text
                        style={[
                          styles.tableHeaderCell,
                          styles.headerNameCell,
                          { width: responsiveLayout.nameWidth, color: theme.textSecondary },
                        ]}
                      >
                        Co-Driver
                      </Text>
                      <Text
                        style={[
                          styles.tableHeaderCell,
                          styles.headerPointsCell,
                          { width: responsiveLayout.pointsWidth, color: theme.textSecondary },
                        ]}
                      >
                        Total
                      </Text>
                      {(selectedCategoryConfig?.tracks || []).map(trackLabel => (
                        <Text
                          key={trackLabel}
                          style={[
                            styles.tableHeaderCell,
                            styles.headerTrackCell,
                            { width: responsiveLayout.trackWidth, color: theme.textSecondary },
                          ]}
                        >
                          {trackLabel}
                        </Text>
                      ))}
                    </View>

                    <FlatList
                      data={leaderboardRows}
                      keyExtractor={item => item.vehicleKey}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.tableBodyContent}
                      {...getVirtualizedListProps(responsiveLayout, {
                        initialNumToRender: responsiveLayout.isTablet ? 10 : 8,
                      })}
                      renderItem={({ item, index }) => (
                        <View
                          style={[
                            styles.tableBodyRow,
                            {
                              backgroundColor: index % 2 === 0 ? theme.surface : theme.surfaceAlt || theme.surface,
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <View style={[styles.infoCell, { width: responsiveLayout.stickerWidth }]}>
                            <Text style={[styles.stickerValue, { color: theme.textPrimary }]}>#{item.stickerNumber}</Text>
                          </View>
                          <View style={[styles.infoCell, { width: responsiveLayout.nameWidth }]}>
                            <Text style={[styles.nameValue, { color: theme.textPrimary }]} numberOfLines={2}>
                              {item.driverName}
                            </Text>
                          </View>
                          <View style={[styles.infoCell, { width: responsiveLayout.nameWidth }]}>
                            <Text style={[styles.nameValue, { color: theme.textPrimary }]} numberOfLines={2}>
                              {item.coDriverName}
                            </Text>
                          </View>
                          <View style={[styles.pointsCell, { width: responsiveLayout.pointsWidth }]}>
                            <Text style={[styles.totalPointsValue, { color: theme.accent }]}>{item.totalPoints}</Text>
                            <Text style={[styles.totalPointsLabel, { color: theme.textSecondary }]}>pts</Text>
                          </View>
                          {item.trackSummaries.map(summary => (
                            <View
                              key={`${item.vehicleKey}-${summary.trackLabel}`}
                              style={[
                                styles.trackCell,
                                { width: responsiveLayout.trackWidth, borderLeftColor: theme.border },
                              ]}
                            >
                              {!summary.entries.length ? (
                                <Text style={[styles.naValue, { color: theme.textSecondary }]}>NA</Text>
                              ) : (
                                <>
                                  <Text style={[styles.trackTotalPoints, { color: theme.accent }]}>
                                    {summary.totalPoints} pts
                                  </Text>
                                  {summary.entries.map(entry => (
                                    <View key={entry.key} style={styles.trackEntryBlock}>
                                      <Text style={[styles.trackEntryLine, { color: theme.textPrimary }]}>
                                        {entry.dayLabel}: {entry.timingLabel}
                                      </Text>
                                      <Text style={[styles.trackEntryMeta, { color: theme.textSecondary }]}>
                                        {entry.pointsLabel} | {entry.rankLabel}
                                      </Text>
                                      <TouchableOpacity
                                        style={[
                                          styles.trackDetailButton,
                                          { borderColor: theme.border, backgroundColor: theme.backgroundStrong },
                                        ]}
                                        onPress={() =>
                                          openTrackDetails({
                                            row: item,
                                            trackLabel: summary.trackLabel,
                                            summary,
                                            entry,
                                          })
                                        }
                                        activeOpacity={0.85}
                                      >
                                        <Text style={[styles.trackDetailButtonText, { color: theme.accent }]}>
                                          Details
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  ))}
                                </>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    />
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>

      {exportPasswordModalVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeExportPasswordModal}
          presentationStyle="overFullScreen"
          hardwareAccelerated={Platform.OS === 'android'}
          statusBarTranslucent={Platform.OS === 'android'}
        >
          <View
            style={[
              styles.passwordOverlay,
              {
                backgroundColor: theme.overlay,
                justifyContent: passwordKeyboardHeight > 0 ? 'flex-start' : 'center',
                paddingBottom: passwordKeyboardHeight > 0 ? Math.max(passwordKeyboardHeight - 12, 20) : 0,
              },
            ]}
          >
            <KeyboardAvoidingView
              style={styles.passwordKeyboardShell}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
            >
              <View style={[styles.passwordShell, { backgroundColor: theme.backgroundStrong, borderColor: theme.border }]}>
                <Text style={[styles.passwordTitle, { color: theme.textPrimary }]}>Enter Password</Text>
                <Text style={[styles.passwordSubtitle, { color: theme.textSecondary }]}>
                  Use the same password you use for Settings to export leaderboard data.
                </Text>

                <TextInput
                  value={exportPasswordInput}
                  autoFocus
                  onChangeText={value => {
                    setExportPasswordInput(value);
                    if (exportPasswordError) {
                      setExportPasswordError('');
                    }
                  }}
                  placeholder="Password"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.passwordInput,
                    { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary },
                  ]}
                  returnKeyType="done"
                  onSubmitEditing={handleExportPasswordSubmit}
                />

                {exportPasswordError ? (
                  <Text style={[styles.passwordErrorText, { color: '#ff8d5c' }]}>{exportPasswordError}</Text>
                ) : null}

                <View style={styles.passwordActions}>
                  <TouchableOpacity
                    style={[styles.passwordActionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={closeExportPasswordModal}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.passwordActionText, { color: theme.textPrimary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.passwordActionButton, { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={handleExportPasswordSubmit}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.passwordActionText, { color: theme.accentText }]}>Export</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}

      {selectedDetail ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeTrackDetails}
          hardwareAccelerated={Platform.OS === 'android'}
          statusBarTranslucent={Platform.OS === 'android'}
        >
          <View style={[styles.detailOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[styles.detailShell, { backgroundColor: theme.backgroundStrong, borderColor: theme.border }]}>
              <View style={[styles.detailHeader, { borderBottomColor: theme.border }]}>
                <View style={styles.detailHeaderText}>
                  <Text style={[styles.detailKicker, { color: theme.accent }]}>Track Details</Text>
                  <Text style={[styles.detailTitle, { color: theme.textPrimary }]}>{selectedDetail.trackLabel}</Text>
                  <Text style={[styles.detailSubtitle, { color: theme.textSecondary }]}>
                    {selectedDetail.categoryLabel} | #{selectedDetail.row?.stickerNumber || '--'} |{' '}
                    {selectedDetail.row?.driverName || '--'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.detailCloseButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={closeTrackDetails}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.detailCloseButtonText, { color: theme.textPrimary }]}>Close</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.detailTopGrid}>
                  {[
                    { label: 'Day', value: selectedDetail.entry?.dayLabel || '--' },
                    { label: 'Timing', value: selectedDetail.entry?.timingLabel || '--' },
                    { label: 'Points', value: selectedDetail.entry?.pointsLabel || '--' },
                    { label: 'Rank', value: selectedDetail.entry?.rankLabel || '--' },
                  ].map(item => (
                    <View key={item.label} style={[styles.detailSummaryCard, { backgroundColor: theme.surface }]}>
                      <Text style={[styles.detailSummaryLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                      <Text style={[styles.detailSummaryValue, { color: theme.textPrimary }]}>{item.value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.detailSectionGrid}>
                  {buildDetailSections(selectedDetail.record || {}).map(section => (
                    <View
                      key={section.title}
                      style={[styles.detailSectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      <Text style={[styles.detailSectionTitle, { color: theme.accent }]}>{section.title}</Text>
                      <View style={styles.detailFieldGrid}>
                        {section.items.map(item => (
                          <View key={item.label} style={[styles.detailFieldCard, { backgroundColor: theme.backgroundStrong }]}>
                            <Text style={[styles.detailFieldLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                            <Text style={[styles.detailFieldValue, { color: theme.textPrimary }]}>
                              {normalizeDetailValue(item.value)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>

                <View style={[styles.detailRawCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.detailSectionTitle, { color: theme.accent }]}>Raw Record</Text>
                  <View style={styles.detailRawGrid}>
                    {[
                      { label: 'Performance Time', value: selectedDetail.record?.performance_time || selectedDetail.record?.performanceTimeDisplay },
                      { label: 'Total Penalties', value: selectedDetail.record?.total_penalties_time || selectedDetail.record?.totalPenaltiesTime },
                      { label: 'Total Time', value: selectedDetail.record?.total_time || selectedDetail.record?.totalTimeDisplay },
                      { label: 'Late Start Status', value: selectedDetail.record?.late_start_status || selectedDetail.record?.lateStartStatus },
                      { label: 'Late Start Penalty', value: selectedDetail.record?.late_start_penalty_time || selectedDetail.record?.lateStartPenaltyTime },
                      { label: 'DNF Points', value: selectedDetail.record?.dnf_points ?? selectedDetail.record?.dnfPoints },
                    ].map(item => (
                      <View key={item.label} style={[styles.detailFieldCard, { backgroundColor: theme.backgroundStrong }]}>
                        <Text style={[styles.detailFieldLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                        <Text style={[styles.detailFieldValue, { color: theme.textPrimary }]}>
                          {normalizeDetailValue(item.value)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080b10',
  },
  shell: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
    textAlign: 'center',
  },
  closeButton: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff6ea',
    fontFamily: BODY_FONT,
  },
  closeActionButton: {
    minWidth: 104,
  },
  passwordOverlay: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  passwordKeyboardShell: {
    flex: 1,
    justifyContent: 'center',
  },
  passwordScrollView: {
    flex: 1,
  },
  passwordScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  passwordShell: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  passwordTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
    textTransform: 'uppercase',
  },
  passwordSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: BODY_FONT,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: BODY_FONT,
  },
  passwordErrorText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: BODY_FONT,
  },
  passwordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  passwordActionButton: {
    minWidth: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordActionText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: BODY_FONT,
    textAlign: 'center',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },
  categoryRow: {
    paddingBottom: 8,
    gap: 12,
  },
  categoryCard: {
    width: '100%',
    minHeight: 124,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  categoryCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  categoryCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
    fontFamily: HEADING_FONT,
  },
  categoryCardCount: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: BODY_FONT,
  },
  resultsStage: {
    flex: 1,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  stageHeaderText: {
    flex: 1,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: HEADING_FONT,
  },
  stageSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: BODY_FONT,
  },
  stageHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: BODY_FONT,
  },
  legendCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: HEADING_FONT,
  },
  legendText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: BODY_FONT,
  },
  horizontalTableScroll: {
    paddingBottom: 24,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tableHeaderCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  headerStickerCell: {
    textAlign: 'left',
  },
  headerNameCell: {
    textAlign: 'left',
  },
  headerPointsCell: {
    textAlign: 'center',
  },
  headerTrackCell: {
    textAlign: 'left',
  },
  tableBodyContent: {
    paddingBottom: 10,
  },
  tableBodyRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  infoCell: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  pointsCell: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerValue: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: BODY_FONT,
  },
  nameValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: BODY_FONT,
  },
  totalPointsValue: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
  },
  totalPointsLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  trackCell: {
    minHeight: 88,
    borderLeftWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  trackTotalPoints: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: HEADING_FONT,
  },
  trackEntryBlock: {
    marginTop: 7,
  },
  trackEntryLine: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    fontFamily: BODY_FONT,
  },
  trackEntryMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: BODY_FONT,
  },
  trackDetailButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  trackDetailButtonText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
    letterSpacing: 0.8,
  },
  naValue: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  emptyState: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: HEADING_FONT,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: BODY_FONT,
  },
  detailOverlay: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  detailShell: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  detailHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  detailKicker: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  detailTitle: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
    textTransform: 'uppercase',
  },
  detailSubtitle: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: BODY_FONT,
  },
  detailCloseButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailCloseButtonText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  detailScrollContent: {
    padding: 16,
    gap: 14,
  },
  detailTopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailSummaryCard: {
    minWidth: 150,
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontFamily: BODY_FONT,
  },
  detailSummaryValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: HEADING_FONT,
    textTransform: 'uppercase',
  },
  detailSectionGrid: {
    gap: 12,
  },
  detailSectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    fontFamily: HEADING_FONT,
  },
  detailFieldGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailFieldCard: {
    minWidth: 150,
    flexGrow: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailFieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: BODY_FONT,
  },
  detailFieldValue: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  detailRawCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  detailRawGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});

export default LeaderboardScreen;
