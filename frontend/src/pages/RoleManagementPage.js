import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../components/ui/dialog';
import {
    Loader2,
    Shield,
    Plus,
    Edit,
    Trash2,
    Search,
    Users,
    ShieldCheck,
    ShieldAlert,
    ChevronDown,
    ChevronRight,
    Check,
    X,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import api from '../services/api';

// Base roles (existing system roles)
const BASE_ROLES = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'broker_admin', label: 'Broker Admin' },
    { value: 'academic_head', label: 'Academic Head' },
    { value: 'admin_supervisor', label: 'Admin Supervisor' },
    { value: 'senior_mentor', label: 'Senior Mentor' },
    { value: 'junior_mentor', label: 'Junior Mentor' },
    { value: 'subjunior_mentor', label: 'Sub-Junior Mentor' },
    { value: 'finance_admin', label: 'Finance Admin' },
    { value: 'assistance', label: 'Assistance' },
    { value: 'draw_admin', label: 'Draw Admin' },
];

// Module definitions with their available permissions
const MODULES = {
    dashboard: {
        label: 'Dashboard',
        permissions: ['view']
    },
    students: {
        label: 'Students',
        permissions: ['view', 'create', 'edit', 'delete', 'transfer', 'export', 'full_access']
    },
    funding: {
        label: 'Funding',
        permissions: ['view', 'create_request', 'approve', 'reject', 'edit_amount', 'export', 'full_access']
    },
    commissions: {
        label: 'Commissions',
        permissions: ['view', 'generate', 'approve', 'release', 'edit_rate', 'export', 'full_access']
    },
    leaderboard: {
        label: 'Leaderboard',
        permissions: ['view']
    },
    requests: {
        label: 'Requests',
        permissions: ['view', 'create', 'approve', 'reject', 'full_access']
    },
    support_tickets: {
        label: 'Support Tickets',
        permissions: ['view', 'create', 'assign', 'resolve', 'delete', 'full_access']
    },
    ai_insights: {
        label: 'AI Insights',
        permissions: ['view', 'generate', 'full_access']
    },
    personnel: {
        label: 'Personnel',
        permissions: ['view', 'create', 'edit', 'deactivate', 'change_role', 'invite', 'full_access']
    },
    audit_logs: {
        label: 'Audit Logs',
        permissions: ['view', 'export', 'full_access']
    },
    settings: {
        label: 'Settings',
        permissions: ['view', 'edit', 'full_access']
    },
    role_management: {
        label: 'Role Management',
        permissions: ['view', 'create', 'edit', 'delete', 'full_access']
    }
};

// Permission labels for display
const PERMISSION_LABELS = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    transfer: 'Transfer',
    export: 'Export',
    create_request: 'Create Request',
    approve: 'Approve',
    reject: 'Reject',
    edit_amount: 'Edit Amount',
    generate: 'Generate',
    release: 'Release',
    edit_rate: 'Edit Rate',
    assign: 'Assign',
    resolve: 'Resolve',
    deactivate: 'Deactivate',
    change_role: 'Change Role',
    invite: 'Invite Users',
    full_access: 'Full Access'
};

// Default permissions for base roles
const getDefaultPermissions = (baseRole) => {
    const permissions = {};
    
    // Initialize all modules with no permissions
    Object.keys(MODULES).forEach(module => {
        permissions[module] = {};
        MODULES[module].permissions.forEach(perm => {
            permissions[module][perm] = false;
        });
    });
    
    // Set permissions based on base role
    switch (baseRole) {
        case 'super_admin':
            // Super admin gets everything
            Object.keys(MODULES).forEach(module => {
                permissions[module].full_access = true;
                MODULES[module].permissions.forEach(perm => {
                    permissions[module][perm] = true;
                });
            });
            break;
        case 'admin':
        case 'broker_admin':
            // Admins get most permissions except role management
            Object.keys(MODULES).forEach(module => {
                if (module !== 'role_management') {
                    permissions[module].view = true;
                    if (MODULES[module].permissions.includes('approve')) permissions[module].approve = true;
                    if (MODULES[module].permissions.includes('edit')) permissions[module].edit = true;
                }
            });
            permissions.students.full_access = true;
            permissions.funding.full_access = true;
            permissions.personnel.view = true;
            permissions.personnel.edit = true;
            break;
        case 'academic_head':
            permissions.dashboard.view = true;
            permissions.students.view = true;
            permissions.students.edit = true;
            permissions.funding.view = true;
            permissions.commissions.view = true;
            permissions.commissions.approve = true;
            permissions.requests.view = true;
            permissions.requests.approve = true;
            permissions.leaderboard.view = true;
            permissions.personnel.view = true;
            break;
        case 'senior_mentor':
        case 'junior_mentor':
        case 'subjunior_mentor':
            permissions.dashboard.view = true;
            permissions.students.view = true;
            permissions.students.create = true;
            permissions.students.edit = true;
            permissions.funding.view = true;
            permissions.funding.create_request = true;
            permissions.commissions.view = true;
            permissions.leaderboard.view = true;
            permissions.requests.view = true;
            permissions.requests.create = true;
            permissions.support_tickets.view = true;
            permissions.support_tickets.create = true;
            break;
        case 'finance_admin':
            permissions.dashboard.view = true;
            permissions.funding.view = true;
            permissions.funding.approve = true;
            permissions.funding.export = true;
            permissions.commissions.view = true;
            permissions.commissions.approve = true;
            permissions.commissions.release = true;
            permissions.commissions.export = true;
            break;
        case 'draw_admin':
            permissions.dashboard.view = true;
            permissions.students.view = true;
            permissions.students.edit = true;
            permissions.funding.view = true;
            permissions.funding.create_request = true;
            permissions.leaderboard.view = true;
            break;
        default:
            permissions.dashboard.view = true;
            break;
    }
    
    return permissions;
};

const RoleManagementPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        base_role: 'junior_mentor',
        is_active: true,
        permissions: getDefaultPermissions('junior_mentor')
    });
    
    // Expanded modules in the form
    const [expandedModules, setExpandedModules] = useState({});

    const canManage = hasRole(['super_admin']);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const response = await api.get('/roles');
            setRoles(response.data);
        } catch (error) {
            console.error('Failed to fetch roles:', error);
            // If endpoint doesn't exist yet, use empty array
            setRoles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleBaseRoleChange = (baseRole) => {
        setFormData({
            ...formData,
            base_role: baseRole,
            permissions: getDefaultPermissions(baseRole)
        });
    };

    const toggleModule = (module) => {
        setExpandedModules({
            ...expandedModules,
            [module]: !expandedModules[module]
        });
    };

    const togglePermission = (module, permission) => {
        const newPermissions = { ...formData.permissions };
        newPermissions[module] = { ...newPermissions[module] };
        newPermissions[module][permission] = !newPermissions[module][permission];
        
        // If full_access is toggled on, enable all permissions
        if (permission === 'full_access' && newPermissions[module][permission]) {
            MODULES[module].permissions.forEach(perm => {
                newPermissions[module][perm] = true;
            });
        }
        
        // If full_access is toggled off, don't change other permissions
        // If any permission is toggled off, also turn off full_access
        if (permission !== 'full_access' && !newPermissions[module][permission]) {
            newPermissions[module].full_access = false;
        }
        
        setFormData({ ...formData, permissions: newPermissions });
    };

    const toggleAllModulePermissions = (module, enabled) => {
        const newPermissions = { ...formData.permissions };
        newPermissions[module] = { ...newPermissions[module] };
        MODULES[module].permissions.forEach(perm => {
            newPermissions[module][perm] = enabled;
        });
        setFormData({ ...formData, permissions: newPermissions });
    };

    const openCreateDialog = () => {
        setEditingRole(null);
        setFormData({
            name: '',
            description: '',
            base_role: 'junior_mentor',
            is_active: true,
            permissions: getDefaultPermissions('junior_mentor')
        });
        setExpandedModules({});
        setDialogOpen(true);
    };

    const openEditDialog = (role) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            description: role.description || '',
            base_role: role.base_role,
            is_active: role.is_active,
            permissions: role.permissions || getDefaultPermissions(role.base_role)
        });
        setExpandedModules({});
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast({ title: 'Error', description: 'Role name is required', variant: 'destructive' });
            return;
        }
        
        setSaving(true);
        try {
            if (editingRole) {
                await api.put(`/roles/${editingRole.id}`, formData);
                toast({ title: 'Success', description: 'Role updated successfully' });
            } else {
                await api.post('/roles', formData);
                toast({ title: 'Success', description: 'Role created successfully' });
            }
            setDialogOpen(false);
            fetchRoles();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to save role',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!roleToDelete) return;
        
        try {
            await api.delete(`/roles/${roleToDelete.id}`);
            toast({ title: 'Success', description: 'Role deleted successfully' });
            setDeleteDialogOpen(false);
            setRoleToDelete(null);
            fetchRoles();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to delete role',
                variant: 'destructive'
            });
        }
    };

    const countPermissions = (permissions) => {
        let count = 0;
        Object.values(permissions || {}).forEach(module => {
            Object.values(module).forEach(enabled => {
                if (enabled) count++;
            });
        });
        return count;
    };

    const countModules = (permissions) => {
        let count = 0;
        Object.entries(permissions || {}).forEach(([module, perms]) => {
            if (Object.values(perms).some(v => v)) count++;
        });
        return count;
    };

    const filteredRoles = roles.filter(role =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="role-management-page">
                <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="font-heading text-2xl text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">Only Super Admins can access Role Management.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="role-management-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Role Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Create and manage custom roles with specific permissions
                    </p>
                </div>
                <Button
                    onClick={openCreateDialog}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                    data-testid="create-role-btn"
                >
                    <Plus className="w-4 h-4" />
                    Create Custom Role
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{roles.length}</p>
                                <p className="text-xs text-muted-foreground uppercase">Custom Roles</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">
                                    {roles.filter(r => r.is_active).length}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase">Active Roles</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">
                                    {roles.reduce((acc, r) => acc + (r.users_count || 0), 0)}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase">Users Assigned</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card className="bg-card border-border">
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search roles..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-background border-border text-foreground"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Roles Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredRoles.length === 0 ? (
                        <div className="text-center py-20">
                            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground mb-4">No custom roles found</p>
                            <Button onClick={openCreateDialog} className="gap-2">
                                <Plus className="w-4 h-4" />
                                Create First Role
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Role Name</TableHead>
                                        <TableHead className="text-muted-foreground">Base Role</TableHead>
                                        <TableHead className="text-muted-foreground">Modules</TableHead>
                                        <TableHead className="text-muted-foreground">Permissions</TableHead>
                                        <TableHead className="text-muted-foreground">Users</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRoles.map((role) => (
                                        <TableRow key={role.id} className="border-border">
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground font-medium">{role.name}</p>
                                                    {role.description && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                            {role.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-purple-500/20 text-purple-400 border-0">
                                                    {BASE_ROLES.find(r => r.value === role.base_role)?.label || role.base_role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-border">
                                                    {countModules(role.permissions)} modules
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-border">
                                                    {countPermissions(role.permissions)} permissions
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-foreground">{role.users_count || 0}</span>
                                            </TableCell>
                                            <TableCell>
                                                {role.is_active ? (
                                                    <Badge className="bg-green-500/20 text-green-400 border-0">Active</Badge>
                                                ) : (
                                                    <Badge className="bg-red-500/20 text-red-400 border-0">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openEditDialog(role)}
                                                        className="text-muted-foreground hover:text-primary"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setRoleToDelete(role);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                        className="text-muted-foreground hover:text-red-400"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Role Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            {editingRole ? 'Edit Custom Role' : 'Create Custom Role'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Configure role permissions and module access
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Role Name *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder="e.g., Senior Account Manager"
                                    className="bg-background border-border text-foreground"
                                    data-testid="role-name-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Base Role *</Label>
                                <Select
                                    value={formData.base_role}
                                    onValueChange={handleBaseRoleChange}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {BASE_ROLES.map(role => (
                                            <SelectItem key={role.value} value={role.value}>
                                                {role.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="Describe the role and its responsibilities"
                                className="bg-background border-border text-foreground"
                                rows={2}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                            />
                            <Label htmlFor="is_active" className="text-foreground cursor-pointer">
                                Active
                            </Label>
                        </div>
                        
                        {/* Module Access & Permissions */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                <h3 className="font-heading text-lg text-foreground">Module Access & Permissions</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Select which modules this role can access and configure granular permissions
                            </p>
                            
                            <div className="space-y-2">
                                {Object.entries(MODULES).map(([moduleKey, moduleConfig]) => {
                                    const modulePerms = formData.permissions[moduleKey] || {};
                                    const hasAnyPermission = Object.values(modulePerms).some(v => v);
                                    const isExpanded = expandedModules[moduleKey];
                                    
                                    return (
                                        <div key={moduleKey} className="border border-border rounded-lg overflow-hidden">
                                            {/* Module Header */}
                                            <div 
                                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                                                    hasAnyPermission ? 'bg-primary/5' : 'bg-background'
                                                } hover:bg-muted/50`}
                                                onClick={() => toggleModule(moduleKey)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                    <span className="text-foreground font-medium">{moduleConfig.label}</span>
                                                    {hasAnyPermission && (
                                                        <Badge className="bg-primary/20 text-primary border-0 text-xs">
                                                            {Object.values(modulePerms).filter(v => v).length} permissions
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs"
                                                        onClick={() => toggleAllModulePermissions(moduleKey, true)}
                                                    >
                                                        <Check className="w-3 h-3 mr-1" /> All
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs"
                                                        onClick={() => toggleAllModulePermissions(moduleKey, false)}
                                                    >
                                                        <X className="w-3 h-3 mr-1" /> None
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {/* Module Permissions */}
                                            {isExpanded && (
                                                <div className="p-3 bg-muted/30 border-t border-border">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                        {moduleConfig.permissions.map(perm => (
                                                            <div
                                                                key={perm}
                                                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                                                    modulePerms[perm] 
                                                                        ? 'bg-primary/10 border-primary/30' 
                                                                        : 'bg-background border-border hover:border-primary/30'
                                                                }`}
                                                                onClick={() => togglePermission(moduleKey, perm)}
                                                            >
                                                                <Checkbox
                                                                    checked={modulePerms[perm] || false}
                                                                    onCheckedChange={() => togglePermission(moduleKey, perm)}
                                                                    className="pointer-events-none"
                                                                />
                                                                <span className={`text-sm ${modulePerms[perm] ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                                    {PERMISSION_LABELS[perm] || perm}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            className="border-border"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !formData.name}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingRole ? 'Update Role' : 'Create Role')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Delete Role</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            This action cannot be undone
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to delete the role <strong className="text-foreground">{roleToDelete?.name}</strong>?
                        {roleToDelete?.users_count > 0 && (
                            <span className="block mt-2 text-amber-500">
                                Warning: {roleToDelete.users_count} user(s) are assigned to this role.
                            </span>
                        )}
                    </p>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            className="border-border"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            className="bg-red-500 text-white hover:bg-red-600"
                        >
                            Delete Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RoleManagementPage;
