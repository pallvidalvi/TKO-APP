import React, { useState } from 'react';
import { Text, View } from 'react-native';
import TouchableOpacity from '../FastTouchableOpacity';
import styles from './stopwatchForm.styles';
import { INITIAL_LAYOUT, TOUCH_HIT_SLOP } from './stopwatchForm.shared';

const DNF_OPTIONS = ['20 points', '50 points'];

const DNFSelector = React.memo(function DNFSelector({
  wrongCourseSelected,
  fourthAttemptSelected,
  timeOverSelected,
  pointsValue,
  onWrongCourseChange,
  onFourthAttemptChange,
  onTimeOverChange,
  onPointsChange,
  timeOverLocked = false,
  timeOverLimitLabel = '',
  disabled = false,
  layout,
}) {
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const [isOpen, setIsOpen] = useState(false);
  const hasSelection = wrongCourseSelected || fourthAttemptSelected || timeOverSelected;
  const selectedReason = wrongCourseSelected
    ? 'wrongCourse'
    : fourthAttemptSelected
      ? 'fourthAttempt'
      : timeOverSelected
        ? 'timeOver'
        : '';

  const setExclusiveReason = reason => {
    onWrongCourseChange(reason === 'wrongCourse');
    onFourthAttemptChange(reason === 'fourthAttempt');
    onTimeOverChange(reason === 'timeOver');
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  };

  const handleSelect = option => {
    onPointsChange(option);
    setIsOpen(false);
  };

  return (
    <View
      style={[
        styles.dnfCard,
        {
          paddingHorizontal: responsiveLayout.isTablet ? 14 : responsiveLayout.isSmallPhone ? 8 : 10,
          paddingVertical: responsiveLayout.isTablet ? 12 : responsiveLayout.isSmallPhone ? 8 : 10,
        },
        disabled && styles.dnfCardDisabled,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.dnfToggleButton,
          hasSelection && styles.dnfToggleButtonActive,
          disabled && styles.dnfToggleButtonDisabled,
        ]}
        onPress={handleToggle}
        disabled={disabled}
        activeOpacity={0.85}
        hitSlop={TOUCH_HIT_SLOP}
      >
        <Text style={[styles.dnfToggleButtonText, hasSelection && styles.dnfToggleButtonTextActive]}>
          {hasSelection ? 'DNF Selected' : 'DNF'}
        </Text>
        <Text style={[styles.dnfToggleButtonArrow, hasSelection && styles.dnfToggleButtonTextActive]}>
          {isOpen ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>

      {isOpen ? (
        <View style={styles.dnfDropdownMenu}>
          <TouchableOpacity
            style={styles.dnfCheckboxRow}
            onPress={() => setExclusiveReason('wrongCourse')}
            activeOpacity={0.85}
            hitSlop={TOUCH_HIT_SLOP}
          >
            <View style={[styles.dnfRadio, selectedReason === 'wrongCourse' && styles.dnfRadioSelected]}>
              {selectedReason === 'wrongCourse' ? <View style={styles.dnfRadioDot} /> : null}
            </View>
            <Text style={styles.dnfCheckboxLabel}>Wrong Course</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dnfCheckboxRow}
            onPress={() => setExclusiveReason('fourthAttempt')}
            activeOpacity={0.85}
            hitSlop={TOUCH_HIT_SLOP}
          >
            <View style={[styles.dnfRadio, selectedReason === 'fourthAttempt' && styles.dnfRadioSelected]}>
              {selectedReason === 'fourthAttempt' ? <View style={styles.dnfRadioDot} /> : null}
            </View>
            <Text style={styles.dnfCheckboxLabel}>4th Attempt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dnfCheckboxRow, timeOverLocked && styles.dnfCheckboxRowDisabled]}
            onPress={() => {
              if (!timeOverLocked) {
                setExclusiveReason('timeOver');
              }
            }}
            activeOpacity={0.85}
            hitSlop={TOUCH_HIT_SLOP}
          >
            <View style={[styles.dnfRadio, selectedReason === 'timeOver' && styles.dnfRadioSelected]}>
              {selectedReason === 'timeOver' ? <View style={styles.dnfRadioDot} /> : null}
            </View>
            <View style={styles.dnfCheckboxContent}>
              <Text style={[styles.dnfCheckboxLabel, timeOverLocked && styles.dnfCheckboxLabelDisabled]}>Time Over</Text>
              {timeOverLocked && timeOverLimitLabel ? (
                <Text style={styles.dnfCheckboxHint}>Auto at {timeOverLimitLabel}</Text>
              ) : null}
            </View>
          </TouchableOpacity>

          <View style={styles.dnfPointsSection}>
            <Text style={styles.dnfPointsLabel}>Points</Text>
            {DNF_OPTIONS.map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dnfDropdownItem,
                  !hasSelection && styles.dnfDropdownItemDisabled,
                ]}
                onPress={() => handleSelect(option)}
                disabled={!hasSelection}
                activeOpacity={0.85}
                hitSlop={TOUCH_HIT_SLOP}
              >
                <Text
                  style={[
                    styles.dnfDropdownItemText,
                    pointsValue === option && styles.dnfDropdownItemTextSelected,
                    !hasSelection && styles.dnfDropdownItemTextDisabled,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {hasSelection || pointsValue ? (
            <TouchableOpacity
              style={[styles.dnfDropdownItem, styles.dnfClearButton]}
              onPress={() => {
                onWrongCourseChange(false);
                onFourthAttemptChange(false);
                onTimeOverChange(false);
                onPointsChange('');
                setIsOpen(false);
              }}
              activeOpacity={0.85}
              hitSlop={TOUCH_HIT_SLOP}
            >
              <Text style={styles.dnfClearButtonText}>Clear DNF</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

export default DNFSelector;
