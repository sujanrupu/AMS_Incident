# app/v1/ticket_routes.py

from fastapi import APIRouter, HTTPException

# schemas + orchestrator
from schemas.ticket_schema import TicketRequest
from orchestrator.ams_orchestrator import handle_ticket
from repositories.ticket_repository import search_similar_tickets
from services.embedding_service import get_embedding

# repository layer
# repository layer
from repositories.ticket_repository import (
    get_all_tickets,
    delete_ticket_cascade,
    update_status_cascade,
    delete_ticket,
    get_ticket,
    get_children,
    update_parent,
    update_child_keys,

    # NEW
    delete_single_ticket,
    promote_first_child_as_parent
)

# Jira integration
from services.jira_service import (
    complete_parent_and_children,
    delete_parent_and_children,
)


from services.merge_service import merge_tickets

router = APIRouter()


# ─────────────────────────────────────────────
# SUBMIT TICKET
# ─────────────────────────────────────────────
@router.post("/submit")
async def submit(data: TicketRequest):

    result = await handle_ticket(data)

    if not isinstance(result, dict):
        return {
            "type": "error",
            "message": "Invalid orchestrator response"
        }

    return result


# ─────────────────────────────────────────────
# GET ALL TICKETS
# ─────────────────────────────────────────────
@router.get("/tickets")
async def get_tickets():
     
    tickets = await get_all_tickets()

    if not isinstance(tickets, list):
        return []

    return tickets


# ─────────────────────────────────────────────
# DELETE TICKET CASCADE
# PARENT + ALL CHILDREN
# JIRA + DB
# ─────────────────────────────────────────────
@router.delete("/tickets/{issueKey}")
async def delete(issueKey: str):

    try:

        tickets = await get_all_tickets()

        if not tickets:
            return {
                "type": "error",
                "message": "No tickets found"
            }

        current = next(
            (
                t for t in tickets
                if t["issue_key"] == issueKey
            ),
            None
        )

        if not current:
            return {
                "type": "error",
                "message": "Ticket not found"
            }

        # If child clicked → use parent
        parent_key = (
            current.get("parent_ticket_key")
            or current.get("issue_key")
        )

        print(
            f"🗑️ Deleting parent + children: "
            f"{parent_key}"
        )

        # DELETE FROM JIRA
        jira_ok = await delete_parent_and_children(
            parent_key
        )

        if not jira_ok:
            print(
                f"⚠️ Jira delete partially failed "
                f"for {parent_key}"
            )

        # DELETE FROM DB
        db_ok = await delete_ticket_cascade(
            parent_key
        )

        if not db_ok:
            return {
                "type": "error",
                "message": "Database delete failed"
            }

        print(
            f"✅ Deleted parent + all child tickets "
            f"for {parent_key}"
        )

        return {
            "type": "success",
            "message":
                "Parent and all child tickets deleted successfully",
            "id": parent_key
        }

    except Exception as e:

        print(f"❌ delete error: {e}")

        return {
            "type": "error",
            "message": str(e)
        }


