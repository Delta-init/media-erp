"""
Role model constants and document helpers.
MongoDB collection: 'roles'
"""

MODULES = [
    "dashboard",
    "connectors",
    "reports",
    "campaigns",
    "projects",
    "ai",
    "users",
    "roles",
    "settings",
]

ACTIONS = ["view", "create", "edit", "delete", "export"]


def default_permissions() -> dict:
    """All actions false for every module."""
    return {m: {a: False for a in ACTIONS} for m in MODULES}


def all_permissions() -> dict:
    """All actions true for every module (Super Admin)."""
    return {m: {a: True for a in ACTIONS} for m in MODULES}


def viewer_permissions() -> dict:
    """Only view=true for non-admin modules."""
    perms = default_permissions()
    for m in ["dashboard", "reports", "campaigns", "projects", "ai"]:
        perms[m]["view"] = True
    return perms


def manager_permissions() -> dict:
    """Manager role permissions."""
    perms = default_permissions()
    perms["dashboard"]["view"] = True
    perms["connectors"]["view"] = True
    perms["connectors"]["create"] = True
    perms["connectors"]["edit"] = True
    perms["reports"]["view"] = True
    perms["reports"]["export"] = True
    perms["campaigns"]["view"] = True
    perms["projects"]["view"] = True
    perms["projects"]["create"] = True
    perms["projects"]["edit"] = True
    perms["projects"]["delete"] = True
    perms["ai"]["view"] = True
    perms["ai"]["create"] = True
    perms["users"]["view"] = True
    perms["settings"]["view"] = True
    return perms
