"""
Pressure-Signal Scorer Implementation for Executive Transaction Authorization.
Contract Owner: Person A (ML/Signals).
Strictly adheres to Section 2 of contracts.md.
"""

from typing import Any, Dict, List, Optional
import numpy as np

from .config import (
    DEFAULT_EMBEDDING_MODEL,
    SEMANTIC_SIMILARITY_THRESHOLD,
    SIGNAL_NAMES,
    SIGNAL_WEIGHTS,
)
from .anchors import LEXICAL_PATTERNS, SEMANTIC_ANCHORS

# Lazy loader for sentence transformer model to avoid slow import times
_MODEL = None
_ANCHOR_EMBEDDINGS: Dict[str, Any] = {}
_HAS_SENTENCE_TRANSFORMERS = False

try:
    from sentence_transformers import SentenceTransformer
    _HAS_SENTENCE_TRANSFORMERS = True
except Exception:
    _HAS_SENTENCE_TRANSFORMERS = False


def _get_model():
    """Lazily load SentenceTransformer model and precompute anchor embeddings."""
    global _MODEL, _ANCHOR_EMBEDDINGS
    if not _HAS_SENTENCE_TRANSFORMERS:
        return None

    if _MODEL is None:
        try:
            _MODEL = SentenceTransformer(DEFAULT_EMBEDDING_MODEL)
            # Precompute anchor embeddings
            for signal, phrases in SEMANTIC_ANCHORS.items():
                _ANCHOR_EMBEDDINGS[signal] = _MODEL.encode(phrases, normalize_embeddings=True)
        except Exception:
            _MODEL = None
    return _MODEL


def _cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Compute maximum cosine similarity between a vector and anchor vectors."""
    if vec_b is None or len(vec_b) == 0:
        return 0.0
    # vec_a is (1, d), vec_b is (n, d)
    sims = np.dot(vec_b, vec_a.T)
    return float(np.max(sims))


def analyze_transcript(transcript: str) -> Dict[str, Any]:
    """
    Analyzes a plain text transcript for psychological pressure, coercion, and vishing signals.

    Args:
        transcript: Plain text note or call transcript snippet.

    Returns:
        Dict conforming to Section 2 of contracts.md containing pressure_score and signals list.
    """
    if not transcript or not isinstance(transcript, str) or not transcript.strip():
        return {
            "pressure_score": 0.0,
            "signals": [
                {"signal": name, "value": False, "contribution": 0.0}
                for name in SIGNAL_NAMES
            ],
        }

    clean_text = transcript.strip()
    model = _get_model()

    # Pre-embed text if model is available
    text_embedding = None
    if model is not None and clean_text:
        try:
            text_embedding = model.encode([clean_text], normalize_embeddings=True)[0]
        except Exception:
            text_embedding = None

    detected_signals: List[Dict[str, Any]] = []
    total_pressure = 0.0

    for signal_name in SIGNAL_NAMES:
        is_detected = False
        confidence = 0.0

        # 1. Lexical / Regex pattern matching (Fast path)
        lexical_rules = LEXICAL_PATTERNS.get(signal_name, [])
        for pattern in lexical_rules:
            if pattern.search(clean_text):
                is_detected = True
                confidence = max(confidence, 0.95)
                break

        # 2. Semantic similarity vector matching (Deep path)
        if text_embedding is not None and signal_name in _ANCHOR_EMBEDDINGS:
            sim = _cosine_similarity(text_embedding, _ANCHOR_EMBEDDINGS[signal_name])
            if sim >= SEMANTIC_SIMILARITY_THRESHOLD:
                is_detected = True
                # Scale confidence linearly between threshold and 1.0
                semantic_conf = min(1.0, (sim - SEMANTIC_SIMILARITY_THRESHOLD) / (1.0 - SEMANTIC_SIMILARITY_THRESHOLD) + 0.6)
                confidence = max(confidence, semantic_conf)

        base_weight = SIGNAL_WEIGHTS.get(signal_name, 0.20)
        if is_detected:
            # Contribution is weight scaled by detection confidence
            contribution = round(base_weight * min(1.0, confidence), 2)
            total_pressure += contribution
            detected_signals.append({
                "signal": signal_name,
                "value": True,
                "contribution": contribution,
            })
        else:
            detected_signals.append({
                "signal": signal_name,
                "value": False,
                "contribution": 0.0,
            })

    # Clamp total pressure score between 0.0 and 1.0, rounded to 2 decimal places
    final_pressure_score = round(min(1.0, max(0.0, total_pressure)), 2)

    return {
        "pressure_score": final_pressure_score,
        "signals": detected_signals,
    }


def analyze_request(request: dict) -> dict:
    """
    Person A's Primary Interface defined in Section 2 of contracts.md.

    Input: Full request dict from Section 1.
    Output:
    {
      "pressure_score": float (0-1),
      "signals": [
        {"signal": str, "value": bool, "contribution": float},
        ...
      ]
    }
    """
    if not isinstance(request, dict):
        return {
            "pressure_score": 0.0,
            "signals": [
                {"signal": name, "value": False, "contribution": 0.0}
                for name in SIGNAL_NAMES
            ],
        }

    transcript = request.get("request_transcript", "")
    return analyze_transcript(transcript)
