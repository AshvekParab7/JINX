from django.core.management.base import BaseCommand

from mental_health.models import CopingResource

RESOURCES = [
    {
        'title': '4-7-8 Breathing',
        'description': 'A calming technique that activates the parasympathetic nervous system to reduce anxiety quickly.',
        'category': 'breathing',
        'steps': [
            'Sit comfortably and close your eyes.',
            'Inhale through your nose for 4 counts.',
            'Hold your breath for 7 counts.',
            'Exhale slowly through your mouth for 8 counts.',
            'Repeat 3–4 times.',
        ],
        'duration_minutes': 3,
        'min_risk_score': 0.0,
        'is_active': True,
    },
    {
        'title': 'Box Breathing',
        'description': 'Used by Navy SEALs to stay calm under pressure. Equalises all four breath phases.',
        'category': 'breathing',
        'steps': [
            'Breathe in for 4 counts.',
            'Hold for 4 counts.',
            'Breathe out for 4 counts.',
            'Hold for 4 counts.',
            'Repeat 4–6 cycles.',
        ],
        'duration_minutes': 4,
        'min_risk_score': 0.0,
        'is_active': True,
    },
    {
        'title': '5-4-3-2-1 Grounding',
        'description': 'Anchor yourself in the present by engaging all five senses. Great for anxiety and panic.',
        'category': 'grounding',
        'steps': [
            'Name 5 things you can see.',
            'Touch 4 things and notice their texture.',
            'Listen for 3 sounds around you.',
            'Identify 2 things you can smell.',
            'Notice 1 thing you can taste.',
        ],
        'duration_minutes': 5,
        'min_risk_score': 0.0,
        'is_active': True,
    },
    {
        'title': 'Progressive Muscle Relaxation',
        'description': 'Systematically tense and release muscle groups to dissolve physical stress.',
        'category': 'activity',
        'steps': [
            'Sit or lie in a comfortable position.',
            'Tense your feet muscles for 5 seconds.',
            'Release and feel the relaxation for 30 seconds.',
            'Move up through calves, thighs, abdomen, hands, arms, shoulders, and face.',
            'End with 3 slow deep breaths.',
        ],
        'duration_minutes': 10,
        'min_risk_score': 0.3,
        'is_active': True,
    },
    {
        'title': '10-Minute Mindful Walk',
        'description': 'A short outdoor walk with deliberate sensory awareness to reset your nervous system.',
        'category': 'activity',
        'steps': [
            'Step outside or find a quiet space.',
            'Walk at a slow, deliberate pace.',
            'Focus on the sensation of each footstep.',
            'Notice 3 things in your environment.',
            'Match your breath rhythm to your steps.',
        ],
        'duration_minutes': 10,
        'min_risk_score': 0.1,
        'is_active': True,
    },
    {
        'title': 'Mindful Body Scan',
        'description': 'Bring gentle awareness to every part of your body to locate and release hidden tension.',
        'category': 'mindfulness',
        'steps': [
            'Lie down or sit comfortably.',
            'Close your eyes and take 3 deep breaths.',
            'Slowly direct attention from your feet upward.',
            'Notice any tension without judgement.',
            'Breathe into tight areas and let them soften.',
        ],
        'duration_minutes': 10,
        'min_risk_score': 0.0,
        'is_active': True,
    },
    {
        'title': 'Thought Reframing',
        'description': 'Challenge negative automatic thoughts and replace them with balanced, realistic perspectives.',
        'category': 'cognitive',
        'steps': [
            'Write down the stressful thought.',
            'Ask: Is this thought 100% true?',
            'What evidence supports or contradicts it?',
            'Write a more balanced version of the thought.',
            'Notice how you feel after reframing.',
        ],
        'duration_minutes': 7,
        'min_risk_score': 0.2,
        'is_active': True,
    },
    {
        'title': 'Crisis Support Contacts',
        'description': 'Immediate resources for when you need real human support right now.',
        'category': 'emergency',
        'steps': [
            'US Suicide & Crisis Lifeline: Call or text 988',
            'Crisis Text Line: Text HOME to 741741',
            'International resources: https://www.iasp.info/resources/Crisis_Centres/',
            'Emergency Services: 911 (US) or your local emergency number',
        ],
        'duration_minutes': 1,
        'min_risk_score': 0.7,
        'is_active': True,
    },
]


class Command(BaseCommand):
    help = 'Seed the database with default coping resources'

    def handle(self, *args, **kwargs):
        created = 0
        for data in RESOURCES:
            _, was_created = CopingResource.objects.get_or_create(
                title=data['title'],
                defaults=data,
            )
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f'Seeded {created} coping resources ({len(RESOURCES) - created} already existed).'))
