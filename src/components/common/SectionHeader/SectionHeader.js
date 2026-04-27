import React from 'react';
import { Text, View } from 'react-native';
import styles from './SectionHeader.styles';

const SectionHeader = React.memo(function SectionHeader({
  title,
  containerStyle,
  titleStyle,
  children,
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      {children ? <View>{children}</View> : null}
    </View>
  );
});

export default SectionHeader;
