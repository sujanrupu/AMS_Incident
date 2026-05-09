from repositories.ticket_repository import (
    get_all_tickets,
    update_parent,
    update_child_keys,
    get_children
)

from repositories.ticket_repository import supabase

from services.jira_service import complete_parent_and_children


# ─────────────────────────────────────────────
# MARK DUPLICATE
# ─────────────────────────────────────────────
async def mark_duplicate(issue_key: str):
    try:
        supabase.table("tickets").update({
            "is_duplicate": True
        }).eq("issue_key", issue_key).execute()
        return True
    except Exception as e:
        print("❌ mark_duplicate error:", str(e))
        return False



async def merge_tickets(target_parent: str, source_parents: list):

    try:

        tickets = await get_all_tickets()

        if not tickets:
            return {"success": False, "message": "No tickets found"}

        source_parents = list(set(source_parents))
        source_parents = [s for s in source_parents if s != target_parent]

        target_ticket = next(
            (t for t in tickets if t["issue_key"] == target_parent),
            None
        )

        if not target_ticket:
            return {"success": False, "message": "Target not found"}

        force_completed = target_ticket.get("status") == "Completed"

        moved = 0

        # ─────────────────────────────
        # STEP 1: MOVE + MARK DUPLICATE
        # ─────────────────────────────
        for source in source_parents:

            for t in tickets:

                if (
                    t["issue_key"] == source
                    or t.get("parent_ticket_key") == source
                ):

                    update_payload = {
                        "parent_ticket_key": target_parent
                    }

                    await mark_duplicate(t["issue_key"])

                    if force_completed:
                        update_payload["status"] = "Completed"

                    supabase.table("tickets") \
                        .update(update_payload) \
                        .eq("issue_key", t["issue_key"]) \
                        .execute()

                    moved += 1

        # ─────────────────────────────
        # STEP 2: CHILD KEY REBUILD
        # ─────────────────────────────
        children = await get_children(target_parent)

        updates = []
        counter = 1

        for t in children:

            if t["issue_key"] == target_parent:
                continue

            update_data = {
                "issue_key": t["issue_key"],
                "child_key": f"{target_parent}.{counter}"
            }

            if force_completed:
                update_data["status"] = "Completed"

            updates.append(update_data)
            counter += 1

        if updates:
            await update_child_keys(updates)

        # ─────────────────────────────
        # STEP 3: 🔥 SYNC WITH JIRA (IMPORTANT)
        # ─────────────────────────────
        if force_completed:

            jira_result = await complete_parent_and_children(target_parent)

            print("🔥 Jira sync result:", jira_result)

        # ─────────────────────────────
        # FINAL RESPONSE
        # ─────────────────────────────
        return {
            "success": True,
            "target": target_parent,
            "sources": source_parents,
            "moved": moved,
            "status_sync": force_completed,
            "jira_synced": force_completed
        }

    except Exception as e:

        print("❌ merge_tickets error:", str(e))

        return {
            "success": False,
            "message": str(e)
        }

