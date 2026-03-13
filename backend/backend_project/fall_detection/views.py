import os
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from twilio.rest import Client
from .models import ActivitySnapshot, FallEvent

@api_view(['GET', 'POST'])
def log_fall_event(request):
    
    # 1. APP POLLING (GET) - Returns True if the last entry is 'Critical'
    if request.method == 'GET':
        latest_incident = FallEvent.objects.order_by('-created_at').first()
        if latest_incident:
            return Response({
                'alert': latest_incident.severity == 'Critical',
                'timestamp': latest_incident.created_at
            })
        return Response({'alert': False})

    # 2. ESP32 DATA (POST)
    payload = request.data or {}
    incident = FallEvent.objects.create(
        activity=payload.get('activity', ''),
        auto_alert_triggered=payload.get('auto_alert_triggered', False),
        confidence=payload.get('confidence', 0) or 0,
        contact_number=payload.get('contact_number', ''),
        mode=payload.get('mode', 'simulated'),
        notes=payload.get('notes', ''),
        sensor_payload=payload.get('sensor_payload', {}),
        severity=payload.get('severity', 'Normal'),
        source=payload.get('source', 'mobile'),
    )

    sms_status = "Not triggered"

    # 3. TWILIO SMS LOGIC
    if incident.auto_alert_triggered or incident.severity == 'Critical':
        # Using environment variables for sensitive data
        TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
        TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
        TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
        target_number = os.environ.get('TARGET_PHONE_NUMBER', '+919518786952')

        try:
            if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
                raise ValueError("Missing Twilio configuration")

            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                body=f"🚨 MINDGUARD EMERGENCY: A {incident.severity} fall was detected! Check on the user immediately.",
                from_=TWILIO_PHONE_NUMBER,
                to=target_number
            )
            sms_status = f"SMS Sent Successfully (SID: {message.sid})"
            print(f"✅ TWILIO SUCCESS: SMS sent to {target_number}")
        except Exception as e:
            sms_status = f"SMS Failed: {str(e)}"
            print(f"❌ TWILIO ERROR: {e}")

    return Response(
        {
            'id': incident.id,
            'message': 'Fall incident logged successfully.',
            'sms_status': sms_status,
            'timestamp': incident.created_at,
        },
        status=status.HTTP_201_CREATED,
    )

@api_view(['POST'])
def log_activity_snapshot(request):
    payload = request.data or {}
    snapshot = ActivitySnapshot.objects.create(
        activity=payload.get('activity', 'Resting'),
        confidence=payload.get('confidence', 0) or 0,
        mode=payload.get('mode', 'simulated'),
        sensor_payload=payload.get('sensor_payload', {}),
        source=payload.get('source', 'mobile'),
    )

    return Response(
        {
            'id': snapshot.id,
            'message': 'Activity snapshot logged successfully.',
            'timestamp': snapshot.created_at,
        },
        status=status.HTTP_201_CREATED,
    )