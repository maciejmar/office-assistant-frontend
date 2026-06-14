import logging
from .graph import build_graph
from .state import NewsletterState

logger = logging.getLogger(__name__)

_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def run_newsletter_job(
    job_id: int,
    user_id: int,
    file_ids: list[int],
    subscriber_emails: list[str],
    language: str,
    tone: str,
    max_length: int,
) -> None:
    state: NewsletterState = {
        "job_id": job_id,
        "user_id": user_id,
        "file_ids": file_ids,
        "subscriber_emails": subscriber_emails,
        "language": language,
        "tone": tone,
        "max_length": max_length,
        "combined_text": "",
        "subject": "",
        "html_body": "",
        "text_body": "",
        "newsletter_id": None,
        "error": None,
    }
    try:
        _get_graph().invoke(state)
    except Exception as e:
        logger.exception("Agent zakończył się nieoczekiwanym błędem dla job_id=%s: %s", job_id, e)
