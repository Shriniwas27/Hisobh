import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Pressable,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onAnimationComplete,
}) => {
  const { colors, isDark } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const [finished, setFinished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissSplash = () => {
    if (finished) return;
    setFinished(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    try {
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationComplete();
      });
    } catch {
      onAnimationComplete();
    }

    // Safety fallback: guaranteed dismiss even if animation is interrupted
    setTimeout(() => {
      onAnimationComplete();
    }, 350);
  };

  useEffect(() => {
    try {
      // 1. Logo pop & fade in
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        // Halo scale with delay
        Animated.timing(ringScale, {
          toValue: 1.5,
          duration: 800,
          delay: 200,
          useNativeDriver: true,
        }),
        // Halo opacity pulse with delay
        Animated.sequence([
          Animated.timing(ringOpacity, {
            toValue: 0.6,
            duration: 350,
            delay: 200,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
        // Title & Subtitle fade in with delay
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          delay: 250,
          useNativeDriver: true,
        }),
        Animated.spring(textTranslateY, {
          toValue: 0,
          friction: 7,
          delay: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      console.warn('Splash animation start notice:', err);
    }

    // 2. Snappy auto-dismiss after 1.5 seconds
    timerRef.current = setTimeout(() => {
      dismissSplash();
    }, 1500);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#121214' : '#F8F7F4',
          opacity: containerOpacity,
        },
      ]}
      pointerEvents={finished ? 'none' : 'auto'}
    >
      <Pressable style={styles.pressableArea} onPress={dismissSplash}>
        {/* Animated Halo / Glow Ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              borderColor: colors.accent,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />

        {/* Center Logo with Spring & Shadow */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              shadowColor: colors.accent,
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            },
          ]}
        >
          <View
            style={[
              styles.logoBorder,
              {
                backgroundColor: isDark ? '#1C1C1F' : '#FFFFFF',
                borderColor: `${colors.accent}40`,
              },
            ]}
          >
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* App Title & Slogan */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Hisobh
          </Text>

          <View style={styles.pillBadge}>
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Smart Personal Ledger
            </Text>
          </View>
        </Animated.View>

        {/* Skip hint at bottom */}
        <Animated.Text
          style={[styles.skipHint, { color: colors.textMuted, opacity: textOpacity }]}
        >
          Tap anywhere to continue
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressableArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
  },
  logoContainer: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
  logoBorder: {
    width: 120,
    height: 120,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  skipHint: {
    position: 'absolute',
    bottom: 48,
    fontSize: 11,
    fontWeight: '500',
  },
});
