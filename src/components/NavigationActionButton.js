import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import TouchableOpacity from './FastTouchableOpacity';

const DEFAULT_HIT_SLOP = {
  top: 14,
  right: 14,
  bottom: 14,
  left: 14,
};

const DEFAULT_PRESS_RETENTION_OFFSET = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
};

export const NavigationActionButton = React.memo(function NavigationActionButton({
  label,
  onPress,
  style,
  textStyle,
  contentStyle,
  icon,
  iconStyle,
  activeOpacity = 0.68,
  delayPressOut = 0,
  hitSlop = DEFAULT_HIT_SLOP,
  pressRetentionOffset = DEFAULT_PRESS_RETENTION_OFFSET,
  disabled = false,
  accessibilityLabel,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.buttonBase, style]}
      activeOpacity={activeOpacity}
      delayPressOut={delayPressOut}
      hitSlop={hitSlop}
      pressRetentionOffset={pressRetentionOffset}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      <View style={[styles.buttonContent, contentStyle]}>
        {icon ? <Text style={[styles.buttonIcon, iconStyle]}>{icon}</Text> : null}
        <Text style={[styles.buttonLabel, textStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
});

export const CloseActionButton = React.memo(function CloseActionButton({
  label = 'X',
  onPress,
  style,
  textStyle,
  activeOpacity = 0.6,
  delayPressOut = 0,
  hitSlop = DEFAULT_HIT_SLOP,
  pressRetentionOffset = DEFAULT_PRESS_RETENTION_OFFSET,
  disabled = false,
  accessibilityLabel = 'Close',
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.closeButtonBase, style]}
      activeOpacity={activeOpacity}
      delayPressOut={delayPressOut}
      hitSlop={hitSlop}
      pressRetentionOffset={pressRetentionOffset}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.closeLabel, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  buttonBase: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  closeButtonBase: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  closeLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
});
