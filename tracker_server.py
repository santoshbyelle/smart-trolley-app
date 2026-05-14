#!/usr/bin/env python3
# ============================================================
# Smart Trolley — Raspberry Pi Server v3.0
# Face Recognition + Tracking + Motor Control
# ============================================================
# MODIFIED: Complete rewrite of authentication system
#   - Face recognition via face_recognition library (dlib)
#   - /add-face accepts image from mobile app
#   - /start-recognition uses Pi camera for live auth
#   - Trolley moves ONLY when a recognized face is detected
#   - All old HOG SVM auth logic replaced with face_recognition
#
# Install:
#   pip3 install flask pyserial numpy opencv-python face_recognition
#
# Run:
#   python3 tracker_server.py
# ============================================================

import cv2
import serial
import time
import threading
import sys
import os
import json
import pickle
import base64
import numpy as np
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

# ─── Try importing face_recognition, fallback to OpenCV DNN ──────────────────
try:
    import face_recognition
    USE_FACE_RECOGNITION = True
    print('✅ face_recognition library loaded')
except ImportError:
    USE_FACE_RECOGNITION = False
    print('⚠️  face_recognition not found — using OpenCV Haar cascade fallback')
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )

# ─── UART to ESP32 ──────────────────────────────────────────────────────────
try:
    uart = serial.Serial('/dev/serial0', 115200, timeout=0.1)
    print('✅ UART connected to ESP32')
except Exception as e:
    print(f'⚠️  UART error: {e} — continuing without UART')
    uart = None

# ─── Camera ─────────────────────────────────────────────────────────────────
cam = cv2.VideoCapture(0)
cam.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
cam.set(cv2.CAP_PROP_FPS, 15)

if not cam.isOpened():
    print('⚠️  Camera not found — running in API-only mode')

# ─── Data Directories ───────────────────────────────────────────────────────
DATA_DIR      = '/home/pi/face_data'
ENCODINGS_DIR = os.path.join(DATA_DIR, 'encodings')
IMAGES_DIR    = os.path.join(DATA_DIR, 'images')
DB_FILE       = os.path.join(DATA_DIR, 'faces_db.json')

for d in [DATA_DIR, ENCODINGS_DIR, IMAGES_DIR]:
    os.makedirs(d, exist_ok=True)

# ─── Face Database ──────────────────────────────────────────────────────────
def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    return {'faces': []}

def save_db(db):
    with open(DB_FILE, 'w') as f:
        json.dump(db, f, indent=2)

def load_all_encodings():
    """Load all saved face encodings into memory for fast comparison."""
    known_encodings = []
    known_names = []
    known_ids = []
    db = load_db()
    for face in db['faces']:
        enc_path = os.path.join(ENCODINGS_DIR, f"{face['id']}.pkl")
        if os.path.exists(enc_path):
            with open(enc_path, 'rb') as f:
                encoding = pickle.load(f)
            known_encodings.append(encoding)
            known_names.append(face['name'])
            known_ids.append(face['id'])
    return known_encodings, known_names, known_ids

# Pre-load encodings at startup
known_encodings, known_names, known_ids = load_all_encodings()

# ─── State ──────────────────────────────────────────────────────────────────
lock = threading.Lock()
running = True

tracker_state = {
    'status': 'running',
    'authenticated': False,
    'authenticated_user': None,
    'last_command': 'STOP',
    'fps': 0,
    'follow_enabled': False,     # Only True after successful face auth
    'recognition_active': False,  # True while /start-recognition is being processed
}

# ─── Motor Commands ─────────────────────────────────────────────────────────
def send(cmd):
    with lock:
        if tracker_state['last_command'] != cmd:
            tracker_state['last_command'] = cmd
            if uart:
                try:
                    uart.write((cmd + '\n').encode())
                except Exception as e:
                    print(f'UART error: {e}')
            print(f'→ ESP32: {cmd}')

