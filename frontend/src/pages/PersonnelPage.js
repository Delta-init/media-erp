import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { personnelAPI, usersAPI, invitationsAPI } from '../services/api';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
    Loader2,
    Users,
    UserPlus,
    Edit,
    Trash2,
    RefreshCw,
    Search,
    UserCheck,
    UserX,
    RotateCcw,
    Phone,
    Mail,
    Building2,
    Shield,
    Send,
    Clock,
    XCircle,
    Copy,
    CheckCircle,
    AlertCircle,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const USER_ROLES = [
    { value: 'super_admin', label: 'Super Admin', color: 'bg-red-500/20 text-red-400' },
    { value: 'admin', label: 'Admin', color: 'bg-orange-500/20 text-orange-400' },
    { value: 'broker_admin', label: 'Broker Admin', color: 'bg-amber-500/20 text-amber-400' },
    { value: 'academic_head', label: 'Academic Head', color: 'bg-purple-500/20 text-purple-400' },
    { value: 'admin_supervisor', label: 'Admin Supervisor', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'senior_mentor', label: 'Senior Mentor', color: 'bg-cyan-500/20 text-cyan-400' },
    { value: 'junior_mentor', label: 'Junior Mentor', color: 'bg-green-500/20 text-green-400' },
    { value: 'subjunior_mentor', label: 'Sub-Junior Mentor', color: 'bg-teal-500/20 text-teal-400' },
    { value: 'finance_admin', label: 'Finance Admin', color: 'bg-yellow-500/20 text-yellow-400' },
    { value: 'assistance', label: 'Assistance', color: 'bg-slate-500/20 text-slate-400' },
    { value: 'draw_admin', label: 'Draw Admin', color: 'bg-pink-500/20 text-pink-400' },
    { value: 'pending', label: 'Pending Approval', color: 'bg-gray-500/20 text-gray-400' },
];

const PersonnelPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [personnel, setPersonnel] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [mentors, setMentors] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const [mainTab, setMainTab] = useState('personnel');
    
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [editForm, setEditForm] = useState({
        full_name: '',
        email: '',
        role: '',
        phone: '',
        department: '',
        senior_mentor_id: '',
        commission_rate: 4,
        custom_role_id: '',
    });
    const [saving, setSaving] = useState(false);
    const [customRoles, setCustomRoles] = useState([]);

    const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
    const [personToDeactivate, setPersonToDeactivate] = useState(null);
    
    // Invite dialog state
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({
        email: '',
        role: 'junior_mentor',
        message: '',
    });
    const [sendingInvite, setSendingInvite] = useState(false);

    const canManage = hasRole(['super_admin', 'admin', 'broker_admin']);
    const canView = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [personnelRes, statsRes, mentorsRes, invitationsRes, rolesRes] = await Promise.all([
                personnelAPI.getAll({ is_active: activeTab === 'active' ? true : activeTab === 'inactive' ? false : undefined }),
                personnelAPI.getStats(),
                usersAPI.getMentors(),
                invitationsAPI.getAll({ status: 'pending' }),
                hasRole(['super_admin']) ? api.get('/roles') : Promise.resolve({ data: [] }),
            ]);
            setPersonnel(personnelRes.data);
            setStats(statsRes.data);
            setMentors(mentorsRes.data);
            setInvitations(invitationsRes.data);
            setCustomRoles(rolesRes.data || []);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch personnel data',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canView) {
            fetchData();
        }
    }, [activeTab]);

    const getRoleBadge = (role) => {
        const roleInfo = USER_ROLES.find(r => r.value === role) || { label: role, color: 'bg-slate-500/20 text-slate-400' };
        return (
            <Badge variant="outline" className={`${roleInfo.color} border-0`}>
                {roleInfo.label}
            </Badge>
        );
    };

    const filteredPersonnel = personnel.filter(p => {
        const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            p.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = !roleFilter || p.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const openEditDialog = (person) => {
        setSelectedPerson(person);
        setEditForm({
            full_name: person.full_name,
            email: person.email,
            role: person.role,
            phone: person.phone || '',
            department: person.department || '',
            senior_mentor_id: person.senior_mentor_id || '',
            commission_rate: person.commission_rate || 4,
            custom_role_id: person.custom_role_id || '',
        });
        setEditDialogOpen(true);
    };

    const handleUpdate = async () => {
        if (!selectedPerson) return;
        
        setSaving(true);
        try {
            const updateData = { ...editForm };
            if (!updateData.phone) delete updateData.phone;
            if (!updateData.department) delete updateData.department;
            if (!updateData.senior_mentor_id) delete updateData.senior_mentor_id;
            
            await personnelAPI.update(selectedPerson.id, updateData);
            toast({ title: 'Success', description: 'Personnel updated successfully' });
            setEditDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update personnel',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const openDeactivateDialog = (person) => {
        setPersonToDeactivate(person);
        setDeactivateDialogOpen(true);
    };

    const handleDeactivate = async () => {
        if (!personToDeactivate) return;
        
        try {
            await personnelAPI.deactivate(personToDeactivate.id);
            toast({ title: 'Success', description: 'Personnel deactivated successfully' });
            setDeactivateDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to deactivate personnel',
                variant: 'destructive',
            });
        }
    };

    const handleReactivate = async (personId) => {
        try {
            await personnelAPI.reactivate(personId);
            toast({ title: 'Success', description: 'Personnel reactivated successfully' });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to reactivate personnel',
                variant: 'destructive',
            });
        }
    };
    
    // Invitation handlers
    const handleSendInvite = async () => {
        if (!inviteForm.email || !inviteForm.role) {
            toast({ title: 'Error', description: 'Please fill in email and role', variant: 'destructive' });
            return;
        }
        
        setSendingInvite(true);
        try {
            await invitationsAPI.create(inviteForm);
            toast({ 
                title: 'Invitation Sent!', 
                description: `Invitation email sent to ${inviteForm.email} (MOCK MODE)` 
            });
            setInviteDialogOpen(false);
            setInviteForm({ email: '', role: 'junior_mentor', message: '' });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to send invitation',
                variant: 'destructive',
            });
        } finally {
            setSendingInvite(false);
        }
    };
    
    const handleCancelInvitation = async (invitationId) => {
        try {
            await invitationsAPI.cancel(invitationId);
            toast({ title: 'Success', description: 'Invitation cancelled' });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to cancel invitation',
                variant: 'destructive',
            });
        }
    };
    
    const handleResendInvitation = async (invitationId) => {
        try {
            await invitationsAPI.resend(invitationId);
            toast({ title: 'Success', description: 'Invitation resent (MOCK MODE)' });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to resend invitation',
                variant: 'destructive',
            });
        }
    };
    
    const copyInviteLink = (token) => {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/login?token=${token}`;
        navigator.clipboard.writeText(link);
        toast({ title: 'Copied!', description: 'Invitation link copied to clipboard' });
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="personnel-page">
                <Users className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="font-heading text-2xl text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to view personnel.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="personnel-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Personnel Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage staff accounts, roles, and invitations
                    </p>
                </div>
                <div className="flex gap-2">
                    {canManage && (
                        <Button
                            onClick={() => setInviteDialogOpen(true)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                            data-testid="invite-user-btn"
                        >
                            <UserPlus className="w-4 h-4" />
                            Invite User
                        </Button>
                    )}
                    <Button
                        onClick={fetchData}
                        variant="outline"
                        className="border-border gap-2"
                        data-testid="refresh-btn"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Total Staff</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <UserCheck className="w-5 h-5 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{stats.active}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{stats.pending_users || 0}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Pending</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{stats.pending_invitations || 0}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Invites</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{stats.mentors_with_students}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Mentors</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Main Tabs - Personnel / Invitations */}
            <Tabs value={mainTab} onValueChange={setMainTab}>
                <TabsList className="bg-background">
                    <TabsTrigger value="personnel" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                        <Users className="w-4 h-4" />
                        Personnel
                    </TabsTrigger>
                    <TabsTrigger value="invitations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                        <Mail className="w-4 h-4" />
                        Pending Invitations
                        {invitations.length > 0 && (
                            <Badge className="ml-1 bg-amber-500 text-white">{invitations.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Personnel Tab */}
                <TabsContent value="personnel" className="mt-4 space-y-4">
                    {/* Tabs & Filters */}
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
                                    <TabsList className="bg-background">
                                        <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                            Active
                                        </TabsTrigger>
                                        <TabsTrigger value="inactive" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                            Inactive
                                        </TabsTrigger>
                                        <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                            All
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                
                                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by name or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 bg-background border-border text-foreground"
                                        />
                                    </div>
                                    <Select value={roleFilter || "all"} onValueChange={(v) => setRoleFilter(v === "all" ? "" : v)}>
                                        <SelectTrigger className="w-full sm:w-48 bg-background border-border text-foreground">
                                            <SelectValue placeholder="Filter by role" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border">
                                            <SelectItem value="all">All Roles</SelectItem>
                                            {USER_ROLES.map(role => (
                                                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table */}
                    <Card className="bg-card border-border">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : filteredPersonnel.length === 0 ? (
                                <div className="text-center py-20">
                                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-muted-foreground">No personnel found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-border hover:bg-transparent">
                                                <TableHead className="text-muted-foreground">Name</TableHead>
                                                <TableHead className="text-muted-foreground">Email</TableHead>
                                                <TableHead className="text-muted-foreground">Role</TableHead>
                                                <TableHead className="text-muted-foreground">Commission %</TableHead>
                                                <TableHead className="text-muted-foreground">Students</TableHead>
                                                <TableHead className="text-muted-foreground">Status</TableHead>
                                                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPersonnel.map((person) => (
                                                <TableRow key={person.id} className="border-border">
                                                    <TableCell>
                                                        <div>
                                                            <p className="text-foreground font-medium">{person.full_name}</p>
                                                            {person.department && (
                                                                <p className="text-xs text-muted-foreground">{person.department}</p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{person.email}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            {getRoleBadge(person.role)}
                                                            {person.custom_role_name && (
                                                                <Badge className="bg-indigo-500/20 text-indigo-400 border-0 text-xs">
                                                                    + {person.custom_role_name}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {['junior_mentor', 'senior_mentor', 'subjunior_mentor'].includes(person.role) ? (
                                                            <Badge className="bg-purple-500/20 text-purple-400 border-0 font-mono">
                                                                {person.commission_rate || 4}%
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-foreground">{person.student_count}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {person.role === 'pending' ? (
                                                            <Badge className="bg-amber-500/20 text-amber-400 border-0">Pending Approval</Badge>
                                                        ) : person.is_active !== false ? (
                                                            <Badge className="bg-green-500/20 text-green-400 border-0">Active</Badge>
                                                        ) : (
                                                            <Badge className="bg-red-500/20 text-red-400 border-0">Inactive</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {canManage && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => openEditDialog(person)}
                                                                        className="text-muted-foreground hover:text-primary"
                                                                        data-testid={`edit-${person.id}`}
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </Button>
                                                                    {person.is_active !== false ? (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => openDeactivateDialog(person)}
                                                                            className="text-muted-foreground hover:text-red-400"
                                                                            disabled={person.id === user?.id}
                                                                            data-testid={`deactivate-${person.id}`}
                                                                        >
                                                                            <UserX className="w-4 h-4" />
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleReactivate(person.id)}
                                                                            className="text-muted-foreground hover:text-green-400"
                                                                            data-testid={`reactivate-${person.id}`}
                                                                        >
                                                                            <RotateCcw className="w-4 h-4" />
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
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
                </TabsContent>

                {/* Invitations Tab */}
                <TabsContent value="invitations" className="mt-4">
                    <Card className="bg-card border-border">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : invitations.length === 0 ? (
                                <div className="text-center py-20">
                                    <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-muted-foreground">No pending invitations</p>
                                    <Button
                                        onClick={() => setInviteDialogOpen(true)}
                                        className="mt-4 gap-2"
                                        data-testid="invite-first-user-btn"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Send First Invitation
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-border hover:bg-transparent">
                                                <TableHead className="text-muted-foreground">Email</TableHead>
                                                <TableHead className="text-muted-foreground">Role</TableHead>
                                                <TableHead className="text-muted-foreground">Invited By</TableHead>
                                                <TableHead className="text-muted-foreground">Sent</TableHead>
                                                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invitations.map((inv) => (
                                                <TableRow key={inv.id} className="border-border">
                                                    <TableCell className="text-foreground font-medium">{inv.email}</TableCell>
                                                    <TableCell>{getRoleBadge(inv.role)}</TableCell>
                                                    <TableCell className="text-muted-foreground">{inv.invited_by_name}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {new Date(inv.created_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => copyInviteLink(inv.token)}
                                                                className="text-muted-foreground hover:text-primary"
                                                                title="Copy invite link"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleResendInvitation(inv.id)}
                                                                className="text-muted-foreground hover:text-primary"
                                                                title="Resend invitation"
                                                            >
                                                                <Send className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleCancelInvitation(inv.id)}
                                                                className="text-muted-foreground hover:text-red-400"
                                                                title="Cancel invitation"
                                                            >
                                                                <XCircle className="w-4 h-4" />
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
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Edit Personnel</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Update personnel information and role
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Full Name</Label>
                            <Input
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                                className="bg-background border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Email</Label>
                            <Input
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                                className="bg-background border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Role</Label>
                            <Select
                                value={editForm.role}
                                onValueChange={(v) => setEditForm({...editForm, role: v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {USER_ROLES.filter(r => r.value !== 'pending').map(role => (
                                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {['junior_mentor', 'subjunior_mentor'].includes(editForm.role) && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Senior Mentor</Label>
                                <Select
                                    value={editForm.senior_mentor_id}
                                    onValueChange={(v) => setEditForm({...editForm, senior_mentor_id: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue placeholder="Select senior mentor" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        <SelectItem value="none">None</SelectItem>
                                        {mentors.filter(m => m.role === 'senior_mentor').map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {/* Commission Rate - Only for mentors */}
                        {['junior_mentor', 'senior_mentor', 'subjunior_mentor'].includes(editForm.role) && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Commission Rate (%)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={editForm.commission_rate}
                                        onChange={(e) => setEditForm({...editForm, commission_rate: parseFloat(e.target.value) || 0})}
                                        className="bg-background border-border text-foreground"
                                        data-testid="commission-rate-input"
                                    />
                                    <span className="text-muted-foreground">%</span>
                                </div>
                                <p className="text-xs text-muted-foreground">Default is 4%. This affects commission calculation.</p>
                            </div>
                        )}
                        {/* Custom Role - Super Admin only */}
                        {customRoles.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Custom Role (Optional)</Label>
                                <Select
                                    value={editForm.custom_role_id || "none"}
                                    onValueChange={(v) => setEditForm({...editForm, custom_role_id: v === "none" ? "" : v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue placeholder="Select custom role" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        <SelectItem value="none">No Custom Role</SelectItem>
                                        {customRoles.filter(r => r.is_active).map(role => (
                                            <SelectItem key={role.id} value={role.id}>
                                                {role.name} ({USER_ROLES.find(r => r.value === role.base_role)?.label || role.base_role})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Custom roles provide additional granular permissions on top of the base role.</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Phone</Label>
                                <Input
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                                    className="bg-background border-border text-foreground"
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Department</Label>
                                <Input
                                    value={editForm.department}
                                    onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                                    className="bg-background border-border text-foreground"
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={saving}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deactivate Dialog */}
            <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Deactivate Personnel</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            This will prevent the user from logging in
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to deactivate <strong className="text-foreground">{personToDeactivate?.full_name}</strong>?
                        They will no longer be able to access the system.
                    </p>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeactivate}
                            className="bg-red-500 text-white hover:bg-red-600"
                        >
                            Deactivate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Invite User Dialog */}
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-primary" />
                            Invite New User
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Send an invitation email with a pre-assigned role
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Email Address *</Label>
                            <Input
                                type="email"
                                value={inviteForm.email}
                                onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                                className="bg-background border-border text-foreground"
                                placeholder="newuser@example.com"
                                data-testid="invite-email-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Role *</Label>
                            <Select
                                value={inviteForm.role}
                                onValueChange={(v) => setInviteForm({...inviteForm, role: v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground" data-testid="invite-role-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {USER_ROLES.filter(r => r.value !== 'pending').map(role => (
                                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Personal Message (Optional)</Label>
                            <Textarea
                                value={inviteForm.message}
                                onChange={(e) => setInviteForm({...inviteForm, message: e.target.value})}
                                className="bg-background border-border text-foreground"
                                placeholder="Welcome to the team! Looking forward to working with you."
                                rows={3}
                            />
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border">
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                The user will receive an email with a registration link. When they sign up using that link, they'll automatically be assigned the selected role.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSendInvite}
                            disabled={sendingInvite || !inviteForm.email}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                            data-testid="send-invite-btn"
                        >
                            {sendingInvite ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Invitation
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PersonnelPage;
