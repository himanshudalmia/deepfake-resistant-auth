"""
Semantic anchor phrases and lexical patterns for pressure signals.
"""

from typing import Dict, List, Pattern
import re

# Semantic anchor sentences representing canonical coercive / vishing attack patterns
SEMANTIC_ANCHORS: Dict[str, List[str]] = {
    "urgency_language": [
        "This is an emergency and must be done right now.",
        "Process this payment immediately, we cannot wait.",
        "Execute the transfer ASAP without delay.",
        "This is extremely urgent, drop everything and wire this.",
        "Need this handled immediately, critical priority.",
    ],
    "secrecy_language": [
        "This is strictly confidential, keep it between us.",
        "Do not loop in anyone else on this transaction.",
        "Keep this private, do not inform the rest of the team.",
        "This is an off-the-record confidential acquisition.",
        "Do not follow standard protocol or discuss this with anyone.",
    ],
    "authority_invocation": [
        "This is directly ordered by the CEO and executive leadership.",
        "The board of directors and CFO have already authorized this transfer.",
        "I am authorizing this as the chief executive officer.",
        "Per executive command, bypass the regular approval flow.",
        "Do not question this instruction, it comes from top management.",
    ],
    "deadline_pressure": [
        "I need this wired within the hour or the deal falls apart.",
        "We have a strict deadline before the banking wire cutoff.",
        "Must be completed before 4 PM today or we face severe penalties.",
        "Time is running out, we only have thirty minutes left.",
        "Failure to meet this deadline will result in major financial loss.",
    ],
    "channel_switch_request": [
        "Message me on my personal WhatsApp or Signal instead.",
        "Switch to my private mobile cell phone right away.",
        "Do not use the corporate portal, contact me on external chat.",
        "Let's move this conversation off the official company network.",
        "Call my personal non-company phone number immediately.",
    ],
}

# Compiled regex patterns for fast, high-precision keyword / phrase matching
LEXICAL_PATTERNS: Dict[str, List[Pattern]] = {
    "urgency_language": [
        re.compile(r"\b(urgent|urgently|emergency|immediate|immediately|asap|right\s+away|right\s+now|rush|hurry|expedite|without\s+delay)\b", re.I),
        re.compile(r"\b(need\s+this\s+(wired|transferred|done|sent)\s+now)\b", re.I),
    ],
    "secrecy_language": [
        re.compile(r"\b(confidential|strictly\s+confidential|keep\s+(this\s+)?(between\s+us|secret|private|quiet))\b", re.I),
        re.compile(r"\b(don'?t|do\s+not)\s+(loop\s+in|tell|inform|discuss\s+with|involve)\s+(anyone|anybody|others|the\s+team)\b", re.I),
        re.compile(r"\b(off\s+the\s+record|discreet(ly)?|behind\s+closed\s+doors)\b", re.I),
    ],
    "authority_invocation": [
        re.compile(r"\b(ceo|cfo|coo|board\s+of\s+directors|executive\s+team|senior\s+leadership)\b", re.I),
        re.compile(r"\b(by\s+order\s+of|per\s+(the\s+)?(ceo|cfo|board|executive)|direct\s+order|authorized\s+by\s+leadership)\b", re.I),
        re.compile(r"\b(do\s+not\s+question|override\s+normal\s+protocol)\b", re.I),
    ],
    "deadline_pressure": [
        re.compile(r"\b(within\s+the\s+hour|within\s+\d+\s*(mins?|minutes?|hours?))\b", re.I),
        re.compile(r"\b(before\s+(\d+|the\s+cutoff|close\s+of\s+business|end\s+of\s+day))\b", re.I),
        re.compile(r"\b(deadline|time\s+is\s+running\s+out|deal\s+will\s+fall\s+through|lose\s+the\s+deal)\b", re.I),
    ],
    "channel_switch_request": [
        re.compile(r"\b(whatsapp|telegram|signal|private\s+(cell|phone|number|line)|personal\s+(email|phone|chat))\b", re.I),
        re.compile(r"\b(switch\s+to|reach\s+me\s+on|contact\s+me\s+at)\s+([+\d\w\s]+(private|personal|whatsapp|signal))\b", re.I),
        re.compile(r"\b(off\s+(the\s+)?(portal|platform|slack|teams|network))\b", re.I),
    ],
}
