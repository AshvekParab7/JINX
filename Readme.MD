# MindGuard

MindGuard is a mobile health companion with a Django backend and an Expo React Native app. The current repository supports mental health assistance, health image analysis, fall event logging, and user authentication.

## Repository Layout

- `backend/backend_project/`: Django project and API apps
- `mindguard/`: Expo mobile application

## Current Backend APIs

The Django project exposes these API groups:

- `api/users/`: user registration, login, and profile
- `api/mental-health/`: chat, voice analysis, coping resources, and session history
- `api/health-detect/`: image-based health detection endpoints
- `api/fall-detect/`: fall incident logging and related monitoring endpoints

The backend currently uses SQLite at `backend/backend_project/db.sqlite3`.

## Current Mobile App Areas

The Expo app currently contains screens for:

- authentication
- dashboard and alerts
- mental health chat and voice support
- health detection and reporting
- fall detection
- accessibility tools

## Models Used In This Project

### Mental health chat

- Model: Google Gemini `gemini-2.0-flash`
- Used for: generating chatbot replies and spoken-style mental health voice replies
- Backend file: `backend/backend_project/mental_health/views.py`

### Voice analysis

- Model used for reply generation: Google Gemini `gemini-2.0-flash`
- Stress analysis method: heuristic scoring, not a dedicated voice emotion model
- How it works now: the backend estimates stress and mood from simple audio-derived signals such as upload size and duration, then uses Gemini to generate the response text
- Backend file: `backend/backend_project/mental_health/views.py`

### Health image analysis

- Model type: TensorFlow / Keras `.h5` classifier
- Primary model file: `backend/backend_project/model(1).h5`
- Optional model paths checked by the backend: `health_model.h5` in the project root or parent folder
- Fallback: if no compatible TensorFlow model loads, the backend uses image screening rules based on color, contrast, and lesion-like patterns
- Backend file: `backend/backend_project/health_detect/views.py`

### Sign language translation

- Model type: TensorFlow / Keras `.h5` classifier
- Model file: `backend/backend_project/sign_model.h5`
- Input pipeline: MediaPipe hand landmarks are extracted first, then passed into the TensorFlow model for alphabet prediction
- Backend file: `backend/backend_project/signTranslate/views.py`

### Fall detection

- Model used: none in the current backend
- How it works now: fall events and activity snapshots are logged from client-provided sensor data and confidence values
- Backend file: `backend/backend_project/fall_detection/views.py`

## Environment Variables

### Backend

Create `backend/backend_project/.env` with:

```env
GEMINI_API=your_google_ai_studio_api_key
```

This key is used by the mental health backend features.

### Mobile App

Set the Expo API base URL before starting the app:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:8000/api
```

Use your machine's local network IP when testing on a phone. Example:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8000/api
```

## Running The Project

### 1. Start the Django backend

From the repo root, activate your Python environment, then run:

```bash
cd backend/backend_project
python manage.py runserver 0.0.0.0:8000
```

### 2. Start the Expo app

In a separate terminal:

```bash
cd mindguard
npm install
npx expo start
```

If Metro has stale cache issues, use:

```bash
npx expo start -c
```

## Notes

- This README documents only the parts that exist in the current workspace.
- There is no ESP32 or Arduino source file in this repository.
- There is no committed `requirements.txt` in the backend folder, so backend dependencies must come from your existing Python environment.
