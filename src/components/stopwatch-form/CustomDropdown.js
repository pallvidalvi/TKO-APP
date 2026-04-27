import React, { useState } from 'react';
import { Text, View } from 'react-native';
import TouchableOpacity from '../FastTouchableOpacity';
import styles from './stopwatchForm.styles';
import { TOUCH_HIT_SLOP } from './stopwatchForm.shared';

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
        <Text style={styles.dropdownArrow}>{isOpen ? '▴' : '▾'}</Text>
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

export default CustomDropdown;
