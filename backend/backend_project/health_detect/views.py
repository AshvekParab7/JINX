import json
import os
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response


MODEL = None
MODEL_LOAD_ATTEMPTED = False
MODEL_METADATA = {}

DEFAULT_MODEL_LABELS = [
    'healthy_skin',
    'dermatitis',
    'fungal_infection',
    'pigmentation_irregularity',
    'diabetic_retinopathy_warning',
    'acne_inflammation',
]

CONDITION_DETAILS = {
    'healthy_skin': {
        'condition': 'No Strong Skin Red Flags',
        'scan_type': 'skin',
        'advice': 'Keep the area clean, take another photo in good lighting if symptoms change, and seek care if pain, swelling, or discharge appears.',
        'summary': 'The image does not show a strong irritation or infection-like pattern in this early screening pass.',
    },
    'dermatitis': {
        'condition': 'Possible Skin Irritation / Dermatitis',
        'scan_type': 'skin',
        'advice': 'Avoid harsh soaps, fragrances, and friction on the area. If redness spreads or becomes painful, consult a clinician.',
        'summary': 'The photo shows a red, inflamed pattern consistent with irritation-type skin changes.',
    },
    'fungal_infection': {
        'condition': 'Possible Fungal-Type Skin Pattern',
        'scan_type': 'skin',
        'advice': 'Keep the area dry, avoid occlusive clothing, and consider medical review if scaling, itching, or ring-shaped spread continues.',
        'summary': 'The image shows uneven color and texture patterns that can appear in fungal-type skin presentations.',
    },
    'pigmentation_irregularity': {
        'condition': 'Possible Pigmentation / Lesion Pattern',
        'scan_type': 'skin',
        'advice': 'Track size, color, and border changes over time. Seek clinical evaluation if the area is new, changing, or bleeding.',
        'summary': 'The image contains darker clustered regions that merit follow-up if the pattern is persistent or changing.',
    },
    'diabetic_retinopathy_warning': {
        'condition': 'Possible Diabetic Retinopathy Markers',
        'scan_type': 'retina',
        'advice': 'Use this only as an early warning. A retinal photo with this pattern should be reviewed by an eye specialist, especially if vision changes are present.',
        'summary': 'The retinal-style image shows contrast and dark lesion-like regions that can align with diabetic retinopathy warning signals.',
    },
    'retina_clear': {
        'condition': 'No Obvious Retinal Red Flags',
        'scan_type': 'retina',
        'advice': 'Continue routine eye screening, especially if you have diabetes or blurred vision.',
        'summary': 'The retinal-style image does not show a strong abnormality signal in this screening pass.',
    },
    'acne_inflammation': {
        'condition': 'Possible Acne / Follicular Inflammation',
        'scan_type': 'skin',
        'advice': 'Avoid picking the area, use gentle cleansing, and seek care if nodules, drainage, or fever occur.',
        'summary': 'The image shows a localized inflamed skin pattern that can align with acne-type or follicular irritation.',
    },
}


def _candidate_model_paths():
    configured_path = os.environ.get('HEALTH_MODEL_PATH')
    paths = []

    if configured_path:
        paths.append(Path(configured_path))

    paths.extend(
        [
            Path(settings.BASE_DIR) / 'model(1).h5',
            Path(settings.BASE_DIR) / 'health_model.h5',
            Path(settings.BASE_DIR).parent / 'health_model.h5',
        ]
    )

    unique_paths = []
    seen = set()
    for path in paths:
        resolved = str(path)
        if resolved not in seen:
            unique_paths.append(path)
            seen.add(resolved)
    return unique_paths


def _load_labels_for_model(model_path, output_size):
    env_labels = os.environ.get('HEALTH_MODEL_LABELS', '').strip()
    if env_labels:
        labels = [item.strip() for item in env_labels.split(',') if item.strip()]
        if len(labels) == output_size:
            return labels

    sidecar_paths = [
        model_path.with_suffix('.labels.json'),
        model_path.with_suffix('.json'),
        model_path.parent / 'health_model_labels.json',
    ]

    for sidecar_path in sidecar_paths:
        if not sidecar_path.exists():
            continue

        try:
            with sidecar_path.open('r', encoding='utf-8') as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            continue

        if isinstance(payload, dict):
            payload = payload.get('labels', [])

        if isinstance(payload, list):
            labels = [str(item).strip() for item in payload if str(item).strip()]
            if len(labels) == output_size:
                return labels

    if output_size <= len(DEFAULT_MODEL_LABELS):
        return DEFAULT_MODEL_LABELS[:output_size]

    return [f'class_{index}' for index in range(output_size)]


