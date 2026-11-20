import React from 'react';
import { TouchableOpacity, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

interface FloatingAddButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  bottomRight?: boolean;
  isTabScreen?: boolean;
}

export const FloatingAddButton: React.FC<FloatingAddButtonProps> = ({
  onPress,
  style,
  bottomRight = false,
  isTabScreen = false,
}) => {
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/add-bill');
    }
  };

  const positionStyle: ViewStyle | null = bottomRight
    ? {
        position: 'absolute',
        bottom: isTabScreen ? (Platform.OS === 'ios' ? 104 : 84) : (Platform.OS === 'ios' ? 36 : 24),
        right: 20,
        zIndex: 999,
      }
    : null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[
        styles.button,
        {
          backgroundColor: colors.accent,
          shadowColor: colors.accent,
        },
        positionStyle,
        style,
      ]}
    >
      <Ionicons name="add" size={32} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
