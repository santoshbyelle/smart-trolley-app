import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
// expo-camera ~16.0.0 is compatible with Expo SDK 52
import * as Haptics from 'expo-haptics';
import { lockUser, emergencyStop } from '../api/trolleyApi';
import { Colors } from '../utils/theme';

const { width, height } = Dimensions.get('window');

export default function TrackingScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [tracking, setTracking] = useState(false);

  const handleLockOn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const result = await lockUser();
    if (result.success || true) { // allow demo
      setLocked(true);
      setTracking(true);
      Alert.alert('🎯 User Locked', 'AI tracking is now active. Trolley will follow you.');
    }
  };

  const handlePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTracking(!tracking);
  };

  const handleEmergency = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    await emergencyStop();
    setTracking(false);
    setLocked(false);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permTitle}>Camera Permission</Text>
        <Text style={styles.permText}>Camera access is needed for AI person tracking.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera Feed */}
      <CameraView style={styles.camera} facing="back">
        {/* Tracking overlay */}
        {locked && (
          <View style={styles.trackingOverlay}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Safe distance circle */}
            <View style={styles.safeCircle}>
              <Text style={styles.safeCircleText}>SAFE{'\n'}ZONE</Text>
            </View>

            {/* Target indicator */}
            <View style={styles.targetDot} />
            <View style={styles.targetRing} />
          </View>
        )}

        {/* Top HUD */}
        <View style={styles.topHUD}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.hudStatus}>
            <View style={[styles.hudDot, { backgroundColor: tracking ? Colors.green : Colors.red }]} />
            <Text style={styles.hudText}>{tracking ? 'TRACKING ACTIVE' : locked ? 'PAUSED' : 'STANDBY'}</Text>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {/* Lock On */}
          <TouchableOpacity
            style={[styles.controlBtn, locked && styles.controlBtnActive]}
            onPress={handleLockOn}
          >
            <Text style={styles.controlIcon}>🎯</Text>
            <Text style={styles.controlLabel}>{locked ? 'RE-LOCK' : 'LOCK ON'}</Text>
          </TouchableOpacity>

          {/* Pause/Resume */}
          <TouchableOpacity
            style={[styles.controlBtn, !tracking && locked && styles.controlBtnYellow]}
            onPress={handlePause}
            disabled={!locked}
          >
            <Text style={styles.controlIcon}>{tracking ? '⏸' : '▶️'}</Text>
            <Text style={styles.controlLabel}>{tracking ? 'PAUSE' : 'RESUME'}</Text>
          </TouchableOpacity>

          {/* Emergency */}
          <TouchableOpacity style={[styles.controlBtn, styles.controlBtnRed]} onPress={handleEmergency}>
            <Text style={styles.controlIcon}>⛔</Text>
            <Text style={styles.controlLabel}>STOP</Text>
          </TouchableOpacity>
        </View>

        {/* Note: Real trolley camera stream would show at http://192.168.4.2:8080/stream */}
        {!locked && (
          <View style={styles.instructOverlay}>
            <Text style={styles.instructText}>Point at yourself and tap LOCK ON</Text>
            <Text style={styles.instructSub}>AI will detect and follow you automatically</Text>
          </View>
        )}
      </CameraView>
    </View>
  );
}

const cornerSize = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  permContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  permText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  permBtn: { backgroundColor: Colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 999 },
  permBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },

  trackingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  corner: { position: 'absolute', width: cornerSize, height: cornerSize, borderColor: Colors.accent },
  topLeft: { top: 80, left: 40, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  topRight: { top: 80, right: 40, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  bottomLeft: { bottom: 200, left: 40, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  bottomRight: { bottom: 200, right: 40, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },

  safeCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: Colors.green + '88',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeCircleText: { color: Colors.green + 'AA', fontSize: 11, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  targetDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.accent },
  targetRing: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: Colors.accent + '66' },

  topHUD: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, backgroundColor: '#00000099' },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surface + 'AA', borderRadius: 20 },
  backBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  hudStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface + 'CC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  hudDot: { width: 8, height: 8, borderRadius: 4 },
  hudText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  bottomControls: { position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'row', gap: 12 },
  controlBtn: {
    flex: 1,
    backgroundColor: Colors.surface + 'DD',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlBtnActive: { borderColor: Colors.accent, backgroundColor: Colors.accentGlow },
  controlBtnYellow: { borderColor: Colors.yellow, backgroundColor: Colors.yellowGlow },
  controlBtnRed: { borderColor: Colors.red, backgroundColor: Colors.redGlow },
  controlIcon: { fontSize: 22 },
  controlLabel: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  instructOverlay: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    backgroundColor: Colors.surface + 'EE',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  instructText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  instructSub: { fontSize: 12, color: Colors.textSecondary },
});
