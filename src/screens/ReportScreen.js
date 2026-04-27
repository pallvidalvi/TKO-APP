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
} from 'react-native';
import { ResultsService, DisputesService, promoteExpiredDisputesToResults } from '../services/dataService';
import TouchableOpacity from '../components/FastTouchableOpacity';
import { CloseActionButton, NavigationActionButton } from '../components/NavigationActionButton';
import {
  DISPUTE_AUTO_SUBMIT_POLL_MS,
  getDisputeAutoSubmitStatus,
  getDisputeResolutionLabel,
  isDnsResult,
  rankTrackResults,
} from '../utils/scoring';

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
    ? Math.min(screenWidth - (isLandscape ? 40 : 32), isLargeTablet ? 1180 : 1080)
    : screenWidth;

  return {
    isTablet,
    isLargeTablet,
    shellPadding,
    shellMaxWidth,
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
    return registration || {};
  }
};

const normalizeValue = value => String(value || '').trim().toLowerCase();
const normalizeDateValue = value =>
  normalizeValue(value)
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCategoryKey = value => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalized === 'LADIES' || normalized === 'LADIES_CATEGORY') {
    return 'LADIES_CATEGORY';
  }

  return normalized;
};

const getDayIdentity = item => ({
  dayId: normalizeValue(item.selected_day_id || item.selectedDayId || item.day_id || item.dayId || ''),
  dayLabel: normalizeValue(
    item.selected_day_label || item.selectedDayLabel || item.day_label || item.dayLabel || ''
  ),
  dayDate: normalizeDateValue(
    item.selected_day_date || item.selectedDayDate || item.day_date || item.dayDate || ''
  ),
});

const matchesSelectedDay = (item, selectedDay) => {
  if (!selectedDay?.id) {
    return false;
  }

  const itemDay = getDayIdentity(item);
  const selectedDayId = normalizeValue(selectedDay.id);
  const selectedDayLabel = normalizeValue(selectedDay.dayLabel);
  const selectedDayDate = normalizeDateValue(selectedDay.dateLabel);

  return (
    itemDay.dayId === selectedDayId ||
    itemDay.dayLabel === selectedDayLabel ||
    itemDay.dayDate === selectedDayDate
  );
};

const getResultIdentityKey = item => {
  const dayIdentity = getDayIdentity(item);

  return [
    normalizeCategoryKey(item.category),
    normalizeValue(item.track_name || item.trackName),
    normalizeValue(item.sticker_number || item.stickerNumber),
    normalizeValue(item.driver_name || item.driverName),
    dayIdentity.dayId || dayIdentity.dayLabel || dayIdentity.dayDate,
  ].join('|');
};

const getNormalizedDisputeDetailEntries = source => {
  const rawDetails = source?.disputeDetails ?? source?.dispute_details ?? [];

  if (!Array.isArray(rawDetails)) {
    return [];
  }

  return rawDetails
    .map(entry => {
      const key = String(entry?.key || '').trim();
      const label = String(entry?.label || '').trim();
      const detail = String(entry?.detail || '').trim();

      if (!key || !label || !detail) {
        return null;
      }

      return {
        key,
        label,
        detail,
      };
    })
    .filter(Boolean);
};

const formatDisputeEntriesInline = source =>
  getNormalizedDisputeDetailEntries(source)
    .map(entry => `${entry.label}: ${entry.detail}`)
    .join(' • ');

const ReportScreen = ({ visible, onClose, selectedDay, categoryOptions = [], theme = DEFAULT_THEME }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

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
      console.error('Error loading report data:', error);
      Alert.alert('Report Error', 'Unable to load report data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadResults();
    } else {
      setSelectedCategory('');
      setSelectedTrack('');
    }
  }, [loadResults, visible]);

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
          console.warn('Unable to auto-submit expired disputes in reports:', error);
        });
    }, DISPUTE_AUTO_SUBMIT_POLL_MS);

    return () => {
      clearInterval(clockIntervalId);
      clearInterval(disputeIntervalId);
    };
  }, [loadResults, visible]);

  useEffect(() => {
    setSelectedCategory('');
    setSelectedTrack('');
  }, [selectedDay?.id]);

  const normalizedResults = useMemo(
    () => results.map(parseRegistrationPayload),
    [results]
  );

  const normalizedDisputes = useMemo(
    () =>
      disputes.map(dispute => ({
        ...parseRegistrationPayload(dispute),
        isDisputed: true,
      })),
    [disputes]
  );

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

  const allowedCategoryMap = useMemo(
    () =>
      categoryOptions.reduce((acc, item) => {
        acc[item.key] = item;
        return acc;
      }, {}),
    [categoryOptions]
  );

  const daySpecificResults = useMemo(
    () =>
      uniqueResults.filter(item => {
        if (!matchesSelectedDay(item, selectedDay)) {
          return false;
        }

        const categoryKey = normalizeCategoryKey(item.category || 'Uncategorized');
        const categoryConfig = allowedCategoryMap[categoryKey];

        if (!categoryConfig) {
          return false;
        }

        const trackName = item.track_name || item.trackName || '';
        return categoryConfig.tracks.some(track => normalizeValue(track) === normalizeValue(trackName));
      }),
    [allowedCategoryMap, selectedDay?.dateLabel, selectedDay?.dayLabel, selectedDay?.id, uniqueResults]
  );

  const categoryCards = useMemo(() => {
    const countsByCategory = daySpecificResults.reduce((acc, item) => {
      const categoryKey = normalizeCategoryKey(item.category || 'Uncategorized');
      acc[categoryKey] = (acc[categoryKey] || 0) + 1;
      return acc;
    }, {});

    return categoryOptions
      .map(item => ({
        key: item.key,
        label: item.label,
        count: countsByCategory[item.key] || 0,
        tracks: item.tracks || [],
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryOptions, daySpecificResults]);

  const selectedCategoryConfig = categoryCards.find(item => item.key === selectedCategory) || null;

  const selectedCategoryResults = useMemo(
    () =>
      selectedCategory
        ? daySpecificResults.filter(item => normalizeCategoryKey(item.category || 'Uncategorized') === selectedCategory)
        : [],
    [daySpecificResults, selectedCategory]
  );

  const trackCards = useMemo(() => {
    if (!selectedCategoryConfig) {
      return [];
    }

    const countsByTrack = selectedCategoryResults.reduce((acc, item) => {
      const trackKey = normalizeValue(item.track_name || item.trackName || '');
      acc[trackKey] = (acc[trackKey] || 0) + 1;
      return acc;
    }, {});

    return selectedCategoryConfig.tracks.map(track => ({
      key: normalizeValue(track),
      label: track,
      count: countsByTrack[normalizeValue(track)] || 0,
    }));
  }, [selectedCategoryConfig, selectedCategoryResults]);

  const selectedTrackResults = useMemo(() => {
    if (!selectedTrack) {
      return [];
    }

    return rankTrackResults(
      selectedCategoryResults.filter(item => normalizeValue(item.track_name || item.trackName || '') === selectedTrack)
    );
  }, [selectedCategoryResults, selectedTrack]);

  useEffect(() => {
    if (selectedCategory && !categoryCards.some(item => item.key === selectedCategory)) {
      setSelectedCategory('');
      setSelectedTrack('');
    }
  }, [categoryCards, selectedCategory]);

  useEffect(() => {
    if (selectedTrack && !trackCards.some(item => item.key === selectedTrack)) {
      setSelectedTrack('');
    }
  }, [selectedTrack, trackCards]);

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
              <Text style={[styles.title, { color: theme.textPrimary }]}>Reports</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {loading
                  ? 'Loading saved results...'
                  : `${selectedDay?.dayLabel || 'Selected Day'} | ${selectedDay?.dateLabel || 'No date selected'}`}
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
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Fetching saved records...</Text>
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
                  onPress={() => {
                    setSelectedCategory(item.key);
                    setSelectedTrack('');
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.categoryCardLabel, { color: theme.textSecondary }]}>Category</Text>
                  <Text style={[styles.categoryCardTitle, { color: theme.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.categoryCardCount, { color: theme.textSecondary }]}>
                    {item.count} {item.count === 1 ? 'Record' : 'Records'}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No reports for this day</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Saved results will appear here only for the selected day.
                  </Text>
                </View>
              }
            />
          ) : (
            <View style={styles.resultsStage}>
              <View style={styles.stageHeader}>
                <View style={styles.stageHeaderText}>
                  <Text style={[styles.stageTitle, { color: theme.textPrimary }]}>{selectedCategoryConfig?.label || 'Reports'}</Text>
                  <Text style={[styles.stageSubtitle, { color: theme.textSecondary }]}>
                    {!selectedTrack
                      ? 'Select an active track for this day.'
                      : `${selectedTrackResults.length} ${selectedTrackResults.length === 1 ? 'record' : 'records'} in ${trackCards.find(item => item.key === selectedTrack)?.label || ''} | Points are calculated for this track only.`}
                  </Text>
                </View>
                <NavigationActionButton
                  label="Back to Categories"
                  onPress={() => {
                    setSelectedCategory('');
                    setSelectedTrack('');
                  }}
                  style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  textStyle={[styles.backButtonText, { color: theme.accent }]}
                />
              </View>

              {!selectedTrack ? (
                <FlatList
                  data={trackCards}
                  keyExtractor={item => item.key}
                  contentContainerStyle={styles.trackRow}
                  {...getVirtualizedListProps(responsiveLayout, {
                    initialNumToRender: responsiveLayout.isTablet ? 8 : 6,
                  })}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.trackCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => setSelectedTrack(item.key)}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.trackCardLabel, { color: theme.textSecondary }]}>Active Track</Text>
                      <Text style={[styles.trackCardTitle, { color: theme.textPrimary }]}>{item.label}</Text>
                      <Text style={[styles.trackCardCount, { color: theme.textSecondary }]}>
                        {item.count} {item.count === 1 ? 'Record' : 'Records'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No active tracks</Text>
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        This category has no active tracks for the selected day.
                      </Text>
                    </View>
                  }
                />
              ) : (
                <>
                  <NavigationActionButton
                    label="Back to Tracks"
                    onPress={() => setSelectedTrack('')}
                    style={[styles.trackBackButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    textStyle={[styles.trackBackButtonText, { color: theme.accent }]}
                  />

                  <FlatList
                    data={selectedTrackResults}
                    keyExtractor={(item, index) => `${item.id || 'result'}-${getResultIdentityKey(item)}-${index}`}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    {...getVirtualizedListProps(responsiveLayout, {
                      initialNumToRender: responsiveLayout.isTablet ? 10 : 8,
                    })}
                    ListHeaderComponent={
                      <View style={[styles.tableHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.tableHeaderCell, styles.stickerCell, { color: theme.textSecondary }]}>Sticker No.</Text>
                        <Text style={[styles.tableHeaderCell, styles.driverCell, { color: theme.textSecondary }]}>Driver Name</Text>
                        <Text style={[styles.tableHeaderCell, styles.codriverCell, { color: theme.textSecondary }]}>Co-Driver Name</Text>
                        <Text style={[styles.tableHeaderCell, styles.totalHeaderCell, { color: theme.textSecondary }]}>Timing / Points</Text>
                      </View>
                    }
                    ListEmptyComponent={
                      <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No records in this track</Text>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                          Submit a result for this active track and it will appear here.
                        </Text>
                      </View>
                    }
                    renderItem={({ item }) => {
                      const stickerNumber = item.sticker_number || item.stickerNumber || '--';
                      const driverName = item.driver_name || item.driverName || '--';
                      const coDriverName = item.codriver_name || item.coDriverName || '--';
                      const disputeDetailSummary = item.isDisputed ? formatDisputeEntriesInline(item) : '';
                      const disputeResolutionLabel = getDisputeResolutionLabel(item);
                      const disputeStatus = item.isDisputed ? getDisputeAutoSubmitStatus(item, nowTimestamp) : null;
                      const totalTime = item.isDisputed
                        ? 'Hold'
                        : isDnsResult(item)
                        ? 'DNS'
                        : item.total_time || item.totalTimeDisplay || '--';
                      const pointsLabel =
                        item.reportPoints === null || item.reportPoints === undefined ? '--' : `${item.reportPoints}`;
                      const resultMetaLabel = item.isDisputed
                        ? `Auto-submit in ${disputeStatus?.remainingLabel || '00:00'}`
                        : item.reportRankLabel
                        ? `${item.reportRankLabel} | ${pointsLabel} pts`
                        : `${pointsLabel} pts`;

                      if (item.isDisputed && disputeDetailSummary) {
                        return (
                          <View style={[styles.tableRowGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                            <View style={styles.tableRowMain}>
                              <Text style={[styles.tableCell, styles.stickerCell, { color: theme.textPrimary }]}>#{stickerNumber}</Text>
                              <Text style={[styles.tableCell, styles.driverCell, { color: theme.textPrimary }]} numberOfLines={1}>
                                {driverName}
                              </Text>
                              <Text style={[styles.tableCell, styles.codriverCell, { color: theme.textPrimary }]} numberOfLines={1}>
                                {coDriverName}
                              </Text>
                              <View style={styles.totalCell}>
                                <Text
                                  style={[
                                    styles.tableCell,
                                    styles.totalValueText,
                                    { color: theme.accent },
                                    styles.disputedValue,
                                  ]}
                                >
                                  {totalTime}
                                </Text>
                                <Text style={[styles.pointsMetaText, { color: theme.textSecondary }]}>
                                  {resultMetaLabel}
                                </Text>
                                {disputeResolutionLabel ? (
                                  <Text style={[styles.pointsMetaText, { color: theme.accent }]}>
                                    Resolution: {disputeResolutionLabel}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                            <Text style={[styles.disputeDetailText, { color: theme.textSecondary }]}>
                              {disputeDetailSummary}
                            </Text>
                          </View>
                        );
                      }

                      return (
                        <View style={[styles.tableRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                          <Text style={[styles.tableCell, styles.stickerCell, { color: theme.textPrimary }]}>#{stickerNumber}</Text>
                          <Text style={[styles.tableCell, styles.driverCell, { color: theme.textPrimary }]} numberOfLines={1}>
                            {driverName}
                          </Text>
                          <Text style={[styles.tableCell, styles.codriverCell, { color: theme.textPrimary }]} numberOfLines={1}>
                            {coDriverName}
                          </Text>
                          <View style={styles.totalCell}>
                            <Text
                              style={[
                                styles.tableCell,
                                styles.totalValueText,
                                { color: item.isDisputed ? theme.accent : theme.textPrimary },
                                item.isDisputed && styles.disputedValue,
                              ]}
                            >
                              {totalTime}
                            </Text>
                            <Text style={[styles.pointsMetaText, { color: theme.textSecondary }]}>
                              {resultMetaLabel}
                            </Text>
                            {disputeResolutionLabel ? (
                              <Text style={[styles.pointsMetaText, { color: theme.accent }]}>
                                Resolution: {disputeResolutionLabel}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    }}
                  />
                </>
              )}
            </View>
          )}
        </View>
      </View>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
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
  resultsStage: {
    flex: 1,
  },
  categoryRow: {
    paddingBottom: 8,
    gap: 12,
  },
  categoryCard: {
    width: '100%',
    minHeight: 124,
    backgroundColor: '#111722',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  categoryCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  categoryCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff6ea',
    lineHeight: 21,
    fontFamily: HEADING_FONT,
  },
  categoryCardCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
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
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },
  stageSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffb15a',
    fontFamily: BODY_FONT,
  },
  trackRow: {
    paddingBottom: 8,
    gap: 10,
  },
  trackCard: {
    width: '100%',
    minHeight: 82,
    backgroundColor: '#111722',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3441',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'flex-start',
  },
  trackCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  trackCardTitle: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },
  trackCardCount: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },
  trackBackButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
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
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#cdbf9a',
    textTransform: 'uppercase',
    fontFamily: BODY_FONT,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  tableRowGroup: {
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  tableRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff6ea',
    fontFamily: BODY_FONT,
  },
  stickerCell: {
    width: 100,
    paddingRight: 8,
  },
  driverCell: {
    flex: 1,
    paddingRight: 8,
  },
  codriverCell: {
    flex: 1,
    paddingRight: 8,
  },
  totalHeaderCell: {
    width: 124,
    textAlign: 'right',
  },
  totalCell: {
    width: 124,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  totalValueText: {
    textAlign: 'right',
  },
  pointsMetaText: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    fontFamily: BODY_FONT,
  },
  disputedValue: {
    color: '#ffb15a',
  },
  disputeDetailText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyState: {
    backgroundColor: '#111722',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: '#cdbf9a',
    fontFamily: BODY_FONT,
  },
});

export default ReportScreen;
