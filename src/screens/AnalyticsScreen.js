import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native';
import { Colors } from '../utils/theme';

const { width } = Dimensions.get('window');

// Simulated trip history — in real app this comes from AsyncStorage or ESP32 logs
const MOCK_TRIPS = [
  { id: 1, date: 'Today', time: '09:14 AM', location: 'T2 Airport', duration: '34 min', distance: 2.4, avgSpeed: 4.2, batteryUsed: 12, weight: 18.2, mode: 'airport', icon: '✈️' },
  { id: 2, date: 'Yesterday', time: '03:42 PM', location: 'City Mall', duration: '51 min', distance: 3.1, avgSpeed: 3.6, batteryUsed: 18, weight: 12.5, mode: 'mall', icon: '🛍️' },
  { id: 3, date: 'Feb 19', time: '11:20 AM', location: 'T1 Airport', duration: '28 min', distance: 1.9, avgSpeed: 4.0, batteryUsed: 9, weight: 20.0, mode: 'airport', icon: '✈️' },
  { id: 4, date: 'Feb 18', time: '06:15 PM', location: 'Grand Mall', duration: '1h 12min', distance: 4.7, avgSpeed: 3.9, batteryUsed: 24, weight: 8.3, mode: 'mall', icon: '🛍️' },
];

function StatCard({ icon, label, value, unit, color }) {
  const animVal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animVal, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.statCard, { opacity: animVal, borderColor: color + '44' }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function MiniBar({ percent, color }) {
  return (
    <View style={barStyles.bg}>
      <View style={[barStyles.fill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  bg: { height: 5, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 3 },
});

export default function AnalyticsScreen({ navigation }) {
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Aggregated stats from mock trips
  const totalDistance = MOCK_TRIPS.reduce((s, t) => s + t.distance, 0).toFixed(1);
  const totalBattery = MOCK_TRIPS.reduce((s, t) => s + t.batteryUsed, 0);
  const avgSpeed = (MOCK_TRIPS.reduce((s, t) => s + t.avgSpeed, 0) / MOCK_TRIPS.length).toFixed(1);
  const maxWeight = Math.max(...MOCK_TRIPS.map((t) => t.weight)).toFixed(1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Trip Analytics</Text>
          <Text style={styles.subtitle}>{MOCK_TRIPS.length} trips recorded</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Summary stats */}
        <Text style={styles.sectionLabel}>ALL-TIME SUMMARY</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="📏" label="Total Distance" value={totalDistance} unit="km" color={Colors.accent} />
          <StatCard icon="⚡" label="Battery Used" value={totalBattery} unit="%" color={Colors.yellow} />
          <StatCard icon="🚀" label="Avg Speed" value={avgSpeed} unit="km/h" color={Colors.green} />
          <StatCard icon="⚖️" label="Max Weight" value={maxWeight} unit="kg" color="#FF7675" />
        </View>

        {/* Mode usage bar */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>MODE USAGE</Text>
          <View style={styles.modeRow}>
            <Text style={styles.modeLabel}>✈️ Airport</Text>
            <MiniBar percent={60} color={Colors.accent} />
            <Text style={styles.modePct}>60%</Text>
          </View>
          <View style={[styles.modeRow, { marginTop: 10 }]}>
            <Text style={styles.modeLabel}>🛍️ Mall</Text>
            <MiniBar percent={40} color={Colors.purple} />
            <Text style={styles.modePct}>40%</Text>
          </View>
        </View>

        {/* Weekly chart (simple bars) */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DISTANCE THIS WEEK (km)</Text>
          <View style={styles.chartRow}>
            {[
              { day: 'Mon', val: 0 },
              { day: 'Tue', val: 1.9 },
              { day: 'Wed', val: 4.7 },
              { day: 'Thu', val: 3.1 },
              { day: 'Fri', val: 2.4 },
              { day: 'Sat', val: 0 },
              { day: 'Sun', val: 0 },
            ].map((d) => {
              const maxVal = 5;
              const pct = (d.val / maxVal) * 100;
              return (
                <View key={d.day} style={styles.chartCol}>
                  <Text style={styles.chartValue}>{d.val > 0 ? d.val : ''}</Text>
                  <View style={styles.chartBarBg}>
                    <View style={[styles.chartBarFill, { height: `${pct}%`, backgroundColor: pct > 0 ? Colors.accent : 'transparent' }]} />
                  </View>
                  <Text style={styles.chartDay}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Trip history */}
        <Text style={styles.sectionLabel}>TRIP HISTORY</Text>
        {MOCK_TRIPS.map((trip) => (
          <TouchableOpacity
            key={trip.id}
            style={[styles.tripCard, selectedTrip === trip.id && { borderColor: Colors.accent }]}
            onPress={() => setSelectedTrip(selectedTrip === trip.id ? null : trip.id)}
            activeOpacity={0.85}
          >
            <View style={styles.tripTop}>
              <View style={styles.tripIconBox}>
                <Text style={styles.tripIcon}>{trip.icon}</Text>
              </View>
              <View style={styles.tripInfo}>
                <Text style={styles.tripLocation}>{trip.location}</Text>
                <Text style={styles.tripMeta}>{trip.date}  ·  {trip.time}  ·  {trip.duration}</Text>
              </View>
              <Text style={styles.tripDist}>{trip.distance} km</Text>
            </View>

            {/* Expanded detail */}
            {selectedTrip === trip.id && (
              <View style={styles.tripDetail}>
                <View style={styles.divider} />
                <View style={styles.tripDetailGrid}>
                  {[
                    { label: 'Avg Speed', value: `${trip.avgSpeed} km/h`, icon: '🚀' },
                    { label: 'Battery Used', value: `${trip.batteryUsed}%`, icon: '⚡' },
                    { label: 'Max Weight', value: `${trip.weight} kg`, icon: '⚖️' },
                    { label: 'Mode', value: trip.mode, icon: trip.icon },
                  ].map((d) => (
                    <View key={d.label} style={styles.detailItem}>
                      <Text style={styles.detailIcon}>{d.icon}</Text>
                      <Text style={styles.detailValue}>{d.value}</Text>
                      <Text style={styles.detailLabel}>{d.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <Text style={styles.note}>* Real data is recorded from ESP32 logs during each trip</Text>
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
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: (width - 50) / 2, backgroundColor: Colors.surfaceElevated, borderRadius: 18, padding: 16, borderWidth: 1, alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  statUnit: { fontSize: 12, color: Colors.textMuted },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', letterSpacing: 1 },

  card: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeLabel: { fontSize: 13, color: Colors.textSecondary, width: 70 },
  modePct: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, width: 36, textAlign: 'right' },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 8 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartValue: { fontSize: 9, color: Colors.accent, marginBottom: 3 },
  chartBarBg: { width: '100%', height: 70, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderRadius: 4 },
  chartDay: { fontSize: 9, color: Colors.textMuted, marginTop: 4, fontWeight: '600' },

  tripCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  tripTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  tripIcon: { fontSize: 22 },
  tripInfo: { flex: 1 },
  tripLocation: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  tripMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  tripDist: { fontSize: 16, fontWeight: '800', color: Colors.accent },

  tripDetail: { marginTop: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  tripDetailGrid: { flexDirection: 'row', gap: 8 },
  detailItem: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 10, alignItems: 'center', gap: 3 },
  detailIcon: { fontSize: 16 },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  detailLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  note: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
});
