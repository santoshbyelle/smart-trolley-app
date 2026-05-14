import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Linking, Animated, Platform,
} from 'react-native';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { getSecurity } from '../api/trolleyApi';
import { Colors } from '../utils/theme';

const SAFE_RADIUS = 50; // meters

export default function MapScreen({ navigation }) {
  const [locationGranted, setLocationGranted] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [trolleyLocation, setTrolleyLocation] = useState(null);
  const [pathHistory, setPathHistory] = useState([]);
  const [antitheft, setAntitheft] = useState(false);
  const [distanceFromTrolley, setDistanceFromTrolley] = useState(1.3);
  const mapRef = useRef(null);
  const alertPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    requestLocation();
  }, []);

  // Alert pulse animation
  useEffect(() => {
    if (antitheft) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(alertPulse, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(alertPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      alertPulse.stopAnimation();
      alertPulse.setValue(1);
    }
  }, [antitheft]);

  // Poll anti-theft
  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await getSecurity();
      if (result.success && result.data.alert && !antitheft) {
        setAntitheft(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          '🚨 ANTI-THEFT ALERT',
          'Trolley has moved outside the safe zone!\nCheck your trolley immediately.',
          [{ text: 'Dismiss', onPress: () => setAntitheft(false) }]
        );
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [antitheft]);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location Required', 'Please grant location permission to use map features.');
      return;
    }
    setLocationGranted(true);

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const userCoord = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    setUserLocation(userCoord);

    // Trolley simulated 1.3m behind (small offset)
    const trolleyCoord = {
      latitude: userCoord.latitude - 0.000012,
      longitude: userCoord.longitude,
    };
    setTrolleyLocation(trolleyCoord);
    setPathHistory([userCoord]);

    // Watch user movement
    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0.5 },
      (newLoc) => {
        const newCoord = {
          latitude: newLoc.coords.latitude,
          longitude: newLoc.coords.longitude,
        };
        setUserLocation(newCoord);
        setPathHistory((prev) => [...prev.slice(-50), newCoord]); // keep last 50 points

        // Simulate trolley following slightly behind
        setTrolleyLocation({
          latitude: newCoord.latitude - 0.000012,
          longitude: newCoord.longitude,
        });
      }
    );
  };

  const handleCenterMap = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      }, 800);
    }
  };

  // Open trolley location in Google Maps app
  const handleOpenGoogleMaps = () => {
    if (!trolleyLocation) {
      Alert.alert('No Location', 'Trolley location not available yet.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { latitude, longitude } = trolleyLocation;
    const label = 'Smart Trolley Location';

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
    });

    // Try Google Maps app first, fallback to browser
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    Linking.canOpenURL('comgooglemaps://').then((supported) => {
      if (supported) {
        Linking.openURL(`comgooglemaps://?q=${latitude},${longitude}&zoom=18`);
      } else {
        Linking.openURL(googleMapsUrl);
      }
    }).catch(() => {
      Linking.openURL(googleMapsUrl);
    });
  };

  const handleFindTrolley = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (trolleyLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: trolleyLocation.latitude,
        longitude: trolleyLocation.longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      }, 800);
    }
    Alert.alert('📡 Find My Trolley', 'Trolley is now flashing its LED lights to help you locate it.');
  };

  if (!locationGranted) {
    return (
      <View style={styles.permContainer}>
        <TouchableOpacity style={styles.backBtnAbs} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.permIcon}>📍</Text>
        <Text style={styles.permTitle}>Location Access Needed</Text>
        <Text style={styles.permText}>
          Grant location permission to see the live map, track your trolley, and enable anti-theft.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestLocation}>
          <Text style={styles.permBtnText}>Grant Location Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* MAP */}
      {userLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={undefined}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.003,
            longitudeDelta: 0.003,
          }}
          showsUserLocation={false}
          showsCompass
          showsScale
          mapType="standard"
        >
          {/* Safe radius circle */}
          {userLocation && (
            <Circle
              center={userLocation}
              radius={SAFE_RADIUS}
              fillColor="rgba(0, 191, 255, 0.08)"
              strokeColor="rgba(0, 191, 255, 0.4)"
              strokeWidth={2}
            />
          )}

          {/* Path history */}
          {pathHistory.length > 1 && (
            <Polyline
              coordinates={pathHistory}
              strokeColor={Colors.accent}
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
          )}

          {/* User marker */}
          {userLocation && (
            <Marker coordinate={userLocation} title="You" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.userMarker}>
                <View style={styles.userMarkerInner} />
              </View>
            </Marker>
          )}

          {/* Trolley marker */}
          {trolleyLocation && (
            <Marker coordinate={trolleyLocation} title="Smart Trolley" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.trolleyMarker, antitheft && styles.trolleyMarkerAlert]}>
                <Text style={styles.trolleyMarkerText}>🧳</Text>
              </View>
            </Marker>
          )}
        </MapView>
      ) : (
        <View style={styles.mapLoading}>
          <Text style={styles.mapLoadingText}>Loading map...</Text>
        </View>
      )}

      {/* TOP HEADER OVERLAY */}
      <View style={styles.topOverlay}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Live Tracking</Text>
        {antitheft && (
          <Animated.View style={[styles.alertBadge, { transform: [{ scale: alertPulse }] }]}>
            <Text style={styles.alertBadgeText}>🚨 ALERT</Text>
          </Animated.View>
        )}
      </View>

      {/* RIGHT SIDE CONTROLS */}
      <View style={styles.sideControls}>
        <TouchableOpacity style={styles.sideBtn} onPress={handleCenterMap}>
          <Text style={styles.sideBtnText}>🎯</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideBtn} onPress={handleFindTrolley}>
          <Text style={styles.sideBtnText}>📡</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM PANEL */}
      <View style={styles.bottomPanel}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>DISTANCE</Text>
            <Text style={styles.statValue}>{distanceFromTrolley.toFixed(1)} m</Text>
          </View>
          <View style={[styles.statCard, antitheft && { borderColor: Colors.red }]}>
            <Text style={styles.statLabel}>SECURITY</Text>
            <Text style={[styles.statValue, { color: antitheft ? Colors.red : Colors.green, fontSize: 14 }]}>
              {antitheft ? '🚨 ALERT' : '🔒 Secure'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>SAFE ZONE</Text>
            <Text style={styles.statValue}>{SAFE_RADIUS}m</Text>
          </View>
        </View>

        {/* Google Maps button */}
        <TouchableOpacity style={styles.googleMapsBtn} onPress={handleOpenGoogleMaps}>
          <Text style={styles.googleMapsIcon}>🗺️</Text>
          <View>
            <Text style={styles.googleMapsBtnText}>Open in Google Maps</Text>
            <Text style={styles.googleMapsBtnSub}>Navigate directly to trolley location</Text>
          </View>
          <Text style={styles.googleMapsArrow}>›</Text>
        </TouchableOpacity>

        {/* Find trolley button */}
        <TouchableOpacity style={styles.findBtn} onPress={handleFindTrolley}>
          <Text style={styles.findBtnText}>📡  Find My Trolley</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A1A0A' },
  mapLoadingText: { color: Colors.textSecondary, fontSize: 15 },

  // Permission screen
  permContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  backBtnAbs: { position: 'absolute', top: 60, left: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  permIcon: { fontSize: 64, marginBottom: 16 },
  permTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  permText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn: { backgroundColor: Colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 999 },
  permBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },

  // Top overlay
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20,
    backgroundColor: Colors.background + 'EE',
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  alertBadge: { backgroundColor: Colors.red, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  alertBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // Side controls
  sideControls: { position: 'absolute', right: 14, top: '45%', gap: 10 },
  sideBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceElevated + 'EE', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  sideBtnText: { fontSize: 20 },

  // Custom markers
  userMarker: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent + '33', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.accent },
  userMarkerInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  trolleyMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.accent, shadowColor: Colors.accent, shadowOpacity: 0.5, shadowRadius: 6, elevation: 5 },
  trolleyMarkerAlert: { borderColor: Colors.red, shadowColor: Colors.red },
  trolleyMarkerText: { fontSize: 20 },

  // Bottom panel
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background + 'F5',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: Colors.border,
    gap: 12,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: Colors.textMuted, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  googleMapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A3A1A', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#00FF7F44',
  },
  googleMapsIcon: { fontSize: 28 },
  googleMapsBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  googleMapsBtnSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  googleMapsArrow: { marginLeft: 'auto', fontSize: 22, color: Colors.textMuted },

  findBtn: { backgroundColor: Colors.accent, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  findBtnText: { fontSize: 15, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
});
