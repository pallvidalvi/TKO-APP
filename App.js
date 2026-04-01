import React, { useState } from 'react';
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
  Picker,
  Alert,
} from 'react-native';

// Get device dimensions for responsive design
const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

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
 * Registration Form Modal Component
 * Displays form for player details and penalties
 */
const RegistrationForm = ({ visible, category, onClose, onSubmit }) => {
  const [playerName, setPlayerName] = useState('');
  const [coDriverName, setCoDriverName] = useState('');
  const [stickerNumber, setStickerNumber] = useState('');
  const [bunting, setBunting] = useState('No');
  const [seatbelt, setSeatbelt] = useState('Yes');

  const handleSubmit = () => {
    if (!playerName.trim()) {
      Alert.alert('Error', 'Please enter Player/Driver Name');
      return;
    }
    if (!stickerNumber.trim()) {
      Alert.alert('Error', 'Please enter Sticker Number');
      return;
    }

    const formData = {
      category: category?.name || '',
      playerName,
      coDriverName,
      stickerNumber,
      penalties: {
        bunting,
        seatbelt,
      },
    };

    onSubmit(formData);
    
    // Reset form
    setPlayerName('');
    setCoDriverName('');
    setStickerNumber('');
    setBunting('No');
    setSeatbelt('Yes');
  };

  const handleClose = () => {
    // Reset form
    setPlayerName('');
    setCoDriverName('');
    setStickerNumber('');
    setBunting('No');
    setSeatbelt('Yes');
    onClose();
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
              Registration - {category?.name}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll}>
            {/* Section 1: Driver Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Driver Details</Text>

              {/* Player Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Player/Driver Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter driver name"
                  placeholderTextColor="#999"
                  value={playerName}
                  onChangeText={setPlayerName}
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
            </View>

            {/* Section 2: Penalties */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Penalties</Text>

              {/* Bunting Dropdown */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Bunting</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={bunting}
                    onValueChange={(itemValue) => setBunting(itemValue)}
                    style={styles.picker}
                  >
                    <Picker.Item label="No" value="No" />
                    <Picker.Item label="Yes" value="Yes" />
                  </Picker>
                </View>
              </View>

              {/* Seatbelt Dropdown */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Seatbelt</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={seatbelt}
                    onValueChange={(itemValue) => setSeatbelt(itemValue)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Yes" value="Yes" />
                    <Picker.Item label="No" value="No" />
                  </Picker>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Submit Registration</Text>
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
      `Driver: ${formData.playerName}\nCategory: ${formData.category}\nSticker #: ${formData.stickerNumber}`,
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

      {/* Categories List */}
      <FlatList
        data={categories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
        contentContainerStyle={styles.listContent}
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
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  // Card styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginVertical: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
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
    fontSize: 48,
    marginBottom: 12,
  },

  // Category name
  categoryName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
    textAlign: 'center',
  },

  // Category description
  categoryDescription: {
    fontSize: 14,
    color: '#868e96',
    textAlign: 'center',
    fontWeight: '400',
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

  // Picker container
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },

  picker: {
    height: 50,
    color: '#212529',
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
});
