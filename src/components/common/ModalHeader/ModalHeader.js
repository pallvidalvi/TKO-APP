import React from 'react';
import { Text, View } from 'react-native';
import { CloseActionButton } from '../../NavigationActionButton';
import styles from './ModalHeader.styles';

const ModalHeader = React.memo(function ModalHeader({
  title,
  subtitle,
  onClose,
  containerStyle,
  titleStyle,
  subtitleStyle,
  rightContent,
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.actions}>
        {rightContent}
        <CloseActionButton onPress={onClose} textStyle={styles.closeButtonText} />
      </View>
    </View>
  );
});

export default ModalHeader;
