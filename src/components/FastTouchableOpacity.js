import React from 'react';
import { TouchableOpacity as RNTouchableOpacity } from 'react-native';

const DEFAULT_PRESS_RETENTION_OFFSET = {
  top: 16,
  right: 16,
  bottom: 16,
  left: 16,
};

const FastTouchableOpacity = React.forwardRef(function FastTouchableOpacity(
  {
    activeOpacity = 0.72,
    delayPressIn = 0,
    delayPressOut = 35,
    pressRetentionOffset = DEFAULT_PRESS_RETENTION_OFFSET,
    ...props
  },
  ref
) {
  return (
    <RNTouchableOpacity
      ref={ref}
      activeOpacity={activeOpacity}
      delayPressIn={delayPressIn}
      delayPressOut={delayPressOut}
      pressRetentionOffset={pressRetentionOffset}
      {...props}
    />
  );
});

FastTouchableOpacity.displayName = 'FastTouchableOpacity';

export default FastTouchableOpacity;
