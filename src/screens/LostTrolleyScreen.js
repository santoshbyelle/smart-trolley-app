import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, Linking, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../utils/theme';
import { getFullStatus, sendTestSMS, setBuzzer } from '../api/trolleyApi';

export default function LostTrolleyScreen({ navigation }) {
  const [gpsLat, setGpsLat]         = useState(null);
  const [gpsLng, setGpsLng]         = useState(null);
  const [gsmReady, setGsmReady]     = useState(false);
  const [weight, setWeight]         = useState(0);
  const [lastSeen, setLastSeen]     = useState('Fetching...');
  const [battery, setBattery]       = useState('—');
  const [lostMode, setLostMode]     = useState(false);
  const [signalStrength, setSignal] = useState(0);
  const [pinging, setPinging]       = useState(false);
  const [connected, setConnected]   = useState(false);

  const radarAnim   = useRef(new Animated.Value(0)).current;
  const radarOpacity= useRef(new Animated.Value(1)).current;
  const ring2       = useRef(new Animated.Value(0)).current;
  const ring2Opacity= useRef(new Animated.Value(1)).current;
  const arrowPulse  = useRef(new Animated.Value(1)).current;
  const pollRef     = useRef(null);

  // Start radar animation
  useEffect(() => {
    const startRadar = () => {
      radarAnim.setValue(0); radarOpacity.setValue(1);
      ring2.setValue(0); ring2Opacity.setValue(1);
      Animated.loop(
        Animated.parallel([
          Animated.timing(radarAnim,    { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(radarOpacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
      setTimeout(() => {
        Animated.loop(
          Animated.parallel([
            Animated.timing(ring2,        { toValue: 1, duration: 2000, useNativeDriver: true }),
            Animated.timing(ring2Opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
          ])
        ).start();
      }, 1000);
    };
    startRadar();
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowPulse, { toValue: 1.1,  duration: 700, useNativeDriver: true }),
        Animated.timing(arrowPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Poll ESP32 for GPS + status
  const fetchStatus = useCallback(async () => {
    const res = await getFullStatus();
    if (!res.success) {
      setConnected(false);
      setSignal(0);
      return;
    }
    const d = res.data;
    setConnected(true);
    setSignal(5);
    setGsmReady(d.gsmReady ?? false);
    setWeight(d.weight ?? 0);
    if (d.gpsLat && d.gpsLat !== 0) {
      setGpsLat(d.gpsLat);
      setGpsLng(d.gpsLng);
      const now = new Date();
      setLastSeen(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const handleOpenMaps = () => {
    if (!gpsLat) {
      Alert.alert('📍 No GPS Fix', 'GPS coordinates not available yet.\n\nTake the trolley outdoors and wait 1-2 minutes for a fix.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${gpsLat},${gpsLng}`;
    Linking.openURL(url);
  };

  const handlePingTrolley = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPinging(true);
    // Sound buzzer for 3 seconds to locate trolley audibly
    await setBuzzer(true);
    setTimeout(async () => {
      await setBuzzer(false);
      setPinging(false);
      Alert.alert('📡 Ping Sent!', 'Trolley buzzer sounded for 3 seconds.\nListen for the beep to find it.');
    }, 3000);
  };

  const handleLostMode = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const next = !lostMode;
    setLostMode(next);
    if (next && gsmReady) {
      await sendTestSMS();
      Alert.alert('🔍 Lost Mode Enabled', 'Trolley buzzer will pulse + GSM location SMS sent.\nCheck your phone for the GPS link.');
    } else if (next) {
      Alert.alert('🔍 Lost Mode Enabled', 'GSM offline — buzzer activated only.\nCheck SIM900A antenna & SIM card.');
    } else {
      await setBuzzer(false);
      Alert.alert('✅ Lost Mode Disabled', 'Trolley will connect normally when in range.');
    }
  };

  const radarScale = radarAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });

  const SignalBars = ({ strength }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((b) => (
        <View key={b} style={{
          width: 6, height: 6 + b * 4, borderRadius: 2,
          backgroundColor: b <= strength ? Colors.green : Colors.border,
        }} />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Find My Trolley</Text>
          <Text style={[styles.subtitle, { color: lostMode ? Colors.yellow : Colors.textMuted }]}>
            {lostMode ? '🔍 Lost Mode Active' : connected ? '● Live GPS from ESP32' : '● Connecting...'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.lostModeBtn, lostMode && { backgroundColor: Colors.yellow + '22', borderColor: Colors.yellow }]}
          onPress={handleLostMode}
        >
          <Text style={[styles.lostModeBtnText, lostMode && { color: Colors.yellow }]}>
            {lostMode ? 'Active' : 'Lost Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scroll}>
        {/* Radar / Signal card */}
        <View style={styles.radarCard}>
          <Text style={styles.radarTitle}>TROLLEY SIGNAL</Text>
          <Text style={styles.radarSub}>
            {connected ? 'Connected via WiFi 192.168.4.1' : 'Searching for SmartTrolley WiFi...'}
          </Text>

          <View style={styles.radarArea}>
            <Animated.View style={[styles.radarRing, { transform: [{ scale: radarScale }], opacity: radarOpacity }]} />
            <Animated.View style={[styles.radarRing, { transform: [{ scale: ring2Scale }], opacity: ring2Opacity, borderColor: Colors.accent + '44' }]} />
            <Animated.View style={[styles.arrowContainer, { transform: [{ scale: arrowPulse }] }]}>
              <Text style={[styles.arrow, { color: connected ? Colors.green : Colors.textMuted }]}>
                {connected ? '📡' : '🔍'}
              </Text>
            </Animated.View>
            <View style={styles.centerDot} />
            <View style={styles.distanceLabel}>
              <Text style={styles.distanceText}>{connected ? 'Found' : '...'}</Text>
              <Text style={styles.distanceSub}>{connected ? 'via WiFi' : 'searching'}</Text>
            </View>
          </View>

          <View style={styles.signalRow}>
            <Text style={styles.signalLabel}>WIFI SIGNAL</Text>
            <SignalBars strength={signalStrength} />
            <Text style={[styles.signalText, { color: connected ? Colors.green : Colors.red }]}>
              {connected ? 'Connected' : 'No signal'}
            </Text>
          </View>
        </View>

        {/* GPS Location Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>LIVE GPS LOCATION (NEO-6M)</Text>
          <View style={styles.lastSeenRow}>
            <Text style={styles.lastSeenIcon}>{gpsLat ? '📍' : '🔄'}</Text>
            <View style={{ flex: 1 }}>
              {gpsLat ? (
                <>
                  <Text style={styles.lastSeenPlace}>
                    {gpsLat.toFixed(5)}, {gpsLng.toFixed(5)}
                  </Text>
                  <Text style={styles.lastSeenTime}>
                    Updated {lastSeen}  ·  Weight {weight.toFixed(1)} kg
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.lastSeenPlace}>Waiting for GPS fix...</Text>
                  <Text style={styles.lastSeenTime}>Take trolley outdoors · Cold start takes ~2 min</Text>
                </>
              )}
            </View>
            {!gpsLat && <ActivityIndicator size="small" color={Colors.accent} />}
          </View>
          <TouchableOpacity style={styles.mapsBtn} onPress={handleOpenMaps}>
            <Text style={styles.mapsBtnText}>🗺️  Open in Google Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Ping button */}
        <TouchableOpacity
          style={[styles.scanBtn, pinging && { backgroundColor: Colors.yellow }, !connected && { opacity: 0.5 }]}
          onPress={handlePingTrolley}
          disabled={pinging || !connected}
        >
          {pinging
            ? <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />
            : null}
          <Text style={styles.scanBtnText}>
            {pinging ? '🔊  Beeping trolley...' : '📡  Ping Trolley (Sound Buzzer)'}
          </Text>
        </TouchableOpacity>

        {/* GSM & Lost mode tips */}
        {lostMode && (
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>🔍 Lost Mode Active</Text>
            <Text style={styles.tipText}>• GSM SMS sent with Google Maps GPS link</Text>
            <Text style={styles.tipText}>• SMS reply LOCATION for updated GPS</Text>
            <Text style={styles.tipText}>• SMS reply STOP to lock motors</Text>
            <Text style={styles.tipText}>• Buzzer silenced — tap Lost Mode again to re-beep</Text>
            <Text style={[styles.tipText, { color: gsmReady ? Colors.green : Colors.red, marginTop: 6 }]}>
              GSM: {gsmReady ? '✅ Online — SMS delivered' : '❌ Offline — check SIM900A'}
            </Text>
          </View>
        )}
      </View>
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
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 11, marginTop: 2 },
  lostModeBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 99, borderWidth: 1, borderColor: Colors.border,
  },
  lostModeBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },

  scroll: { flex: 1, paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    color: Colors.textMuted, marginBottom: 10, marginTop: 4,
  },

  radarCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 24,
    padding: 20, marginBottom: 14, borderWidth: 1,
    borderColor: Colors.borderAccent, alignItems: 'center',
  },
  radarTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.accent, marginBottom: 4 },
  radarSub:   { fontSize: 12, color: Colors.textMuted, marginBottom: 20 },
  radarArea:  { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  radarRing:  { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: Colors.accent + '88' },
  arrowContainer: { alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 48 },
  centerDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.accent },
  distanceLabel: { position: 'absolute', bottom: -10, alignItems: 'center' },
  distanceText:  { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  distanceSub:   { fontSize: 10, color: Colors.textMuted },
  signalRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  signalLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: Colors.textMuted, flex: 1 },
  signalText: { fontSize: 12, fontWeight: '700' },

  card: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 20,
    padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  lastSeenRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  lastSeenIcon:  { fontSize: 28 },
  lastSeenPlace: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  lastSeenTime:  { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  mapsBtn: {
    backgroundColor: '#1A3A1A', borderRadius: 14, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.green + '44',
  },
  mapsBtnText: { color: Colors.green, fontWeight: '700', fontSize: 14 },

  scanBtn: {
    backgroundColor: Colors.accent, borderRadius: 999,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 16, flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  scanBtnText: { color: '#000', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  tipsCard: {
    backgroundColor: Colors.yellow + '11', borderRadius: 20, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.yellow + '44', gap: 6,
  },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: Colors.yellow, marginBottom: 4 },
  tipText:   { fontSize: 13, color: Colors.textSecondary },
});