# ─── Face Recognition Helpers ───────────────────────────────────────────────
def detect_and_encode_from_image(image_bytes):
    """Detect face in image bytes, return encoding or None + error message."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None, 'Could not decode image'

        if USE_FACE_RECOGNITION:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            locations = face_recognition.face_locations(rgb)
            if len(locations) == 0:
                return None, 'No face detected in image'
            if len(locations) > 1:
                return None, f'Multiple faces detected ({len(locations)}). Please capture only one face.'
            encodings = face_recognition.face_encodings(rgb, locations)
            if len(encodings) == 0:
                return None, 'Could not extract face encoding'
            return encodings[0], None
        else:
            # OpenCV fallback — store the image itself for template matching
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(60, 60))
            if len(faces) == 0:
                return None, 'No face detected in image'
            if len(faces) > 1:
                return None, f'Multiple faces detected ({len(faces)}). Please capture only one face.'
            x, y, w, h = faces[0]
            face_crop = gray[y:y+h, x:x+w]
            face_resized = cv2.resize(face_crop, (128, 128))
            return face_resized.flatten().astype(np.float64) / 255.0, None

    except Exception as e:
        return None, f'Processing error: {str(e)}'


def recognize_from_camera():
    """Capture frame from Pi camera, attempt face recognition.
    Returns dict with recognized, person_name, confidence, error."""
    if not cam.isOpened():
        return {'recognized': False, 'person_name': None, 'confidence': 0, 'error': 'Camera not available'}

    if len(known_encodings) == 0:
        return {'recognized': False, 'person_name': None, 'confidence': 0, 'error': 'No faces registered. Add a user first.'}

    # Capture multiple frames for reliability
    best_result = {'recognized': False, 'person_name': None, 'confidence': 0, 'error': None}
    attempts = 5  # Try up to 5 frames

    for attempt in range(attempts):
        ret, frame = cam.read()
        if not ret:
            time.sleep(0.2)
            continue

        if USE_FACE_RECOGNITION:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            locations = face_recognition.face_locations(rgb)
            if len(locations) == 0:
                time.sleep(0.3)
                continue

            encodings = face_recognition.face_encodings(rgb, locations)
            if len(encodings) == 0:
                continue

            for enc in encodings:
                distances = face_recognition.face_distance(known_encodings, enc)
                if len(distances) == 0:
                    continue
                best_idx = int(np.argmin(distances))
                best_dist = distances[best_idx]
                confidence = int(max(0, min(100, (1.0 - best_dist) * 100 * 1.6)))

                if best_dist < 0.55:  # Threshold for match
                    return {
                        'recognized': True,
                        'person_name': known_names[best_idx],
                        'person_id': known_ids[best_idx],
                        'confidence': confidence,
                        'error': None,
                    }
                elif confidence > best_result['confidence']:
                    best_result = {
                        'recognized': False,
                        'person_name': known_names[best_idx],
                        'confidence': confidence,
                        'error': 'Face detected but not a close enough match',
                    }
        else:
            # OpenCV fallback — simple template-based comparison
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(60, 60))
            if len(faces) == 0:
                time.sleep(0.3)
                continue

            x, y, w, h = faces[0]
            face_crop = gray[y:y+h, x:x+w]
            face_resized = cv2.resize(face_crop, (128, 128))
            test_enc = face_resized.flatten().astype(np.float64) / 255.0

            best_match_dist = float('inf')
            best_match_idx = -1
            for i, known_enc in enumerate(known_encodings):
                dist = np.linalg.norm(test_enc - known_enc)
                if dist < best_match_dist:
                    best_match_dist = dist
                    best_match_idx = i

            confidence = int(max(0, min(100, (1.0 - best_match_dist / 2.0) * 100)))
            if best_match_dist < 0.8 and best_match_idx >= 0:
                return {
                    'recognized': True,
                    'person_name': known_names[best_match_idx],
                    'person_id': known_ids[best_match_idx],
                    'confidence': confidence,
                    'error': None,
                }

        time.sleep(0.3)

    if best_result['confidence'] == 0:
        best_result['error'] = 'No face detected. Please stand in front of the trolley camera.'

    return best_result


# ═══════════════════════════════════════════════════════════════════════════════
# FLASK API SERVER
# ═══════════════════════════════════════════════════════════════════════════════
app = Flask(__name__)
CORS(app)

# ─── Health Check (for auto-discovery by mobile app) ────────────────────────
@app.route('/ping')
def ping():
    return jsonify({
        'device': 'smarttrolley-pi',
        'status': 'ok',
        'version': '3.0.0',
        'faces_registered': len(known_encodings),
    })


# ─── Start Face Recognition ────────────────────────────────────────────────
# Called by mobile app "Authenticate User" button
# Uses PI CAMERA to scan and recognize the person standing in front
@app.route('/start-recognition', methods=['GET', 'POST'])
def start_recognition():
    global known_encodings, known_names, known_ids

    with lock:
        if tracker_state['recognition_active']:
            return jsonify({'error': 'Recognition already in progress'}), 409
        tracker_state['recognition_active'] = True

    try:
        # Reload encodings in case new faces were added
        known_encodings, known_names, known_ids = load_all_encodings()

        result = recognize_from_camera()

        with lock:
            if result['recognized']:
                tracker_state['authenticated'] = True
                tracker_state['authenticated_user'] = result['person_name']
                tracker_state['follow_enabled'] = True
                # Send FOLLOW command to ESP32
                send('FOLLOW')
            else:
                tracker_state['authenticated'] = False
                tracker_state['authenticated_user'] = None
                tracker_state['follow_enabled'] = False
                send('STOP')

        return jsonify(result)

    finally:
        with lock:
            tracker_state['recognition_active'] = False


# ─── Add New Face ──────────────────────────────────────────────────────────
# Called by mobile app "Add New User" — sends image captured from phone camera
@app.route('/add-face', methods=['POST'])
def add_face():
    global known_encodings, known_names, known_ids

    # Accept both multipart form and JSON base64
    name = None
    image_bytes = None

    if request.content_type and 'multipart' in request.content_type:
        # Form data with file upload
        name = request.form.get('name', '').strip()
        file = request.files.get('image')
        if file:
            image_bytes = file.read()
    else:
        # JSON with base64 image
        data = request.json or {}
        name = data.get('name', '').strip()
        image_b64 = data.get('image', '')
        if image_b64:
            # Strip data URI prefix if present
            if ',' in image_b64:
                image_b64 = image_b64.split(',', 1)[1]
            try:
                image_bytes = base64.b64decode(image_b64)
            except Exception:
                return jsonify({'success': False, 'error': 'Invalid base64 image data'}), 400

    if not name:
        return jsonify({'success': False, 'error': 'Name is required'}), 400
    if not image_bytes:
        return jsonify({'success': False, 'error': 'Image is required'}), 400
    if len(image_bytes) < 1000:
        return jsonify({'success': False, 'error': 'Image too small — may be corrupted'}), 400

    # Detect and encode face
    encoding, error = detect_and_encode_from_image(image_bytes)
    if error:
        return jsonify({'success': False, 'error': error}), 400

    # Generate unique ID
    face_id = name.lower().replace(' ', '_') + '_' + datetime.now().strftime('%Y%m%d%H%M%S')

    # Save encoding
    enc_path = os.path.join(ENCODINGS_DIR, f'{face_id}.pkl')
    with open(enc_path, 'wb') as f:
        pickle.dump(encoding, f)

    # Save image for reference
    img_path = os.path.join(IMAGES_DIR, f'{face_id}.jpg')
    with open(img_path, 'wb') as f:
        f.write(image_bytes)

    # Update database
    db = load_db()
    db['faces'].append({
        'id': face_id,
        'name': name,
        'date': datetime.now().strftime('%b %d, %Y %H:%M'),
        'image': f'{face_id}.jpg',
    })
    save_db(db)

    # Reload encodings into memory
    known_encodings, known_names, known_ids = load_all_encodings()

    print(f'✅ New face registered: {name} (id: {face_id})')
    return jsonify({
        'success': True,
        'face_id': face_id,
        'name': name,
        'total_faces': len(known_encodings),
    })


# ─── Get Registered Faces ──────────────────────────────────────────────────
@app.route('/faces', methods=['GET'])
def get_faces():
    db = load_db()
    return jsonify({
        'faces': db['faces'],
        'total': len(db['faces']),
    })


# ─── Remove Face ───────────────────────────────────────────────────────────
@app.route('/remove-face/<face_id>', methods=['DELETE'])
def remove_face(face_id):
    global known_encodings, known_names, known_ids

    db = load_db()
    found = False
    new_faces = []
    for face in db['faces']:
        if face['id'] == face_id:
            found = True
            # Delete files
            for path in [
                os.path.join(ENCODINGS_DIR, f'{face_id}.pkl'),
                os.path.join(IMAGES_DIR, f'{face_id}.jpg'),
            ]:
                if os.path.exists(path):
                    os.remove(path)
        else:
            new_faces.append(face)

    if not found:
        return jsonify({'success': False, 'error': 'Face not found'}), 404

    db['faces'] = new_faces
    save_db(db)

    # Reload encodings
    known_encodings, known_names, known_ids = load_all_encodings()

    # If deleted user was authenticated, reset auth
    with lock:
        if tracker_state['authenticated_user'] and face_id.startswith(tracker_state['authenticated_user'].lower().replace(' ', '_')):
            tracker_state['authenticated'] = False
            tracker_state['authenticated_user'] = None
            tracker_state['follow_enabled'] = False
            send('STOP')

    return jsonify({'success': True, 'deleted': face_id})


# ─── Auth Status ───────────────────────────────────────────────────────────
@app.route('/auth-status', methods=['GET'])
def auth_status():
    with lock:
        return jsonify({
            'authenticated': tracker_state['authenticated'],
            'user': tracker_state['authenticated_user'],
            'follow_enabled': tracker_state['follow_enabled'],
            'status': tracker_state['status'],
            'fps': tracker_state['fps'],
        })


# ─── Deauthenticate / Lock Trolley ─────────────────────────────────────────
@app.route('/deauth', methods=['POST'])
def deauth():
    with lock:
        tracker_state['authenticated'] = False
        tracker_state['authenticated_user'] = None
        tracker_state['follow_enabled'] = False
    send('STOP')
    return jsonify({'success': True, 'message': 'Trolley locked. Authentication cleared.'})


# ─── Keep old HOG endpoints alive for backward compat (optional) ───────────
@app.route('/hog/status')
def hog_status():
    with lock:
        return jsonify({
            'status': tracker_state['status'],
            'activeProfile': tracker_state.get('authenticated_user'),
            'authenticated': tracker_state['authenticated'],
            'fps': tracker_state['fps'],
        })

@app.route('/hog/profiles')
def hog_profiles():
    db = load_db()
    profiles = []
    for face in db['faces']:
        profiles.append({
            'id': face['id'],
            'name': face['name'],
            'frames': 1,
            'date': face.get('date', 'Unknown'),
            'confidence': 90,
        })
    return jsonify({'profiles': profiles})


# ═══════════════════════════════════════════════════════════════════════════════
# ESP32 LISTENER
# ═══════════════════════════════════════════════════════════════════════════════
def listen_esp32():
    while running:
        try:
            if uart and uart.in_waiting:
                msg = uart.readline().decode('utf-8', errors='ignore').strip()
                if msg == 'OBSTACLE':
                    print('■ Obstacle — stopping')
                elif msg == 'ALERT':
                    print('■ Anti-theft alert')
                elif msg:
                    print(f'ESP32: {msg}')
        except Exception:
            pass
        time.sleep(0.05)

threading.Thread(target=listen_esp32, daemon=True).start()


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN TRACKING LOOP
# Trolley moves ONLY when authenticated (follow_enabled == True)
# ═══════════════════════════════════════════════════════════════════════════════
FRAME_W     = 320
CENTER_ZONE = 60
MIN_BOX_H   = 60
MAX_BOX_H   = 180
LOOP_DELAY  = 0.1

print('='*60)
print('Smart Trolley Server v3.0')
print('Face Recognition + Tracking + Motor Control')
print('='*60)
print(f'Registered faces: {len(known_encodings)}')
print('Starting Flask API on port 5000...')

flask_thread = threading.Thread(
    target=lambda: app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False),
    daemon=True,
)
flask_thread.start()
print('✅ Flask running at http://0.0.0.0:5000')
print('Endpoints:')
print('  GET  /ping              — health check')
print('  POST /start-recognition — authenticate via Pi camera')
print('  POST /add-face          — register new face from app')
print('  GET  /faces             — list registered faces')
print('  DEL  /remove-face/<id>  — delete a face')
print('  GET  /auth-status       — current auth state')
print('  POST /deauth            — lock trolley / clear auth')
print('='*60)

# HOG descriptor for person detection during tracking
hog_detector = cv2.HOGDescriptor()
hog_detector.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

frame_count = 0
fps_timer = time.time()

try:
    while True:
        if not cam.isOpened():
            time.sleep(1)
            continue

        ret, frame = cam.read()
        if not ret:
            time.sleep(0.2)
            continue

        frame_count += 1

        # FPS calculation
        if frame_count % 30 == 0:
            elapsed = time.time() - fps_timer
            with lock:
                tracker_state['fps'] = round(30 / max(elapsed, 0.01), 1)
            fps_timer = time.time()

        # Skip tracking if recognition API is actively using the camera
        with lock:
            if tracker_state['recognition_active']:
                time.sleep(0.1)
                continue

        # ─── CRITICAL: Trolley moves ONLY when face-authenticated ───
        with lock:
            follow_ok = tracker_state['follow_enabled'] and tracker_state['authenticated']

        if not follow_ok:
            send('STOP')
            time.sleep(LOOP_DELAY)
            continue

        # Person detection for tracking
        boxes, weights = hog_detector.detectMultiScale(
            frame, winStride=(8, 8), padding=(4, 4), scale=1.05
        )

        if len(boxes) == 0:
            send('STOP')
            time.sleep(LOOP_DELAY)
            continue

        boxes_sorted = sorted(boxes, key=lambda b: b[2]*b[3], reverse=True)
        x, y, w, h = boxes_sorted[0]
        person_cx = x + w // 2
        offset = person_cx - (FRAME_W // 2)

        if h < MIN_BOX_H or h > MAX_BOX_H:
            send('STOP')
        elif offset < -CENTER_ZONE:
            send('LEFT')
        elif offset > CENTER_ZONE:
            send('RIGHT')
        else:
            send('FORWARD')

        time.sleep(LOOP_DELAY)

except KeyboardInterrupt:
    print('\nStopped by user')
finally:
    running = False
    send('STOP')
    if cam.isOpened():
        cam.release()
    if uart:
        uart.close()
    print('Server shutdown complete')
