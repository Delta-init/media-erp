# User & Role Management — mediaERP Implementation Plan

> Source of truth: `carltoncrm/carlton-leads-crm-backend` + `carltoncrm/carlton-leads-crm`
> Adapted for mediaERP stack: FastAPI + Motor (async MongoDB) + Next.js 14 + Zustand + React Query

---

## 1. What Carlton CRM Has (Reference)

### User Model
| Field | Type | Notes |
|-------|------|-------|
| name | String | required, maxlength 100 |
| email | String | required, unique, lowercase |
| password | String | bcrypt hashed, select:false |
| role | ObjectId → Role | required |
| designation | String | optional |
| status | "active" \| "inactive" | default: active |
| createdAt / updatedAt | Date | auto |

### Role Model
| Field | Type | Notes |
|-------|------|-------|
| roleName | String | required, unique |
| description | String | optional |
| permissions | Map\<module, {view,create,edit,delete,export}\> | nested object |
| isSystemRole | Boolean | default: false — Super Admin bypasses all checks |

### Permission Actions per module
- `view` `create` `edit` `delete` `export`

### Carlton CRM Modules
`dashboard · users · roles · leads · teams · courses · reminders · reports · settings · whatsapp · ai-agent`

### Key Patterns from Carlton
1. **JWT payload** = `{ userId, email, roleId }` — roleId stored so role can be fetched fresh from DB on every request
2. **Live role fetch on every request** — permissions are always current, no re-login needed after permission changes
3. **Super Admin bypass** — `isSystemRole && roleName === "Super Admin"` skips all permission checks
4. **selfOrPermission** — user can always GET their own record without `users.view`
5. **Role delete blocked** if any users assigned
6. **Super Admin user delete blocked** + self-delete blocked
7. **Frontend `hasPermission(module, action)`** in Zustand store
8. **Permission-based sidebar** — hides items, blocks navigation
9. **Permission-based redirect** — routes to first allowed page on unauthorized access
10. **Admin creates users** — no invite/email verification, admin sets password directly

---

## 2. mediaERP Modules (Adapted)

| Module Key | Sidebar Label | Route |
|------------|---------------|-------|
| `dashboard` | Overview | /dashboard |
| `connectors` | Connectors | /connectors |
| `reports` | Reports | /reports |
| `campaigns` | Campaigns | /campaigns |
| `projects` | Projects | /projects |
| `ai` | AI Queries | /ai |
| `users` | Users | /users |
| `roles` | Roles | /roles |
| `settings` | Settings | /settings |

### Permission Actions (per module)
```
view · create · edit · delete · export
```

---

## 3. Backend Changes

### 3a. New Files

#### `app/models/role.py`
```python
MODULES = [
  "dashboard","connectors","reports","campaigns",
  "projects","ai","users","roles","settings"
]
ACTIONS = ["view","create","edit","delete","export"]
```
MongoDB collection: `roles`
Document shape:
```json
{
  "_id": ObjectId,
  "role_name": "Super Admin",
  "description": "Full access",
  "is_system_role": true,
  "permissions": {
    "dashboard": {"view":true,"create":true,"edit":true,"delete":true,"export":true},
    "users":     {"view":true,"create":true,"edit":true,"delete":true,"export":true},
    ...
  },
  "created_at": ISODate,
  "updated_at": ISODate
}
```

#### `app/schemas/role.py`
- `CreateRoleRequest` — role_name, description, permissions dict
- `UpdateRoleRequest` — all optional

#### `app/services/role_service.py`
- `list_roles(db, search, page, limit)` → paginated
- `list_roles_simple(db)` → just id + role_name (for dropdowns)
- `create_role(db, data)` → validates uniqueness
- `update_role(db, id, data)` → blocks renaming Super Admin
- `delete_role(db, id)` → blocks system roles, blocks if users assigned

#### `app/routers/roles.py`
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/roles` | `roles.view` | Paginated list with search |
| GET | `/api/v1/roles/all` | `roles.view` | Simple list for dropdowns |
| POST | `/api/v1/roles` | `roles.create` | Create role |
| GET | `/api/v1/roles/{id}` | `roles.view` | Get single role |
| PUT | `/api/v1/roles/{id}` | `roles.edit` | Update role |
| DELETE | `/api/v1/roles/{id}` | `roles.delete` | Delete role |

#### `app/routers/users.py` (NEW — admin user management)
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/users` | `users.view` | Paginated list + search + status/role filter |
| POST | `/api/v1/users` | `users.create` | Admin creates user with role |
| GET | `/api/v1/users/{id}` | `users.view` OR self | Get user by ID |
| PUT | `/api/v1/users/{id}` | `users.edit` | Update user |
| DELETE | `/api/v1/users/{id}` | `users.delete` | Delete (blocks self + Super Admin) |

### 3b. Modified Files

#### `app/models/user.py`
Add fields: `role_id: ObjectId | None`, `designation: str`, `status: "active"|"inactive"`

#### `app/middleware/auth.py` — `get_current_user`
- Decode JWT → `user_id` + `role_id`
- Fetch user from DB (check status != "inactive")
- Fetch role from DB → attach `role` document to request
- Return `{ user_doc + role_doc }`

#### NEW: `app/middleware/permissions.py`
```python
def check_permission(module: str, action: str):
    async def dependency(current_user=Depends(get_current_user)):
        role = current_user.get("role")
        if role and role.get("is_system_role") and role.get("role_name") == "Super Admin":
            return current_user  # bypass
        perms = role.get("permissions", {}).get(module, {})
        if not perms.get(action):
            raise HTTPException(403, f"No '{action}' permission on '{module}'")
        return current_user
    return dependency
```

