import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Switch, Alert, Dimensions, TextInput, Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import {
  getFullStatus, startFollow, stopTrolley, emergencyStop,
  returnToUser, setMode, setPID, setSensitivity, getWeight,
} from '../api/trolleyApi';
import { Colors } from '../utils/theme';

const { width } = Dimensions.get('window');

// ─── Battery Widget ───────────────────────────────────────────────────────────
function BatteryWidget({ level }) {
  const color = level > 50 ? Colors.green : level > 20 ? Colors.yellow : Colors.red;
  return (
    <View style={bStyles.container}>
      <View style={bStyles.body}>
        <View style={[bStyles.fill, { width: `${level}%`, backgroundColor: color }]} />
      </View>
      <View style={bStyles.tip} />
      <Text style={[bStyles.label, { color }]}>{level}%</Text>
    </View>
  );
}
const bStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { width: 38, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.textMuted, overflow: 'hidden', backgroundColor: Colors.background },
  fill: { height: '100%', borderRadius: 2 },
  tip: { width: 4, height: 8, backgroundColor: Colors.textMuted, borderTopRightRadius: 2, borderBottomRightRadius: 2, marginLeft: -1 },
  label: { fontSize: 12, fontWeight: '700' },
});

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ connected }) {
  return (
    <View style={[sbStyles.container, { borderColor: connected ? Colors.greenGlow : Colors.redGlow }]}>
      <View style={[sbStyles.dot, { backgroundColor: connected ? Colors.green : Colors.red }]} />
      <Text style={[sbStyles.text, { color: connected ? Colors.green : Colors.red }]}>
        {connected ? 'CONNECTED' : 'OFFLINE'}
      </Text>
    </View>
  );
}
const sbStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
});

