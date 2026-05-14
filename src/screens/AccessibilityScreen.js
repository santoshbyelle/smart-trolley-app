import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Animated, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { setSensitivity, setPID } from '../api/trolleyApi';
import { Colors } from '../utils/theme';

const PROFILES = [
  {
    key: 'elderly',
    icon: '👴',
    label: 'Elderly Mode',
    desc: 'Very smooth & slow. Maximum safety.',
    color: '#FFB347',
    pid: { kp: 0.4, ki: 0.1, kd: 0.05 },
    speed: 'slow',
    distance: 1.5,
    features: ['Ultra-smooth acceleration', 'Extended stopping distance', 'Large UI text', 'Gentle audio alerts'],
  },
  {
    key: 'wheelchair',
    icon: '♿',
    label: 'Wheelchair Mode',
    desc: 'Side-following. Obstacle priority.',
    color: '#74B9FF',
    pid: { kp: 0.6, ki: 0.15, kd: 0.05 },
    speed: 'slow',
    distance: 1.2,
    features: ['Side-follow positioning', 'Wide turning radius', 'Low-speed precision', 'One-hand operation'],
  },
  {
    key: 'child',
    icon: '👧',
    label: 'Child Safe Mode',
    desc: 'Strict speed limit. Child-proof.',
    color: '#A29BFE',
    pid: { kp: 0.5, ki: 0.12, kd: 0.04 },
    speed: 'slow',
    distance: 0.8,
    features: ['Max speed: 2 km/h', 'Instant stop reflex', 'Bright LED status', 'Guardian alerts'],
  },
  {
    key: 'standard',
    icon: '🧑',
    label: 'Standard Mode',
    desc: 'Default settings for all users.',
    color: Colors.accent,
    pid: { kp: 1.2, ki: 0.4, kd: 0.1 },
    speed: 'normal',
    distance: 1.0,
    features: ['Balanced PID response', 'Normal following speed', 'Standard alerts', 'Full feature access'],
  },
];

export default function AccessibilityScreen({ navigation }) {
  const [activeProfile, setActiveProfile] = useState('standard');
  const [largeText, setLargeText] = useState(false);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleSelectProfile = async (profile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveProfile(profile.key);

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    await setPID(profile.pid.kp, profile.pid.ki, profile.pid.kd);
    await setSensitivity(profile.speed);

    Alert.alert(
      `${profile.icon} ${profile.label} Applied`,
      `PID tuned for ${profile.label}.\nFollowing distance set to ${profile.distance}m.`
    );
  };

  const textScale = largeText ? 1.2 : 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { fontSize: 22 * textScale }]}>Accessibility</Text>
          <Text style={styles.subtitle}>Adapted for every user</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile cards */}
        <Text style={styles.sectionLabel}>MOTION PROFILES</Text>
        {PROFILES.map((profile) => {
          const isActive = activeProfile === profile.key;
          return (
            <TouchableOpacity
              key={profile.key}
              style={[styles.profileCard, isActive && { borderColor: profile.color, backgroundColor: profile.color + '12' }]}
              onPress={() => handleSelectProfile(profile)}
              activeOpacity={0.85}
            >
              <View style={styles.profileTop}>
                <View style={[styles.profileIconBox, { backgroundColor: profile.color + '22' }]}>
                  <Text style={styles.profileIcon}>{profile.icon}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileLabel, { fontSize: 16 * textScale }]}>{profile.label}</Text>
                  <Text style={styles.profileDesc}>{profile.desc}</Text>
                </View>
                <View style={[styles.activeRing, isActive && { backgroundColor: profile.color }]}>
                  {isActive && <Text style={styles.activeTick}>✓</Text>}
                </View>
              </View>

              {/* Features list */}
              <View style={styles.featuresList}>
                {profile.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <View style={[styles.featureDot, { backgroundColor: profile.color }]} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* PID preview */}
              <View style={styles.pidPreview}>
                <Text style={[styles.pidChip, { borderColor: profile.color + '66', color: profile.color }]}>
                  Kp {profile.pid.kp}
                </Text>
                <Text style={[styles.pidChip, { borderColor: profile.color + '66', color: profile.color }]}>
                  Ki {profile.pid.ki}
                </Text>
                <Text style={[styles.pidChip, { borderColor: profile.color + '66', color: profile.color }]}>
                  Kd {profile.pid.kd}
                </Text>
                <Text style={[styles.pidChip, { borderColor: profile.color + '66', color: profile.color }]}>
                  {profile.distance}m gap
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Display settings */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>DISPLAY & FEEDBACK</Text>
        <View style={styles.toggleCard}>
          {[
            { label: 'Large Text Mode', desc: 'Increase all text size by 20%', value: largeText, setter: setLargeText },
            { label: 'High Contrast', desc: 'Stronger color differences', value: highContrast, setter: setHighContrast },
            { label: 'Audio Alerts', desc: 'Voice prompts for key events', value: audioAlerts, setter: setAudioAlerts },
            { label: 'Haptic Feedback', desc: 'Vibration on important actions', value: hapticFeedback, setter: setHapticFeedback },
          ].map((item, i) => (
            <View key={item.label}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Text style={[styles.toggleLabel, { fontSize: 15 * textScale }]}>{item.label}</Text>
                  <Text style={styles.toggleDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={(v) => { Haptics.selectionAsync(); item.setter(v); }}
                  trackColor={{ false: Colors.border, true: Colors.accent + '77' }}
                  thumbColor={item.value ? Colors.accent : Colors.textMuted}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  title: { fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 12 },

  profileCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: Colors.border },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  profileIconBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  profileIcon: { fontSize: 26 },
  profileInfo: { flex: 1 },
  profileLabel: { fontWeight: '700', color: Colors.textPrimary },
  profileDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  activeRing: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  activeTick: { color: '#000', fontWeight: '900', fontSize: 14 },

  featuresList: { gap: 5, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText: { fontSize: 12, color: Colors.textSecondary },

  pidPreview: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pidChip: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },

  toggleCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 4, borderWidth: 1, borderColor: Colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  toggleLeft: { flex: 1, marginRight: 12 },
  toggleLabel: { fontWeight: '600', color: Colors.textPrimary },
  toggleDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
});
