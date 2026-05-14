import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { setPID, setSensitivity, getPiUrl } from '../api/trolleyApi';
import { Colors } from '../utils/theme';

export default function SettingsScreen({ navigation }) {
  const [kp, setKp] = useState(1.2);
  const [ki, setKi] = useState(0.4);
  const [kd, setKd] = useState(0.1);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [antitheftEnabled, setAntitheftEnabled] = useState(true);
  const [sensitivity, setSensMode] = useState('normal');

  const handleSavePID = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setPID(kp, ki, kd);
    Alert.alert('✅ PID Saved', `Kp: ${kp.toFixed(2)}, Ki: ${ki.toFixed(2)}, Kd: ${kd.toFixed(2)}`);
  };

  const handleSensitivity = async (mode) => {
    Haptics.selectionAsync();
    setSensMode(mode);
    await setSensitivity(mode);
  };

  const FEATURE_SCREENS = [
    { icon: '👤', label: 'Face Authentication', sub: 'Recognize users, add new faces', screen: 'FaceAuth', color: Colors.accent },
    { icon: '♿', label: 'Accessibility Mode', sub: 'Elderly, Wheelchair, Child profiles', screen: 'Accessibility', color: '#FFB347' },
    { icon: '📊', label: 'Trip Analytics', sub: 'Distance, speed, battery history', screen: 'Analytics', color: Colors.accentSecondary },
    { icon: '👥', label: 'User Profiles', sub: 'Custom settings per person', screen: 'Profiles', color: '#A29BFE' },
    { icon: '🔒', label: 'Anti-Theft System', sub: 'Geofence, motion, siren', screen: 'AntiTheft', color: Colors.red },
    { icon: '🔍', label: 'Find My Trolley', sub: 'AirTag-style lost mode', screen: 'LostTrolley', color: Colors.green },
    { icon: '🌡️', label: 'Sensor Dashboard', sub: 'Temp, humidity, air quality', screen: 'Sensors', color: '#74B9FF' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── FEATURE SCREENS ── */}
        <Text style={styles.sectionLabel}>ADVANCED FEATURES</Text>
        {FEATURE_SCREENS.map((f) => (
          <TouchableOpacity
            key={f.screen}
            style={styles.featureRow}
            onPress={() => { Haptics.selectionAsync(); navigation.navigate(f.screen); }}
            activeOpacity={0.8}
          >
            <View style={[styles.featureIcon, { backgroundColor: f.color + '22' }]}>
              <Text style={{ fontSize: 22 }}>{f.icon}</Text>
            </View>
            <View style={styles.featureInfo}>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureSub}>{f.sub}</Text>
            </View>
            <Text style={styles.featureArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* ── PID (backup controls here too) ── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>SPEED SENSITIVITY</Text>
        <View style={styles.card}>
          <View style={styles.sensitivityRow}>
            {[
              { key: 'slow', label: '🐢 Slow', sub: 'Elderly' },
              { key: 'normal', label: '🚶 Normal', sub: 'Standard' },
              { key: 'fast', label: '🏃 Fast', sub: 'Rush' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sensBtn, sensitivity === opt.key && styles.sensBtnActive]}
                onPress={() => handleSensitivity(opt.key)}
              >
                <Text style={[styles.sensLabel, sensitivity === opt.key && { color: Colors.background }]}>{opt.label}</Text>
                <Text style={[styles.sensSub, sensitivity === opt.key && { color: Colors.background + 'AA' }]}>{opt.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── ALERTS ── */}
        <Text style={styles.sectionLabel}>ALERTS & NOTIFICATIONS</Text>
        <View style={styles.toggleCard}>
          {[
            { label: 'Obstacle Alerts', desc: 'Notify when trolley detects an obstacle', value: alertsEnabled, setter: setAlertsEnabled },
            { label: 'Anti-Theft Monitoring', desc: 'Alert when trolley moves outside safe zone', value: antitheftEnabled, setter: setAntitheftEnabled },
            { label: 'Voice Commands', desc: '"Follow Me", "Stop", "Return"', value: voiceEnabled, setter: setVoiceEnabled },
          ].map((item, i) => (
            <View key={item.label}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <Text style={styles.toggleLabel}>{item.label}</Text>
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

        {/* ── DEVICE INFO ── */}
        <Text style={styles.sectionLabel}>DEVICE INFO</Text>
        <View style={styles.card}>
          {[
            { label: 'Trolley API', value: '192.168.4.1' },
            { label: 'Pi Server', value: getPiUrl().replace('http://', '') },
            { label: 'App Version', value: '3.0.0' },
            { label: 'SDK', value: 'Expo 54' },
          ].map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue}>{row.value}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 10 },
  card: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },

  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surfaceElevated, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  featureIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureInfo: { flex: 1 },
  featureLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  featureSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  featureArrow: { fontSize: 22, color: Colors.textMuted },

  sensitivityRow: { flexDirection: 'row', gap: 8 },
  sensBtn: { flex: 1, backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 4 },
  sensBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sensLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  sensSub: { fontSize: 10, color: Colors.textMuted },

  toggleCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  toggleLeft: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  toggleDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 13, color: Colors.accent, fontFamily: 'monospace' },
});
