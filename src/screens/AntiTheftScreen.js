import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Animated, Alert, Vibration, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../utils/theme';
import {
  getFullStatus,
  armSecurity,
  disarmSecurity,
  clearAlert,
  sendTestSMS,
  setBuzzer,
  lockMotors,
  emergencyStop,
} from '../api/trolleyApi';

// ─── Threat levels ────────────────────────────────────────────────────────────
const THREAT_LEVELS = {
  safe:    { label: 'SECURE',  color: Colors.green,  icon: '🔒', desc: 'Trolley is secure — no movement detected' },
  warning: { label: 'WARNING', color: Colors.yellow, icon: '⚠️', desc: 'Unusual motion detected — monitoring...' },
  alert:   { label: 'ALERT!',  color: Colors.red,    icon: '🚨', desc: 'Theft detected! GSM alert sent to owner.' },
};

// ─── GSM Status Badge ─────────────────────────────────────────────────────────
function GsmBadge({ ready, loading }) {
  if (loading) return <ActivityIndicator size="small" color={Colors.accent} />;
  return (
    <View style={[gsmStyles.badge, { borderColor: ready ? Colors.green + '55' : Colors.red + '55', backgroundColor: ready ? Colors.green + '11' : Colors.red + '11' }]}>
      <View style={[gsmStyles.dot, { backgroundColor: ready ? Colors.green : Colors.red }]} />
      <Text style={[gsmStyles.text, { color: ready ? Colors.green : Colors.red }]}>
        {ready ? 'GSM CONNECTED' : 'GSM OFFLINE'}
      </Text>
    </View>
  );
}
const gsmStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AntiTheftScreen({ navigation }) {
  // Live state from ESP32
  const [armed, setArmed]             = useState(false);
  const [alert, setAlertActive]       = useState(false);
  const [gsmReady, setGsmReady]       = useState(false);
  const [gpsLat, setGpsLat]           = useState(null);
  const [gpsLng, setGpsLng]           = useState(null);
  const [weight, setWeight]           = useState(0);

  // UI state
  const [threatLevel, setThreatLevel] = useState('safe');
  const [loading, setLoading]         = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [smsSending, setSmsSending]   = useState(false);
  const [sirenOn, setSirenOn]         = useState(false);
  const [eventLog, setEventLog]       = useState([
    { id: 1, time: '—', type: 'info', msg: 'Connecting to trolley...' },
  ]);

  const alertPulse = useRef(new Animated.Value(1)).current;
  const pollTimer  = useRef(null);

  // ── Add log entry ──────────────────────────────────────────────────────────
  const addLog = useCallback((type, msg) => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setEventLog((prev) => [{ id: Date.now(), time, type, msg }, ...prev.slice(0, 19)]);
  }, []);

  // ── Pulse animation when alert fires ───────────────────────────────────────
  useEffect(() => {
    if (threatLevel === 'alert') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(alertPulse, { toValue: 1.12, duration: 350, useNativeDriver: true }),
          Animated.timing(alertPulse, { toValue: 1,    duration: 350, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      alertPulse.setValue(1);
    }
  }, [threatLevel]);

  // ── Poll ESP32 /status every 2 s ───────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    const res = await getFullStatus();
    if (!res.success) return;
    const d = res.data;

    setArmed(d.antitheft ?? false);
    setGsmReady(d.gsmReady ?? false);
    setWeight(d.weight ?? 0);
    if (d.gpsLat && d.gpsLat !== 0) setGpsLat(d.gpsLat);
    if (d.gpsLng && d.gpsLng !== 0) setGpsLng(d.gpsLng);

    // Detect alert transition
    if (d.alert && !alert) {
      setAlertActive(true);
      setThreatLevel('alert');
      Vibration.vibrate([0, 400, 200, 400, 200, 400]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      addLog('alert', '🚨 Theft detected — GSM SMS + call triggered');
      Alert.alert(
        '🚨 THEFT ALERT',
        `Motion detected while armed!\n\n• Buzzer activated\n• SMS sent via GSM\n• Owner phone called\n• GPS location logged\n\nWeight: ${d.weight?.toFixed(1) ?? '?'} kg`,
        [
          { text: 'Dismiss',      onPress: handleClearAlert },
          { text: 'Lock Motors',  style: 'destructive', onPress: handleLockMotors },
        ]
      );
    } else if (!d.alert && alert) {
      setAlertActive(false);
      if (d.antitheft) setThreatLevel('safe');
    }

    if (!d.alert) {
      if (d.antitheft) setThreatLevel('safe');
      else setThreatLevel('safe');
    }

    setStatusLoading(false);
  }, [alert, addLog]);

  useEffect(() => {
    fetchStatus();
    pollTimer.current = setInterval(fetchStatus, 2000);
    return () => clearInterval(pollTimer.current);
  }, [fetchStatus]);

  const threat = THREAT_LEVELS[threatLevel];

  // ── ARM ────────────────────────────────────────────────────────────────────
  const handleArm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);
    const res = await armSecurity();
    setLoading(false);
    if (res.success) {
      setArmed(true);
      setThreatLevel('safe');
      addLog('info', '🔒 Anti-theft ARMED via app');
      Alert.alert('🔒 System Armed', 'Anti-theft monitoring is active.\nGSM is ready to send SMS alerts.');
    } else {
      Alert.alert('⚠️ Connection Error', 'Could not reach trolley.\nCheck WiFi: SmartTrolley (192.168.4.1)');
    }
  };

  // ── DISARM ─────────────────────────────────────────────────────────────────
  const handleDisarm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const res = await disarmSecurity();
    setLoading(false);
    if (res.success) {
      setArmed(false);
      setAlertActive(false);
      setThreatLevel('safe');
      setSirenOn(false);
      addLog('info', '🔓 Anti-theft DISARMED via app');
      Alert.alert('🔓 Disarmed', 'All alerts paused. Buzzer silenced.');
    } else {
      Alert.alert('⚠️ Connection Error', 'Could not reach trolley.\nCheck WiFi connection.');
    }
  };

  // ── CLEAR ALERT ────────────────────────────────────────────────────────────
  const handleClearAlert = async () => {
    const res = await clearAlert();
    if (res.success) {
      setAlertActive(false);
      setThreatLevel(armed ? 'safe' : 'safe');
      addLog('info', '✅ Alert cleared — monitoring resumed');
    }
  };

  // ── LOCK MOTORS ────────────────────────────────────────────────────────────
  const handleLockMotors = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const res = await lockMotors();
    if (res.success) {
      addLog('warning', '🔐 Motors locked remotely');
      Alert.alert('🔐 Motors Locked', 'Trolley wheels are now locked.\nUnlock via Disarm or Dashboard stop button.');
    } else {
      // Still notify — emergency stop as fallback
      await emergencyStop();
      addLog('warning', '🔐 Emergency stop sent');
      Alert.alert('🔐 Emergency Stop Sent', 'Trolley motors stopped.');
    }
  };

  // ── SIREN ──────────────────────────────────────────────────────────────────
  const handleSiren = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const nextState = !sirenOn;
    setSirenOn(nextState);
    const res = await setBuzzer(nextState);
    if (res.success) {
      addLog(nextState ? 'alert' : 'info', nextState ? '🔊 Siren ACTIVATED via app' : '🔇 Siren silenced via app');
      if (nextState) Vibration.vibrate([0, 300, 150, 300, 150, 300]);
    } else {
      setSirenOn(!nextState); // revert
      Alert.alert('⚠️ Error', 'Could not reach trolley buzzer.');
    }
  };

  // ── TEST SMS ───────────────────────────────────────────────────────────────
  const handleTestSMS = async () => {
    if (!gsmReady) {
      Alert.alert('⚠️ GSM Not Ready', 'SIM900A is not registered on the network.\n\nCheck:\n• SIM card inserted correctly\n• Antenna connected\n• Network signal available');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSmsSending(true);
    addLog('info', '📤 Sending test SMS via GSM...');
    const res = await sendTestSMS();
    setSmsSending(false);
    if (res.success && res.data?.sent) {
      addLog('info', '✅ Test SMS sent to owner number');
      Alert.alert('✅ Test SMS Sent!', 'Check your phone.\nIf not received within 30 seconds, verify:\n• Owner number in firmware\n• APN setting matches your carrier\n• SIM has SMS credit');
    } else {
      addLog('warning', '❌ Test SMS failed — check GSM module');
      Alert.alert('❌ SMS Failed', 'GSM module responded but SMS failed.\nCheck owner phone number & APN in firmware.');
    }
  };

  // ── GPS MAPS LINK ──────────────────────────────────────────────────────────
  const getGpsStatus = () => {
    if (!gpsLat || !gpsLng || gpsLat === 0) return 'No GPS fix — take outdoors';
    return `${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}`;
  };

  // ── SMS COMMANDS REFERENCE ─────────────────────────────────────────────────
  const SMS_COMMANDS = [
    { cmd: 'LOCATION', desc: 'Reply with live Google Maps link', icon: '📍' },
    { cmd: 'STATUS',   desc: 'Mode, weight, armed state, speed',  icon: '📊' },
    { cmd: 'ARM',      desc: 'Arm anti-theft remotely via SMS',   icon: '🔒' },
    { cmd: 'DISARM',   desc: 'Disarm alarm + stop buzzer',        icon: '🔓' },
    { cmd: 'STOP',     desc: 'Emergency stop motors via SMS',     icon: '🛑' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Anti-Theft</Text>
          <Text style={styles.subtitle}>SIM900A GSM Security System</Text>
        </View>
        <GsmBadge ready={gsmReady} loading={statusLoading} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Threat Status Card ─────────────────────────────────────────── */}
        <Animated.View style={[
          styles.threatCard,
          { borderColor: threat.color, transform: [{ scale: alertPulse }] },
        ]}>
          <View style={[styles.threatGlow, { backgroundColor: threat.color + '12' }]} />
          <Text style={styles.threatIcon}>{threat.icon}</Text>
          <Text style={[styles.threatLabel, { color: threat.color }]}>{threat.label}</Text>
          <Text style={styles.threatDesc}>{threat.desc}</Text>

          <View style={styles.threatRow}>
            <View style={[styles.threatBadge, { borderColor: threat.color + '55', backgroundColor: threat.color + '18' }]}>
              <View style={[styles.threatDot, { backgroundColor: threat.color }]} />
              <Text style={[styles.threatBadgeText, { color: threat.color }]}>
                {armed ? 'ARMED' : 'DISARMED'}
              </Text>
            </View>
            {weight > 0 && (
              <View style={[styles.threatBadge, { borderColor: Colors.border, backgroundColor: Colors.surfaceElevated }]}>
                <Text style={[styles.threatBadgeText, { color: Colors.textSecondary }]}>⚖️  {weight.toFixed(1)} kg</Text>
              </View>
            )}
          </View>

          {/* Active alert clear button */}
          {alert && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearAlert}>
              <Text style={styles.clearBtnText}>✕  Clear Alert</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── Arm / Disarm Buttons ───────────────────────────────────────── */}
        <View style={styles.armRow}>
          <TouchableOpacity
            style={[styles.armBtn, armed && styles.armBtnActive, loading && { opacity: 0.6 }]}
            onPress={handleArm}
            disabled={loading || armed}
          >
            {loading && !armed ? <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} /> : null}
            <Text style={styles.armBtnText}>🔒  ARM</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.disarmBtn, !armed && { opacity: 0.5 }]}
            onPress={handleDisarm}
            disabled={loading || !armed}
          >
            {loading && armed ? <ActivityIndicator size="small" color={Colors.red} style={{ marginRight: 8 }} /> : null}
            <Text style={styles.disarmBtnText}>🔓  DISARM</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Actions ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>INSTANT ACTIONS</Text>
        <View style={styles.actionsGrid}>

          <TouchableOpacity
            style={[styles.actionCard, { borderColor: Colors.red + '55' }]}
            onPress={handleLockMotors}
          >
            <Text style={styles.actionIcon}>🔐</Text>
            <Text style={styles.actionLabel}>Lock Motors</Text>
            <Text style={styles.actionSub}>Send /lock to ESP32</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { borderColor: (sirenOn ? Colors.red : Colors.yellow) + '55' }, sirenOn && { backgroundColor: Colors.red + '11' }]}
            onPress={handleSiren}
          >
            <Text style={styles.actionIcon}>{sirenOn ? '🔇' : '🔊'}</Text>
            <Text style={styles.actionLabel}>{sirenOn ? 'Silence' : 'Siren'}</Text>
            <Text style={styles.actionSub}>{sirenOn ? 'Turn off buzzer' : 'Sound buzzer now'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { borderColor: Colors.accent + '55' }, smsSending && { opacity: 0.6 }]}
            onPress={handleTestSMS}
            disabled={smsSending}
          >
            {smsSending
              ? <ActivityIndicator size="small" color={Colors.accent} />
              : <Text style={styles.actionIcon}>📤</Text>}
            <Text style={styles.actionLabel}>Test SMS</Text>
            <Text style={styles.actionSub}>{gsmReady ? 'Send via GSM now' : 'GSM offline'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { borderColor: Colors.green + '55' }]}
            onPress={() => fetchStatus()}
          >
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={styles.actionLabel}>Refresh</Text>
            <Text style={styles.actionSub}>Sync with ESP32</Text>
          </TouchableOpacity>
        </View>

        {/* ── GSM Status Card ────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>GSM MODULE STATUS</Text>
        <View style={styles.card}>
          <View style={styles.gsmRow}>
            <Text style={styles.gsmIcon}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.gsmTitle}>SIM900A Module</Text>
              <Text style={[styles.gsmStatus, { color: gsmReady ? Colors.green : Colors.red }]}>
                {gsmReady ? '✅ Registered on network — SMS & calls ready' : '❌ Not registered — check SIM, antenna & power'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.gsmInfoGrid}>
            <View style={styles.gsmInfoItem}>
              <Text style={styles.gsmInfoLabel}>NETWORK</Text>
              <Text style={[styles.gsmInfoValue, { color: gsmReady ? Colors.green : Colors.textMuted }]}>
                {gsmReady ? 'Registered' : 'No signal'}
              </Text>
            </View>
            <View style={styles.gsmInfoItem}>
              <Text style={styles.gsmInfoLabel}>BANDS</Text>
              <Text style={styles.gsmInfoValue}>900 / 1800 MHz</Text>
            </View>
            <View style={styles.gsmInfoItem}>
              <Text style={styles.gsmInfoLabel}>CARRIERS</Text>
              <Text style={styles.gsmInfoValue}>Airtel · Vi · Jio · BSNL</Text>
            </View>
            <View style={styles.gsmInfoItem}>
              <Text style={styles.gsmInfoLabel}>GPS</Text>
              <Text style={[styles.gsmInfoValue, { color: gpsLat ? Colors.green : Colors.textMuted }]}>
                {getGpsStatus()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── SMS Remote Commands Reference ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>SMS REMOTE COMMANDS</Text>
        <View style={styles.card}>
          <Text style={styles.smsHint}>Send these to the trolley SIM number from your registered phone:</Text>
          {SMS_COMMANDS.map((item, i) => (
            <View key={item.cmd}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.smsRow}>
                <Text style={styles.smsIcon}>{item.icon}</Text>
                <View style={styles.smsCmdBox}>
                  <Text style={styles.smsCmdText}>{item.cmd}</Text>
                </View>
                <Text style={styles.smsDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Event Log ──────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>LIVE EVENT LOG</Text>
        <View style={styles.logCard}>
          {eventLog.length === 0 && (
            <Text style={[styles.logMsg, { color: Colors.textMuted, textAlign: 'center', padding: 8 }]}>No events yet</Text>
          )}
          {eventLog.map((e) => {
            const col = e.type === 'alert' ? Colors.red : e.type === 'warning' ? Colors.yellow : Colors.textMuted;
            return (
              <View key={e.id} style={styles.logRow}>
                <View style={[styles.logDot, { backgroundColor: col }]} />
                <Text style={styles.logTime}>{e.time}</Text>
                <Text style={[styles.logMsg, { color: e.type === 'alert' ? Colors.red : Colors.textSecondary }]}>
                  {e.msg}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── How It Works ───────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
        <View style={[styles.card, { gap: 10 }]}>
          {[
            { n: '1', t: 'ARM the system', d: 'Tap ARM — ESP32 activates MPU-6050 motion detection' },
            { n: '2', t: 'Motion detected', d: 'If trolley is moved, accel > 8000 threshold triggers alert' },
            { n: '3', t: 'Buzzer + LED',    d: 'GPIO 2 buzzer sounds, GPIO 12 red LED turns on instantly' },
            { n: '4', t: 'GSM SMS alert',   d: 'SIM900A sends SMS with Google Maps GPS link to owner' },
            { n: '5', t: 'Phone call',      d: 'SIM900A calls owner number — rings for 20 seconds' },
            { n: '6', t: 'DISARM',          d: 'Tap DISARM in app or SMS DISARM to silence alarm' },
          ].map((step) => (
            <View key={step.n} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{step.n}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.t}</Text>
                <Text style={styles.stepDesc}>{step.d}</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: Colors.surfaceElevated, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  backBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  title:    { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  scroll: { paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    color: Colors.textMuted, marginBottom: 10, marginTop: 6,
  },

  // Threat card
  threatCard: {
    borderRadius: 24, borderWidth: 2, padding: 28,
    alignItems: 'center', marginBottom: 14, overflow: 'hidden',
  },
  threatGlow: { ...StyleSheet.absoluteFillObject },
  threatIcon:  { fontSize: 48, marginBottom: 6 },
  threatLabel: { fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  threatDesc:  { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 14, textAlign: 'center' },
  threatRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  threatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  threatDot:   { width: 7, height: 7, borderRadius: 4 },
  threatBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  clearBtn: { marginTop: 14, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 99, backgroundColor: Colors.red + '22', borderWidth: 1, borderColor: Colors.red + '66' },
  clearBtnText: { color: Colors.red, fontWeight: '700', fontSize: 13 },

  // Arm / Disarm
  armRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  armBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.green, borderRadius: 99, paddingVertical: 14, gap: 6,
  },
  armBtnActive: { opacity: 0.4 },
  armBtnText: { color: '#000', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  disarmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.red + '22', borderRadius: 99, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.red + '77', gap: 6,
  },
  disarmBtnText: { color: Colors.red, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Actions grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  actionCard: {
    width: '47%', backgroundColor: Colors.surfaceElevated,
    borderRadius: 18, padding: 16, borderWidth: 1,
    alignItems: 'flex-start', gap: 4,
  },
  actionIcon:  { fontSize: 24, marginBottom: 4 },
  actionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  actionSub:   { fontSize: 11, color: Colors.textMuted },

  // Card
  card: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 20,
    padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },

  // GSM info
  gsmRow:   { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  gsmIcon:  { fontSize: 28, marginTop: 2 },
  gsmTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  gsmStatus:{ fontSize: 12, marginTop: 3, lineHeight: 18 },
  gsmInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  gsmInfoItem: { width: '45%' },
  gsmInfoLabel:{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 3 },
  gsmInfoValue:{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  // SMS commands
  smsHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  smsRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  smsIcon: { fontSize: 18, width: 24 },
  smsCmdBox:{ backgroundColor: Colors.accent + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accent + '44' },
  smsCmdText:{ color: Colors.accent, fontWeight: '800', fontSize: 12, letterSpacing: 0.5, fontFamily: 'monospace' },
  smsDesc: { flex: 1, fontSize: 11, color: Colors.textSecondary },

  // Event log
  logCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 20,
    padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  logTime:{ fontSize: 11, color: Colors.textMuted, width: 54 },
  logMsg: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Steps
  stepRow:     { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum:     { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.accent + '22', borderWidth: 1, borderColor: Colors.accent + '55', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: Colors.accent, fontWeight: '800', fontSize: 12 },
  stepTitle:   { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  stepDesc:    { fontSize: 11, color: Colors.textMuted, marginTop: 2, lineHeight: 16 },
});
