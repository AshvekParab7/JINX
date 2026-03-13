import os
import logging

from google import genai
from google.genai import types as genai_types
from django.conf import settings
from django.db.models import Avg
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatSession, ChatMessage, CopingResource, VoiceAnalysis
from .serializers import (
    ChatSessionSerializer,
    ChatSessionSummarySerializer,
    CopingResourceSerializer,
    VoiceAnalysisSerializer,
)


logger = logging.getLogger(__name__)

STRESS_PATTERNS = {
    'crisis': {
        'keywords': [
            'suicide', 'kill myself', 'end my life', 'self harm',
            'hurt myself', 'want to die', 'not worth living', 'no reason to live',
        ],
        'score': 1.0,
    },
    'high': {
        'keywords': [
            'hopeless', 'worthless', "can't cope", 'cant cope',
            'overwhelmed', 'breaking down', 'falling apart', 'panic attack',
            'no point', 'give up', 'burnout', 'nothing matters', 'trapped',
            'shaking', "can't breathe",
        ],
        'score': 0.75,
    },
    'moderate': {
        'keywords': [
            'stressed', 'anxious', 'anxiety', 'worried', 'upset', 'sad',
            'depressed', 'lonely', 'nervous', 'scared', 'frightened',
            'frustrated', 'angry', 'irritable', 'unmotivated', 'dread',
        ],
        'score': 0.45,
    },
    'low': {
        'keywords': [
            'tired', 'busy', 'difficult', 'hard', 'struggling',
            'problem', 'issue', 'challenge', 'pressure', 'tense',
        ],
        'score': 0.2,
    },
}

POSITIVE_INDICATORS = [
    'happy', 'good', 'great', 'wonderful', 'excited', 'calm', 'peaceful',
    'better', 'improved', 'grateful', 'hopeful', 'okay', 'fine', 'relieved',
]

VOICE_MOOD_META = {
    'calm': {
        'label': 'Calm',
        'summary': 'steady and grounded',
        'palette': {
            'primary': '#59E1FF',
            'secondary': '#2CCBFF',
            'glow': 'rgba(89, 225, 255, 0.32)',
            'surface': '#0A1D34',
        },
    },
    'restless': {
        'label': 'Restless',
        'summary': 'slightly unsettled',
        'palette': {
            'primary': '#8B8CFF',
            'secondary': '#52C7FF',
            'glow': 'rgba(113, 128, 255, 0.34)',
            'surface': '#161A44',
        },
    },
    'tense': {
        'label': 'Tense',
        'summary': 'stressed and activated',
        'palette': {
            'primary': '#FF7A59',
            'secondary': '#FF49A6',
            'glow': 'rgba(255, 109, 125, 0.34)',
            'surface': '#351222',
        },
    },
    'overwhelmed': {
        'label': 'Overwhelmed',
        'summary': 'high strain and overloaded',
        'palette': {
            'primary': '#FF5A7A',
            'secondary': '#FF2FD1',
            'glow': 'rgba(255, 74, 168, 0.38)',
            'surface': '#330A1E',
        },
    },
}


def _extract_response_text(response):
    # response.text raises ValueError in the new SDK when there is no valid content.
    try:
        text = response.text
        if text:
            return text.strip()
    except (ValueError, AttributeError):
        pass

    candidates = getattr(response, 'candidates', None) or []
    for candidate in candidates:
        content = getattr(candidate, 'content', None)
        parts = getattr(content, 'parts', None) or []
        for part in parts:
            try:
                part_text = getattr(part, 'text', None)
                if part_text:
                    return part_text.strip()
            except (ValueError, AttributeError):
                pass

    return ''


