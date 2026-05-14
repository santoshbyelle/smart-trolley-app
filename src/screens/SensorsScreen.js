import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import { Colors } from '../utils/theme';

// Simulated sensor readings — in real app, these come from GET /api/sensors
const useSensorData = (demoMode = true) => {
  const [sensors, setSensors] = useState({
    temperature: 24.2,
    humidity: 58,
    airQuality: 87,  // AQI 0-100 (100 = cleanest)
    shockLevel: 0,   // 0-10
    tilt: 2,         // degrees
    rain: false,
    pressure: 1013,  // hPa
    vibration: 'low',
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      if (demoMode) {
        setSensors((prev) => ({
          ...prev,
          temperature: parseFloat((prev.temperature + (Math.random() * 0.4 - 0.2)).toFixed(1)),
          humidity: Math.min(100, Math.max(0, prev.humidity + Math.round(Math.random() * 2 - 1))),
          airQuality: Math.min(100, Math.max(0, prev.airQuality + Math.round(Math.random() * 4 - 2))),
          shockLevel: Math.max(0, Math.round(Math.random() * 2)),
          tilt: parseFloat((Math.random() * 4).toFixed(1)),
        }));
      } else {
        try {
          const res = await fetch('http://192.168.4.1/api/sensors');
          const data = await res.json();
          setSensors(data);
        } catch (e) {}
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [demoMode]);

  return sensors;
};

function GaugeCard({ icon, label, value, unit, min, max, color, status, statusColor }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const percent = Math.min(Math.max((value - min) / (max - min), 0), 1);

  useEffect(() => {
    Animated.timing(animVal, { toValue: percent, duration: 600, useNativeDriver: false }).start();
  }, [value]);

  const barWidth = animVal.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[gStyles.card, { borderColor: color + '44' }]}>
      <View style={gStyles.top}>
        <Text style={gStyles.icon}>{icon}</Text>
        <View style={[gStyles.statusPill, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
          <Text style={[gStyles.statusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>
      <Text style={[gStyles.value, { color }]}>{value}<Text style={gStyles.unit}> {unit}</Text></Text>
      <Text style={gStyles.label}>{label}</Text>
      <View style={gStyles.barBg}>
        <Animated.View style={[gStyles.barFill, { width: barWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}
const gStyles = StyleSheet.create({
  card: { flex: 1, minWidth: '45%', backgroundColor: Colors.surfaceElevated, borderRadius: 18, padding: 14, borderWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  icon: { fontSize: 22 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  value: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 13, fontWeight: '400', color: Colors.textMuted },
  label: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', letterSpacing: 1, marginTop: 2, marginBottom: 8 },
  barBg: { height: 4, borderRadius: 2, backgroundColor: Colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
});

function BoolCard({ icon, label, value, trueLabel, falseLabel, trueColor, falseColor }) {
  const color = value ? trueColor : falseColor;
  return (
    <View style={[boolStyles.card, { borderColor: color + '55' }]}>
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <Text style={[boolStyles.status, { color }]}>{value ? trueLabel : falseLabel}</Text>
      <Text style={boolStyles.label}>{label}</Text>
    </View>
  );
}
const boolStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 18, padding: 14, borderWidth: 1, alignItems: 'center', gap: 4 },
  status: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', letterSpacing: 1 },
});

export default function SensorsScreen({ navigation }) {
  const sensors = useSensorData(true); // true = demo mode

  const getAirQualityStatus = (v) => v > 80 ? ['GOOD', Colors.green] : v > 50 ? ['MODERATE', Colors.yellow] : ['POOR', Colors.red];
  const getTempStatus = (v) => v < 18 ? ['COLD', Colors.accent] : v < 30 ? ['NORMAL', Colors.green] : ['HOT', Colors.red];
  const getHumidityStatus = (v) => v < 30 ? ['DRY', Colors.yellow] : v < 70 ? ['IDEAL', Colors.green] : ['HUMID', Colors.accent];
  const getShockStatus = (v) => v === 0 ? ['NONE', Colors.green] : v < 4 ? ['MINOR', Colors.yellow] : ['HIGH', Colors.red];

  const [aqStatus, aqColor] = getAirQualityStatus(sensors.airQuality);
  const [tStatus, tColor] = getTempStatus(sensors.temperature);
  const [hStatus, hColor] = getHumidityStatus(sensors.humidity);
  const [sStatus, sColor] = getShockStatus(sensors.shockLevel);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Sensor Dashboard</Text>
          <Text style={styles.subtitle}>⚡ Live from trolley IoT sensors</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Live indicator */}
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE DATA  ·  Updates every 1.5s</Text>
          <Text style={styles.liveNote}>Demo mode — connect trolley for real values</Text>
        </View>

        {/* Gauge grid */}
        <Text style={styles.sectionLabel}>ENVIRONMENTAL</Text>
        <View style={styles.grid}>
          <GaugeCard
            icon="🌡️" label="TEMPERATURE" value={sensors.temperature} unit="°C"
            min={0} max={50} color={tColor} status={tStatus} statusColor={tColor}
          />
          <GaugeCard
            icon="💧" label="HUMIDITY" value={sensors.humidity} unit="%"
            min={0} max={100} color={hColor} status={hStatus} statusColor={hColor}
          />
          <GaugeCard
            icon="🌬️" label="AIR QUALITY" value={sensors.airQuality} unit="AQI"
            min={0} max={100} color={aqColor} status={aqStatus} statusColor={aqColor}
          />
          <GaugeCard
            icon="📊" label="PRESSURE" value={sensors.pressure} unit="hPa"
            min={980} max={1040} color={Colors.accent} status="NORMAL" statusColor={Colors.green}
          />
        </View>

        {/* Physical sensors */}
        <Text style={styles.sectionLabel}>PHYSICAL STATE</Text>
        <View style={styles.grid}>
          <GaugeCard
            icon="💥" label="SHOCK LEVEL" value={sensors.shockLevel} unit="/10"
            min={0} max={10} color={sColor} status={sStatus} statusColor={sColor}
          />
          <GaugeCard
            icon="📐" label="TILT ANGLE" value={sensors.tilt} unit="°"
            min={0} max={45} color={sensors.tilt > 15 ? Colors.red : Colors.green}
            status={sensors.tilt > 15 ? 'DANGER' : 'LEVEL'} statusColor={sensors.tilt > 15 ? Colors.red : Colors.green}
          />
        </View>

        {/* Boolean sensors */}
        <Text style={styles.sectionLabel}>STATUS FLAGS</Text>
        <View style={styles.boolRow}>
          <BoolCard
            icon="🌧️" label="RAIN" value={sensors.rain}
            trueLabel="DETECTED" falseLabel="CLEAR"
            trueColor={Colors.accent} falseColor={Colors.green}
          />
          <BoolCard
            icon="📳" label="VIBRATION" value={sensors.vibration !== 'low'}
            trueLabel="ACTIVE" falseLabel="CALM"
            trueColor={Colors.yellow} falseColor={Colors.green}
          />
        </View>

        {/* Summary health card */}
        <View style={styles.healthCard}>
          <Text style={styles.sectionLabel}>TROLLEY HEALTH SCORE</Text>
          <View style={styles.healthRow}>
            <Text style={styles.healthScore}>94</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.healthStatus}>Excellent Condition</Text>
              <Text style={styles.healthSub}>All sensors normal  ·  No alerts</Text>
              <View style={styles.healthBar}>
                <View style={[styles.healthFill, { width: '94%' }]} />
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.apiNote}>
          Real data endpoint: GET http://192.168.4.1/api/sensors
        </Text>
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
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.accent, marginTop: 2 },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 10 },

  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.green + '15', borderRadius: 14, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: Colors.green + '33', flexWrap: 'wrap' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  liveText: { fontSize: 11, fontWeight: '700', color: Colors.green, letterSpacing: 1 },
  liveNote: { fontSize: 10, color: Colors.textMuted, width: '100%' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  boolRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },

  healthCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.green + '44' },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  healthScore: { fontSize: 52, fontWeight: '900', color: Colors.green, letterSpacing: -2 },
  healthStatus: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  healthSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  healthBar: { height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  healthFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.green },

  apiNote: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', fontFamily: 'monospace', marginBottom: 4 },
});
