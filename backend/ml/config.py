"""
Configuration and weight definitions for Pressure-Signal Scorer.
Conforms strictly to Section 2 of contracts.md.
"""

from typing import Dict

# 5 Canonical signals defined in the contract
SIGNAL_NAMES = [
    "urgency_language",
    "secrecy_language",
    "authority_invocation",
    "deadline_pressure",
    "channel_switch_request",
]

# Base contribution weights when a signal is strongly active
SIGNAL_WEIGHTS: Dict[str, float] = {
    "urgency_language": 0.30,
    "secrecy_language": 0.35,
    "authority_invocation": 0.20,
    "deadline_pressure": 0.20,
    "channel_switch_request": 0.25,
}

# Similarity threshold for semantic vector matching
SEMANTIC_SIMILARITY_THRESHOLD = 0.52

# Embedding model identifier
DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
