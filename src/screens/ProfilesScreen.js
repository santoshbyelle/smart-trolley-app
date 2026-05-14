import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { setSensitivity, setPID, setMode } from '../api/trolleyApi';
import { Colors } from '../utils/theme';

const AVATARS = ['👤', '👨', '👩', '👴', '👵', '👧', '👦', '🧑‍💼', '👨‍⚕️', '👩‍⚕️'];
const AVATAR_COLORS = ['#00BFFF', '#00FF7F', '#FFC300', '#FF7675', '#A29BFE', '#74B9FF', '#fd79a8'];

const DEFAULT_PROFILES = [
  {
    id: 1, name: 'Myself', avatar: '👤', color: '#00BFFF', isActive: true,
    mode: 'airport', speed: 'normal', distance: 1.0,
    pid: { kp: 1.2, ki: 0.4, kd: 0.1 },
    trips: 4, lastUsed: 'Today',
  },
  {
    id: 2, name: 'Dad', avatar: '👴', color: '#FFB347', isActive: false,
    mode: 'mall', speed: 'slow', distance: 1.5,
    pid: { kp: 0.4, ki: 0.1, kd: 0.05 },
    trips: 2, lastUsed: 'Feb 18',
  },
];

function ProfileModal({ visible, onClose, onSave }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('👤');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [speed, setSpeed] = useState('normal');
  const [mode, setModalMode] = useState('airport');

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a name for this profile.'); return; }
    onSave({ name: name.trim(), avatar, color, speed, mode, distance: speed === 'slow' ? 1.5 : 1.0, pid: { kp: 1.2, ki: 0.4, kd: 0.1 }, trips: 0, lastUsed: 'Never' });
    setName(''); setAvatar('👤'); setColor(AVATAR_COLORS[0]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <Text style={mStyles.title}>New User Profile</Text>

          {/* Avatar picker */}
          <Text style={mStyles.label}>CHOOSE AVATAR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {AVATARS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[mStyles.avatarBtn, avatar === a && { borderColor: color, backgroundColor: color + '22' }]}
                  onPress={() => setAvatar(a)}
                >
                  <Text style={{ fontSize: 26 }}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Color picker */}
          <Text style={mStyles.label}>PROFILE COLOR</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {AVATAR_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[mStyles.colorDot, { backgroundColor: c }, color === c && mStyles.colorDotActive]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          {/* Name input */}
          <Text style={mStyles.label}>NAME</Text>
          <TextInput
            style={mStyles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Mom, Dad, Guest..."
            placeholderTextColor={Colors.textMuted}
          />

          {/* Mode */}
          <Text style={mStyles.label}>DEFAULT MODE</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {['airport', 'mall'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[mStyles.optBtn, mode === m && { borderColor: color, backgroundColor: color + '22' }]}
                onPress={() => setModalMode(m)}
              >
                <Text style={{ color: mode === m ? color : Colors.textSecondary, fontWeight: '700' }}>
                  {m === 'airport' ? '✈️ Airport' : '🛍️ Mall'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Speed */}
          <Text style={mStyles.label}>WALKING SPEED</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
            {[{ k: 'slow', l: '🐢 Slow' }, { k: 'normal', l: '🚶 Normal' }, { k: 'fast', l: '🏃 Fast' }].map((s) => (
              <TouchableOpacity
                key={s.k}
                style={[mStyles.optBtn, speed === s.k && { borderColor: color, backgroundColor: color + '22' }]}
                onPress={() => setSpeed(s.k)}
              >
                <Text style={{ color: speed === s.k ? color : Colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{s.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={mStyles.btnRow}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[mStyles.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>Create Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 8 },
  avatarBtn: { width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  input: { backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14, color: Colors.textPrimary, fontSize: 16, marginBottom: 16 },
  optBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  saveBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
});

export default function ProfilesScreen({ navigation }) {
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [showModal, setShowModal] = useState(false);

  const handleActivate = async (profile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setProfiles((prev) => prev.map((p) => ({ ...p, isActive: p.id === profile.id })));
    await setSensitivity(profile.speed);
    await setPID(profile.pid.kp, profile.pid.ki, profile.pid.kd);
    await setMode(profile.mode);
    Alert.alert(
      `${profile.avatar} ${profile.name} Activated`,
      `Mode: ${profile.mode}\nSpeed: ${profile.speed}\nDistance: ${profile.distance}m\n\nTrolley settings updated!`
    );
  };

  const handleDelete = (id) => {
    if (profiles.find((p) => p.id === id)?.isActive) {
      Alert.alert('Cannot Delete', 'Switch to another profile first.'); return;
    }
    Alert.alert('Delete Profile', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setProfiles((prev) => prev.filter((p) => p.id !== id)) },
    ]);
  };

  const handleAddProfile = (data) => {
    const newProfile = { ...data, id: Date.now(), isActive: false };
    setProfiles((prev) => [...prev, newProfile]);
  };

  const activeProfile = profiles.find((p) => p.isActive);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>User Profiles</Text>
          <Text style={styles.subtitle}>Each user gets custom settings</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Active profile banner */}
        {activeProfile && (
          <View style={[styles.activeBanner, { borderColor: activeProfile.color }]}>
            <Text style={{ fontSize: 36 }}>{activeProfile.avatar}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeName}>{activeProfile.name}</Text>
              <Text style={styles.activeSub}>Currently active  ·  {activeProfile.trips} trips</Text>
            </View>
            <View style={[styles.activeDot, { backgroundColor: Colors.green }]} />
          </View>
        )}

        <Text style={styles.sectionLabel}>ALL PROFILES</Text>

        {profiles.map((profile) => (
          <View key={profile.id} style={[styles.profileCard, profile.isActive && { borderColor: profile.color }]}>
            {/* Top row */}
            <View style={styles.profileTop}>
              <View style={[styles.avatarBox, { backgroundColor: profile.color + '22' }]}>
                <Text style={{ fontSize: 28 }}>{profile.avatar}</Text>
              </View>
              <View style={styles.profileInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  {profile.isActive && (
                    <View style={[styles.activeChip, { backgroundColor: profile.color }]}>
                      <Text style={styles.activeChipText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.profileMeta}>
                  {profile.mode === 'airport' ? '✈️' : '🛍️'} {profile.mode}  ·  {profile.speed} speed  ·  {profile.distance}m gap
                </Text>
                <Text style={styles.profileTrips}>{profile.trips} trips  ·  Last: {profile.lastUsed}</Text>
              </View>
            </View>

            {/* PID chips */}
            <View style={styles.pidRow}>
              {[`Kp ${profile.pid.kp}`, `Ki ${profile.pid.ki}`, `Kd ${profile.pid.kd}`].map((c) => (
                <Text key={c} style={[styles.pidChip, { borderColor: profile.color + '66', color: profile.color }]}>{c}</Text>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              {!profile.isActive && (
                <TouchableOpacity
                  style={[styles.activateBtn, { backgroundColor: profile.color }]}
                  onPress={() => handleActivate(profile)}
                >
                  <Text style={styles.activateBtnText}>Activate</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(profile.id)}
              >
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Guest mode */}
        <View style={styles.guestCard}>
          <Text style={styles.guestIcon}>👥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.guestTitle}>Guest Mode</Text>
            <Text style={styles.guestSub}>Limited access · Standard settings · No data saved</Text>
          </View>
          <TouchableOpacity style={styles.guestBtn}>
            <Text style={styles.guestBtnText}>Enable</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ProfileModal visible={showModal} onClose={() => setShowModal(false)} onSave={handleAddProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  addBtn: { backgroundColor: Colors.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 },
  addBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.textMuted, marginBottom: 12 },

  activeBanner: { borderRadius: 20, borderWidth: 1.5, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, backgroundColor: Colors.surfaceElevated },
  activeName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  activeSub: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  activeDot: { width: 12, height: 12, borderRadius: 6 },

  profileCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1.5, borderColor: Colors.border },
  profileTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatarBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, justifyContent: 'center', gap: 3 },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  activeChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  activeChipText: { fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 1 },
  profileMeta: { fontSize: 12, color: Colors.textSecondary },
  profileTrips: { fontSize: 11, color: Colors.textMuted },
  pidRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  pidChip: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  actionRow: { flexDirection: 'row', gap: 10 },
  activateBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  activateBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  deleteBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  deleteBtnText: { fontSize: 18 },

  guestCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  guestIcon: { fontSize: 32 },
  guestTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  guestSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  guestBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: Colors.border },
  guestBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
});
