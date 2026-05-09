# repositories/ticket_repository.py

from supabase import create_client
from core.config import Config

supabase = create_client(
    Config.SUPABASE_URL,
    Config.SUPABASE_KEY
)

# ─────────────────────────────────────────────
# ALLOWED FIELDS
# ─────────────────────────────────────────────
ALLOWED_FIELDS = {
    "issue_key",
    "child_key",
    "name",
    "email",
    "summary",
    "description",
    "status",
    "is_duplicate",
    "parent_ticket_key",
    "embedding",
    "checklist_steps",
    "commands",
    "runbook_title",
    "runbook_category",
    "runbook_escalation_team",
    "match_type"
}

# ─────────────────────────────────────────────
# INSERT TICKET
# ─────────────────────────────────────────────
async def insert_ticket(data):

    print("🔥 FINAL RAW PAYLOAD:", data)

    try:
        data = dict(data)

        data = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}

        if data.get("embedding") is not None:
            data["embedding"] = [float(x) for x in data["embedding"]]

        data.setdefault("child_key", None)
        data.setdefault("checklist_steps", None)
        data.setdefault("commands", None)

        res = supabase.table("tickets").insert(data).execute()

        return res.data[0] if res.data else None

    except Exception as e:
        print("❌ insert_ticket error:", str(e))
        return None


# ─────────────────────────────────────────────
# GET ALL TICKETS
# ─────────────────────────────────────────────
async def get_all_tickets():
    try:
        res = supabase.table("tickets").select("*").execute()
        return res.data or []
    except Exception as e:
        print("❌ get_all_tickets error:", str(e))
        return []


# ─────────────────────────────────────────────
# GET SINGLE TICKET
# ─────────────────────────────────────────────
async def get_ticket(issue_key: str):
    try:
        res = (
            supabase.table("tickets")
            .select("*")
            .eq("issue_key", issue_key)
            .limit(1)
            .execute()
        )

        return res.data[0] if res.data else None

    except Exception as e:
        print("❌ get_ticket error:", str(e))
        return None


# ─────────────────────────────────────────────
# VECTOR SEARCH
# ─────────────────────────────────────────────
async def search_similar_tickets(query_embedding, top_k=5):

    try:
        if not query_embedding:
            return []

        query_embedding = [float(x) for x in query_embedding]

        res = supabase.rpc(
            "match_tickets",
            {
                "query_embedding": query_embedding,
                "match_count": top_k,
            }
        ).execute()

        return res.data or []

    except Exception as e:
        print("❌ vector search error:", str(e))
        return []


# ─────────────────────────────────────────────
# DELETE SINGLE
# ─────────────────────────────────────────────
async def delete_ticket(issue_key: str):

    try:
        res = (
            supabase.table("tickets")
            .delete()
            .eq("issue_key", issue_key)
            .execute()
        )

        return bool(res.data)

    except Exception as e:
        print("❌ delete_ticket error:", str(e))
        return False


# ─────────────────────────────────────────────
# DELETE CASCADE
# ─────────────────────────────────────────────
async def delete_ticket_cascade(parent_key: str):

    try:
        res = (
            supabase.table("tickets")
            .delete()
            .or_(
                f"issue_key.eq.{parent_key},"
                f"parent_ticket_key.eq.{parent_key}"
            )
            .execute()
        )

        return bool(res.data)

    except Exception as e:
        print("❌ delete_ticket_cascade error:", str(e))
        return False


# ─────────────────────────────────────────────
# UPDATE STATUS CASCADE
# ─────────────────────────────────────────────
async def update_status_cascade(parent_key: str, status: str):

    try:
        res = (
            supabase.table("tickets")
            .update({"status": status})
            .or_(
                f"issue_key.eq.{parent_key.strip()},"
                f"parent_ticket_key.eq.{parent_key.strip()}"
            )
            .execute()
        )

        return bool(res.data)

    except Exception as e:
        print("❌ update_status_cascade error:", str(e))
        return False


# ─────────────────────────────────────────────
# RUNBOOK UPDATE
# ─────────────────────────────────────────────
async def update_ticket_runbook(
    issue_key: str,
    checklist_steps: list,
    commands: list,
    runbook_title: str = None,
    runbook_category: str = None,
    runbook_escalation_team: str = None,
    match_type: str = None,
):

    try:
        res = (
            supabase.table("tickets")
            .update({
                "checklist_steps": checklist_steps,
                "commands": commands,
                "runbook_title": runbook_title,
                "runbook_category": runbook_category,
                "runbook_escalation_team": runbook_escalation_team,
                "match_type": match_type,
            })
            .eq("issue_key", issue_key)
            .execute()
        )

        return bool(res.data)

    except Exception as e:
        print("❌ update_ticket_runbook error:", str(e))
        return False


# ─────────────────────────────────────────────
# ⭐ NEW: GET ONLY PARENT TICKETS (FOR MERGE DROPDOWN)
# ─────────────────────────────────────────────
async def get_parent_tickets():

    try:
        res = (
            supabase.table("tickets")
            .select("*")
            .is_("parent_ticket_key", None)
            .execute()
        )

        return res.data or []

    except Exception as e:
        print("❌ get_parent_tickets error:", str(e))
        return []


# ─────────────────────────────────────────────
# MERGE SUPPORT
# ─────────────────────────────────────────────
async def get_children(parent_key: str):

    try:
        res = (
            supabase.table("tickets")
            .select("*")
            .eq("parent_ticket_key", parent_key)
            .order("created_at", desc=False)
            .execute()
        )

        return res.data or []

    except Exception as e:
        print("❌ get_children error:", str(e))
        return []


# UPDATE PARENT LINK
async def update_parent(issue_key: str, new_parent: str):

    try:
        res = (
            supabase.table("tickets")
            .update({"parent_ticket_key": new_parent})
            .eq("issue_key", issue_key)
            .execute()
        )

        return bool(res.data)

    except Exception as e:
        print("❌ update_parent error:", str(e))
        return False


# BULK CHILD KEY UPDATE
async def update_child_keys(updates: list):

    try:
        for item in updates:
            supabase.table("tickets") \
                .update({"child_key": item["child_key"]}) \
                .eq("issue_key", item["issue_key"]) \
                .execute()

        return True

    except Exception as e:
        print("❌ update_child_keys error:", str(e))
        return False




# Detach child from parent

async def detach_child_ticket(issue_key: str):

    try:

        res = (
            supabase.table("tickets")
            .update({
                "child_key": None,
                "parent_ticket_key": None,
                "is_duplicate": False  
            })
            .eq("issue_key", issue_key)
            .execute()
        )

        return bool(res.data)

    except Exception as e:
        print("❌ detach_child_ticket error:", str(e))
        return False

