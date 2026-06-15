from typing import TypedDict, Optional


class NewsletterState(TypedDict):
    job_id: int
    user_id: int
    file_ids: list[int]
    subscriber_emails: list[str]
    language: str
    tone: str
    max_length: int
    custom_prompt: Optional[str]
    combined_text: str
    subject: str
    html_body: str
    text_body: str
    newsletter_id: Optional[int]
    error: Optional[str]
