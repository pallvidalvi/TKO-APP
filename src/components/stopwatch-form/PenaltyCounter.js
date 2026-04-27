import React from 'react';
import { Text, TextInput, View } from 'react-native';
import TouchableOpacity from '../FastTouchableOpacity';
import styles from './stopwatchForm.styles';
import { INITIAL_LAYOUT, MIN_TOUCH_TARGET, TOUCH_HIT_SLOP } from './stopwatchForm.shared';

const PenaltyCounter = React.memo(function PenaltyCounter({
  label,
  count,
  onCountChange,
  penaltyTime,
  layout,
  disabled = false,
  showPenaltyTime = true,
}) {
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const penaltyCardWidth =
    responsiveLayout.penaltyColumns === 1
      ? '100%'
      : responsiveLayout.penaltyColumns === 2
        ? '48.5%'
        : '31.5%';

  const handleIncrement = () => {
    onCountChange(String((parseInt(count) || 0) + 1));
  };

  const handleDecrement = () => {
    const newValue = Math.max(0, (parseInt(count) || 0) - 1);
    onCountChange(String(newValue));
  };

  return (
    <View
      style={[
        styles.penaltyCard,
        {
          width: penaltyCardWidth,
          paddingHorizontal: responsiveLayout.isTablet ? 12 : responsiveLayout.isSmallPhone ? 8 : 10,
          paddingVertical: responsiveLayout.isTablet ? 10 : responsiveLayout.isSmallPhone ? 7 : 8,
          minHeight: responsiveLayout.isTablet ? 88 : responsiveLayout.isSmallPhone ? 74 : 82,
        },
      ]}
    >
      <Text
        style={[
          styles.penaltyCardLabel,
          {
            fontSize: responsiveLayout.isTablet ? 14 : responsiveLayout.isSmallPhone ? 11 : 12,
            marginBottom: responsiveLayout.isSmallPhone ? 6 : 8,
          },
        ]}
      >
        {label}
      </Text>
      <View style={styles.penaltyCardControls}>
        <TouchableOpacity
          style={[
            styles.counterButton,
            disabled && styles.counterButtonDisabled,
            {
              width: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
              height: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
            },
          ]}
          onPress={handleDecrement}
          disabled={disabled}
          activeOpacity={0.8}
          hitSlop={TOUCH_HIT_SLOP}
        >
          <Text
            style={[
              styles.counterButtonText,
              { fontSize: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 16 : 18 },
            ]}
          >
            -
          </Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.counterInput,
            {
              width: responsiveLayout.isTablet ? 60 : 54,
              height: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
              fontSize: responsiveLayout.isTablet ? 22 : responsiveLayout.isSmallPhone ? 15 : 16,
            },
          ]}
          value={count}
          editable={false}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="0"
          placeholderTextColor="#ccc"
        />
        <TouchableOpacity
          style={[
            styles.counterButton,
            disabled && styles.counterButtonDisabled,
            {
              width: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
              height: responsiveLayout.isTablet ? 54 : MIN_TOUCH_TARGET,
            },
          ]}
          onPress={handleIncrement}
          disabled={disabled}
          activeOpacity={0.8}
          hitSlop={TOUCH_HIT_SLOP}
        >
          <Text
            style={[
              styles.counterButtonText,
              { fontSize: responsiveLayout.isTablet ? 20 : responsiveLayout.isSmallPhone ? 16 : 18 },
            ]}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>
      {showPenaltyTime ? (
        <View
          style={[
            styles.penaltyValueRow,
            {
              marginTop: responsiveLayout.isSmallPhone ? 6 : 8,
            },
          ]}
        >
          <View
            style={[
              styles.penaltyValuePill,
              {
                minWidth: responsiveLayout.isTablet ? 56 : responsiveLayout.isSmallPhone ? 40 : 44,
                paddingHorizontal: responsiveLayout.isSmallPhone ? 6 : 8,
              },
            ]}
          >
            <Text style={[styles.penaltyValue, { fontSize: responsiveLayout.isSmallPhone ? 11 : 12 }]}>
              {penaltyTime}s
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

export default PenaltyCounter;