#### `app/routers/auth.py`
- Login: include `role_id` in JWT payload
- JWT now: `{ sub: user_id, role_id: role_id, exp: ... }`

#### `app/database.py`
Add indexes for `roles` and updated `users` collection.

#### `app/main.py`
Register `roles_router` and `users_router`.

### 3c. Seed Script
`backend/scripts/seed_admin.py`
- Creates "Super Admin" role with all permissions = true, `is_system_role=true`
- Creates "Viewer" role with only `view=true` for non-admin modules
- Creates admin user from env vars `ADMIN_EMAIL` + `ADMIN_PASSWORD`

---

## 4. Frontend Changes

### 4a. New Types (`types/role.ts`, update `types/user.ts`)
```typescript
// Role
interface ModulePermissions { view:boolean; create:boolean; edit:boolean; delete:boolean; export:boolean }
interface Role {
  id: string; role_name: string; description: string;
  is_system_role: boolean;
  permissions: Record<string, ModulePermissions>;
  created_at: string; updated_at: string;
}

// User (updated)
interface User {
  id: string; name: string; email: string;
  role: Role;           // populated
  role_id: string;
  designation: string;
  status: "active" | "inactive";
  created_at: string; updated_at: string;
}
```

### 4b. Updated `authStore.ts`
Add `hasPermission(module: string, action: string): boolean`:
```typescript
hasPermission: (module, action) => {
  const { user } = get();
  if (!user?.role) return false;
  if (user.role.is_system_role && user.role.role_name === "Super Admin") return true;
  return user.role.permissions?.[module]?.[action] === true;
}
```

### 4c. New Hooks
- `hooks/useUsers.ts` — `useUsersList`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`
- `hooks/useRoles.ts` — `useRoles`, `useRolesSimple`, `useCreateRole`, `useUpdateRole`, `useDeleteRole`

### 4d. New Components
```
components/users/
  UserDialog.tsx         — Create/Edit modal (name, email, password, role, designation, status)
  DeleteUserDialog.tsx   — Confirm delete

components/roles/
  RoleDialog.tsx         — Create/Edit modal
  PermissionMatrix.tsx   — Checkbox grid: modules × actions, toggle-all per row/column
  DeleteRoleDialog.tsx   — Confirm delete (warn if users assigned)
```

### 4e. New Pages
- `app/(dashboard)/users/page.tsx` — table + search + status/role filters + Add/Edit/Delete
- `app/(dashboard)/roles/page.tsx` — table + PermissionMatrix preview + Add/Edit/Delete

### 4f. Updated Files

#### `components/layout/Sidebar.tsx`
- Add `Users` and `Roles` nav items (below Projects, above Settings)
- Each NavItem checks `hasPermission(module, "view")` — hides if false
- Import `hasPermission` from `useAuthStore`

#### `app/(dashboard)/layout.tsx`
- Add permission guard: if current page module not allowed → redirect to first allowed page

#### `app/(dashboard)/settings/page.tsx`
- Settings page only visible to users with `settings.view`

---

## 5. Seed Roles (Initial Data)

### Super Admin
- `is_system_role: true`
- All modules: all actions = `true`
- Cannot be deleted or renamed

### Manager
- dashboard: view
- connectors: view, create, edit
- reports: view, export
- campaigns: view
- projects: view, create, edit, delete
- ai: view, create
- users: view
- roles: (none)
- settings: view

### Viewer
- dashboard: view
- reports: view
- campaigns: view
- projects: view
- ai: view
- (everything else: false)

---

## 6. Implementation Order

1. **Backend — Role model + service + router** (no auth changes yet)
2. **Backend — Update User model** (add role_id, designation, status)
3. **Backend — Update JWT** (include role_id in payload)
4. **Backend — Update auth middleware** (fetch role on every request)
5. **Backend — Permission middleware** (check_permission dependency)
6. **Backend — Users admin router** (CRUD for user management)
7. **Backend — Protect existing routers** with check_permission
8. **Backend — Seed script**
9. **Frontend — Types update**
10. **Frontend — authStore.hasPermission**
11. **Frontend — useUsers + useRoles hooks**
12. **Frontend — PermissionMatrix + RoleDialog + DeleteRoleDialog**
13. **Frontend — UserDialog + DeleteUserDialog**
14. **Frontend — /roles page**
15. **Frontend — /users page**
16. **Frontend — Sidebar nav items + permission gates**
17. **Frontend — Dashboard layout permission redirect**
18. **Test all endpoints + UI flows**

---

## 7. API Response Shapes

### User object (returned by all user endpoints)
```json
{
  "id": "...", "name": "...", "email": "...",
  "role": { "id":"...", "role_name":"Manager", "permissions":{...}, "is_system_role":false },
  "role_id": "...", "designation": "...", "status": "active",
  "created_at": "...", "updated_at": "..."
}
```

### Role object
```json
{
  "id": "...", "role_name": "...", "description": "...", "is_system_role": false,
  "permissions": {
    "dashboard":   {"view":true, "create":false, "edit":false, "delete":false, "export":false},
    "connectors":  {"view":true, "create":true,  "edit":true,  "delete":false, "export":false},
    ...
  },
  "created_at": "...", "updated_at": "..."
}
```

### JWT payload (updated)
```json
{ "sub": "<user_id>", "role_id": "<role_id>", "type": "access", "exp": ... }
```