def _get_model_components():
    global MODEL, MODEL_LOAD_ATTEMPTED, MODEL_METADATA

    if MODEL_LOAD_ATTEMPTED:
        return MODEL, MODEL_METADATA

    MODEL_LOAD_ATTEMPTED = True
    MODEL_METADATA = {
        'available': False,
        'source': 'screening_rules',
        'reason': 'No compatible health model loaded.',
    }

    try:
        import numpy as np
        import tensorflow as tf
    except ModuleNotFoundError as error:
        MODEL_METADATA['reason'] = f'Model runtime unavailable: {error.name}'
        return None, MODEL_METADATA

    for model_path in _candidate_model_paths():
        if not model_path.exists():
            continue

        try:
            candidate_model = tf.keras.models.load_model(model_path)
            output_shape = getattr(candidate_model, 'output_shape', None)
            output_size = output_shape[-1] if output_shape else None
            labels = _load_labels_for_model(model_path, output_size or 0) if output_size else []

            MODEL = candidate_model
            MODEL_METADATA = {
                'available': True,
                'source': 'backend_model',
                'path': str(model_path),
                'labels': labels,
                'numpy': np,
            }
            return MODEL, MODEL_METADATA
        except Exception as error:
            MODEL_METADATA = {
                'available': False,
                'source': 'screening_rules',
                'reason': f'Failed to load {model_path.name}: {error}',
            }

    return None, MODEL_METADATA


def _normalize_uploaded_image(uploaded_file):
    from PIL import Image

    uploaded_file.seek(0)
    image = Image.open(uploaded_file)
    image.load()
    return image.convert('RGB')


def _clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def _build_response_payload(condition_key, confidence_score, analysis_source, detected_pattern, extra=None):
    details = CONDITION_DETAILS.get(condition_key, CONDITION_DETAILS['healthy_skin'])
    payload = {
        'condition_key': condition_key,
        'condition': details['condition'],
        'scan_type': details['scan_type'],
        'confidence_score': round(confidence_score, 4),
        'confidence': f"{round(confidence_score * 100)}%",
        'advice': details['advice'],
        'summary': details['summary'],
        'detected_pattern': detected_pattern,
        'analysis_source': analysis_source,
        'limitations': 'This is an early screening aid and not a clinical diagnosis.',
    }
    if extra:
        payload.update(extra)
    return payload


def _analyze_with_model(image):
    model, metadata = _get_model_components()
    if not model or not metadata.get('available'):
        return None

    np = metadata['numpy']
    resized = image.resize((224, 224))
    image_array = np.asarray(resized, dtype='float32') / 255.0
    image_array = np.expand_dims(image_array, axis=0)

    predictions = model.predict(image_array, verbose=0)
    flat_predictions = np.asarray(predictions).reshape(-1)
    if flat_predictions.size == 0:
        return None

    top_index = int(np.argmax(flat_predictions))
    labels = metadata.get('labels') or []
    condition_key = labels[top_index] if top_index < len(labels) else f'class_{top_index}'
    confidence_score = float(flat_predictions[top_index])

    return _build_response_payload(
        condition_key=condition_key,
        confidence_score=_clamp(confidence_score),
        analysis_source='backend_model',
        detected_pattern=f'Model matched class {condition_key}.',
        extra={'model_path': metadata.get('path')},
    )


