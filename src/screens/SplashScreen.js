import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { Colors, Typography } from '../utils/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotScale1 = useRef(new Animated.Value(0.6)).current;
  const dotScale2 = useRef(new Animated.Value(0.6)).current;
  const dotScale3 = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start(() => {
      // Tagline fade in
      Animated.timing(taglineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();

      // Loading dots
      const dotAnim = (dot, delay) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.spring(dot, { toValue: 1, useNativeDriver: true }),
            Animated.spring(dot, { toValue: 0.6, useNativeDriver: true }),
          ])
        );
      dotAnim(dotScale1, 0).start();
      dotAnim(dotScale2, 200).start();
      dotAnim(dotScale3, 400).start();
    });

    // Navigate after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Connect');
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Background grid lines */}
      <View style={styles.gridOverlay}>
        {[...Array(8)].map((_, i) => (
          <View key={i} style={[styles.gridLine, { top: (height / 8) * i }]} />
        ))}
      </View>

      {/* Glow circle */}
      <View style={styles.glowCircle} />

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        {/* Trolley Icon SVG-like */}
        <View style={styles.iconBox}>
          <View style={styles.trolleyBody} />
          <View style={styles.trolleyHandle} />
          <View style={styles.trolleyWheelRow}>
            <View style={styles.wheel} />
            <View style={styles.wheel} />
          </View>
          {/* Circuit dot */}
          <View style={styles.circuitDot} />
        </View>

        <Text style={styles.logoText}>SMART TROLLEY</Text>
        <View style={styles.logoUnderline} />
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Walk Freely. We Follow.
      </Animated.Text>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { transform: [{ scale: dotScale1 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ scale: dotScale2 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ scale: dotScale3 }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.accent,
  },
  glowCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.accentGlow,
    top: height / 2 - 200,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBox: {
    width: 100,
    height: 100,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  trolleyBody: {
    width: 52,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    opacity: 0.9,
  },
  trolleyHandle: {
    width: 6,
    height: 20,
    backgroundColor: Colors.accent,
    position: 'absolute',
    top: 10,
    right: 22,
    borderRadius: 3,
    opacity: 0.7,
  },
  trolleyWheelRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 4,
  },
  wheel: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  circuitDot: {
    position: 'absolute',
    top: 10,
    left: 22,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentSecondary,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 6,
  },
  logoUnderline: {
    marginTop: 8,
    width: 60,
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontStyle: 'italic',
    marginBottom: 64,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
});