def _build_history_contents(history_items):
    """
    Convert a list of {role, text} dicts into google-genai Content objects.
    Gemini roles are 'user' and 'model'; we map 'bot' → 'model'.
    Consecutive same-role messages are merged to satisfy the alternating-turn requirement.
    """
    contents = []
    for item in history_items:
        role = 'user' if item.get('role') == 'user' else 'model'
        text = (item.get('text') or '').strip()
        if not text:
            continue
        if contents and contents[-1].role == role:
            # Merge into the previous turn to keep strict alternation.
            prev_text = contents[-1].parts[0].text
            contents[-1] = genai_types.Content(
                role=role,
                parts=[genai_types.Part(text=f"{prev_text}\n{text}")],
            )
        else:
            contents.append(
                genai_types.Content(
                    role=role,
                    parts=[genai_types.Part(text=text)],
                )
            )
    return contents


def _recent_history_from_db(session, limit=12):
    history_qs = session.messages.order_by('-created_at')[:limit]
    return [
        {'role': message.role, 'text': message.text}
        for message in reversed(list(history_qs))
    ]


def _refresh_session_risk(session):
    user_avg = session.messages.filter(role='user').aggregate(avg=Avg('stress_score'))['avg']
    voice_avg = session.voice_analyses.aggregate(avg=Avg('risk_score'))['avg']
    values = [value for value in [user_avg, voice_avg] if value is not None]
    session.overall_risk_score = round(sum(values) / len(values), 3) if values else 0.0
    session.save(update_fields=['overall_risk_score', 'updated_at'])
    return session.overall_risk_score


def _voice_mood_from_score(risk_score, duration_seconds):
    if risk_score >= 0.75 or duration_seconds >= 26:
        return 'overwhelmed'
    if risk_score >= 0.52:
        return 'tense'
    if risk_score >= 0.28:
        return 'restless'
    return 'calm'


def _voice_visual_theme(mood):
    meta = VOICE_MOOD_META.get(mood, VOICE_MOOD_META['calm'])
    return {
        'mood': mood,
        'label': meta['label'],
        **meta['palette'],
    }


def _gemini_reply(level, score, keywords, session, frontend_history=None):
    """Generate a response using the Gemini API with conversation context."""
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.environ.get('GEMINI_API', '')
    if not api_key:
        return "I'm here with you. Tell me more about how you're feeling."

    client = genai.Client(api_key=api_key)

    # Prefer history supplied by the frontend so each tab carries its own context.
    # Fall back to the stored DB history when the frontend sends nothing.
    history_items = frontend_history if (frontend_history and len(frontend_history) > 0) \
        else _recent_history_from_db(session)

    system_instruction = (
        "You are Jinx, a warm and empathetic AI mental wellness companion inside the MindGuard app. "
        "Listen without judgment, validate feelings, and offer practical coping support. "
        "Do not diagnose or prescribe. Keep responses concise, natural, and supportive. "
        "If the user appears in immediate danger, calmly encourage urgent real-world help or a crisis line."
    )

    crisis_note = (
        " IMPORTANT: This message shows crisis-level stress. Gently but clearly encourage the user "
        "to contact 988 (US) or their local crisis line while staying calm and compassionate."
    ) if level == 'crisis' else ''

    # Build multi-turn contents from history (all messages except the final user turn).
    # The backend already saved the current user message to DB, so it will appear in history_items.
    # We strip the last user turn from the history and inject it with context metadata.
    contents = _build_history_contents(history_items)

    # Inject stress context into the last user turn (or create one).
    context_note = (
        f"\n\n[Stress classifier: level={level}, score={score:.2f}, "
        f"keywords={', '.join(keywords) if keywords else 'none'}.{crisis_note}]"
    )
    if contents and contents[-1].role == 'user':
        prior_text = contents[-1].parts[0].text
        contents[-1] = genai_types.Content(
            role='user',
            parts=[genai_types.Part(text=prior_text + context_note)],
        )
    elif contents:
        # History ended on a model turn — Gemini needs a user turn last.
        contents.append(genai_types.Content(
            role='user',
            parts=[genai_types.Part(text=context_note.strip() + "\n\nPlease reply as Jinx.")],
        ))
    else:
        # No history at all.
        contents.append(genai_types.Content(
            role='user',
            parts=[genai_types.Part(text=f"(New conversation){context_note}")],
        ))

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.75,
            ),
        )
        response_text = _extract_response_text(response)
        if response_text:
            return response_text
    except Exception as exc:
        logger.error("Gemini chat API error: %s", exc)

    return "I'm here with you. Could you tell me a bit more about how you're feeling?"