def _analyze_with_screening_rules(image):
    from PIL import ImageStat

    sample = image.resize((256, 256))
    stat = ImageStat.Stat(sample)
    mean_red, mean_green, mean_blue = stat.mean
    std_red, std_green, std_blue = stat.stddev
    pixels = list(sample.getdata())
    total_pixels = max(len(pixels), 1)

    red_hot_pixels = sum(1 for red, green, blue in pixels if red > 145 and green < 125 and blue < 125) / total_pixels
    dark_pixels = sum(1 for red, green, blue in pixels if (red + green + blue) / 3 < 70) / total_pixels
    bright_pixels = sum(1 for red, green, blue in pixels if (red + green + blue) / 3 > 185) / total_pixels
    warm_pixels = sum(1 for red, green, blue in pixels if red > green * 1.05 and green > blue * 0.95) / total_pixels
    neutral_pixels = sum(1 for red, green, blue in pixels if abs(red - green) < 18 and abs(red - blue) < 18) / total_pixels

    contrast = (std_red + std_green + std_blue) / (255 * 3)
    redness_bias = (mean_red - mean_green) / 255
    darkness_bias = 1 - ((mean_red + mean_green + mean_blue) / (255 * 3))
    retina_like = mean_red > mean_green > mean_blue and warm_pixels > 0.45 and dark_pixels > 0.05

    if retina_like:
        lesion_score = _clamp((dark_pixels * 0.5) + (contrast * 0.35) + (red_hot_pixels * 0.15))
        if lesion_score >= 0.32:
            return _build_response_payload(
                condition_key='diabetic_retinopathy_warning',
                confidence_score=max(0.62, lesion_score),
                analysis_source='screening_rules',
                detected_pattern='Warm retinal palette with darker lesion-like regions.',
            )

        return _build_response_payload(
            condition_key='retina_clear',
            confidence_score=max(0.58, 1 - lesion_score),
            analysis_source='screening_rules',
            detected_pattern='Retinal-style image without a strong lesion cluster signal.',
        )

    if red_hot_pixels > 0.22 or redness_bias > 0.09:
        return _build_response_payload(
            condition_key='dermatitis',
            confidence_score=max(0.64, _clamp((red_hot_pixels * 1.4) + (redness_bias * 2.2) + (contrast * 0.4))),
            analysis_source='screening_rules',
            detected_pattern='Red inflammatory skin pattern.',
        )

    if dark_pixels > 0.3 and contrast > 0.18:
        return _build_response_payload(
            condition_key='pigmentation_irregularity',
            confidence_score=max(0.6, _clamp((dark_pixels * 0.9) + (contrast * 1.2))),
            analysis_source='screening_rules',
            detected_pattern='Clustered darker regions with visible contrast.',
        )

    if neutral_pixels > 0.34 and contrast > 0.16 and bright_pixels < 0.22:
        return _build_response_payload(
            condition_key='fungal_infection',
            confidence_score=max(0.57, _clamp((neutral_pixels * 1.1) + (contrast * 0.9) + (darkness_bias * 0.4))),
            analysis_source='screening_rules',
            detected_pattern='Patchy neutral-toned texture pattern.',
        )

    if red_hot_pixels > 0.12 and contrast > 0.12:
        return _build_response_payload(
            condition_key='acne_inflammation',
            confidence_score=max(0.56, _clamp((red_hot_pixels * 1.2) + (contrast * 0.8))),
            analysis_source='screening_rules',
            detected_pattern='Localized warm skin inflammation pattern.',
        )

    return _build_response_payload(
        condition_key='healthy_skin',
        confidence_score=max(0.55, _clamp(0.72 - contrast + bright_pixels * 0.1)),
        analysis_source='screening_rules',
        detected_pattern='Balanced skin tone without a strong abnormality signal.',
    )


@api_view(['POST'])
def analyze_health_image(request):
    uploaded_image = request.FILES.get('image')
    if not uploaded_image:
        return Response({'error': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        image = _normalize_uploaded_image(uploaded_image)
    except ModuleNotFoundError as error:
        return Response(
            {'error': f'Missing image dependency: {error.name}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as error:
        return Response(
            {'error': f'Invalid image upload: {error}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        analysis = _analyze_with_model(image) or _analyze_with_screening_rules(image)
        return Response(analysis, status=status.HTTP_200_OK)
    except Exception as error:
        return Response(
            {'error': f'Image analysis failed: {error}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )