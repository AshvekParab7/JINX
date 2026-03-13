# MindGuard - Running on Local Network (Hotspot)

To run the app with your laptop as the backend and mobile phone as the client on a hotspot:

## 1. Laptop Setup (Backend)

1.  Connect your laptop to the mobile hotspot.
2.  Open a terminal in VS Code.
3.  Navigate to the backend project:
    ```bash
    cd backend/backend_project
    ```
4.  Run the server to listen on all interfaces:
    ```bash
    python manage.py runserver 0.0.0.0:8000
    ```
    *(Note: The server must be running for the app to work)*

## 2. Mobile Setup (Frontend)

1.  Open a **new** terminal in VS Code (keep the backend running in the first one).
2.  Navigate to the app folder:
    ```bash
    cd mindguard
    ```
3.  Start the Expo development server:
    ```bash
    npx expo start --clear
    ```
4.  Use your Android phone (connected to the same hotspot) to scan the QR code using the **Expo Go** app.

## 3. Login Credentials

Use the following admin account to log in:

-   **Username:** `admin`
-   **Password:** `admin123`

## Troubleshooting

-   **"Network Error"**: Make sure your phone and laptop are on the same WiFi/Hotspot.
-   **IP Address Changes**: If you reconnect to the hotspot, your laptop's IP address (`10.55.184.35`) might change. 
    -   Run `ipconfig` in the terminal to find the new `IPv4 Address`.
    -   Update `mindguard/src/components/services/api.js` with the new IP if necessary.
