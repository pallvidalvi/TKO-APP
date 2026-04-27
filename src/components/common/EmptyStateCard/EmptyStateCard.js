import React from 'react';
import { Text, View } from 'react-native';
import styles from './EmptyStateCard.styles';

const EmptyStateCard = React.memo(function EmptyStateCard({
  title,
  message,
  containerStyle,
  titleStyle,
  messageStyle,
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      <Text style={[styles.message, messageStyle]}>{message}</Text>
    </View>
  );
});

export default EmptyStateCard;
