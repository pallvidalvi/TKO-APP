import React from 'react';
import { Text, View } from 'react-native';
import TouchableOpacity from '../FastTouchableOpacity';
import styles from './stopwatchForm.styles';
import { TOUCH_HIT_SLOP } from './stopwatchForm.shared';

const LateStartCheckbox = React.memo(function LateStartCheckbox({
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <TouchableOpacity
      style={[styles.lateStartCheckboxRow, disabled && styles.lateStartCheckboxRowDisabled]}
      onPress={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      disabled={disabled}
      activeOpacity={0.85}
      hitSlop={TOUCH_HIT_SLOP}
    >
      <View style={[styles.lateStartCheckbox, checked && styles.lateStartCheckboxChecked]}>
        <Text style={styles.lateStartCheckboxTick}>{checked ? '✓' : ''}</Text>
      </View>
      <Text style={styles.lateStartCheckboxLabel}>Late Start</Text>
    </TouchableOpacity>
  );
});

export default LateStartCheckbox;
