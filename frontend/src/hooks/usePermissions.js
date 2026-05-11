import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Default permissions for base roles (fallback when no custom role)
const DEFAULT_ROLE_PERMISSIONS = {
    super_admin: {
        // Super admin has all permissions
        dashboard: { view: true },
        students: { view: true, create: true, edit: true, delete: true, transfer: true, export: true, full_access: true },
        funding: { view: true, create_request: true, approve: true, reject: true, edit_amount: true, export: true, full_access: true },
        commissions: { view: true, generate: true, approve: true, release: true, edit_rate: true, export: true, full_access: true },
        leaderboard: { view: true },
        requests: { view: true, create: true, approve: true, reject: true, full_access: true },
        support_tickets: { view: true, create: true, assign: true, resolve: true, delete: true, full_access: true },
        ai_insights: { view: true, generate: true, full_access: true },
        personnel: { view: true, create: true, edit: true, deactivate: true, change_role: true, invite: true, full_access: true },
        audit_logs: { view: true, export: true, full_access: true },
        settings: { view: true, edit: true, full_access: true },
        role_management: { view: true, create: true, edit: true, delete: true, full_access: true }
    },
    admin: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true, delete: true, transfer: true, export: true, full_access: true },
        funding: { view: true, create_request: true, approve: true, reject: true, edit_amount: true, export: true, full_access: true },
        commissions: { view: true, approve: true, export: true },
        leaderboard: { view: true },
        requests: { view: true, create: true, approve: true, reject: true, full_access: true },
        support_tickets: { view: true, create: true, assign: true, resolve: true },
        ai_insights: { view: true, generate: true },
        personnel: { view: true, edit: true, invite: true },
        audit_logs: { view: true },
        settings: { view: true, edit: true },
        role_management: {}
    },
    broker_admin: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true, delete: true, transfer: true, export: true, full_access: true },
        funding: { view: true, create_request: true, approve: true, reject: true, edit_amount: true, export: true, full_access: true },
        commissions: { view: true, approve: true, export: true },
        leaderboard: { view: true },
        requests: { view: true, create: true, approve: true, reject: true, full_access: true },
        support_tickets: { view: true, create: true, assign: true, resolve: true },
        ai_insights: { view: true, generate: true },
        personnel: { view: true, edit: true, invite: true },
        audit_logs: { view: true },
        settings: { view: true },
        role_management: {}
    },
    academic_head: {
        dashboard: { view: true },
        students: { view: true, edit: true },
        funding: { view: true },
        commissions: { view: true, approve: true },
        leaderboard: { view: true },
        requests: { view: true, approve: true, reject: true },
        support_tickets: { view: true, create: true },
        ai_insights: { view: true },
        personnel: { view: true },
        audit_logs: {},
        settings: {},
        role_management: {}
    },
    admin_supervisor: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true },
        funding: { view: true, create_request: true },
        commissions: { view: true },
        leaderboard: { view: true },
        requests: { view: true, create: true, approve: true },
        support_tickets: { view: true, create: true, assign: true },
        ai_insights: { view: true },
        personnel: { view: true },
        audit_logs: {},
        settings: {},
        role_management: {}
    },
    senior_mentor: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true },
        funding: { view: true, create_request: true },
        commissions: { view: true },
        leaderboard: { view: true },
        requests: { view: true, create: true },
        support_tickets: { view: true, create: true },
        ai_insights: { view: true },
        personnel: {},
        audit_logs: {},
        settings: {},
        role_management: {}
    },
    junior_mentor: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true },
        funding: { view: true, create_request: true },
        commissions: { view: true },
        leaderboard: { view: true },
        requests: { view: true, create: true },
        support_tickets: { view: true, create: true },
        ai_insights: { view: true },
        personnel: {},
        audit_logs: {},
        settings: {},
        role_management: {}
    },
    subjunior_mentor: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true },
        funding: { view: true, create_request: true },
        commissions: { view: true },
        leaderboard: { view: true },
        requests: { view: true, create: true },
        support_tickets: { view: true, create: true },
        ai_insights: {},
        personnel: {},
        audit_logs: {},
        settings: {},
        role_management: {}
    },
    finance_admin: {
        dashboard: { view: true },
        students: { view: true },
        funding: { view: true, approve: true, reject: true, export: true },
        commissions: { view: true, approve: true, release: true, export: true },
        leaderboard: { view: true },
        requests: { view: true },
        support_tickets: { view: true },
        ai_insights: {},
        personnel: {},
        audit_logs: { view: true },
        settings: {},
        role_management: {}
    },
    assistance: {
        dashboard: { view: true },
        students: { view: true, create: true, edit: true },
        funding: { view: true, create_request: true },
        commissions: {},
        leaderboard: { view: true },
        requests: { view: true, create: true },
        support_tickets: { view: true, create: true },
        ai_insights: {},
        personnel: {},
        audit_logs: {},
        settings: {},
        role_management: {}
    },
    draw_admin: {
        dashboard: { view: true },
        students: { view: true, edit: true },
        funding: { view: true, create_request: true },
        commissions: {},
        leaderboard: { view: true },
        requests: { view: true, create: true },
        support_tickets: { view: true, create: true },
        ai_insights: {},
        personnel: {},
        audit_logs: {},
        settings: {},
        role_management: {}
    },
    pending: {
        // Pending users have no permissions
        dashboard: {},
        students: {},
        funding: {},
        commissions: {},
        leaderboard: {},
        requests: {},
        support_tickets: {},
        ai_insights: {},
        personnel: {},
        audit_logs: {},
        settings: {},
        role_management: {}
    }
};

