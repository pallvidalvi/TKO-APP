import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { ResultsService } from '../services/dataService';

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

let FileSystem = null;
let Sharing = null;

if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system/legacy');
  Sharing = require('expo-sharing');
}

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

const getResponsiveLayout = (screenWidth, screenHeight) => {
  const shortestSide = Math.min(screenWidth, screenHeight);
  const isTablet = shortestSide >= 600;
  const shellPadding = isTablet ? 24 : 16;
  const shellMaxWidth = isTablet ? 1120 : screenWidth;

  return {
    isTablet,
    shellPadding,
    shellMaxWidth,
  };
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

const toTitleCase = value =>
  String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const normalizeValue = value => String(value || '').trim().toLowerCase();

const buildDnsCsvRow = item => {
  const nullValue = 'null';

  return [
    item.track_name || item.trackName || nullValue,
    item.sr_no || item.srNo || nullValue,
    item.sticker_number || item.stickerNumber || nullValue,
    item.driver_name || item.driverName || nullValue,
    item.codriver_name || item.coDriverName || nullValue,
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
    'Yes',
    nullValue,
    nullValue,
    nullValue,
    nullValue,
    nullValue,
    'DNS',
    'DNS',
    nullValue,
  ];
};

const downloadCsvFile = async (fileName, headers, rows) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row
        .map(cell => {
          const str = String(cell ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    ),
  ].join('\n');

  if (Platform.OS === 'web') {
    const element = document.createElement('a');
    const file = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    return true;
  }

  if (FileSystem && Sharing) {
    const filePath = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, csvContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Download DNS Report',
        UTI: 'public.comma-separated-values-text',
      });
    }

    return true;
  }

  throw new Error('CSV download not supported on this platform');
};

