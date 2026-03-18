import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style, textStyle, icon }: ButtonProps) {
  const bg = variant === 'primary' ? colors.gold
    : variant === 'danger' ? colors.danger
    : variant === 'ghost' ? 'transparent'
    : colors.card;
  const textColor = variant === 'primary' ? colors.navy
    : variant === 'ghost' ? colors.gold
    : colors.text;
  const borderColor = variant === 'secondary' ? colors.cardBorder
    : variant === 'ghost' ? 'transparent'
    : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: bg, borderColor, opacity: disabled ? 0.5 : 1 }, style]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
});