# ─────────────────────────────────────────────
# DELETE ONLY PARENT
# PROMOTE FIRST CHILD AS NEW PARENT
# ─────────────────────────────────────────────
@router.delete("/tickets/{issueKey}/parent-only")
async def delete_parent_only(issueKey: str):

    try:

        from repositories.ticket_repository import (
            get_children,
            delete_ticket,
            update_parent,
            promote_first_child_as_parent
        )

        from services.jira_service import (
            delete_jira_ticket
        )

        tickets = await get_all_tickets()

        current = next(
            (
                t for t in tickets
                if t["issue_key"] == issueKey
            ),
            None
        )

        if not current:
            return {
                "type": "error",
                "message": "Parent ticket not found"
            }

        # only parent allowed
        if current.get("parent_ticket_key"):
            return {
                "type": "error",
                "message": "Only parent tickets allowed"
            }

        # get children
        children = await get_children(issueKey)

        # ─────────────────────────────
        # NO CHILDREN
        # NORMAL DELETE
        # ─────────────────────────────
        if not children:

            await delete_jira_ticket(issueKey)

            await delete_ticket(issueKey)

            return {
                "type": "success",
                "message": "Parent deleted successfully",
                "id": issueKey
            }

        # ─────────────────────────────
        # PROMOTE FIRST CHILD
        # ─────────────────────────────
        new_parent_key = await promote_first_child_as_parent(
            issueKey
        )

        if not new_parent_key:
            return {
                "type": "error",
                "message": "Failed to promote child"
            }

        # ─────────────────────────────
        # DELETE OLD PARENT
        # ─────────────────────────────
        await delete_jira_ticket(issueKey)

        await delete_ticket(issueKey)

        # IMPORTANT:
        # - Existing statuses preserved
        # - Child numbering gaps preserved
        # - No status cascade

        return {
            "type": "success",
            "message": "Parent deleted and first child promoted",
            "old_parent": issueKey,
            "new_parent": new_parent_key
        }

    except Exception as e:

        print(
            "❌ delete_parent_only error:",
            str(e)
        )

        return {
            "type": "error",
            "message": str(e)
        }
        


# ─────────────────────────────────────────────
# DELETE SINGLE CHILD
# ─────────────────────────────────────────────
@router.delete("/tickets/child/{issueKey}")
async def delete_single_child(issueKey: str):

    try:

        from repositories.ticket_repository import (
            delete_ticket,
            get_ticket
        )

        from services.jira_service import (
            delete_jira_ticket
        )

        current = await get_ticket(issueKey)

        if not current:
            return {
                "type": "error",
                "message": "Child ticket not found"
            }

        # only child allowed
        if not current.get("parent_ticket_key"):
            return {
                "type": "error",
                "message": "Only child tickets allowed"
            }

        # ─────────────────────────────
        # DELETE FROM JIRA
        # ─────────────────────────────
        await delete_jira_ticket(issueKey)

        # ─────────────────────────────
        # DELETE FROM DATABASE
        # ─────────────────────────────
        await delete_ticket(issueKey)

        # IMPORTANT:
        # No child key regeneration
        # Keep numbering gaps as-is

        return {
            "type": "success",
            "message": "Child ticket deleted successfully",
            "id": issueKey
        }

    except Exception as e:

        print(
            "❌ delete_single_child error:",
            str(e)
        )

        return {
            "type": "error",
            "message": str(e)
        }



# ─────────────────────────────────────────────
# COMPLETE TICKET CASCADE
# PARENT + ALL CHILDREN
# JIRA + DB
# ─────────────────────────────────────────────
@router.put("/tickets/{issueKey}/complete")
async def complete_ticket(issueKey: str):

    try:

        tickets = await get_all_tickets()

        if not tickets:
            return {
                "type": "error",
                "message": "No tickets found"
            }

        current = next(
            (
                t for t in tickets
                if t["issue_key"] == issueKey
            ),
            None
        )

        if not current:
            return {
                "type": "error",
                "message": "Ticket not found"
            }

        # If child clicked → use parent
        parent_key = (
            current.get("parent_ticket_key")
            or current.get("issue_key")
        )

        print(
            f"🔍 Completing parent + children: "
            f"{parent_key}"
        )

        # UPDATE ALL JIRA ISSUES
        jira_ok = await complete_parent_and_children(
            parent_key
        )

        if not jira_ok:
            print(
                f"⚠️ Jira cascade update partially failed "
                f"for {parent_key}"
            )

        # UPDATE DB
        db_ok = await update_status_cascade(
            parent_key,
            "Completed"
        )

        if not db_ok:
            return {
                "type": "error",
                "message": "Database update failed"
            }

        print(
            f"✅ Completed parent + all child tickets "
            f"for {parent_key}"
        )

        return {
            "type": "success",
            "message":
                "Parent and all child tickets marked completed",
            "id": parent_key
        }

    except Exception as e:

        print(f"❌ complete_ticket error: {e}")

        return {
            "type": "error",
            "message": str(e)
        }