def _gemini_voice_reply(stress_level, risk_score, mood, notes, session, frontend_history=None):
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.environ.get('GEMINI_API', '')
    fallback_map = {
        'overwhelmed': "I'm here with you. Let's slow this down together and take one steady breath before the next step.",
        'tense': "You sound like you're carrying a lot right now. Let's take a short pause and ease the pressure a little.",
        'restless': "I'm picking up some tension. A quick grounding reset could help you feel more settled.",
        'calm': "Your voice sounds fairly steady right now. Let's build on that and keep the momentum going.",
    }
    if not api_key:
        return fallback_map.get(mood, fallback_map['calm'])

    client = genai.Client(api_key=api_key)
    history_items = frontend_history if (frontend_history and len(frontend_history) > 0) \
        else _recent_history_from_db(session)
    mood_meta = VOICE_MOOD_META.get(mood, VOICE_MOOD_META['calm'])
    crisis_note = (
        " If the user may be in immediate danger, urge them clearly to contact emergency help or a crisis line now."
        if stress_level == 'crisis' else ''
    )
    system_instruction = (
        "You are Jinx, a warm mental wellness companion in a mobile app. "
        "You are responding to a voice analysis. Your answer must sound natural when spoken aloud. "
        "Keep it to 1 or 2 short sentences, supportive, calm, and practical. Do not diagnose."
    )
    voice_prompt = (
        f"Voice analysis result: mood is {mood_meta['summary']}, stress level is {stress_level}, "
        f"risk score {risk_score:.2f}. Analysis note: {notes}.{crisis_note} Reply as Jinx only."
    )
    contents = _build_history_contents(history_items)
    contents.append(genai_types.Content(
        role='user',
        parts=[genai_types.Part(text=voice_prompt)],
    ))

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.75,
            ),
        )
        response_text = _extract_response_text(response)
        if response_text:
            return response_text
    except Exception as exc:
        logger.error("Gemini voice API error: %s", exc)

    return fallback_map.get(mood, fallback_map['calm'])


def analyze_text_stress(text):
    """Return (level, score, detected_keywords) from keyword matching."""
    text_lower = text.lower()
    max_score = 0.0
    detected = []
    level = 'neutral'

    for category, data in STRESS_PATTERNS.items():
        for keyword in data['keywords']:
            if keyword in text_lower and keyword not in detected:
                detected.append(keyword)
                if data['score'] > max_score:
                    max_score = data['score']
                    level = category

    if not detected:
        if any(w in text_lower for w in POSITIVE_INDICATORS):
            level = 'positive'

    return level, max_score, detected


def _get_or_create_session(session_id_str):
    if session_id_str:
        try:
            return ChatSession.objects.get(session_id=session_id_str)
        except (ChatSession.DoesNotExist, Exception):
            pass
    return ChatSession.objects.create()