// ─── Weight Display ───────────────────────────────────────────────────────────
function WeightDisplay({ weight, mode }) {
  const maxWeight = mode === 'airport' ? 20 : 35;
  const percent = Math.min((weight / maxWeight) * 100, 100);
  const color = percent < 70 ? Colors.green : percent < 90 ? Colors.yellow : Colors.red;
  const statusText = percent < 70 ? 'SAFE' : percent < 90 ? 'NEAR LIMIT' : 'OVERLOADED';

  return (
    <View>
      <View style={wStyles.topRow}>
        <View>
          <Text style={wStyles.label}>LUGGAGE WEIGHT</Text>
          <Text style={wStyles.subLabel}>⚡ Live from weight sensor</Text>
        </View>
        <View style={[wStyles.badge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
          <Text style={[wStyles.badgeText, { color }]}>{statusText}</Text>
        </View>
      </View>
      <Text style={wStyles.value}>{weight.toFixed(1)}<Text style={wStyles.unit}> kg</Text></Text>
      <View style={wStyles.barBg}>
        <View style={[wStyles.barFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <View style={wStyles.row}>
        <Text style={[wStyles.pctText, { color }]}>{percent.toFixed(0)}% of limit</Text>
        <Text style={wStyles.maxText}>Max: {maxWeight} kg  {mode === 'airport' ? '✈️ Airport' : '🛍️ Mall'}</Text>
      </View>
    </View>
  );
}
const wStyles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted },
  subLabel: { fontSize: 10, color: Colors.accent, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  value: { fontSize: 44, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1, marginTop: 4 },
  unit: { fontSize: 22, fontWeight: '400', color: Colors.textSecondary },
  barBg: { height: 8, borderRadius: 4, backgroundColor: Colors.border, marginTop: 12, marginBottom: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  pctText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  maxText: { fontSize: 11, color: Colors.textMuted },
});

// ─── Distance Modal ───────────────────────────────────────────────────────────
function DistanceModal({ visible, currentDist, onSave, onClose }) {
  const [value, setValue] = useState(String(currentDist));
  useEffect(() => { setValue(String(currentDist)); }, [currentDist]);
  const options = [0.5, 1.0, 1.5, 2.0, 2.5];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={dStyles.overlay}>
        <View style={dStyles.sheet}>
          <Text style={dStyles.title}>Set Following Distance</Text>
          <Text style={dStyles.sub}>How far should the trolley stay behind you?</Text>
          <View style={dStyles.optionsRow}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[dStyles.optBtn, parseFloat(value) === opt && dStyles.optBtnActive]}
                onPress={() => setValue(String(opt))}
              >
                <Text style={[dStyles.optBtnText, parseFloat(value) === opt && dStyles.optBtnTextActive]}>
                  {opt}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={dStyles.inputLabel}>CUSTOM (0.3 – 5.0 meters)</Text>
          <View style={dStyles.inputRow}>
            <TextInput
              style={dStyles.input}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholderTextColor={Colors.textMuted}
              placeholder="e.g. 1.2"
            />
            <Text style={dStyles.inputUnit}>m</Text>
          </View>
          <View style={dStyles.btnRow}>
            <TouchableOpacity style={dStyles.cancelBtn} onPress={onClose}>
              <Text style={dStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dStyles.saveBtn}
              onPress={() => {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0.3 || num > 5.0) {
                  Alert.alert('Invalid Value', 'Enter a value between 0.3 and 5.0 meters');
                  return;
                }
                onSave(num);
              }}
            >
              <Text style={dStyles.saveText}>Apply Distance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const dStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  sub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  optionsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  optBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.card },
  optBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentGlow },
  optBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  optBtnTextActive: { color: Colors.accent },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderAccent, paddingHorizontal: 16, marginBottom: 24 },
  input: { flex: 1, fontSize: 28, fontWeight: '700', color: Colors.textPrimary, paddingVertical: 14 },
  inputUnit: { fontSize: 18, color: Colors.accent, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#000' },
});

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation, route }) {
  const { initialData = {}, demoMode = false } = route.params || {};

  const [connected, setConnected] = useState(
    initialData.connection === 'connected' || initialData.connection === 'demo'
  );
  const [battery, setBattery] = useState(initialData.battery || 82);
  const [weight, setWeight] = useState(initialData.weight || 0);
  const [followMode, setFollowMode] = useState(initialData.follow || false);
  const [trolleyMode, setTrolleyMode] = useState(initialData.mode || 'airport');
  const [isOverloaded, setIsOverloaded] = useState(false);

  // Distance
  const [targetDistance, setTargetDistance] = useState(1.0);
  const [distanceModalVisible, setDistanceModalVisible] = useState(false);

  // PID state
  const [kp, setKp] = useState(1.2);
  const [ki, setKi] = useState(0.4);
  const [kd, setKd] = useState(0.1);
  const [sensitivity, setSensMode] = useState(initialData.speed_mode || 'normal');

  const emergencyScale = useRef(new Animated.Value(1)).current;
  const followPulse = useRef(new Animated.Value(1)).current;

  // Poll status + weight every 1 second
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!demoMode) {
        const statusRes = await getFullStatus();
        if (statusRes?.success) {
          const d = statusRes.data;
          setConnected(true);
          setBattery(d.battery);
          setFollowMode(d.follow);
          setTrolleyMode(d.mode);
          setSensMode(d.speed_mode);
        } else {
          setConnected(false);
        }

        // Auto-read weight from sensor
        const weightRes = await getWeight();
        if (weightRes?.success) {
          const w = weightRes.data.weight;
          setWeight(w);
          const maxW = trolleyMode === 'airport' ? 20 : 35;
          if (w > maxW) {
            setIsOverloaded(true);
            if (followMode) {
              setFollowMode(false);
              await stopTrolley();
              Alert.alert('⚠️ OVERLOADED', `Weight (${w.toFixed(1)} kg) exceeds ${maxW} kg limit.\nFollow mode has been disabled.`);
            }
          } else {
            setIsOverloaded(false);
          }
        }
      } else {
        // Demo: simulate sensor fluctuation
        setWeight((prev) => {
          const next = parseFloat((prev + (Math.random() * 0.4 - 0.2)).toFixed(1));
          return Math.max(0, next);
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [demoMode, trolleyMode, followMode]);

  useEffect(() => {
    if (followMode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(followPulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
          Animated.timing(followPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      followPulse.stopAnimation();
      followPulse.setValue(1);
    }
  }, [followMode]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(emergencyScale, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(emergencyScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleFollowToggle = async (value) => {
    if (isOverloaded && value) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('⚠️ Overloaded', 'Remove excess weight before enabling follow mode.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFollowMode(value);
    if (!demoMode) {
      if (value) await startFollow();
      else await stopTrolley();
    }
  };

  const handleEmergencyStop = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setFollowMode(false);
    if (!demoMode) await emergencyStop();
    Alert.alert('🛑 EMERGENCY STOP', 'All motors stopped immediately.');
  };

  const handleModeSwitch = async (newMode) => {
    Haptics.selectionAsync();
    setTrolleyMode(newMode);
    if (!demoMode) await setMode(newMode);
  };

  const handleSaveDistance = async (dist) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTargetDistance(dist);
    setDistanceModalVisible(false);
    if (!demoMode) {
      await fetch('http://192.168.4.1/api/distance/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_distance: dist }),
      }).catch(() => {});
    }
    Alert.alert('✅ Distance Updated', `Trolley will now follow at ${dist}m behind you.`);
  };

  const handleSavePID = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!demoMode) await setPID(kp, ki, kd);
    Alert.alert('⚡ PID Applied', `Kp: ${kp.toFixed(2)}   Ki: ${ki.toFixed(2)}   Kd: ${kd.toFixed(2)}`);
  };

  const handleSensChange = async (mode) => {
    Haptics.selectionAsync();
    setSensMode(mode);
    if (!demoMode) await setSensitivity(mode);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <Text style={styles.greeting}>Dashboard</Text>
            <StatusBadge connected={connected} />
          </View>
          <BatteryWidget level={battery} />
        </View>

        {/* MODE SELECTOR */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>TROLLEY MODE</Text>
          <View style={styles.modeRow}>
            {[
              { key: 'airport', icon: '✈️', label: 'AIRPORT', sub: 'Max 20 kg' },
              { key: 'mall', icon: '🛍️', label: 'MALL', sub: 'Max 35 kg' },
            ].map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeBtn, trolleyMode === m.key && styles.modeBtnActive]}
                onPress={() => handleModeSwitch(m.key)}
              >
                <Text style={styles.modeBtnIcon}>{m.icon}</Text>
                <Text style={[styles.modeBtnText, trolleyMode === m.key && styles.modeBtnTextActive]}>
                  {m.label}
                </Text>
                <Text style={[styles.modeBtnSub, trolleyMode === m.key && { color: Colors.accent }]}>
                  {m.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FOLLOW + DISTANCE ROW */}
        <View style={styles.rowCards}>
          <Animated.View style={[
            styles.followCard,
            followMode && { borderColor: Colors.green + '66' },
            { transform: [{ scale: followPulse }] },
          ]}>
            <Text style={styles.sectionLabel}>FOLLOW MODE</Text>
            <Text style={styles.followStatus}>{followMode ? '🟢 Active' : '⚫ Off'}</Text>
            <Switch
              value={followMode}
              onValueChange={handleFollowToggle}
              trackColor={{ false: Colors.border, true: Colors.green + '77' }}
              thumbColor={followMode ? Colors.green : Colors.textMuted}
              style={{ marginTop: 10 }}
            />
          </Animated.View>

          <TouchableOpacity
            style={styles.distanceCard}
            onPress={() => setDistanceModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.sectionLabel}>FOLLOW DISTANCE</Text>
            <Text style={styles.distanceValue}>
              {targetDistance.toFixed(1)}<Text style={styles.distanceUnit}>m</Text>
            </Text>
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✏️ TAP TO SET</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* WEIGHT — auto from sensor */}
        <View style={[styles.card, isOverloaded && { borderColor: Colors.red + '66' }]}>
          <WeightDisplay weight={weight} mode={trolleyMode} />
        </View>

        {/* ★ PID MOTOR CONTROL — PRIMARY FEATURE ★ */}
        <View style={styles.pidCard}>
          <View style={styles.pidHeaderRow}>
            <View>
              <Text style={styles.pidSectionLabel}>⚙️ PID MOTOR CONTROL</Text>
              <Text style={styles.pidSectionSub}>Core feature — smooth speed matching</Text>
            </View>
            <View style={styles.coreBadge}>
              <Text style={styles.coreBadgeText}>PRIMARY</Text>
            </View>
          </View>

          {/* Sensitivity */}
          <Text style={styles.subLabel}>WALKING SPEED SENSITIVITY</Text>
          <View style={styles.sensRow}>
            {[
              { key: 'slow', icon: '🐢', label: 'Slow', sub: 'Elderly' },
              { key: 'normal', icon: '🚶', label: 'Normal', sub: 'Standard' },
              { key: 'fast', icon: '🏃', label: 'Fast', sub: 'Rush' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sensBtn, sensitivity === opt.key && styles.sensBtnActive]}
                onPress={() => handleSensChange(opt.key)}
              >
                <Text style={styles.sensIcon}>{opt.icon}</Text>
                <Text style={[styles.sensLabel, sensitivity === opt.key && { color: Colors.background }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.sensSub, sensitivity === opt.key && { color: Colors.background + 'AA' }]}>
                  {opt.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* PID Sliders */}
          <Text style={[styles.subLabel, { marginTop: 18 }]}>FINE PID TUNING</Text>
          {[
            { label: 'Kp  Proportional', value: kp, setter: setKp, min: 0, max: 3, color: Colors.accent },
            { label: 'Ki  Integral', value: ki, setter: setKi, min: 0, max: 1.5, color: Colors.green },
            { label: 'Kd  Derivative', value: kd, setter: setKd, min: 0, max: 0.5, color: Colors.yellow },
          ].map((param) => (
            <View key={param.label} style={styles.sliderRow}>
              <View style={styles.sliderLabelRow}>
                <Text style={styles.sliderLabel}>{param.label}</Text>
                <Text style={[styles.sliderValue, { color: param.color }]}>{param.value.toFixed(2)}</Text>
              </View>
              <Slider
                minimumValue={param.min}
                maximumValue={param.max}
                value={param.value}
                onValueChange={param.setter}
                minimumTrackTintColor={param.color}
                maximumTrackTintColor={Colors.border}
                thumbTintColor={param.color}
                style={{ marginHorizontal: -4 }}
              />
            </View>
          ))}

          <TouchableOpacity style={styles.applyBtn} onPress={handleSavePID}>
            <Text style={styles.applyBtnText}>⚡  Apply PID to Trolley</Text>
          </TouchableOpacity>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.actionsRow}>
          {[
            { icon: '↩️', label: 'Return', onPress: async () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); if (!demoMode) await returnToUser(); Alert.alert('↩️ Returning', 'Trolley is coming back to you.'); } },
            { icon: '📷', label: 'Camera', onPress: () => navigation.navigate('Tracking') },
            { icon: '👤', label: 'Face Auth', onPress: () => navigation.navigate('FaceAuth') },
            { icon: '🗺️', label: 'Map', onPress: () => navigation.navigate('Map') },
            { icon: '⚙️', label: 'Settings', onPress: () => navigation.navigate('Settings') },
          ].map((a) => (
            <TouchableOpacity key={a.label} style={styles.actionBtn} onPress={a.onPress}>
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* EMERGENCY STOP */}
      <Animated.View style={[styles.emergencyContainer, { transform: [{ scale: emergencyScale }] }]}>
        <TouchableOpacity style={styles.emergencyBtn} onPress={handleEmergencyStop} activeOpacity={0.85}>
          <Text style={styles.emergencyText}>⛔  EMERGENCY STOP</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* DISTANCE MODAL */}
      <DistanceModal
        visible={distanceModalVisible}
        currentDist={targetDistance}
        onSave={handleSaveDistance}
        onClose={() => setDistanceModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingTop: 60 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  topLeft: { gap: 8 },
  greeting: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 10 },
  card: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  modeBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentGlow },
  modeBtnIcon: { fontSize: 22 },
  modeBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: Colors.textSecondary },
  modeBtnTextActive: { color: Colors.accent },
  modeBtnSub: { fontSize: 11, color: Colors.textMuted },
  rowCards: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  followCard: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: Colors.border },
  followStatus: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  distanceCard: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: Colors.borderAccent },
  distanceValue: { fontSize: 38, fontWeight: '800', color: Colors.accent, letterSpacing: -1, marginTop: 4 },
  distanceUnit: { fontSize: 18, fontWeight: '400', color: Colors.textSecondary },
  editBadge: { marginTop: 10, backgroundColor: Colors.accentGlow, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.borderAccent, alignSelf: 'flex-start' },
  editBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.accent, letterSpacing: 1 },

  // PID card
  pidCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1.5, borderColor: Colors.borderAccent },
  pidHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pidSectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: Colors.accent },
  pidSectionSub: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  coreBadge: { backgroundColor: Colors.accentGlow, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.borderAccent },
  coreBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.accent, letterSpacing: 2 },
  subLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 10 },
  sensRow: { flexDirection: 'row', gap: 8 },
  sensBtn: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 3 },
  sensBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sensIcon: { fontSize: 18 },
  sensLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  sensSub: { fontSize: 9, color: Colors.textMuted },
  sliderRow: { marginBottom: 10 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  sliderLabel: { fontSize: 13, color: Colors.textSecondary },
  sliderValue: { fontSize: 14, fontWeight: '800' },
  applyBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  applyBtnText: { color: '#000', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 6 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  emergencyContainer: { position: 'absolute', bottom: 30, alignSelf: 'center', shadowColor: Colors.red, shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  emergencyBtn: { backgroundColor: Colors.red, paddingHorizontal: 44, paddingVertical: 18, borderRadius: 999 },
  emergencyText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
});
