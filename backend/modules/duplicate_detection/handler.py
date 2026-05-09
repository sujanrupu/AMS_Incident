# modules/duplicate_detection/handler.py

from core.constants import SIMILARITY_THRESHOLD

from modules.duplicate_detection.agent import find_best_match
from modules.duplicate_detection.service import generate_related

from services.jira_service import (
    create_ticket,
    generate_child_id,
    append_duplicate
)

from services.embedding_service import get_embedding

from repositories.ticket_repository import (
    get_all_tickets,
    insert_ticket,
    search_similar_tickets
)


# ─────────────────────────────────────────────
# DUPLICATE DETECTION FLOW
# ─────────────────────────────────────────────
async def handle_duplicate_flow(state):

    data    = state.get("data") or {}
    summary = state.get("summary", "")

    # ─────────────────────────────────────────────
    # VALIDATION
    # ─────────────────────────────────────────────
    if not data or not summary:
        return {
            **state,
            "type": "error",
            "message": "Invalid request payload"
        }

    # Safe extraction
    name = getattr(data, "name", None) or data.get("name", "")
    email = getattr(data, "email", None) or data.get("email", "")
    description = getattr(data, "description", None) or data.get("description", "")

    # ─────────────────────────────────────────────
    # STEP 1 — VECTOR SEARCH
    # ONLY PARENT OPEN TICKETS
    # ─────────────────────────────────────────────
    candidate_tickets = []

    query_embedding = await get_embedding(summary)

    if query_embedding:

        query_embedding = [float(x) for x in query_embedding]

        candidate_tickets = await search_similar_tickets(
            query_embedding,
            top_k=5
        )

    # ─────────────────────────────────────────────
    # FALLBACK
    # ─────────────────────────────────────────────
    if not candidate_tickets:

        tickets = await get_all_tickets() or []

        # Only parent open tickets
        candidate_tickets = [
            t for t in tickets
            if (
                t.get("status") == "Open"
                and not t.get("is_duplicate")
                and not t.get("child_key")
            )
        ]

    # ─────────────────────────────────────────────
    # STEP 2 — LLM SIMILARITY
    # ─────────────────────────────────────────────
    score, parent = await find_best_match(
        summary,
        candidate_tickets
    )

    # ─────────────────────────────────────────────
    # DUPLICATE FLOW
    # ─────────────────────────────────────────────
    if parent and score >= SIMILARITY_THRESHOLD:

        # Parent Jira ID
        parent_key = parent.get("issue_key")

        # Generate visual child chain
        # Example:
        # TP-544.1
        child_key = await generate_child_id(parent_key)

        # Create REAL Jira ticket
        new_ticket = await create_ticket(data, summary)

        issue_key = (
            new_ticket.get("issueKey")
            if new_ticket else None
        )

        if not issue_key:
            return {
                **state,
                "type": "error",
                "message": "Failed to create Jira duplicate ticket"
            }

        # Append duplicate info in parent
        await append_duplicate(
            parent_key,
            child_key,
            summary
        )

        # Store duplicate ticket
        await insert_ticket({

            # REAL Jira issue ID
            "issue_key": issue_key,

            # Visual duplicate chain
            "child_key": child_key,

            "name": name,
            "email": email,

            "summary": summary,
            "description": description,

            "status": "Open",

            "is_duplicate": True,

            "parent_ticket_key": parent_key,

            # No embeddings for duplicates
            "embedding": None,
        })

        return {
            **state,
            "type": "success",
            "message": "Duplicate ticket linked successfully",

            # Actual Jira ticket
            "id": issue_key,

            # Duplicate chain ID
            "child_key": child_key,

            "parent_ticket": parent_key,

            "is_duplicate": True
        }

    # ─────────────────────────────────────────────
    # NEW PARENT TICKET FLOW
    # ─────────────────────────────────────────────
    related = await generate_related(summary)

    # Create REAL Jira ticket
    new_ticket = await create_ticket(
        data,
        related
    )

    issue_key = (
        new_ticket.get("issueKey")
        if new_ticket else None
    )

    if not issue_key:
        return {
            **state,
            "type": "error",
            "message": "Failed to create Jira ticket"
        }

    # ─────────────────────────────────────────────
    # STEP 3 — GENERATE EMBEDDING
    # ─────────────────────────────────────────────
    embedding = await get_embedding(
        f"{summary}\n{related}"
    )

    if embedding:
        embedding = [float(x) for x in embedding]

    # ─────────────────────────────────────────────
    # STORE PARENT TICKET
    # ─────────────────────────────────────────────
    await insert_ticket({

        # Real Jira ID
        "issue_key": issue_key,

        # Parent ticket => no child key
        "child_key": None,

        "name": name,
        "email": email,

        "summary": summary,
        "description": description,

        "status": "Open",

        "is_duplicate": False,

        "parent_ticket_key": None,

        "embedding": embedding
    })

    return {
        **state,
        "type": "success",
        "message": "Ticket registered successfully",

        # Actual Jira ID
        "id": issue_key,

        "child_key": None,

        "is_duplicate": False
    }