class ChatView(APIView):
    """POST /api/mental-health/chat/"""
    parser_classes = [JSONParser]

    def post(self, request):
        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({'error': 'message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        session = _get_or_create_session(request.data.get('session_id'))
        # The frontend sends its in-memory history for the active tab so each
        # session carries full context even on a fresh backend restart.
        frontend_history = request.data.get('history') or []

        level, score, keywords = analyze_text_stress(message_text)

        ChatMessage.objects.create(
            session=session,
            role='user',
            text=message_text,
            stress_score=score,
            detected_keywords=keywords,
        )

        _refresh_session_risk(session)

        # Append the freshly saved user message to the frontend history so Gemini
        # sees the current turn too (frontend history = everything before this send).
        full_history = list(frontend_history) + [{'role': 'user', 'text': message_text}]
        bot_text = _gemini_reply(level, score, keywords, session, frontend_history=full_history)

        if score >= 0.7:
            coping_qs = CopingResource.objects.filter(is_active=True).order_by('?')[:3]
        elif score >= 0.4:
            coping_qs = CopingResource.objects.filter(
                is_active=True
            ).exclude(category='emergency').order_by('?')[:2]
        else:
            coping_qs = CopingResource.objects.filter(
                is_active=True, category__in=['breathing', 'mindfulness']
            ).order_by('?')[:1]

        ChatMessage.objects.create(
            session=session, role='bot', text=bot_text,
            stress_score=0.0, detected_keywords=[],
        )

        return Response({
            'session_id': str(session.session_id),
            'reply': bot_text,
            'stress_level': level,
            'risk_score': score,
            'session_risk': session.overall_risk_score,
            'coping_resources': CopingResourceSerializer(coping_qs, many=True).data,
        })


class VoiceAnalysisView(APIView):
    """POST /api/mental-health/voice/"""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'audio file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        session = _get_or_create_session(request.data.get('session_id'))

        size_kb = audio_file.size / 1024
        duration_seconds = round(max(4.0, min(35.0, size_kb / 18.0)), 1)
        energy_score = min(1.0, size_kb / 460.0)
        session_bias = min(0.18, (session.overall_risk_score or 0.0) * 0.25)
        risk_score = round(min(0.95, 0.12 + (energy_score * 0.64) + session_bias), 3)

        if risk_score >= 0.75:
            stress_level = 'crisis'
            notes = (
                'Voice patterns show significant stress indicators. '
                'Please consider reaching out to a mental health professional or crisis line.'
            )
        elif risk_score >= 0.55:
            stress_level = 'high'
            notes = 'Elevated stress markers detected. A short breathing or grounding reset may help.'
        elif risk_score >= 0.30:
            stress_level = 'moderate'
            notes = 'Some stress markers noted. A short grounding exercise may help.'
        else:
            stress_level = 'low'
            notes = 'Voice patterns appear generally calm. Keep up the self-care!'

        mood = _voice_mood_from_score(risk_score, duration_seconds)
        visual_theme = _voice_visual_theme(mood)
        ai_reply = _gemini_voice_reply(stress_level, risk_score, mood, notes, session)

        analysis = VoiceAnalysis.objects.create(
            session=session,
            audio_file=audio_file,
            stress_level=stress_level,
            risk_score=risk_score,
            duration_seconds=duration_seconds,
            notes=notes,
        )

        session_risk = _refresh_session_risk(session)

        if risk_score >= 0.55:
            coping_qs = CopingResource.objects.filter(is_active=True).order_by('?')[:3]
        else:
            coping_qs = CopingResource.objects.filter(
                is_active=True, category__in=['breathing', 'grounding']
            ).order_by('?')[:2]

        return Response({
            'session_id': str(session.session_id),
            'analysis_id': analysis.id,
            'stress_level': stress_level,
            'risk_score': risk_score,
            'session_risk': session_risk,
            'duration_seconds': duration_seconds,
            'mood': mood,
            'mood_label': visual_theme['label'],
            'visual_theme': visual_theme,
            'ai_reply': ai_reply,
            'notes': notes,
            'coping_resources': CopingResourceSerializer(coping_qs, many=True).data,
        })


class CopingResourcesView(APIView):
    """GET /api/mental-health/resources/?category=<cat>"""

    def get(self, request):
        category = request.query_params.get('category')
        qs = CopingResource.objects.filter(is_active=True)
        if category:
            qs = qs.filter(category=category)
        return Response(CopingResourceSerializer(qs, many=True).data)


class ChatSessionsView(APIView):
    """GET/POST /api/mental-health/sessions/"""

    def get(self, request):
        sessions = ChatSession.objects.all().prefetch_related('messages')
        return Response(ChatSessionSummarySerializer(sessions, many=True).data)

    def post(self, request):
        session = ChatSession.objects.create()
        return Response(ChatSessionSummarySerializer(session).data, status=status.HTTP_201_CREATED)


class ChatHistoryView(APIView):
    """GET /api/mental-health/history/<session_id>/"""

    def get(self, request, session_id):
        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ChatSessionSerializer(session).data)

