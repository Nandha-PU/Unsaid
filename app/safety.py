import re
from typing import Tuple

# Compiled regular expressions with word boundaries and flexible spacing
THREAT_PATTERN = re.compile(
    r"\b("
    r"kill\s+you|"
    r"bomb|"
    r"destroy\s+your\s+life|"
    r"harm\s+you|"
    r"blackmail|"
    r"leak\s+your\s+address|"
    r"hunt\s+you\s+down|"
    r"ruin\s+you"
    r")\b",
    re.IGNORECASE,
)

CRISIS_PATTERN = re.compile(
    r"\b("
    r"suicide|"
    r"end\s+my\s+life|"
    r"kill\s+myself|"
    r"hurting?\s+myself|"
    r"self[\s-]harm"
    r")\b",
    re.IGNORECASE,
)


def evaluate_safety(text: str) -> Tuple[str, str | None]:
    """
    Evaluates text against communication safety and wellbeing policies.

    Returns:
        (status, message)
        status: "ok" | "refused" | "crisis"
        message: explanation or support guidance if not ok, otherwise None
    """
    if not text:
        return "ok", None

    clean = text.strip()

    if THREAT_PATTERN.search(clean):
        return (
            "refused",
            "Your draft contains threatening or abusive language, which violates our communication policies. Please rephrase respectfully to receive guidance.",
        )

    if CRISIS_PATTERN.search(clean):
        return (
            "crisis",
            "You may be experiencing intense distress. Academic and personal stress is real, but your wellbeing comes first. Please reach out to your campus counseling center or a local support helpline.",
        )

    return "ok", None