/**
 * Hook to check user permissions based on base role and custom role
 * Usage:
 *   const { hasPermission, can, loading } = usePermissions();
 *   hasPermission('students', 'create') // true/false
 *   can.students.create // true/false
 *   can.funding.approve // true/false
 */
export const usePermissions = () => {
    const { user } = useAuth();
    const [customRolePermissions, setCustomRolePermissions] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch custom role permissions if user has a custom role
    useEffect(() => {
        const fetchCustomRole = async () => {
            if (user?.custom_role_id) {
                try {
                    const response = await api.get(`/roles/${user.custom_role_id}`);
                    setCustomRolePermissions(response.data.permissions || {});
                } catch (error) {
                    console.error('Failed to fetch custom role:', error);
                    setCustomRolePermissions(null);
                }
            } else {
                setCustomRolePermissions(null);
            }
            setLoading(false);
        };

        if (user) {
            fetchCustomRole();
        } else {
            setLoading(false);
        }
    }, [user?.custom_role_id, user?.id]);

    /**
     * Check if user has a specific permission
     * Custom role permissions override base role permissions
     */
    const hasPermission = useCallback((module, action) => {
        if (!user) return false;

        // Super admin always has all permissions
        if (user.role === 'super_admin') return true;

        // Check custom role permissions first (they override base role)
        if (customRolePermissions && customRolePermissions[module]) {
            const modulePerms = customRolePermissions[module];
            // Check for full_access
            if (modulePerms.full_access) return true;
            // Check specific action
            if (modulePerms[action] !== undefined) {
                return modulePerms[action];
            }
        }

        // Fall back to base role permissions
        const basePerms = DEFAULT_ROLE_PERMISSIONS[user.role];
        if (basePerms && basePerms[module]) {
            if (basePerms[module].full_access) return true;
            return basePerms[module][action] || false;
        }

        return false;
    }, [user, customRolePermissions]);

    /**
     * Check if user has access to a module (any permission)
     */
    const hasModuleAccess = useCallback((module) => {
        if (!user) return false;
        if (user.role === 'super_admin') return true;

        // Check custom role
        if (customRolePermissions && customRolePermissions[module]) {
            const modulePerms = customRolePermissions[module];
            if (Object.values(modulePerms).some(v => v === true)) return true;
        }

        // Check base role
        const basePerms = DEFAULT_ROLE_PERMISSIONS[user.role];
        if (basePerms && basePerms[module]) {
            if (Object.values(basePerms[module]).some(v => v === true)) return true;
        }

        return false;
    }, [user, customRolePermissions]);

    /**
     * Get all permissions for current user merged from base and custom role
     */
    const getAllPermissions = useCallback(() => {
        if (!user) return {};

        const basePerms = DEFAULT_ROLE_PERMISSIONS[user.role] || {};
        
        // If no custom role, return base permissions
        if (!customRolePermissions) return basePerms;

        // Merge permissions (custom role overrides base)
        const merged = {};
        const allModules = new Set([...Object.keys(basePerms), ...Object.keys(customRolePermissions)]);
        
        allModules.forEach(module => {
            merged[module] = {
                ...(basePerms[module] || {}),
                ...(customRolePermissions[module] || {})
            };
        });

        return merged;
    }, [user, customRolePermissions]);

    // Build a convenient object for checking permissions
    const buildCanObject = useCallback(() => {
        const modules = [
            'dashboard', 'students', 'funding', 'commissions', 'leaderboard',
            'requests', 'support_tickets', 'ai_insights', 'personnel',
            'audit_logs', 'settings', 'role_management'
        ];
        
        const actions = [
            'view', 'create', 'edit', 'delete', 'transfer', 'export',
            'create_request', 'approve', 'reject', 'edit_amount',
            'generate', 'release', 'edit_rate', 'assign', 'resolve',
            'deactivate', 'change_role', 'invite', 'full_access'
        ];

        const can = {};
        modules.forEach(module => {
            can[module] = {};
            actions.forEach(action => {
                can[module][action] = hasPermission(module, action);
            });
        });

        return can;
    }, [hasPermission]);

    return {
        hasPermission,
        hasModuleAccess,
        getAllPermissions,
        can: buildCanObject(),
        loading,
        customRolePermissions,
        baseRolePermissions: user ? DEFAULT_ROLE_PERMISSIONS[user.role] : {}
    };
};

export default usePermissions;
