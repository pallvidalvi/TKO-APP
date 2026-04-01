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
    } else {
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
    }
  },
};

// Get device dimensions for responsive design
const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2; // Grid layout with 2 columns

/**
 * CategoryCard Component
 * Displays individual category with animation on press
 */
const CategoryCard = ({ category, onPress }) => {
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
          <Text style={styles.categoryIcon}>{category.icon}</Text>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryDescription}>{category.description}</Text>
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
 * Registration Form Modal Component
 * Displays form for player details and penalties
 */
const RegistrationForm = ({ visible, category, onClose, onSubmit }) => {
  // Driver Details
  const [srNo, setSrNo] = useState('');
  const [stickerNumber, setStickerNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [coDriverName, setCoDriverName] = useState('');

  // Penalties Section (with count inputs)
  const [bustingCount, setBustingCount] = useState('0');
  const [seatbeltCount, setSeatbeltCount] = useState('0');
  const [groundTouchCount, setGroundTouchCount] = useState('0');
  const [lateStartCount, setLateStartCount] = useState('0');
  const [behaviourCount, setBehaviourCount] = useState('0');

  // DNF Section (with count inputs)
  const [taskSkippedCount, setTaskSkippedCount] = useState('0');
  const [wrongCourseCount, setWrongCourseCount] = useState('0');
  const [fourthAttemptCount, setFourthAttemptCount] = useState('0');

  // Stopwatch
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [performanceTime, setPerformanceTime] = useState('');

  // Penalty multipliers
  const PENALTY_VALUES = {
    busting: 20,
    seatbelt: 30,
    groundTouch: 30,
    lateStart: 30,
    behaviour: 30,
    taskSkipped: 60,
    wrongCourse: 60,
    fourthAttempt: 60,
  };

  // Calculate penalty times
  const calculatePenaltyTime = (count, multiplier) => {
    const numCount = parseInt(count) || 0;
    return numCount * multiplier;
  };

  // Calculate total penalties time
  const bustingPenaltyTime = calculatePenaltyTime(bustingCount, PENALTY_VALUES.busting);
  const seatbeltPenaltyTime = calculatePenaltyTime(seatbeltCount, PENALTY_VALUES.seatbelt);
  const groundTouchPenaltyTime = calculatePenaltyTime(groundTouchCount, PENALTY_VALUES.groundTouch);
  const lateStartPenaltyTime = calculatePenaltyTime(lateStartCount, PENALTY_VALUES.lateStart);
  const behaviourPenaltyTime = calculatePenaltyTime(behaviourCount, PENALTY_VALUES.behaviour);

  const taskSkippedPenaltyTime = calculatePenaltyTime(taskSkippedCount, PENALTY_VALUES.taskSkipped);
  const wrongCoursePenaltyTime = calculatePenaltyTime(wrongCourseCount, PENALTY_VALUES.wrongCourse);
  const fourthAttemptPenaltyTime = calculatePenaltyTime(fourthAttemptCount, PENALTY_VALUES.fourthAttempt);

  // Total calculations
  const totalPenaltiesTime = 
    bustingPenaltyTime + 
    seatbeltPenaltyTime + 
    groundTouchPenaltyTime + 
    lateStartPenaltyTime + 
    behaviourPenaltyTime +
    taskSkippedPenaltyTime +
    wrongCoursePenaltyTime +
    fourthAttemptPenaltyTime;

  const completionTimeInSeconds = stopwatchTime;
  const totalTime = totalPenaltiesTime + completionTimeInSeconds;

  // Stopwatch effect
  useEffect(() => {
    let interval;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchTime((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning]);

  const toggleStopwatch = () => {
    setIsStopwatchRunning(!isStopwatchRunning);
  };

  const stopStopwatch = () => {
    setIsStopwatchRunning(false);
  };

  const resetStopwatch = () => {
    setStopwatchTime(0);
    setIsStopwatchRunning(false);
    setCompletionTime('');
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = () => {
    if (!driverName.trim()) {
      Alert.alert('Error', 'Please enter Driver Name');
      return;
    }
    if (!stickerNumber.trim()) {
      Alert.alert('Error', 'Please enter Sticker Number');
      return;
    }

    const formattedCompletionTime = formatTime(stopwatchTime);

    const formData = {
      category: category?.name || '',
      srNo,
      stickerNumber,
      driverName,
      coDriverName,
      completionTime: formattedCompletionTime,
      completionTimeSeconds: stopwatchTime,
      
      // Penalties counts
      bustingCount,
      seatbeltCount,
      groundTouchCount,
      lateStartCount,
      behaviourCount,
      
      // DNF counts
      taskSkippedCount,
      wrongCourseCount,
      fourthAttemptCount,
      
      // Calculated penalty times
      bustingPenaltyTime,
      seatbeltPenaltyTime,
      groundTouchPenaltyTime,
      lateStartPenaltyTime,
      behaviourPenaltyTime,
      taskSkippedPenaltyTime,
      wrongCoursePenaltyTime,
      fourthAttemptPenaltyTime,
      
      // Totals
      totalPenaltiesTime,
      totalTime,
    };

    // Generate Excel file
    generateAndDownloadExcel(formData);
    
    onSubmit(formData);
    resetStopwatch();
    resetForm();
  };

  const resetForm = () => {
    setSrNo('');
    setStickerNumber('');
    setDriverName('');
    setCoDriverName('');
    setBustingCount('0');
    setSeatbeltCount('0');
    setGroundTouchCount('0');
    setLateStartCount('0');
    setBehaviourCount('0');
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
      // Prepare CSV headers - matching the TKO form structure
      const headers = [
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
        'Behaviour (Count)',
        'Behaviour (Time)',
        'Task Skipped (Count)',
        'Task Skipped (Time)',
        'Wrong Course (Count)',
        'Wrong Course (Time)',
        '4th Attempt (Count)',
        '4th Attempt (Time)',
        'Total Penalties Time (sec)',
        'Completion Time (sec)',
        'Total Time (sec)',
        'Completion Time (HH:MM:SS)',
        'Submission Date',
      ];

      // Prepare data row
      const rows = [
        [
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
          data.behaviourCount,
          data.behaviourPenaltyTime,
          data.taskSkippedCount,
          data.taskSkippedPenaltyTime,
          data.wrongCourseCount,
          data.wrongCoursePenaltyTime,
          data.fourthAttemptCount,
          data.fourthAttemptPenaltyTime,
          data.totalPenaltiesTime,
          data.completionTimeSeconds,
          data.totalTime,
          data.completionTime,
          new Date().toLocaleString(),
        ],
      ];

      // Generate file name: categoryName_driverName.csv
      const fileName = `${data.category}_${data.driverName}.csv`;

      // Download file (works on both web and mobile)
      await CSVExporter.downloadFile(fileName, headers, rows);

      // Show success message
      Alert.alert('Success!', `File downloaded: ${fileName}`);
      
      // Reset form only (don't refresh page)
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to generate file: ' + error.message);
      console.error('File generation error:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.fullPageContainer}>
        <View style={styles.fullPageContent}>
          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              Track Information - {category?.name}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            {/* Stopwatch Section */}
            <View style={styles.stopwatchSection}>
              <Text style={styles.stopwatchTitle}>⏱️ Stopwatch</Text>
              <View style={styles.stopwatchContainer}>
                <Text style={styles.stopwatchDisplay}>{formatTime(stopwatchTime)}</Text>
              </View>
              <View style={styles.stopwatchButtonsContainer}>
                <TouchableOpacity
                  style={[styles.stopwatchButton, isStopwatchRunning && styles.stopwatchButtonActive]}
                  onPress={toggleStopwatch}
                >
                  <Text style={styles.stopwatchButtonText}>
                    {isStopwatchRunning ? 'Stop' : 'Start'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stopwatchButton}
                  onPress={resetStopwatch}
                >
                  <Text style={styles.stopwatchButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Completion Time Field
            <View style={styles.section}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Completion Time</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={formatTime(stopwatchTime)}
                  editable={false}
                  placeholderTextColor="#999"
                />
              </View>
            </View> */}

            {/* Section 1: Driver Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Driver Details</Text>

              {/* Sticker Number */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Sticker Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter sticker number"
                  placeholderTextColor="#999"
                  value={stickerNumber}
                  onChangeText={setStickerNumber}
                  keyboardType="number-pad"
                />
              </View>

              {/* Driver Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Driver Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter driver name"
                  placeholderTextColor="#999"
                  value={driverName}
                  onChangeText={setDriverName}
                />
              </View>

              {/* Co-Driver Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Co-Driver Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter co-driver name (optional)"
                  placeholderTextColor="#999"
                  value={coDriverName}
                  onChangeText={setCoDriverName}
                />
              </View>
            </View>

            {/* Section 2: Penalties (Counts & Calculations) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Penalties</Text>

              {/* Bunting & Pole */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>Bunting & Pole (20 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={bustingCount}
                    onChangeText={setBustingCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{bustingPenaltyTime}s</Text>
                </View>
              </View>

              {/* Seatbelt */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>Seatbelt (30 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={seatbeltCount}
                    onChangeText={setSeatbeltCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{seatbeltPenaltyTime}s</Text>
                </View>
              </View>

              {/* Ground Touch */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>Ground Touch (30 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={groundTouchCount}
                    onChangeText={setGroundTouchCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{groundTouchPenaltyTime}s</Text>
                </View>
              </View>

              {/* Late Start */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>Late Start (30 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={lateStartCount}
                    onChangeText={setLateStartCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{lateStartPenaltyTime}s</Text>
                </View>
              </View>

              {/* Behaviour */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>Behaviour (30 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={behaviourCount}
                    onChangeText={setBehaviourCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{behaviourPenaltyTime}s</Text>
                </View>
              </View>
            </View>

            {/* Section 3: DNF (Did Not Finish) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DNF (Did Not Finish)</Text>

              {/* Task Skipped */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>Task Skipped (60 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={taskSkippedCount}
                    onChangeText={setTaskSkippedCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{taskSkippedPenaltyTime}s</Text>
                </View>
              </View>

              {/* Wrong Course */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>Wrong Course (60 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={wrongCourseCount}
                    onChangeText={setWrongCourseCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{wrongCoursePenaltyTime}s</Text>
                </View>
              </View>

              {/* 4th Attempt */}
              <View style={styles.penaltyRow}>
                <View style={styles.penaltyInputContainer}>
                  <Text style={styles.penaltyLabel}>4th Attempt (60 sec)</Text>
                  <TextInput
                    style={styles.penaltyInput}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={fourthAttemptCount}
                    onChangeText={setFourthAttemptCount}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.penaltyValueContainer}>
                  <Text style={styles.penaltyValue}>{fourthAttemptPenaltyTime}s</Text>
                </View>
              </View>
            </View>

            {/* Section 4: Time Summary (Highlighted) */}
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Time Summary</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Penalties Time:</Text>
                <Text style={styles.summaryValue}>{totalPenaltiesTime} seconds</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Performance Time (Completion):</Text>
                <Text style={styles.summaryValue}>{completionTimeInSeconds} seconds</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRowTotal}>
                <Text style={styles.summaryLabelTotal}>TOTAL TIME:</Text>
                <Text style={styles.summaryValueTotal}>{totalTime} seconds</Text>
              </View>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Submit & Download CSV</Text>
            </TouchableOpacity>
          </View>
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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  // Category data
  const categories = [
    {
      id: '1',
      name: 'Extreme',
      description: 'Ultimate performance',
      icon: '⚡',
    },
    {
      id: '2',
      name: 'Diesel Modified',
      description: 'Enhanced diesel power',
      icon: '⛽',
    },
    {
      id: '3',
      name: 'Petrol Modified',
      description: 'Upgraded petrol engine',
      icon: '🔥',
    },
    {
      id: '4',
      name: 'Diesel Expert',
      description: 'Professional diesel builds',
      icon: '🛠️',
    },
    {
      id: '5',
      name: 'Petrol Expert',
      description: 'Expert petrol tuning',
      icon: '⚙️',
    },
    {
      id: '6',
      name: 'Thar SUV',
      description: 'Mahindra Thar specialist',
      icon: '🏔️',
    },
    {
      id: '7',
      name: 'Jimny SUV',
      description: 'Maruti Jimny expert',
      icon: '�',
    },
    {
      id: '8',
      name: 'SUV Modified',
      description: 'Custom SUV builds',
      icon: '🚙',
    },
    {
      id: '9',
      name: 'Stock NDMS',
      description: 'Stock vehicle category',
      icon: '📋',
    },
    {
      id: '10',
      name: 'Ladies Category',
      description: 'Women drivers welcome',
      icon: '�',
    },
  ];

  /**
   * Handle card press - Opens registration form
   */
  const handleCategoryPress = (category) => {
    setSelectedCategory(category);
    setFormVisible(true);
  };

  /**
   * Handle form submission
   */
  const handleFormSubmit = (formData) => {
    Alert.alert(
      'Registration Submitted',
      `Driver: ${formData.playerName}\nCategory: ${formData.category}\nSticker #: ${formData.stickerNumber}\nCompletion Time: ${formData.completionTime}`,
      [
        {
          text: 'OK',
          onPress: () => {
            setFormVisible(false);
            setSelectedCategory(null);
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
      onPress={() => handleCategoryPress(item)}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vehicle Categories</Text>
        <Text style={styles.headerSubtitle}>Choose your preferred vehicle type</Text>
      </View>

      {/* Categories Grid */}
      <FlatList
        data={categories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={true}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />

      {/* Registration Form Modal */}
      <RegistrationForm
        visible={formVisible}
        category={selectedCategory}
        onClose={() => {
          setFormVisible(false);
          setSelectedCategory(null);
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
    backgroundColor: '#f8f9fa',
  },

  // Header styles
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },

  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '400',
  },

  // List content styles
  listContent: {
    paddingVertical: 20,
    paddingHorizontal: 10,
  },

  columnWrapper: {
    justifyContent: 'space-around',
    marginBottom: 10,
  },

  // Card styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginVertical: 8,
    marginHorizontal: 5,
    paddingVertical: 20,
    paddingHorizontal: 12,
    elevation: 4, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  cardContent: {
    alignItems: 'center',
  },

  // Category icon
  categoryIcon: {
    fontSize: 40,
    marginBottom: 8,
  },

  // Category name
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 6,
    textAlign: 'center',
  },

  // Category description
  categoryDescription: {
    fontSize: 12,
    color: '#868e96',
    textAlign: 'center',
    fontWeight: '400',
  },

  // Stopwatch styles
  stopwatchSection: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#007bff',
  },

  stopwatchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },

  stopwatchContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#007bff',
    alignItems: 'center',
  },

  stopwatchDisplay: {
    fontSize: 48,
    fontWeight: '700',
    color: '#007bff',
    fontFamily: 'Courier New',
  },

  stopwatchButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },

  stopwatchButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },

  stopwatchButtonActive: {
    backgroundColor: '#dc3545',
  },

  stopwatchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#f8f9fa',
  },

  fullPageContent: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  // Form header
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },

  closeButton: {
    fontSize: 28,
    color: '#6c757d',
    fontWeight: '300',
  },

  // Form scroll
  formScroll: {
    flex: 1,
    padding: 20,
  },

  // Form section
  section: {
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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

  // Button container
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  submitButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Penalty Row Styles
  penaltyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  penaltyInputContainer: {
    flex: 1,
    marginRight: 10,
  },

  penaltyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginBottom: 6,
  },

  penaltyInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212529',
    backgroundColor: '#ffffff',
  },

  penaltyValueContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#e7f3ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },

  penaltyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0066cc',
  },

  // Summary Section Styles
  summarySection: {
    marginTop: 20,
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffc107',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 16,
    textAlign: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },

  summaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#856404',
    flex: 1,
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6b35',
    marginLeft: 10,
  },

  summaryDivider: {
    height: 2,
    backgroundColor: '#ffc107',
    marginVertical: 12,
  },

  summaryRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#ff6b35',
    borderRadius: 8,
    elevation: 3,
  },

  summaryLabelTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
  },

  summaryValueTotal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 10,
  },
});

