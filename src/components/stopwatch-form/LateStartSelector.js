import React, { useState } from 'react';
import { Text, View } from 'react-native';
import TouchableOpacity from '../FastTouchableOpacity';
import styles from './stopwatchForm.styles';
import { INITIAL_LAYOUT, TOUCH_HIT_SLOP } from './stopwatchForm.shared';

const LATE_START_OPTIONS = [
  { value: 'late_start', label: 'Late Start with Penalty' },
  { value: 'late_start_with_approval', label: 'Late Start with Approval' },
];

const LateStartSelector = React.memo(function LateStartSelector({
  value,
  onValueChange,
  disabled = false,
  approvalOnly = false,
  layout,
}) {
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const [isOpen, setIsOpen] = useState(false);
  const selectableOptions = approvalOnly
    ? LATE_START_OPTIONS.filter(option => option.value === 'late_start_with_approval')
    : LATE_START_OPTIONS;
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
        hitSlop={TOUCH_HIT_SLOP}
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
          {isOpen ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>

      {isOpen ? (
        <View style={styles.lateStartSelectorMenu}>
          {selectableOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={styles.lateStartSelectorItem}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
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
              hitSlop={TOUCH_HIT_SLOP}
            >
              <Text style={styles.lateStartSelectorClearText}>Clear Late Start</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

export default LateStartSelector;
