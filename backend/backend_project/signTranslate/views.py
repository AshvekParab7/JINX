import base64
import numpy as np
import cv2
import mediapipe as mp
import tensorflow as tf
from rest_framework.decorators import api_view
from rest_framework.response import Response

# Initialize these ONCE outside the view for performance
model = tf.keras.models.load_model('sign_model.h5')
LABELS = list('ABCDEFGHIJKLMNOPQRSTUVWXYZ')

mp_hands = mp.solutions.hands
# Using a context manager or static instance
hands_detector = mp_hands.Hands(
    static_image_mode=True, 
    max_num_hands=1, 
    min_detection_confidence=0.5
)

@api_view(['POST'])
def predict(request):
    try:
        # 1. Get raw string
        header_data = request.data.get('image')
        if not header_data:
            return Response({'error': 'No image data provided'}, status=400)

        # 2. Strip the 'data:image/jpeg;base64,' prefix if it exists
        if ',' in header_data:
            header_data = header_data.split(',')[1]

        # 3. Decode to CV2 image
        img_bytes = base64.b64decode(header_data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return Response({'error': 'Failed to decode image'}, status=400)

        # 4. MediaPipe Processing
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands_detector.process(rgb_frame)

        if results.multi_hand_landmarks:
            landmarks = []
            # Assuming your model was trained on 21 landmarks (x, y, z)
            for lm in results.multi_hand_landmarks[0].landmark:
                landmarks.extend([lm.x, lm.y, lm.z])

            # 5. Reshape and Predict
            input_data = np.array([landmarks], dtype=np.float32)
            prediction = model.predict(input_data, verbose=0) # verbose=0 keeps logs clean
            
            idx = np.argmax(prediction)
            label = LABELS[idx]
            confidence = float(np.max(prediction))

            return Response({
                'prediction': label,
                'confidence': confidence
            })

        return Response({'prediction': None, 'confidence': 0})

    except Exception as e:
        return Response({'error': str(e)}, status=500)