# ─────────────────────────────────────────────
# GET TICKET BY ISSUE KEY (PARENT ONLY)
# USED FOR SEARCH BAR
# ─────────────────────────────────────────────
import re


@router.get("/tickets/search/{issueKey}")
async def search_by_id(issueKey: str):

    try:

        tickets = await get_all_tickets()

        if not tickets:
            return {
                "type": "error",
                "message": "No tickets found"
            }

        key = issueKey.strip().upper()

        # ─────────────────────────────
        # STEP 1: FIND EXACT TICKET
        # ─────────────────────────────
        current = next(
            (
                t for t in tickets
                if t["issue_key"].upper() == key
            ),
            None
        )

        if not current:
            return {
                "type": "error",
                "message": "Ticket not found"
            }

        # ─────────────────────────────
        # STEP 2: CHILD TICKET FLOW
        # ─────────────────────────────
        if current.get("child_key"):

            parent_key = current["parent_ticket_key"]

            parent = next(
                (
                    t for t in tickets
                    if t["issue_key"] == parent_key
                ),
                None
            )

            if not parent:
                return {
                    "type": "error",
                    "message": "Parent ticket not found"
                }

            children = [
                t for t in tickets
                if t.get("parent_ticket_key") == parent_key
            ]

            return {
                "type": "success",

                # IMPORTANT ORDER FOR UI
                "child": current,          # show first
                "parent_key": parent_key,  # display label
                "parent": parent,          # full card
                "children": children,

                "mode": "child-view"
            }

        # ─────────────────────────────
        # STEP 3: PARENT FLOW
        # ─────────────────────────────
        children = [
            t for t in tickets
            if t.get("parent_ticket_key") == current["issue_key"]
        ]

        return {
            "type": "success",
            "parent": current,
            "children": children,
            "mode": "parent-view"
        }

    except Exception as e:

        print(f"❌ search_by_id error: {e}")

        return {
            "type": "error",
            "message": str(e)
        }




# ─────────────────────────────────────────────
# MERGE TICKETS (DB ONLY)
# ─────────────────────────────────────────────
@router.post("/tickets/merge")
async def merge_tickets_api(payload: dict):

    """
    payload:
    {
        "target_parent_key": "TP-594",
        "source_parent_keys": ["TP-595", "TP-596"]
    }
    """

    try:

        target = payload.get("target_parent_key")
        sources = payload.get("source_parent_keys", [])

        # ─────────────────────────────
        # VALIDATION
        # ─────────────────────────────
        if not target or not isinstance(sources, list):
            return {
                "type": "error",
                "message": "Invalid merge request"
            }

        # remove duplicates
        sources = list(set(sources))

        # ensure target is included (optional safety)
        if target not in sources:
            sources.append(target)

        # remove target from "source-only logic safety"
        source_only = [
            s for s in sources
            if s != target
        ]

        if not source_only:
            return {
                "type": "error",
                "message": "No source tickets to merge"
            }

        # ─────────────────────────────
        # CALL SERVICE
        # ─────────────────────────────
        result = await merge_tickets(
            target_parent=target,
            source_parents=source_only
        )

        return {
            "type": "success",
            "message": "Tickets merged successfully",
            "data": result
        }

    except Exception as e:

        return {
            "type": "error",
            "message": str(e)
        }




@router.put("/tickets/{issueKey}/detach")
async def detach_ticket(issueKey: str):

    try:

        tickets = await get_all_tickets()

        current = next(
            (t for t in tickets if t["issue_key"] == issueKey),
            None
        )

        if not current:
            return {
                "type": "error",
                "message": "Ticket not found"
            }

        # only allow child tickets
        if not current.get("parent_ticket_key"):
            return {
                "type": "error",
                "message": "Only child tickets can be detached"
            }

        from repositories.ticket_repository import detach_child_ticket

        ok = await detach_child_ticket(issueKey)

        if not ok:
            return {
                "type": "error",
                "message": "Detach failed"
            }

        return {
            "type": "success",
            "message": "Ticket detached successfully",
            "id": issueKey
        }

    except Exception as e:
        return {
            "type": "error",
            "message": str(e)
        }
