import React, { useState } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import TouchableOpacity from '../FastTouchableOpacity';
import styles from './stopwatchForm.styles';
import { INITIAL_LAYOUT, CATEGORY_CARD_PALETTES, normalizeCategoryKey } from './stopwatchForm.shared';

const CategoryCard = React.memo(function CategoryCard({ category, onPress, teamCount = 0, cardStyle, layout }) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const responsiveLayout = layout || INITIAL_LAYOUT;
  const categoryKey = normalizeCategoryKey(category.name || category.category || '');
  const palette = CATEGORY_CARD_PALETTES[categoryKey] || {
    background: '#ffffff',
    border: '#c7d5f5',
    iconBackground: category.color || '#5b7cfa',
    badgeBackground: '#4263cf',
    secondaryBadgeBackground: '#e8efff',
    secondaryBadgeBorder: '#9fb4ef',
    secondaryBadgeText: '#4263cf',
    title: '#1f2d5a',
    description: '#5f6f97',
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 260,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 280,
      friction: 20,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[
          styles.card,
          {
            width: '100%',
            minHeight: responsiveLayout.isTablet ? 360 : 316,
            paddingHorizontal: responsiveLayout.isTablet ? 14 : 12,
            paddingVertical: responsiveLayout.isTablet ? 14 : 12,
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
          cardStyle,
        ]}
      >
        <View style={styles.cardContent}>
          <View
            style={[
              styles.iconBox,
              {
                minHeight: responsiveLayout.isTablet ? 212 : 182,
                backgroundColor: category.imageSource ? 'transparent' : palette.iconBackground,
              },
            ]}
          >
            {category.imageSource ? (
              <Image
                source={category.imageSource}
                style={[
                  styles.categoryImageIcon,
                  categoryKey === 'PETROL_MODIFIED' && styles.categoryImageIconPetrolModified,
                  categoryKey === 'SUV_MODIFIED' && styles.categoryImageIconSuvModified,
                  categoryKey === 'PETROL_EXPERT' && styles.categoryImageIconPetrolExpert,
                ]}
                resizeMode="contain"
              />
            ) : (
              <Text style={[styles.categoryIcon, { fontSize: responsiveLayout.isTablet ? 34 : 30 }]}>
                {category.icon}
              </Text>
            )}
          </View>

          <View style={styles.countPanel}>
            <View style={styles.countStatsRow}>
              <View
                style={[
                  styles.countStat,
                  styles.countStatSecondary,
                  {
                    backgroundColor: palette.secondaryBadgeBackground,
                    borderColor: palette.secondaryBadgeBorder,
                  },
                ]}
              >
                <Text style={[styles.countStatValue, { color: palette.secondaryBadgeText }]}>
                  {String(category.trackCount || 0).padStart(2, '0')}
                </Text>
                <Text style={[styles.countStatLabel, { color: palette.secondaryBadgeText }]}>Tracks</Text>
              </View>
              <View style={styles.countStatsDivider} />
              <View
                style={[
                  styles.countStat,
                  {
                    backgroundColor: palette.badgeBackground,
                    borderColor: palette.badgeBackground,
                  },
                ]}
              >
                <Text style={[styles.countStatValue, styles.countStatValueOnPrimary]}>
                  {String(teamCount || 0).padStart(2, '0')}
                </Text>
                <Text style={[styles.countStatLabel, styles.countStatLabelOnPrimary]}>Teams</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default CategoryCard;