const ReportScreen = ({ visible, onClose }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const responsiveLayout = getResponsiveLayout(screenWidth, screenHeight);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadResults = async () => {
    try {
      setLoading(true);
      const rows = await ResultsService.getAllResults();
      setResults(rows);
    } catch (error) {
      console.error('Error loading report data:', error);
      Alert.alert('Report Error', 'Unable to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadResults();
    } else {
      setSelectedCategory('');
      setSelectedTrack('');
      setSelectedRecord(null);
    }
  }, [visible]);

  const normalizedResults = results.map(parseRegistrationPayload);
  const categoryBuckets = normalizedResults.reduce((acc, item) => {
    const categoryKey = normalizeValue(item.category || 'Uncategorized');

    if (!acc[categoryKey]) {
      acc[categoryKey] = {
        key: categoryKey,
        label: toTitleCase(item.category || 'Uncategorized'),
        count: 0,
        dnsCount: 0,
      };
    }

    acc[categoryKey].count += 1;
    if (item.is_dns || item.isDns) {
      acc[categoryKey].dnsCount += 1;
    }
    return acc;
  }, {});

  const categoryCards = Object.values(categoryBuckets).sort((a, b) => a.label.localeCompare(b.label));
  const selectedCategoryResults = selectedCategory
    ? normalizedResults.filter(item => normalizeValue(item.category) === selectedCategory)
    : [];
  const trackBuckets = selectedCategoryResults.reduce((acc, item) => {
    const trackKey = normalizeValue(item.track_name || item.trackName || 'Track');
    if (!acc[trackKey]) {
      acc[trackKey] = {
        key: trackKey,
        label: item.track_name || item.trackName || 'Track',
        count: 0,
        dnsCount: 0,
      };
    }
    acc[trackKey].count += 1;
    if (item.is_dns || item.isDns) {
      acc[trackKey].dnsCount += 1;
    }
    return acc;
  }, {});
  const trackCards = Object.values(trackBuckets).sort((a, b) => a.label.localeCompare(b.label));
  const selectedTrackResults = selectedTrack
    ? selectedCategoryResults.filter(item => normalizeValue(item.track_name || item.trackName) === selectedTrack)
    : [];
  const selectedDnsResults = selectedTrackResults.filter(item => Boolean(item.is_dns || item.isDns));
  const selectedCategoryLabel =
    categoryCards.find(item => item.key === selectedCategory)?.label || 'Report';
  const selectedTrackLabel =
    trackCards.find(item => item.key === selectedTrack)?.label || 'Select a Track';

  const handleDownloadDnsCsv = async () => {
    if (!selectedCategory) {
      Alert.alert('DNS CSV', 'Please select a category first.');
      return;
    }

    if (!selectedDnsResults.length) {
      Alert.alert('DNS CSV', 'No DNS records found for the selected category or track.');
      return;
    }

    const fileName = `${selectedCategoryLabel} - ${selectedTrackLabel} - DNS.csv`;
    const rows = selectedDnsResults.map(buildDnsCsvRow);

    try {
      await downloadCsvFile(fileName, RECORD_EXPORT_HEADERS, rows);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate DNS CSV: ' + error.message);
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          {
            paddingHorizontal: responsiveLayout.shellPadding,
            paddingTop: responsiveLayout.isTablet ? 28 : 20,
          },
        ]}
      >
        <View style={[styles.shell, { maxWidth: responsiveLayout.shellMaxWidth }]}>
          <View style={styles.header}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.title}>Report</Text>
              <Text style={styles.subtitle}>
                {loading
                  ? 'Loading saved results...'
                  : selectedCategory
                    ? selectedTrack
                      ? `${selectedCategoryLabel} > ${selectedTrackLabel}`
                      : `${selectedCategoryLabel} tracks available`
                    : `${categoryCards.length} category reports available`}
              </Text>
            </View>
            <View style={styles.actions}>
              {selectedCategory && selectedTrack ? (
                <TouchableOpacity style={styles.actionButton} onPress={handleDownloadDnsCsv} activeOpacity={0.85}>
                  <Text style={styles.actionButtonText}>DNS CSV</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.actionButton} onPress={loadResults} activeOpacity={0.85}>
                <Text style={styles.actionButtonText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.closeButton}>X</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#2f6fed" />
              <Text style={styles.loadingText}>Fetching report data...</Text>
            </View>
          ) : null}

          {!selectedCategory ? (
            <View style={styles.categoryStage}>
              <FlatList
                data={categoryCards}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.key}
                contentContainerStyle={styles.categoryRow}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.categoryCard}
                    onPress={() => {
                      setSelectedCategory(item.key);
                      setSelectedTrack('');
                      setSelectedRecord(null);
                    }}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.categoryCardLabel}>Report</Text>
                    <Text style={styles.categoryCardTitle}>{item.label}</Text>
                    <Text style={styles.categoryCardCount}>
                      {item.count} {item.count === 1 ? 'Result' : 'Results'} | {item.dnsCount} DNS
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No saved submissions yet</Text>
                    <Text style={styles.emptyText}>Submit a result and the category cards will appear here.</Text>
                  </View>
                }
              />
            </View>
          ) : (
            <View style={styles.resultsStage}>
              <View style={styles.stageHeader}>
                <View style={styles.stageHeaderText}>
                  <Text style={styles.stageTitle}>{selectedCategoryLabel} Report</Text>
                  <Text style={styles.stageSubtitle}>
                    {selectedTrack
                      ? `${selectedTrackLabel} | ${selectedTrackResults.length} ${
                          selectedTrackResults.length === 1 ? 'result' : 'results'
                        } | ${selectedDnsResults.length} DNS`
                      : `${trackCards.length} tracks available. Select a track to view results.`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setSelectedCategory('');
                    setSelectedTrack('');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.backButtonText}>Back to Categories</Text>
                </TouchableOpacity>
              </View>

              {!selectedTrack ? (
                <>
                  <FlatList
                    data={trackCards}
                    keyExtractor={item => item.key}
                    contentContainerStyle={styles.trackRow}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.trackCard}
                        onPress={() => setSelectedTrack(item.key)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.trackCardLabel}>Track</Text>
                        <Text style={styles.trackCardTitle}>{item.label}</Text>
                        <Text style={styles.trackCardCount}>
                          {item.count} {item.count === 1 ? 'Result' : 'Results'} | {item.dnsCount} DNS
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.trackBackButton}
                    onPress={() => {
                      setSelectedTrack('');
                      setSelectedRecord(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.trackBackButtonText}>Back to Tracks</Text>
                  </TouchableOpacity>

                  <FlatList
                    data={selectedTrackResults}
                    keyExtractor={(item, index) => String(item.id || index)}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No results in this track</Text>
                        <Text style={styles.emptyText}>
                          Try another track, or submit a new result.
                        </Text>
                      </View>
                    }
                    ListHeaderComponent={
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.srCell]}>Sr.No.</Text>
                        <Text style={[styles.tableHeaderCell, styles.stickerCell]}>Sticker No.</Text>
                        <Text style={[styles.tableHeaderCell, styles.driverCell]}>Driver Name</Text>
                        <Text style={[styles.tableHeaderCell, styles.actionCell]}>Action</Text>
                      </View>
                    }
                    renderItem={({ item, index }) => {
                      const srNo = item.sr_no || item.srNo || index + 1;
                      const trackName = item.track_name || item.trackName || '--';
                      const driverName = item.driver_name || item.driverName || '--';
                      const stickerNumber = item.sticker_number || item.stickerNumber || '--';
                      const buntingCount = item.bunting_count ?? item.bustingCount ?? 0;
                      const seatbeltCount = item.seatbelt_count ?? item.seatbeltCount ?? 0;
                      const groundTouchCount = item.ground_touch_count ?? item.groundTouchCount ?? 0;
                      const lateStartCount = item.late_start_count ?? item.lateStartCount ?? 0;
                      const lateStartStatus = item.late_start_status || item.lateStartStatus || 'No';
                      const attemptCount = item.attempt_count ?? item.attemptCount ?? 0;
                      const taskSkippedCount = item.task_skipped_count ?? item.taskSkippedCount ?? 0;
                      const wrongCourseCount = item.wrong_course_count ?? item.wrongCourseCount ?? 0;
                      const fourthAttemptCount = item.fourth_attempt_count ?? item.fourthAttemptCount ?? 0;
                      const totalPenaltiesTime = item.total_penalties_time ?? item.totalPenaltiesTime ?? 0;
                      const performanceTime = item.performance_time || item.performanceTimeDisplay || '--';
                      const totalTime = item.total_time || item.totalTimeDisplay || '--';
                      const isDns = Boolean(item.is_dns || item.isDns);

                      return (
                        <View style={styles.tableRow}>
                          <Text style={[styles.tableCell, styles.srCell]}>{String(srNo).padStart(2, '0')}</Text>
                          <Text style={[styles.tableCell, styles.stickerCell]}>#{stickerNumber}</Text>
                          <Text style={[styles.tableCell, styles.driverCell]} numberOfLines={1}>
                            {driverName}
                          </Text>
                          <TouchableOpacity
                            style={styles.detailButton}
                            onPress={() =>
                              setSelectedRecord({
                                ...item,
                                srNo,
                                trackName,
                                driverName,
                                stickerNumber,
                                buntingCount,
                                seatbeltCount,
                                groundTouchCount,
                                lateStartCount,
                                lateStartStatus,
                                attemptCount,
                                taskSkippedCount,
                                wrongCourseCount,
                                fourthAttemptCount,
                                totalPenaltiesTime,
                                performanceTime,
                                totalTime,
                                isDns,
                              })
                            }
                            activeOpacity={0.85}
                          >
                            <Text style={styles.detailButtonIcon}>i</Text>
                            <Text style={styles.detailButtonText}>View</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }}
                  />
                </>
              )}

              <Modal
                visible={Boolean(selectedRecord)}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedRecord(null)}
              >
                <View style={styles.detailOverlay}>
                  <View style={styles.detailModal}>
                    <View style={styles.detailHeader}>
                      <Text style={styles.detailTitle}>Result Details</Text>
                      <TouchableOpacity onPress={() => setSelectedRecord(null)} activeOpacity={0.85}>
                        <Text style={styles.closeButton}>X</Text>
                      </TouchableOpacity>
                    </View>

                    {selectedRecord ? (
                      <FlatList
                        data={[
                          ['Sr. No.', String(selectedRecord.srNo).padStart(2, '0')],
                          ['Track Name', selectedRecord.trackName || '--'],
                          ['Sticker Number', `#${selectedRecord.stickerNumber || '--'}`],
                          ['Driver Name', selectedRecord.driverName || '--'],
                          ['Co-Driver Name', selectedRecord.codriver_name || selectedRecord.coDriverName || '--'],
                          ['Category', selectedRecord.category || '--'],
                          ['Bunting Count', String(selectedRecord.buntingCount ?? 0)],
                          ['Seatbelt Count', String(selectedRecord.seatbeltCount ?? 0)],
                          ['Ground Touch Count', String(selectedRecord.groundTouchCount ?? 0)],
                          ['Late Start Count', String(selectedRecord.lateStartCount ?? 0)],
                          ['Late Start Status', selectedRecord.lateStartStatus || 'No'],
                          ['Attempt Count', String(selectedRecord.attemptCount ?? 0)],
                          ['Task Skipped Count', String(selectedRecord.taskSkippedCount ?? 0)],
                          ['Wrong Course Count', String(selectedRecord.wrongCourseCount ?? 0)],
                          ['4th Attempt Count', String(selectedRecord.fourthAttemptCount ?? 0)],
                          ['Total Penalty Time', String(selectedRecord.totalPenaltiesTime ?? 0)],
                          ['Performance Time', selectedRecord.performanceTime || '--'],
                          ['Total Time', selectedRecord.totalTime || '--'],
                          ['DNS', formatBoolValue(selectedRecord.isDns)],
                        ]}
                        keyExtractor={(_, index) => String(index)}
                        renderItem={({ item }) => (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>{item[0]}</Text>
                            <Text style={styles.detailValue}>{item[1]}</Text>
                          </View>
                        )}
                      />
                    ) : null}
                  </View>
                </View>
              </Modal>
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
    gap: 10,
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
    fontSize: 18,
    fontWeight: '900',
    color: '#fff6ea',
    fontFamily: BODY_FONT,
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
  categoryStage: {
    marginBottom: 12,
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
  categoryRow: {
    paddingBottom: 8,
    gap: 12,
  },
  categoryCard: {
    width: 170,
    minHeight: 120,
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
  trackCardSelected: {
    borderColor: '#ff8a1f',
    backgroundColor: '#171d27',
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
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
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
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  tableCell: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff6ea',
    fontFamily: BODY_FONT,
  },
  srCell: {
    width: 64,
    paddingRight: 6,
  },
  stickerCell: {
    width: 110,
    paddingRight: 6,
  },
  driverCell: {
    flex: 1,
    paddingRight: 6,
  },
  actionCell: {
    width: 86,
    textAlign: 'center',
  },
  detailButton: {
    width: 86,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ff8a1f',
    borderWidth: 1,
    borderColor: '#ffb15a',
  },
  detailButtonIcon: {
    fontSize: 14,
    fontWeight: '900',
    color: '#161616',
    lineHeight: 16,
  },
  detailButtonText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: '#161616',
    fontFamily: BODY_FONT,
  },
  listContent: {
    paddingBottom: 24,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  detailModal: {
    backgroundColor: '#111722',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a3441',
    paddingHorizontal: 18,
    paddingVertical: 18,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff6ea',
    fontFamily: HEADING_FONT,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingRight: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3441',
  },
  detailKey: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#cdbf9a',
    paddingRight: 12,
    fontFamily: BODY_FONT,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#fff6ea',
    textAlign: 'right',
    paddingRight: 4,
    fontFamily: BODY_FONT,
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
