import React from 'react';
import { Text, View } from 'react-native';
import SectionHeader from '../SectionHeader/SectionHeader';
import styles from '../../../styles/App.styles';

const TimeSummarySection = React.memo(function TimeSummarySection({
  responsiveLayout,
  totalPenaltiesTime,
  lateStartPenaltyTime,
  performanceTimeDisplay,
  isDNF,
  dnfSelection,
  totalTimeDisplay,
  containerStyle,
  title = 'Time Summary',
}) {
  return (
    <View style={[styles.summarySection, containerStyle]}>
      <SectionHeader
        title={title}
        containerStyle={[styles.sectionTitleContainer, { marginBottom: responsiveLayout.isSmallPhone ? 8 : 10 }]}
        titleStyle={[
          styles.summaryTitle,
          {
            fontSize: responsiveLayout.isTablet ? 16 : responsiveLayout.isSmallPhone ? 14 : 15,
            marginBottom: 0,
          },
        ]}
      />
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Total Penalties Time:</Text>
        <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{totalPenaltiesTime} sec</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Late Start Penalty:</Text>
        <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{lateStartPenaltyTime} sec</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>Performance Time:</Text>
        <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>
          {performanceTimeDisplay}
        </Text>
      </View>
      {isDNF ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>DNF Points:</Text>
          <Text style={[styles.summaryValue, { fontSize: responsiveLayout.isSmallPhone ? 13 : 14 }]}>{dnfSelection}</Text>
        </View>
      ) : null}
      <View style={styles.summaryDivider} />
      <View
        style={[
          styles.summaryRowTotal,
          {
            paddingVertical: responsiveLayout.isSmallPhone ? 8 : 10,
            paddingHorizontal: responsiveLayout.isSmallPhone ? 10 : 12,
          },
        ]}
      >
        <Text
          style={[
            styles.summaryLabelTotal,
            { fontSize: responsiveLayout.isTablet ? 18 : responsiveLayout.isSmallPhone ? 15 : 16 },
          ]}
        >
          TOTAL TIME:
        </Text>
        <Text
          style={[
            styles.summaryValueTotal,
            { fontSize: responsiveLayout.isTablet ? 26 : responsiveLayout.isSmallPhone ? 20 : 22 },
          ]}
        >
          {totalTimeDisplay}
        </Text>
      </View>
    </View>
  );
});

export default TimeSummarySection;
