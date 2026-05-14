// ============================================
// MODIFIED: ConnectScreen — Auto-Discovery
// Connects to ESP32 + Raspberry Pi on same hotspot
// Replaces old manual "Tap to Connect" login
// ============================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, TextInput, Keyboard, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getFullStatus, discoverPi, pingPi, setPiUrl } from '../api/trolleyApi';
import { Colors } from '../utils/theme';

const PHASE = {
  SEARCHING:  { label: 'Searching for Smart Trolley...', color: '#FFC300' },
  CONNECTING: { label: 'Connecting...', color: Colors.accent },
  CONNECTED:  { label: 'Connected', color: Colors.green },
  FAILED:     { label: 'Connection Failed', color: Colors.red },
  MANUAL:     { label: 'Manual Entry', color: Colors.purple },
};

export default function ConnectScreen({ navigation }) {
  const [phase, setPhase]             = useState(PHASE.SEARCHING);
  const [progressText, setProgressText] = useState('Initializing...');
  const [showManual, setShowManual]   = useState(false);
  const [manualIp, setManualIp]       = useState('');
  const [espFound, setEspFound]       = useState(false);
  const [piFound, setPiFound]         = useState(false);

  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const ringAnim   = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    startPulse();
    startAutoConnect();
  }, []);

  const startPulse = () => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ])).start();
  };

  const startRing = () => {
    ringAnim.setValue(0); ringOpacity.setValue(0.8);
    Animated.loop(Animated.parallel([
      Animated.timing(ringAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ])).start();
  };

  const stopRing = () => { ringAnim.setValue(0); ringOpacity.setValue(0); };

  // ─── Auto-Discovery ─────────────────────────────────────────────────────
  const startAutoConnect = useCallback(async () => {
    setPhase(PHASE.SEARCHING);
    setShowManual(false);
    setEspFound(false);
    setPiFound(false);
    startRing();

    // 1. Try ESP32
    setProgressText('Looking for ESP32 trolley...');
    const espResult = await getFullStatus();
    if (espResult.success) setEspFound(true);

    // 2. Try Raspberry Pi
    setProgressText('Discovering Raspberry Pi...');
    const piResult = await discoverPi();
    if (piResult.success) setPiFound(true);

    // 3. Evaluate
    if (espResult.success || piResult.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase(PHASE.CONNECTED);
      stopRing();
      const msg = [];
      if (espResult.success) msg.push('ESP32 connected');
      if (piResult.success) msg.push('Pi connected');
      setProgressText(msg.join(' • '));

      setTimeout(() => {
        navigation.replace('Main', {
          initialData: espResult.success
            ? espResult.data
            : { connection: 'connected', mode: 'airport', follow: false, battery: 0, weight: 0, speed_mode: 'normal' },
          demoMode: false,
        });
      }, 1200);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase(PHASE.FAILED);
      stopRing();
      setProgressText('No devices found. Ensure all devices are on the same hotspot.');
    }
  }, [navigation]);

  // ─── Manual IP ──────────────────────────────────────────────────────────
  const handleManualConnect = async () => {
    if (!manualIp.trim()) return;
    Keyboard.dismiss();
    setPhase(PHASE.CONNECTING);
    setProgressText(`Trying ${manualIp.trim()}...`);
    startRing();

    const url = `http://${manualIp.trim().replace(/^https?:\/\//, '')}:5000`;
    setPiUrl(url);

    const res = await pingPi();
    if (res.success && res.data?.device === 'smarttrolley-pi') {
      setPiFound(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase(PHASE.CONNECTED);
      stopRing();
      setProgressText(`Pi connected at ${manualIp.trim()}`);
      setTimeout(() => {
        navigation.replace('Main', {
          initialData: { connection: 'connected', mode: 'airport', follow: false, battery: 0, weight: 0, speed_mode: 'normal' },
          demoMode: false,
        });
      }, 1200);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase(PHASE.FAILED);
      stopRing();
      setProgressText('Could not reach Pi at that address');
    }
  };

  const enterDemo = () => {
    navigation.replace('Main', {
      initialData: { connection: 'demo', mode: 'airport', follow: false, battery: 82, weight: 18.4, distance: 1.2, speed_mode: 'normal' },
      demoMode: true,
    });
  };

  const isSearching = phase === PHASE.SEARCHING || phase === PHASE.CONNECTING;
  const isFailed = phase === PHASE.FAILED;
  const statusColor = phase.color;
  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });

  return (
    <View style={s.container}>
      <View style={[s.blob, { top: -80, right: -80, backgroundColor: Colors.accentGlow }]} />
      <View style={[s.blob, { bottom: -60, left: -60, backgroundColor: '#6C5CE722' }]} />

      <Text style={s.headerTitle}>Smart Trolley</Text>
      <Text style={s.headerSub}>Auto-Connect via Hotspot</Text>

      {/* Center circle */}
      <View style={s.centerArea}>
        {isSearching && (
          <Animated.View style={[s.ring, { borderColor: statusColor, transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
        )}
        <Animated.View style={{ transform: [{ scale: isSearching ? pulseAnim : 1 }] }}>
          <View style={[s.circle, { borderColor: statusColor }]}>
            <View style={[s.dot, { backgroundColor: statusColor }]} />
            <View style={s.trolleyIcon}>
              <View style={[s.tBody, { backgroundColor: statusColor }]} />
              <View style={s.tWheels}>
                <View style={[s.tWheel, { borderColor: statusColor }]} />
                <View style={[s.tWheel, { borderColor: statusColor }]} />
              </View>
            </View>
            {isSearching
              ? <ActivityIndicator size="small" color={statusColor} style={{ marginTop: 8 }} />
              : <Text style={[s.circleLabel, { color: statusColor }]}>{phase === PHASE.CONNECTED ? 'CONNECTED' : 'NOT FOUND'}</Text>
            }
          </View>
        </Animated.View>
      </View>

      {/* Device badges */}
      <View style={s.badgeRow}>
        <View style={[s.badge, { borderColor: (espFound ? Colors.green : Colors.textMuted) + '55' }]}>
          <View style={[s.badgeDot, { backgroundColor: espFound ? Colors.green : Colors.textMuted }]} />
          <Text style={[s.badgeText, { color: espFound ? Colors.green : Colors.textMuted }]}>ESP32</Text>
        </View>
        <View style={[s.badge, { borderColor: (piFound ? Colors.green : Colors.textMuted) + '55' }]}>
          <View style={[s.badgeDot, { backgroundColor: piFound ? Colors.green : Colors.textMuted }]} />
          <Text style={[s.badgeText, { color: piFound ? Colors.green : Colors.textMuted }]}>Raspberry Pi</Text>
        </View>
      </View>

      {/* Status */}
      <View style={[s.pill, { borderColor: statusColor + '66', backgroundColor: statusColor + '15' }]}>
        <View style={[s.pillDot, { backgroundColor: statusColor }]} />
        <Text style={[s.pillText, { color: statusColor }]}>{phase.label}</Text>
      </View>
      <Text style={s.progress}>{progressText}</Text>

      {/* Actions on failure */}
      {isFailed && !showManual && (
        <View style={s.actions}>
          <TouchableOpacity style={s.retryBtn} onPress={startAutoConnect}>
            <Text style={s.retryBtnText}>🔄  Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.manualBtn} onPress={() => { setShowManual(true); setPhase(PHASE.MANUAL); }}>
            <Text style={s.manualBtnText}>⌨️  Enter IP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.demoBtn} onPress={enterDemo}>
            <Text style={s.demoBtnText}>📱 Demo Mode</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual IP entry */}
      {showManual && (
        <View style={s.manualArea}>
          <Text style={s.manualLabel}>RASPBERRY PI IP ADDRESS</Text>
          <View style={s.inputRow}>
            <TextInput style={s.ipInput} value={manualIp} onChangeText={setManualIp}
              placeholder="e.g. 192.168.43.100" placeholderTextColor={Colors.textMuted}
              keyboardType="numeric" autoFocus returnKeyType="go" onSubmitEditing={handleManualConnect}
            />
            <TouchableOpacity style={s.goBtn} onPress={handleManualConnect}>
              <Text style={s.goBtnText}>Go</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => { setShowManual(false); startAutoConnect(); }}>
            <Text style={s.backLink}>← Auto-Connect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: Colors.textMuted, letterSpacing: 3, marginTop: 4, textTransform: 'uppercase' },
  centerArea: { alignItems: 'center', justifyContent: 'center', width: 240, height: 210, marginTop: 24 },
  ring: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2 },
  circle: { width: 180, height: 180, borderRadius: 90, borderWidth: 2, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 8 },
  trolleyIcon: { alignItems: 'center', marginBottom: 6 },
  tBody: { width: 38, height: 26, borderRadius: 6, opacity: 0.9 },
  tWheels: { flexDirection: 'row', gap: 18, marginTop: 3 },
  tWheel: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: Colors.background },
  circleLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 1, marginTop: 16 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '600' },
  progress: { fontSize: 13, color: Colors.textSecondary, marginTop: 10, textAlign: 'center' },
  actions: { width: '100%', marginTop: 20, gap: 10 },
  retryBtn: { backgroundColor: Colors.accent, borderRadius: 99, paddingVertical: 16, alignItems: 'center' },
  retryBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  manualBtn: { borderRadius: 99, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.accent + '66', backgroundColor: Colors.surfaceElevated },
  manualBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  demoBtn: { paddingVertical: 12, alignItems: 'center' },
  demoBtnText: { color: Colors.textMuted, fontWeight: '600', fontSize: 13 },
  manualArea: { width: '100%', marginTop: 20, gap: 10 },
  manualLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.accent },
  inputRow: { flexDirection: 'row', gap: 10 },
  ipInput: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: Colors.textPrimary, fontSize: 16, fontFamily: 'monospace', borderWidth: 1, borderColor: Colors.border },
  goBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center' },
  goBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  backLink: { color: Colors.accent, fontWeight: '600', fontSize: 13, marginTop: 4 },
});
