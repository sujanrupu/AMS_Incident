# services/jira_service.py

import httpx
import re

from core.config import Config

from repositories.ticket_repository import (
    get_all_tickets
)


auth = (
    Config.JIRA_EMAIL,
    Config.JIRA_API_TOKEN
)

headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
}

BASE_URL = f"https://{Config.JIRA_DOMAIN}"


# ─────────────────────────────────────────────
# CREATE JIRA TICKET
# ─────────────────────────────────────────────
async def create_ticket(
    data,
    related=""
):

    url = (
        f"{BASE_URL}"
        f"/rest/servicedeskapi/request"
    )

    summary = (
        getattr(data, "summary", None)
        or data.get("summary", "")
    )

    description = (
        getattr(data, "description", None)
        or data.get("description", "")
    )

    payload = {
        "serviceDeskId": Config.SERVICE_DESK_ID,

        "requestTypeId": Config.REQUEST_TYPE_ID,

        "requestFieldValues": {
            "summary": summary,

            "description":
                f"{description}\n\n"
                f"Related:\n{related}"
        }
    }

    try:

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            res = await client.post(
                url,
                json=payload,
                headers=headers,
                auth=auth
            )

        if res.status_code not in [200, 201]:

            print(
                "❌ Jira create error:",
                res.text
            )

            return None

        return res.json()

    except Exception as e:

        print(
            "❌ Exception in create_ticket:",
            str(e)
        )

        return None


# ─────────────────────────────────────────────
# APPEND DUPLICATE INFO
# INTO PARENT TICKET
# ─────────────────────────────────────────────
async def append_duplicate(
    parent_key,
    child_key,
    summary
):

    url = (
        f"{BASE_URL}"
        f"/rest/api/3/issue/{parent_key}"
    )

    new_text = (
        f"[{child_key}] {summary}"
    )

    try:

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            res = await client.get(
                url,
                headers=headers,
                auth=auth
            )

        if res.status_code != 200:

            print(
                "❌ Failed to fetch parent issue:",
                res.text
            )

            return False

        issue = res.json()

        desc = (
            issue.get("fields", {})
            .get("description")
        )

        new_block = {
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": new_text
                }
            ]
        }

        content = []

        if (
            isinstance(desc, dict)
            and "content" in desc
        ):
            content = desc["content"]

        content.append(new_block)

        payload = {
            "fields": {
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": content
                }
            }
        }

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            res = await client.put(
                url,
                json=payload,
                headers=headers,
                auth=auth
            )

        if res.status_code not in [200, 204]:

            print(
                "❌ Error appending duplicate:",
                res.text
            )

            return False

        return True

    except Exception as e:

        print(
            "❌ append_duplicate exception:",
            str(e)
        )

        return False


# ─────────────────────────────────────────────
# GENERATE CHILD KEY
#
# Example:
# TP-544.1
# TP-544.2
# ─────────────────────────────────────────────
async def generate_child_id(
    parent_key: str
):

    tickets = await get_all_tickets()

    pattern = re.compile(
        rf"^{re.escape(parent_key)}\.(\d+)$"
    )

    max_num = 0

    for t in tickets:

        child_key = (
            t.get("child_key")
            or ""
        )

        if child_key.count(".") > 1:
            continue

        match = pattern.match(child_key)

        if match:

            num = int(match.group(1))

            if num > max_num:
                max_num = num

    return f"{parent_key}.{max_num + 1}"


# ─────────────────────────────────────────────
# DELETE SINGLE JIRA TICKET
# ─────────────────────────────────────────────
async def delete_jira_ticket(
    issue_key: str
):

    url = (
        f"{BASE_URL}"
        f"/rest/api/3/issue/{issue_key}"
    )

    try:

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            res = await client.delete(
                url,
                headers=headers,
                auth=auth
            )

        if res.status_code not in [200, 204]:

            print(
                f"❌ Jira delete failed "
                f"{issue_key}:",
                res.text
            )

            return False

        print(
            f"🗑 Jira ticket deleted: "
            f"{issue_key}"
        )

        return True

    except Exception as e:

        print(
            "❌ delete_jira_ticket exception:",
            str(e)
        )

        return False


