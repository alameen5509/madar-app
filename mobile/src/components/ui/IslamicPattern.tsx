import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Defs, Pattern, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface IslamicPatternProps {
  style?: ViewStyle;
  opacity?: number;
}

export function IslamicPattern({ style, opacity = 0.05 }: IslamicPatternProps) {
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" style={{ opacity }}>
        <Defs>
          <Pattern id="islamic" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <Path
              d="M30 0 L60 15 L60 45 L30 60 L0 45 L0 15 Z"
              stroke={colors.gold}
              strokeWidth="0.5"
              fill="none"
            />
            <Path
              d="M30 10 L50 20 L50 40 L30 50 L10 40 L10 20 Z"
              stroke={colors.gold}
              strokeWidth="0.3"
              fill="none"
            />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#islamic)" />
      </Svg>
    </View>
  );
}
