import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { initializeDatabase, seedDatabase, getAllTeams } from './src/db/database';
import { TeamsService, CategoriesService } from './src/services/dataService';

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
const IS_PORTRAIT = height >= width;
const CARD_WIDTH = IS_TABLET ? (width - 76) / 2 : (width - 44) / 2;

const AVAILABLE_TRACKS = ['Pratapgad', 'Rajgad', 'Purandar'];

const normalizeCategoryKey = (value = '') =>
  value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

const attachTeamCountsToCategories = (categories = [], teams = []) =>
  categories.map(category => ({
    ...category,
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

const getTeamTracks = (team = {}) => {
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

  return AVAILABLE_TRACKS;
};

/**
 * CategoryCard Component
 * Displays individual category with animation on press and team count
 */
const CategoryCard = ({ category, onPress, teamCount = 0 }) => {
  const [scaleAnim] = useState(new Animated.Value(1));

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
        style={styles.card}
      >
        <View style={styles.cardContent}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: category.color || '#ff4757' },
            ]}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
          </View>

          <View style={styles.textContent}>
            <Text style={styles.categoryName}>{category.name}</Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>{teamCount}</Text>
            <Text style={styles.countLabel}>teams</Text>
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

/**
 * PenaltyCounter Component
 * Provides increment/decrement buttons with manual input for penalty counts
 */
const PenaltyCounter = ({ label, count, onCountChange, penaltyTime }) => {
  const handleIncrement = () => {
    onCountChange(String((parseInt(count) || 0) + 1));
  };

  const handleDecrement = () => {
    const newValue = Math.max(0, (parseInt(count) || 0) - 1);
    onCountChange(String(newValue));
  };

  return (
    <View style={styles.penaltyCard}>
      <Text style={styles.penaltyCardLabel}>{label}</Text>
      <View style={styles.penaltyCardControls}>
        <TouchableOpacity
          style={styles.counterButton}
          onPress={handleDecrement}
          activeOpacity={0.8}
        >
          <Text style={styles.counterButtonText}>-</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.counterInput}
          value={count}
          editable={false}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="0"
          placeholderTextColor="#ccc"
        />
        <TouchableOpacity
          style={styles.counterButton}
          onPress={handleIncrement}
          activeOpacity={0.8}
        >
          <Text style={styles.counterButtonText}>+</Text>
        </TouchableOpacity>
        <View style={styles.penaltyValuePill}>
          <Text style={styles.penaltyValue}>{penaltyTime}s</Text>
        </View>
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
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [srNo, setSrNo] = useState('');
  const [stickerNumber, setStickerNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [coDriverName, setCoDriverName] = useState('');
  const [bustingCount, setBustingCount] = useState('0');
  const [seatbeltCount, setSeatbeltCount] = useState('0');
  const [groundTouchCount, setGroundTouchCount] = useState('0');
  const [lateStartCount, setLateStartCount] = useState('0');
  const [attemptCount, setAttemptCount] = useState('0');
  const [taskSkippedCount, setTaskSkippedCount] = useState('0');
  const [wrongCourseCount, setWrongCourseCount] = useState('0');
  const [fourthAttemptCount, setFourthAttemptCount] = useState('0');
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);

  const PENALTY_VALUES = {
    busting: 20,
    seatbelt: 30,
    groundTouch: 30,
    lateStart: 30,
    attempt: 30,
    taskSkipped: 60,
    wrongCourse: 60,
    fourthAttempt: 60,
  };

  const calculatePenaltyTime = (count, multiplier) => {
    const numCount = parseInt(count, 10) || 0;
    return numCount * multiplier;
  };

  const bustingPenaltyTime = calculatePenaltyTime(bustingCount, PENALTY_VALUES.busting);
  const seatbeltPenaltyTime = calculatePenaltyTime(seatbeltCount, PENALTY_VALUES.seatbelt);
  const groundTouchPenaltyTime = calculatePenaltyTime(groundTouchCount, PENALTY_VALUES.groundTouch);
  const lateStartPenaltyTime = calculatePenaltyTime(lateStartCount, PENALTY_VALUES.lateStart);
  const attemptPenaltyTime = calculatePenaltyTime(attemptCount, PENALTY_VALUES.attempt);
  const taskSkippedPenaltyTime = calculatePenaltyTime(taskSkippedCount, PENALTY_VALUES.taskSkipped);
  const wrongCoursePenaltyTime = calculatePenaltyTime(wrongCourseCount, PENALTY_VALUES.wrongCourse);
  const fourthAttemptPenaltyTime = calculatePenaltyTime(fourthAttemptCount, PENALTY_VALUES.fourthAttempt);

  const totalPenaltiesTime =
    bustingPenaltyTime +
    seatbeltPenaltyTime +
    groundTouchPenaltyTime +
    lateStartPenaltyTime +
    attemptPenaltyTime +
    taskSkippedPenaltyTime;

  const completionTimeInSeconds = Math.floor(stopwatchTime / 1000);
  const totalTime = totalPenaltiesTime + completionTimeInSeconds;

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
      const recordTracks = getTeamTracks(initialRecord);
      setSrNo(String(initialRecord.srNo || ''));
      setStickerNumber(String(getTeamStickerNumber(initialRecord) || ''));
      setDriverName(initialRecord.driver_name || initialRecord.driverName || '');
      setCoDriverName(initialRecord.codriver_name || initialRecord.coDriverName || '');
      setTrackName(initialRecord.selectedTrack || recordTracks[0] || AVAILABLE_TRACKS[0]);
    }
  }, [visible, initialRecord]);

  const toggleStopwatch = () => {
    setIsStopwatchRunning(prev => !prev);
  };

  const resetStopwatch = () => {
    setStopwatchTime(0);
    setIsStopwatchRunning(false);
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  const formatTimeWithMs = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:00`;
  };

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
    setLateStartCount('0');
    setAttemptCount('0');
    setTaskSkippedCount('0');
    setWrongCourseCount('0');
    setFourthAttemptCount('0');
  };

  const handleClose = () => {
    resetForm();
    resetStopwatch();
    onClose();
  };

  const generateAndDownloadExcel = async (data) => {
    try {
      const headers = [
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
        'Late Start (Count)',
        'Late Start (Time)',
        'Attempt (Count)',
        'Attempt (Time)',
        'Task Skipped (Count)',
        'Task Skipped (Time)',
        'Wrong Course (Count)',
        'Wrong Course (Time)',
        '4th Attempt (Count)',
        '4th Attempt (Time)',
        'Total Penalties Time (sec)',
        'Performance Time (MM:SS:MS)',
        'Total Time (MM:SS:MS)',
        'Submission Date',
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
        data.lateStartCount,
        data.lateStartPenaltyTime,
        data.attemptCount,
        data.attemptPenaltyTime,
        data.taskSkippedCount,
        data.taskSkippedPenaltyTime,
        data.wrongCourseCount,
        data.wrongCoursePenaltyTime,
        data.fourthAttemptCount,
        data.fourthAttemptPenaltyTime,
        data.totalPenaltiesTime,
        formatTimeWithMs(data.completionTimeSeconds),
        formatTimeWithMs(data.totalTime),
        new Date().toLocaleString(),
      ]];

      const fileName = `${data.category} - ${data.trackName}.csv`;
      await CSVExporter.downloadFile(fileName, headers, rows);
      Alert.alert('Success!', `File downloaded: ${fileName}`);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to generate file: ' + error.message);
      console.error('File generation error:', error);
    }
  };

  const handleSubmit = () => {
    if (!trackName.trim()) {
      Alert.alert('Error', 'Please select Track Name');
      return;
    }
    if (!driverName.trim() || !stickerNumber.trim() || !coDriverName.trim()) {
      Alert.alert('Error', 'Selected record details are incomplete');
      return;
    }

    const formData = {
      trackName,
      category: category?.name || '',
      srNo,
      stickerNumber,
      driverName,
      coDriverName,
      completionTime: formatTime(stopwatchTime),
      completionTimeSeconds: completionTimeInSeconds,
      bustingCount,
      seatbeltCount,
      groundTouchCount,
      lateStartCount,
      attemptCount,
      taskSkippedCount,
      wrongCourseCount,
      fourthAttemptCount,
      bustingPenaltyTime,
      seatbeltPenaltyTime,
      groundTouchPenaltyTime,
      lateStartPenaltyTime,
      attemptPenaltyTime,
      taskSkippedPenaltyTime,
      wrongCoursePenaltyTime,
      fourthAttemptPenaltyTime,
      totalPenaltiesTime,
      totalTime,
    };

    generateAndDownloadExcel(formData);
    onSubmit(formData);
    resetStopwatch();
    resetForm();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
    >
      {category ? (
        <View style={styles.fullPageContainer}>
          <View style={styles.fullPageContent}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{category.name}</Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formBody}>
              <View style={styles.dashboardLayout}>
                <View style={styles.dashboardLeftPanel}>
                  <View style={styles.detailsAccordion}>
                    <TouchableOpacity
                      style={styles.detailsAccordionHeader}
                      onPress={() => setDetailsExpanded(prev => !prev)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.detailsTrackPill}>
                        <Text style={styles.detailsTrackPillText}>
                          {trackName || AVAILABLE_TRACKS[0]}
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

                  <View style={styles.timerHeroCard}>
                    <Text style={styles.stopwatchDisplay}>{formatTime(stopwatchTime)}</Text>
                    <View style={styles.stopwatchButtonsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.stopwatchButton,
                          isStopwatchRunning && styles.stopwatchButtonActive,
                        ]}
                        onPress={toggleStopwatch}
                      >
                        <Text style={styles.stopwatchButtonText}>
                          {isStopwatchRunning ? 'Stop Timer' : 'Start Timer'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.stopwatchButton, styles.stopwatchResetButton, styles.stopwatchResetCompact]}
                        onPress={resetStopwatch}
                      >
                        <Text style={styles.stopwatchButtonText}>RST</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.dashboardRightPanel}>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Penalties</Text>
                    <View style={styles.penaltyGrid}>
                      <PenaltyCounter
                        label="Bunting & Pole (20s)"
                        count={bustingCount}
                        onCountChange={setBustingCount}
                        penaltyTime={bustingPenaltyTime}
                      />
                      <PenaltyCounter
                        label="Seatbelt (30s)"
                        count={seatbeltCount}
                        onCountChange={setSeatbeltCount}
                        penaltyTime={seatbeltPenaltyTime}
                      />
                      <PenaltyCounter
                        label="Ground Touch (30s)"
                        count={groundTouchCount}
                        onCountChange={setGroundTouchCount}
                        penaltyTime={groundTouchPenaltyTime}
                      />
                      <PenaltyCounter
                        label="Late Start (30s)"
                        count={lateStartCount}
                        onCountChange={setLateStartCount}
                        penaltyTime={lateStartPenaltyTime}
                      />
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tasks</Text>
                    <View style={styles.penaltyGrid}>
                      <PenaltyCounter
                        label="Task Attempt (30s)"
                        count={attemptCount}
                        onCountChange={setAttemptCount}
                        penaltyTime={attemptPenaltyTime}
                      />
                      <PenaltyCounter
                        label="Task Skip (60s)"
                        count={taskSkippedCount}
                        onCountChange={setTaskSkippedCount}
                        penaltyTime={taskSkippedPenaltyTime}
                      />
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DNF (Did Not Finish)</Text>
                    <View style={styles.penaltyGrid}>
                      <PenaltyCounter
                        label="Wrong Course (60s)"
                        count={wrongCourseCount}
                        onCountChange={setWrongCourseCount}
                        penaltyTime={wrongCoursePenaltyTime}
                      />
                      <PenaltyCounter
                        label="4th Attempt (60s)"
                        count={fourthAttemptCount}
                        onCountChange={setFourthAttemptCount}
                        penaltyTime={fourthAttemptPenaltyTime}
                      />
                    </View>
                  </View>

                  {IS_PORTRAIT ? (
                    <View style={styles.summarySection}>
                      <Text style={styles.summaryTitle}>Time Summary</Text>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total Penalties Time:</Text>
                        <Text style={styles.summaryValue}>{totalPenaltiesTime} sec</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Performance Time:</Text>
                        <Text style={styles.summaryValue}>
                          {formatTimeWithMs(completionTimeInSeconds)}
                        </Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryRowTotal}>
                        <Text style={styles.summaryLabelTotal}>TOTAL TIME:</Text>
                        <Text style={styles.summaryValueTotal}>{formatTimeWithMs(totalTime)}</Text>
                      </View>
                    </View>
                  ) : null}

                </View>
              </View>

              {!IS_PORTRAIT ? (
                <View style={styles.tabletFooterPanel}>
                  <View style={styles.summarySection}>
                    <Text style={styles.summaryTitle}>Time Summary</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Penalties Time:</Text>
                      <Text style={styles.summaryValue}>{totalPenaltiesTime} sec</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Performance Time:</Text>
                      <Text style={styles.summaryValue}>
                        {formatTimeWithMs(completionTimeInSeconds)}
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRowTotal}>
                      <Text style={styles.summaryLabelTotal}>TOTAL TIME:</Text>
                      <Text style={styles.summaryValueTotal}>{formatTimeWithMs(totalTime)}</Text>
                    </View>
                  </View>

                </View>
              ) : null}
            </View>

            <View style={styles.submitActionBar}>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Submit & Download CSV</Text>
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
  onTrackSelect,
  selectedTracksByRecord,
  completedTracksByRecord,
}) => (
  <Modal
    visible={visible}
    transparent={false}
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.recordsPageContainer}>
      <View style={styles.recordsHeader}>
        <View>
          <Text style={styles.recordsTitle}>{category?.name || 'Category Records'}</Text>
          <Text style={styles.recordsSubtitle}>
            {records.length} {records.length === 1 ? 'record' : 'records'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item, index) => String(item.id || item.car_number || index)}
        contentContainerStyle={styles.recordsListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No records found</Text>
            <Text style={styles.emptyStateText}>
              {"This category doesn't have any teams yet."}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const tracks = getTeamTracks(item);
          const recordKey = getRecordKey(item);
          const selectedTrack = selectedTracksByRecord[recordKey];
          const completedTracks = completedTracksByRecord[recordKey] || [];
          const canStart = Boolean(selectedTrack) && !completedTracks.includes(selectedTrack);

          return (
            <View style={styles.recordCard}>
              <View style={styles.recordTopRow}>
                <View style={styles.recordMetaBlock}>
                  <Text style={styles.recordMetaLabel}>SR.</Text>
                  <Text style={styles.recordMetaValue}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>

                <View style={styles.recordMetaBlockWide}>
                  <Text style={styles.recordMetaLabel}>Sticker No.</Text>
                  <Text style={styles.recordStickerValue}>
                    #{getTeamStickerNumber(item) || '--'}
                  </Text>
                </View>

                <View style={styles.recordDriverBlock}>
                  <Text style={styles.recordMetaLabel}>Driver Name</Text>
                  <Text style={styles.recordDriverName}>
                    {item.driver_name || item.driverName || 'Unknown Driver'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.startButton, !canStart && styles.startButtonDisabled]}
                  onPress={() =>
                    canStart ? onStart({ ...item, srNo: index + 1, selectedTrack, recordKey }) : null
                  }
                  disabled={!canStart}
                >
                  <Text style={styles.startButtonText}>Start</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.recordDivider} />

              <View style={styles.recordTracksRow}>
                <Text style={styles.recordTracksLabel}>Tracks:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.trackChipContainer}>
                    {tracks.map(track => (
                      <TouchableOpacity
                        key={`${item.id || item.car_number}-${track}`}
                        style={[
                          styles.trackChip,
                          selectedTrack === track && styles.trackChipSelected,
                          completedTracks.includes(track) && styles.trackChipCompleted,
                        ]}
                        onPress={() => onTrackSelect(item, track)}
                        disabled={completedTracks.includes(track)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.trackChipText,
                            selectedTrack === track && styles.trackChipTextSelected,
                            completedTracks.includes(track) && styles.trackChipTextCompleted,
                          ]}
                        >
                          {track}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          );
        }}
      />
    </View>
  </Modal>
);

/**
 * Main App Component
 * Displays the home screen with vehicle categories
 */
export default function App() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [recordsVisible, setRecordsVisible] = useState(false);
  const [selectedTracksByRecord, setSelectedTracksByRecord] = useState({});
  const [completedTracksByRecord, setCompletedTracksByRecord] = useState({});
  const [searchText, setSearchText] = useState('');
  const [dbReady, setDbReady] = useState(false);
  const [teams, setTeams] = useState([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState([]);

  // Initialize database on app startup
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        // SQLite is not available on web in this app's DB wrapper.
        // On web, skip local DB and load directly from API service.
        if (Platform.OS !== 'web') {
          // Initialize the database
          await initializeDatabase();
          
          // Seed with dummy data
          await seedDatabase();
        }
        
        // Load teams from API (with local DB fallback handled by TeamsService)
        const teamsData = await TeamsService.getAllTeams();
        console.log('📊 Teams received on homepage load:', teamsData.length);
        console.log(
          '📦 Teams response preview:',
          JSON.stringify(teamsData.slice(0, 8), null, 2)
        );
        Alert.alert(
          'Teams API Check',
          `Response received.\nTotal teams: ${teamsData.length}`
        );
        setTeams(teamsData);
        
        // Load categories and add team counts
        const categoriesData = await CategoriesService.getAllCategories();
        const baseCategories = categoriesData.length > 0 ? categoriesData : categories;
        const categoriesWithTeamCounts = attachTeamCountsToCategories(baseCategories, teamsData);
        
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
    },
    {
      id: '2',
      name: 'Diesel Modified',
      description: 'Enhanced diesel power',
      icon: '🚨',
      color: '#2f3542',
    },
    {
      id: '3',
      name: 'Petrol Modified',
      description: 'Upgraded petrol engine',
      icon: '🔥',
      color: '#ff9f43',
    },
    {
      id: '4',
      name: 'Diesel Expert',
      description: 'Professional diesel builds',
      icon: '🛠️',
      color: '#0984e3',
    },
    {
      id: '5',
      name: 'Petrol Expert',
      description: 'Expert petrol tuning',
      icon: '⚙️',
      color: '#6c5ce7',
    },
    {
      id: '6',
      name: 'Thar SUV',
      description: 'Mahindra Thar specialist',
      icon: '🏔️',
      color: '#00b894',
    },
    {
      id: '7',
      name: 'Jimny SUV',
      description: 'Maruti Jimny expert',
      icon: '🚗',
      color: '#1e90ff',
    },
    {
      id: '8',
      name: 'SUV Modified',
      description: 'Custom SUV builds',
      icon: '🚙',
      color: '#fdcb6e',
    },
    {
      id: '9',
      name: 'Stock NDMS',
      description: 'Stock vehicle category',
      icon: '📋',
      color: '#74b9ff',
    },
    {
      id: '10',
      name: 'Ladies Category',
      description: 'Women drivers welcome',
      icon: '👩',
      color: '#a29bfe',
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
    setRecordsVisible(true);
  };

  const handleRecordStart = (record) => {
    setSelectedRecord(record);
    setRecordsVisible(false);
    setFormVisible(true);
  };

  const handleTrackSelect = (record, track) => {
    const recordKey = getRecordKey(record);
    const completedTracks = completedTracksByRecord[recordKey] || [];

    if (completedTracks.includes(track)) {
      return;
    }

    setSelectedTracksByRecord(prev => ({
      ...prev,
      [recordKey]: track,
    }));
  };

  /**
   * Handle form submission
   */
  const handleFormSubmit = (formData) => {
    const completedTrack = formData.trackName;
    const recordKey = selectedRecord?.recordKey || getRecordKey(selectedRecord || {});

    if (recordKey && completedTrack) {
      setCompletedTracksByRecord(prev => ({
        ...prev,
        [recordKey]: [...new Set([...(prev[recordKey] || []), completedTrack])],
      }));

      setSelectedTracksByRecord(prev => ({
        ...prev,
        [recordKey]: '',
      }));
    }

    Alert.alert(
      'Registration Submitted',
      `Driver: ${formData.driverName}\nCategory: ${formData.category}\nSticker #: ${formData.stickerNumber}\nCompletion Time: ${formData.completionTime}`,
      [
        {
          text: 'OK',
          onPress: () => {
            setFormVisible(false);
            setSelectedRecord(null);
            setRecordsVisible(true);
          },
        },
      ]
    );
  };

  /**
   * Render individual category item
   */
  const renderCategoryItem = ({ item }) => (
    <CategoryCard
      category={item}
      teamCount={item.teamCount || 0}
      onPress={() => handleCategoryPress(item)}
    />
  );

  const selectedCategoryRecords = selectedCategory
    ? getTeamsForCategory(teams, selectedCategory.name)
    : [];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Text style={styles.exploreTitle}>Explore</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.iconBadge}>🔔</Text>
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search categories..."
          placeholderTextColor="#bbb"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Categories Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Categories Grid */}
      <FlatList
        data={filteredCategories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={true}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />

      <CategoryRecordsModal
        visible={recordsVisible}
        category={selectedCategory}
        records={selectedCategoryRecords}
        selectedTracksByRecord={selectedTracksByRecord}
        completedTracksByRecord={completedTracksByRecord}
        onClose={() => {
          setRecordsVisible(false);
          setSelectedCategory(null);
        }}
        onTrackSelect={handleTrackSelect}
        onStart={handleRecordStart}
      />

      {/* Registration Form Modal */}
      <RegistrationForm
        visible={formVisible}
        category={selectedCategory}
        initialRecord={selectedRecord}
        onClose={() => {
          setFormVisible(false);
          setSelectedRecord(null);
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
    backgroundColor: '#f5f6fa',
  },

  // Top Header styles
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
  },

  exploreTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529',
  },

  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  iconText: {
    fontSize: 18,
    color: '#212529',
  },

  iconBadge: {
    fontSize: 18,
    color: '#212529',
  },

  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4757',
  },

  // Search Bar styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },

  searchIcon: {
    fontSize: 16,
    marginRight: 10,
    color: '#999',
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#212529',
    padding: 0,
  },

  // Section Header styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
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
    backgroundColor: '#ffffff',
    minHeight: IS_TABLET ? 210 : 180,
    borderRadius: 18,
    paddingHorizontal: IS_TABLET ? 16 : 12,
    paddingVertical: IS_TABLET ? 18 : 14,
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    color: '#212529',
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
  countBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: IS_TABLET ? 68 : 60,
  },

  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
  },

  countLabel: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
    marginTop: 2,
  },

  recordsPageContainer: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    paddingHorizontal: IS_TABLET ? 24 : 16,
    paddingTop: IS_TABLET ? 28 : 20,
  },

  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  recordsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
  },

  recordsSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },

  recordsListContent: {
    paddingBottom: IS_TABLET ? 36 : 24,
  },

  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: IS_TABLET ? 22 : 18,
    paddingVertical: IS_TABLET ? 24 : 20,
  },

  recordMetaBlock: {
    width: 70,
    marginRight: 10,
    marginBottom: 10,
  },

  recordMetaBlockWide: {
    width: IS_TABLET ? 160 : 140,
    marginRight: 10,
    marginBottom: 10,
  },

  recordDriverBlock: {
    flex: 1,
    minWidth: IS_TABLET ? 240 : 160,
    marginRight: 12,
    marginBottom: 10,
  },

  recordMetaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#95a5a6',
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  recordMetaValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#636e72',
  },

  recordStickerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#576574',
  },

  recordDriverName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },

  startButton: {
    backgroundColor: '#27ae60',
    borderRadius: 10,
    paddingHorizontal: IS_TABLET ? 28 : 24,
    paddingVertical: 14,
    minWidth: IS_TABLET ? 128 : 110,
    alignItems: 'center',
    marginLeft: 'auto',
    marginBottom: 10,
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

  recordTracksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  recordTracksLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#95a5a6',
    textTransform: 'uppercase',
    marginRight: 12,
    marginBottom: 8,
  },

  trackChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  trackChip: {
    backgroundColor: '#e8f3fc',
    borderWidth: 1,
    borderColor: '#c6e1f7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    marginBottom: 8,
  },

  trackChipSelected: {
    backgroundColor: '#d6ebff',
    borderColor: '#7db8f0',
  },

  trackChipCompleted: {
    backgroundColor: '#ccefd7',
    borderColor: '#60b77e',
  },

  trackChipText: {
    fontSize: 14,
    color: '#2c7dbf',
    fontWeight: '600',
  },

  trackChipTextSelected: {
    color: '#1f6dae',
  },

  trackChipTextCompleted: {
    color: '#257245',
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
    color: '#212529',
    marginBottom: 8,
  },

  emptyStateText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },

  // Stopwatch styles
  timerHeroCard: {
    backgroundColor: '#161f36',
    borderRadius: 24,
    paddingHorizontal: IS_TABLET ? 28 : 18,
    paddingVertical: IS_TABLET ? 30 : 22,
    marginBottom: 24,
    alignItems: 'center',
  },

  stopwatchDisplay: {
    fontSize: IS_TABLET ? 70 : 48,
    fontWeight: '300',
    color: '#66a5ff',
    letterSpacing: IS_TABLET ? 6 : 2,
    fontVariant: ['tabular-nums'],
    marginBottom: 20,
  },

  stopwatchButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 0,
    gap: 12,
    flexWrap: 'wrap',
  },

  stopwatchButton: {
    backgroundColor: '#25c05a',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    minWidth: IS_TABLET ? 220 : 180,
    alignItems: 'center',
  },

  stopwatchButtonActive: {
    backgroundColor: '#1b9148',
  },

  stopwatchResetButton: {
    backgroundColor: '#f44343',
  },

  stopwatchResetCompact: {
    minWidth: IS_TABLET ? 110 : 96,
  },

  stopwatchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },

  // Full page modal styles
  fullPageContainer: {
    flex: 1,
    backgroundColor: '#eef4ff',
  },

  fullPageContent: {
    flex: 1,
    backgroundColor: '#eef4ff',
  },

  // Form header
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IS_TABLET ? 28 : 20,
    paddingTop: IS_TABLET ? 24 : 16,
    paddingBottom: 12,
    backgroundColor: '#eef4ff',
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
    paddingHorizontal: IS_TABLET ? 20 : 12,
    paddingBottom: 12,
  },

  dashboardLayout: {
    flexDirection: IS_PORTRAIT ? 'column' : 'row',
    gap: 12,
    alignItems: 'stretch',
  },

  dashboardLeftPanel: {
    width: IS_PORTRAIT ? '100%' : '37%',
  },

  dashboardRightPanel: {
    width: IS_PORTRAIT ? '100%' : '61%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: IS_TABLET ? 18 : 12,
    borderWidth: 1,
    borderColor: '#e5edf8',
  },

  detailsAccordion: {
    backgroundColor: '#ffffff',
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },

  detailsTrackPill: {
    backgroundColor: '#3565df',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },

  detailsTrackPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  detailsAccordionTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  detailsAccordionTriggerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 6,
  },

  detailsAccordionTriggerIcon: {
    fontSize: 14,
    color: '#111827',
  },

  heroInfoCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: IS_TABLET ? 18 : 14,
    paddingVertical: IS_TABLET ? 12 : 10,
    borderTopWidth: 1,
    borderTopColor: '#edf2fb',
  },

  heroMetaText: {
    fontSize: IS_TABLET ? 16 : 14,
    color: '#5c6f8f',
    marginBottom: 4,
  },

  heroSecondaryMetaText: {
    fontSize: IS_TABLET ? 14 : 13,
    color: '#5c6f8f',
  },

  heroMetaStrong: {
    color: '#1f2740',
    fontWeight: '700',
  },

  // Form section
  section: {
    marginBottom: 14,
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
    fontSize: IS_TABLET ? 18 : 15,
    fontWeight: '800',
    color: '#63799a',
    flex: 1,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#e5edf8',
    paddingBottom: 8,
    marginBottom: 10,
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
    color: '#212529',
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  dropdownButtonText: {
    fontSize: 14,
    color: '#212529',
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
    backgroundColor: '#ffffff',
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
    paddingHorizontal: IS_TABLET ? 20 : 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#eef4ff',
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
    color: '#ffffff',
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
    color: '#ffffff',
  },

  submitButton: {
    backgroundColor: '#3565df',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Penalty Row Styles
  penaltyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },

  penaltyCard: {
    width: '48.5%',
    backgroundColor: '#fbfcff',
    borderWidth: 1,
    borderColor: '#dce6f4',
    borderRadius: 16,
    paddingHorizontal: IS_TABLET ? 12 : 10,
    paddingVertical: IS_TABLET ? 10 : 8,
    minHeight: IS_TABLET ? 88 : 82,
  },

  penaltyCardLabel: {
    fontSize: IS_TABLET ? 14 : 12,
    fontWeight: '700',
    color: '#4c5c77',
    marginBottom: 8,
  },

  penaltyCardControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  counterButton: {
    width: IS_TABLET ? 40 : 36,
    height: IS_TABLET ? 40 : 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#3565df',
  },

  counterButtonText: {
    fontSize: IS_TABLET ? 20 : 18,
    fontWeight: '700',
    color: '#ffffff',
  },

  counterInput: {
    width: IS_TABLET ? 56 : 42,
    height: IS_TABLET ? 40 : 36,
    textAlign: 'center',
    fontSize: IS_TABLET ? 22 : 16,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },

  penaltyValuePill: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: IS_TABLET ? 48 : 40,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#dfeafd',
    borderRadius: 8,
  },

  penaltyValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3565df',
  },

  // Summary Section Styles
  summarySection: {
    marginBottom: 12,
    padding: 12,
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
    fontSize: IS_TABLET ? 16 : 15,
    fontWeight: '700',
    color: '#9c4900',
    marginBottom: 10,
    textAlign: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },

  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f1f1f',
    flex: 1,
  },

  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f1f1f',
    marginLeft: 10,
  },

  summaryDivider: {
    height: 2,
    backgroundColor: '#ffc107',
    marginVertical: 8,
  },

  summaryRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ff5a1f',
    borderRadius: 16,
    elevation: 3,
  },

  summaryLabelTotal: {
    fontSize: IS_TABLET ? 18 : 16,
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
  },

  summaryValueTotal: {
    fontSize: IS_TABLET ? 26 : 22,
    fontWeight: '800',
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
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
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
});
