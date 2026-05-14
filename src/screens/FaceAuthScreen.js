// ============================================
// NEW: FaceAuthScreen — Face Recognition Auth
// Replaces old HOGAuthScreen
//
// Features:
//   A. "Authenticate User" → calls Pi /start-recognition
//   B. "Add New User"      → phone camera capture → /add-face
//   C. Registered faces list with delete
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Alert, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {
  startRecognition, addFace, getFaces, removeFace,
  getAuthStatus, deauth, pingPi,
} from '../api/trolleyApi';
import { Colors } from '../utils/theme';

// ─── Result Badge ───────────────────────────────────────────────────────────
function ResultBadge({ type, text }) {
  const cfg = {
    success: { bg: Colors.green + '15', border: Colors.green + '55', color: Colors.green, icon: '✅' },
    fail:    { bg: Colors.red + '15',   border: Colors.red + '55',   color: Colors.red,   icon: '❌' },
    info:    { bg: Colors.accent + '15', border: Colors.accent + '55', color: Colors.accent, icon: 'ℹ️' },
  };
  const c = cfg[type] || cfg.info;
  return (
    <View style={[rbStyles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={rbStyles.icon}>{c.icon}</Text>
      <Text style={[rbStyles.text, { color: c.color }]}>{text}</Text>
    </View>
  );
}
const rbStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  icon: { fontSize: 20 },
  text: { fontSize: 14, fontWeight: '700', flex: 1 },
});

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function FaceAuthScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();

  // State
  const [piOnline, setPiOnline]           = useState(false);
  const [scanning, setScanning]           = useState(false);
  const [scanResult, setScanResult]       = useState(null);
  const [faces, setFaces]                 = useState([]);
  const [authUser, setAuthUser]           = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [newName, setNewName]             = useState('');
  const [capturing, setCapturing]         = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [submitting, setSubmitting]       = useState(false);

  const cameraRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    checkPi();
    loadFaces();
    checkAuth();
  }, []);

  const checkPi = async () => {
    const res = await pingPi();
    setPiOnline(res.success && res.data?.device === 'smarttrolley-pi');
  };

  const loadFaces = async () => {
    const res = await getFaces();
    if (res.success) setFaces(res.data.faces || []);
  };

  const checkAuth = async () => {
    const res = await getAuthStatus();
    if (res.success) {
      setAuthUser(res.data.authenticated ? res.data.user : null);
    }
  };

  // ─── Authenticate User ────────────────────────────────────────────────
  const handleAuthenticate = async () => {
    if (!piOnline) {
      Alert.alert('Pi Offline', 'Raspberry Pi is not reachable.\nCheck that it is powered on and on the same network.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScanning(true);
    setScanResult(null);

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    const res = await startRecognition();
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    setScanning(false);

    if (res.success) {
      const d = res.data;
      if (d.recognized) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setScanResult({ type: 'success', text: `User Recognized: ${d.person_name} (${d.confidence}% match)` });
        setAuthUser(d.person_name);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setScanResult({ type: 'fail', text: d.error || 'User Not Recognized' });
        setAuthUser(null);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setScanResult({ type: 'fail', text: 'Server error: ' + (res.error || 'Connection failed') });
    }
  };

  // ─── Lock Trolley ─────────────────────────────────────────────────────
  const handleDeauth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deauth();
    setAuthUser(null);
    setScanResult({ type: 'info', text: 'Trolley locked. Authentication cleared.' });
  };

  // ─── Capture Photo ────────────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        exif: false,
      });
      setCapturedImage(photo);
    } catch (e) {
      Alert.alert('Capture Error', e.message);
    }
    setCapturing(false);
  };

  // ─── Submit New Face ──────────────────────────────────────────────────
  const handleSubmitFace = async () => {
    if (!newName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this person.');
      return;
    }
    if (!capturedImage?.base64) {
      Alert.alert('No Photo', 'Please capture a photo first.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await addFace(newName.trim(), capturedImage.base64);
    setSubmitting(false);

    if (res.success && res.data?.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Face Added!', `${newName} has been registered.\nTotal faces: ${res.data.total_faces}`);
      setShowAddModal(false);
      setNewName('');
      setCapturedImage(null);
      loadFaces();
    } else {
      const errMsg = res.data?.error || res.error || 'Unknown error';
      Alert.alert('Failed to Add Face', errMsg);
    }
  };

  // ─── Delete Face ──────────────────────────────────────────────────────
  const handleDeleteFace = (face) => {
    Alert.alert(
      'Remove User',
      `Delete "${face.name}" from the system?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await removeFace(face.id);
            if (res.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadFaces();
            } else {
              Alert.alert('Error', res.error || 'Could not delete face');
            }
          },
        },
      ]
    );
  };

  // ─── Permission Guard ─────────────────────────────────────────────────
  if (!permission) return <View style={styles.container} />;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Face Authentication</Text>
          <Text style={styles.subtitle}>Recognize & manage users</Text>
        </View>
        <View style={[styles.piBadge, { backgroundColor: piOnline ? Colors.green + '22' : Colors.red + '22', borderColor: piOnline ? Colors.green + '55' : Colors.red + '55' }]}>
          <View style={[styles.piDot, { backgroundColor: piOnline ? Colors.green : Colors.red }]} />
          <Text style={[styles.piText, { color: piOnline ? Colors.green : Colors.red }]}>
            {piOnline ? 'PI ONLINE' : 'PI OFFLINE'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Auth Status ── */}
        {authUser && (
          <View style={[styles.card, { borderColor: Colors.green + '55' }]}>
            <View style={styles.authRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>CURRENT USER</Text>
                <Text style={styles.authName}>{authUser}</Text>
                <Text style={[styles.authStatus, { color: Colors.green }]}>Authenticated — Trolley active</Text>
              </View>
              <TouchableOpacity style={styles.lockBtn} onPress={handleDeauth}>
                <Text style={styles.lockBtnText}>🔒 Lock</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Result ── */}
        {scanResult && <ResultBadge type={scanResult.type} text={scanResult.text} />}

        {/* ── Authenticate User Button ── */}
        <Animated.View style={{ transform: [{ scale: scanning ? pulseAnim : 1 }] }}>
          <TouchableOpacity
            style={[styles.primaryBtn, scanning && { opacity: 0.7 }]}
            onPress={handleAuthenticate}
            disabled={scanning}
            activeOpacity={0.85}
          >
            {scanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.primaryBtnText}>Scanning... Stand in front of trolley</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>👤  Authenticate User</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.scanHint}>
          Pi camera will scan and identify the person standing in front of the trolley
        </Text>

        {/* ── Add New User Button ── */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            if (!permission.granted) {
              requestPermission();
              return;
            }
            setCapturedImage(null);
            setNewName('');
            setShowAddModal(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText}>➕  Add New User</Text>
        </TouchableOpacity>

        {/* ── Registered Faces ── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
          REGISTERED FACES ({faces.length})
        </Text>

        {faces.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyTitle}>No Faces Registered</Text>
            <Text style={styles.emptyDesc}>
              Tap "Add New User" to register the first face.{'\n'}The trolley won't move until a user is recognized.
            </Text>
          </View>
        ) : (
          faces.map((face) => (
            <View key={face.id} style={styles.faceCard}>
              <View style={styles.faceAvatar}>
                <Text style={{ fontSize: 24 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.faceName}>{face.name}</Text>
                <Text style={styles.faceDate}>{face.date}</Text>
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteFace(face)}>
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ── How It Works ── */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <View style={styles.howRow}>
            <Text style={styles.howIcon}>📱</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.howTitle}>1. Add User</Text>
              <Text style={styles.howDesc}>Capture face via phone camera & send to Pi</Text>
            </View>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howIcon}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.howTitle}>2. Authenticate</Text>
              <Text style={styles.howDesc}>Pi camera scans & matches face in real-time</Text>
            </View>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howIcon}>🚀</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.howTitle}>3. Trolley Follows</Text>
              <Text style={styles.howDesc}>Motors activate ONLY after successful recognition</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══ Add New User Modal ═══ */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={modalStyles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.sheet}>
            <View style={modalStyles.headerRow}>
              <Text style={modalStyles.title}>Add New User</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={modalStyles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Camera Preview / Captured Image */}
            <View style={modalStyles.cameraWrap}>
              {capturedImage ? (
                <View style={modalStyles.previewPlaceholder}>
                  <Text style={{ fontSize: 48 }}>✅</Text>
                  <Text style={modalStyles.previewText}>Photo Captured</Text>
                  <TouchableOpacity
                    style={modalStyles.retakeBtn}
                    onPress={() => setCapturedImage(null)}
                  >
                    <Text style={modalStyles.retakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : permission?.granted ? (
                <CameraView
                  ref={cameraRef}
                  style={modalStyles.camera}
                  facing="front"
                >
                  <View style={modalStyles.cameraOverlay}>
                    {/* Face guide frame */}
                    <View style={modalStyles.faceFrame}>
                      <View style={[modalStyles.corner, modalStyles.tl]} />
                      <View style={[modalStyles.corner, modalStyles.tr]} />
                      <View style={[modalStyles.corner, modalStyles.bl]} />
                      <View style={[modalStyles.corner, modalStyles.br]} />
                    </View>
                    <Text style={modalStyles.cameraHint}>Align face within frame</Text>
                  </View>
                </CameraView>
              ) : (
                <View style={modalStyles.previewPlaceholder}>
                  <Text style={{ fontSize: 36 }}>📷</Text>
                  <Text style={modalStyles.previewText}>Camera permission needed</Text>
                  <TouchableOpacity style={modalStyles.retakeBtn} onPress={requestPermission}>
                    <Text style={modalStyles.retakeBtnText}>Grant Permission</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Capture Button */}
            {!capturedImage && permission?.granted && (
              <TouchableOpacity
                style={modalStyles.captureBtn}
                onPress={handleCapture}
                disabled={capturing}
              >
                {capturing ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={modalStyles.captureBtnText}>📸  Capture Photo</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Name Input */}
            <Text style={modalStyles.inputLabel}>PERSON NAME</Text>
            <TextInput
              style={modalStyles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. John Doe"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />

            {/* Submit */}
            <TouchableOpacity
              style={[modalStyles.submitBtn, (!capturedImage || !newName.trim() || submitting) && { opacity: 0.5 }]}
              onPress={handleSubmitFace}
              disabled={!capturedImage || !newName.trim() || submitting}
            >
              {submitting ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={modalStyles.submitBtnText}>Sending to Pi...</Text>
                </View>
              ) : (
                <Text style={modalStyles.submitBtnText}>✅  Register Face</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Modal Styles ───────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: 24, paddingBottom: 48,
    borderWidth: 1, borderColor: Colors.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  closeText: { fontSize: 22, color: Colors.textMuted, padding: 4 },
  cameraWrap: {
    height: 280, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderAccent, marginBottom: 14,
  },
  camera: { flex: 1 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#00000033',
    alignItems: 'center', justifyContent: 'center',
  },
  faceFrame: { width: 180, height: 220, position: 'relative' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: Colors.accent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  cameraHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 12, fontWeight: '600' },
  previewPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, gap: 8,
  },
  previewText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  retakeBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: Colors.accent },
  retakeBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  captureBtn: {
    backgroundColor: Colors.accent, borderRadius: 99,
    paddingVertical: 16, alignItems: 'center', marginBottom: 14,
  },
  captureBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 14, color: Colors.textPrimary, fontSize: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: Colors.green, borderRadius: 99,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
});

// ─── Main Styles ───────────────────────────────────────────────────────────
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
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  piBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1,
  },
  piDot: { width: 6, height: 6, borderRadius: 3 },
  piText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 10 },
  card: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  authRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authName: { fontSize: 20, fontWeight: '800', color: Colors.green, marginTop: 4 },
  authStatus: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  lockBtn: {
    backgroundColor: Colors.red + '22', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.red + '55',
  },
  lockBtnText: { color: Colors.red, fontWeight: '700', fontSize: 13 },
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: 99,
    paddingVertical: 18, alignItems: 'center', marginBottom: 8,
  },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanHint: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 14 },
  addBtn: {
    borderRadius: 99, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.accent + '66', backgroundColor: Colors.surfaceElevated,
  },
  addBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 15 },

  faceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surfaceElevated, borderRadius: 16, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  faceAvatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: Colors.accentGlow, alignItems: 'center', justifyContent: 'center',
  },
  faceName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  faceDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  deleteBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  deleteBtnText: { fontSize: 16 },

  emptyCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 28,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', alignItems: 'center', gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptyDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  howRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  howIcon: { fontSize: 22, marginTop: 2 },
  howTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  howDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