# ─────────────────────────────────────────────
# UPDATE SINGLE JIRA ISSUE STATUS
# ─────────────────────────────────────────────
async def update_jira_status(
    issue_key: str
):

    url = (
        f"{BASE_URL}"
        f"/rest/api/3/issue/"
        f"{issue_key}/transitions"
    )

    try:

        # Get transitions
        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            res = await client.get(
                url,
                headers=headers,
                auth=auth
            )

        if res.status_code != 200:

            print(
                f"❌ Failed to fetch transitions "
                f"for {issue_key}:",
                res.text
            )

            return False

        transitions = (
            res.json()
            .get("transitions", [])
        )

        transition_id = None

        for t in transitions:

            name = (
                t.get("name", "")
                .lower()
            )

            if any(
                k in name
                for k in [
                    "done",
                    "complete",
                    "resolve",
                    "close"
                ]
            ):

                transition_id = t.get("id")
                break

        if not transition_id:

            print(
                f"❌ No suitable transition found "
                f"for {issue_key}"
            )

            return False

        payload = {
            "transition": {
                "id": transition_id
            }
        }

        async with httpx.AsyncClient(
            timeout=15
        ) as client:

            res = await client.post(
                url,
                json=payload,
                headers=headers,
                auth=auth
            )

        if res.status_code not in [200, 204]:

            print(
                f"❌ Jira status update failed "
                f"for {issue_key}:",
                res.text
            )

            return False

        print(
            f"✅ Jira ticket completed: "
            f"{issue_key}"
        )

        return True

    except Exception as e:

        print(
            "❌ update_jira_status exception:",
            str(e)
        )

        return False


# ─────────────────────────────────────────────
# GET ALL RELATED TICKETS
#
# Includes:
# - Parent
# - All child tickets
# ─────────────────────────────────────────────
async def get_related_tickets(
    parent_key: str
):

    tickets = await get_all_tickets()

    related_tickets = []

    for t in tickets:

        if (
            t.get("issue_key") == parent_key
            or t.get("parent_ticket_key") == parent_key
        ):
            related_tickets.append(t)

    return related_tickets


# ─────────────────────────────────────────────
# COMPLETE PARENT + ALL CHILD JIRA TICKETS
# ─────────────────────────────────────────────
async def complete_parent_and_children(
    parent_key: str
):

    try:

        related_tickets = await get_related_tickets(
            parent_key
        )

        if not related_tickets:

            print(
                f"⚠️ No related tickets found "
                f"for {parent_key}"
            )

            return False

        success = True

        for t in related_tickets:

            jira_issue_key = t.get("issue_key")

            if not jira_issue_key:
                continue

            updated = await update_jira_status(
                jira_issue_key
            )

            if not updated:
                success = False

        return success

    except Exception as e:

        print(
            "❌ complete_parent_and_children exception:",
            str(e)
        )

        return False


# ─────────────────────────────────────────────
# DELETE PARENT + ALL CHILD JIRA TICKETS
# ─────────────────────────────────────────────
async def delete_parent_and_children(
    parent_key: str
):

    try:

        related_tickets = await get_related_tickets(
            parent_key
        )

        if not related_tickets:

            print(
                f"⚠️ No related tickets found "
                f"for {parent_key}"
            )

            return False

        success = True

        # Delete children first
        children = [
            t for t in related_tickets
            if t.get("parent_ticket_key") == parent_key
        ]

        # Delete parent last
        parent = [
            t for t in related_tickets
            if t.get("issue_key") == parent_key
        ]

        ordered = children + parent

        for t in ordered:

            jira_issue_key = t.get("issue_key")

            if not jira_issue_key:
                continue

            deleted = await delete_jira_ticket(
                jira_issue_key
            )

            if not deleted:
                success = False

        return success

    except Exception as e:

        print(
            "❌ delete_parent_and_children exception:",
            str(e)
        )

        return False