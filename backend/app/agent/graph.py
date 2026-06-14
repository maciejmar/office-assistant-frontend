from langgraph.graph import StateGraph, END

from .state import NewsletterState
from .nodes import (
    mark_running,
    extract_texts,
    generate_newsletter,
    save_newsletter,
    send_emails,
    mark_failed,
)


def _route(state: NewsletterState) -> str:
    return "error" if state.get("error") else "ok"


def build_graph():
    g = StateGraph(NewsletterState)

    g.add_node("mark_running",  mark_running)
    g.add_node("extract",       extract_texts)
    g.add_node("generate",      generate_newsletter)
    g.add_node("save",          save_newsletter)
    g.add_node("send",          send_emails)
    g.add_node("mark_failed",   mark_failed)

    g.set_entry_point("mark_running")
    g.add_edge("mark_running", "extract")
    g.add_conditional_edges("extract",  _route, {"ok": "generate", "error": "mark_failed"})
    g.add_conditional_edges("generate", _route, {"ok": "save",     "error": "mark_failed"})
    g.add_conditional_edges("save",     _route, {"ok": "send",     "error": "mark_failed"})
    g.add_edge("send",        END)
    g.add_edge("mark_failed", END)

    return g.compile()
