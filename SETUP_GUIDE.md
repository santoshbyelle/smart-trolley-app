# Smart Trolley App — Setup Guide v3.0 (Face Recognition)

## Overview

The Smart Trolley now uses **face recognition** controlled entirely from the mobile app.
- **Add users** by capturing their face via the phone camera
- **Authenticate** by having the Pi camera scan the person in front of the trolley
- **Trolley moves ONLY** after a recognized face is detected

No login/signup screens. No manual authentication triggers.

---

## Architecture

```
Mobile App (Phone Camera)  ──► /add-face ──►  Raspberry Pi (stores encoding)
Mobile App (Authenticate)  ──► /start-recognition ──►  Pi Camera scans ──► returns result
Pi (recognized=true)       ──► UART FOLLOW ──►  ESP32 Motors activate
Pi (recognized=false)      ──► UART STOP   ──►  ESP32 Motors locked
```

All devices must be on the **same hotspot/network**.

---

## Quick Start

### 1. Raspberry Pi Setup
```bash
pip3 install flask flask-cors pyserial numpy opencv-python face_recognition
mkdir -p /home/pi/face_data/encodings /home/pi/face_data/images
python3 tracker_server.py
```

### 2. Connect all devices to same hotspot

### 3. Launch Mobile App
```bash
npm install && npx expo start
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /ping | Health check for auto-discovery |
| POST | /start-recognition | Pi camera scans and recognizes face |
| POST | /add-face | Register new face (image + name) |
| GET | /faces | List registered faces |
| DELETE | /remove-face/id | Remove a face |
| GET | /auth-status | Current auth state |
| POST | /deauth | Lock trolley |

---

## Files Changed

| File | Status |
|------|--------|
| tracker_server.py | NEW — Pi backend with face recognition |
| tracker_hog_v2.py | DELETED — replaced |
| src/screens/FaceAuthScreen.js | NEW — auth + add user UI |
| src/screens/HOGAuthScreen.js | DELETED — replaced |
| src/api/trolleyApi.js | MODIFIED — face recognition APIs |
| src/navigation/AppNavigator.js | MODIFIED — FaceAuth route |
| src/screens/ConnectScreen.js | MODIFIED — auto-discovery |
| src/screens/DashboardScreen.js | MODIFIED — Face Auth quick action |
| src/screens/SettingsScreen.js | MODIFIED — Face Auth in features |
