import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { retentionAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
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
    ShieldAlert,
    UserPlus,
    RefreshCw,
    Search,
    DollarSign,
    Users,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    Activity,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const RETENTION_STATUSES = [
    { value: 'pending_assignment', label: 'Pending Assignment', color: 'bg-orange-500/20 text-orange-400' },
    { value: 'assigned_to_draw_admin', label: 'Assigned', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'under_retention', label: 'Under Retention', color: 'bg-purple-500/20 text-purple-400' },
    { value: 'retained', label: 'Retained', color: 'bg-green-500/20 text-green-400' },
    { value: 'churned', label: 'Churned', color: 'bg-red-500/20 text-red-400' },
];

const PRIORITIES = [
    { value: 'low', label: 'Low', color: 'bg-slate-500/20 text-slate-400' },
    { value: 'normal', label: 'Normal', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'high', label: 'High', color: 'bg-orange-500/20 text-orange-400' },
    { value: 'critical', label: 'Critical', color: 'bg-red-500/20 text-red-400' },
];

const RetentionPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [cases, setCases] = useState([]);
    const [summary, setSummary] = useState(null);
    const [drawAdmins, setDrawAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState(null);
    const [assignForm, setAssignForm] = useState({
        draw_admin_id: '',
        priority: 'normal',
        notes: '',
    });
    
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [updateForm, setUpdateForm] = useState({
        status: '',
        notes: '',
        outcome_reason: '',
    });
    
    const [saving, setSaving] = useState(false);

    const canManage = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);
    const canView = hasRole(['super_admin', 'admin', 'broker_admin', 'draw_admin', 'academic_head']);
    const isDrawAdmin = user?.role === 'draw_admin';

    const fetchData = async () => {
        try {
            setLoading(true);
            const statusParam = statusFilter === 'active' 
                ? undefined 
                : statusFilter === 'all' 
                    ? undefined 
                    : statusFilter;
            
            const [casesRes, summaryRes, drawAdminsRes] = await Promise.all([
                retentionAPI.getCases({ status: statusParam }),
                retentionAPI.getSummary(),
                canManage ? retentionAPI.getDrawAdmins() : Promise.resolve({ data: [] }),
            ]);
            
            let filteredCases = casesRes.data;
            if (statusFilter === 'active') {
                filteredCases = casesRes.data.filter(c => 
                    ['pending_assignment', 'assigned_to_draw_admin', 'under_retention'].includes(c.retention_status)
                );
            }
            
            setCases(filteredCases);
            setSummary(summaryRes.data);
            setDrawAdmins(drawAdminsRes.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch retention data',
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
    }, [statusFilter]);

    const getStatusBadge = (status) => {
        const statusInfo = RETENTION_STATUSES.find(s => s.value === status) || 
            { label: status, color: 'bg-slate-500/20 text-slate-400' };
        return (
            <Badge variant="outline" className={`${statusInfo.color} border-0`}>
                {statusInfo.label}
            </Badge>
        );
    };

    const getPriorityBadge = (priority) => {
        const priorityInfo = PRIORITIES.find(p => p.value === priority) || 
            { label: priority, color: 'bg-slate-500/20 text-slate-400' };
        return (
            <Badge variant="outline" className={`${priorityInfo.color} border-0`}>
                {priorityInfo.label}
            </Badge>
        );
    };

    const filteredCases = cases.filter(c => {
        const matchesSearch = c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            c.student_code.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const openAssignDialog = (caseData) => {
        setSelectedCase(caseData);
        setAssignForm({
            draw_admin_id: caseData.draw_admin_id || '',
            priority: caseData.priority || 'normal',
            notes: caseData.notes || '',
        });
        setAssignDialogOpen(true);
    };

    const openUpdateDialog = (caseData) => {
        setSelectedCase(caseData);
        setUpdateForm({
            status: caseData.retention_status,
            notes: caseData.notes || '',
            outcome_reason: caseData.outcome_reason || '',
        });
        setUpdateDialogOpen(true);
    };

    const handleAssign = async () => {
        if (!selectedCase || !assignForm.draw_admin_id) {
            toast({
                title: 'Error',
                description: 'Please select a draw admin',
                variant: 'destructive',
            });
            return;
        }
        
        setSaving(true);
        try {
            await retentionAPI.assign({
                student_id: selectedCase.student_id,
                draw_admin_id: assignForm.draw_admin_id,
                priority: assignForm.priority,
                notes: assignForm.notes || undefined,
            });
            toast({ title: 'Success', description: 'Case assigned to draw admin' });
            setAssignDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to assign case',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async () => {
        if (!selectedCase || !updateForm.status) {
            return;
        }
        
        setSaving(true);
        try {
            await retentionAPI.updateStatus(selectedCase.student_id, {
                status: updateForm.status,
                notes: updateForm.notes || undefined,
                outcome_reason: updateForm.outcome_reason || undefined,
            });
            toast({ title: 'Success', description: 'Retention status updated' });
            setUpdateDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update status',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="retention-page">
                <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="font-heading text-2xl text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to view retention cases.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="retention-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Retention Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage high-value students ($25K+ deposits)
                    </p>
                </div>
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

            {/* Summary Stats */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.total_high_value_students}</p>
                                    <p className="text-xs text-muted-foreground uppercase">High Value</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.by_status.pending_assignment}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Pending</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.active_cases}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">${(summary.value_at_risk_usd / 1000).toFixed(0)}K</p>
                                    <p className="text-xs text-muted-foreground uppercase">At Risk</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.by_status.retained}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Retained</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-cyan-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.retention_rate}%</p>
                                    <p className="text-xs text-muted-foreground uppercase">Success Rate</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
                            <TabsList className="bg-background">
                                <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    Active
                                </TabsTrigger>
                                <TabsTrigger value="pending_assignment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    Pending
                                </TabsTrigger>
                                <TabsTrigger value="retained" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    Retained
                                </TabsTrigger>
                                <TabsTrigger value="churned" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    Churned
                                </TabsTrigger>
                                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    All
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or code..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-background border-border text-foreground"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Cases Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredCases.length === 0 ? (
                        <div className="text-center py-20">
                            <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No retention cases found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Student</TableHead>
                                        <TableHead className="text-muted-foreground">Deposits</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-muted-foreground">Priority</TableHead>
                                        <TableHead className="text-muted-foreground">Assigned To</TableHead>
                                        <TableHead className="text-muted-foreground">Days</TableHead>
                                        <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCases.map((caseItem) => (
                                        <TableRow key={caseItem.id} className="border-border">
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground font-medium">{caseItem.student_name}</p>
                                                    <p className="text-xs text-muted-foreground">{caseItem.student_code}</p>
                                                    {caseItem.primary_mentor_name && (
                                                        <p className="text-xs text-muted-foreground">Mentor: {caseItem.primary_mentor_name}</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-primary font-medium">${caseItem.net_deposit_usd.toLocaleString()}</span>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(caseItem.retention_status)}</TableCell>
                                            <TableCell>{getPriorityBadge(caseItem.priority)}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {caseItem.draw_admin_name || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {caseItem.days_in_retention > 0 ? (
                                                    <span className={caseItem.days_in_retention > 7 ? 'text-red-400' : 'text-muted-foreground'}>
                                                        {caseItem.days_in_retention}d
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canManage && caseItem.retention_status === 'pending_assignment' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => openAssignDialog(caseItem)}
                                                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                                                            data-testid={`assign-${caseItem.id}`}
                                                        >
                                                            <UserPlus className="w-4 h-4 mr-1" />
                                                            Assign
                                                        </Button>
                                                    )}
                                                    {(canManage || (isDrawAdmin && caseItem.draw_admin_id === user?.id)) && 
                                                     !['retained', 'churned'].includes(caseItem.retention_status) && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openUpdateDialog(caseItem)}
                                                            className="border-border"
                                                            data-testid={`update-${caseItem.id}`}
                                                        >
                                                            Update
                                                        </Button>
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

            {/* Assign Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Assign Retention Case</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Assign this high-value student to a draw admin
                        </DialogDescription>
                    </DialogHeader>
                    {selectedCase && (
                        <div className="space-y-4">
                            <div className="p-3 bg-background rounded-lg border border-border">
                                <p className="text-sm text-muted-foreground">Student</p>
                                <p className="text-foreground font-medium">{selectedCase.student_name}</p>
                                <p className="text-primary text-lg font-bold">${selectedCase.net_deposit_usd.toLocaleString()}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Draw Admin</Label>
                                <Select
                                    value={assignForm.draw_admin_id}
                                    onValueChange={(v) => setAssignForm({...assignForm, draw_admin_id: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue placeholder="Select draw admin" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {drawAdmins.map(da => (
                                            <SelectItem key={da.id} value={da.id}>
                                                {da.full_name} ({da.active_cases} active)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Priority</Label>
                                <Select
                                    value={assignForm.priority}
                                    onValueChange={(v) => setAssignForm({...assignForm, priority: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {PRIORITIES.map(p => (
                                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Notes (Optional)</Label>
                                <Textarea
                                    value={assignForm.notes}
                                    onChange={(e) => setAssignForm({...assignForm, notes: e.target.value})}
                                    className="bg-background border-border text-foreground min-h-[80px]"
                                    placeholder="Any context for the draw admin..."
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssign}
                            disabled={saving || !assignForm.draw_admin_id}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Case'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Update Status Dialog */}
            <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Update Retention Status</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Update the status of this retention case
                        </DialogDescription>
                    </DialogHeader>
                    {selectedCase && (
                        <div className="space-y-4">
                            <div className="p-3 bg-background rounded-lg border border-border">
                                <p className="text-foreground font-medium">{selectedCase.student_name}</p>
                                <p className="text-primary">${selectedCase.net_deposit_usd.toLocaleString()}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Status</Label>
                                <Select
                                    value={updateForm.status}
                                    onValueChange={(v) => setUpdateForm({...updateForm, status: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {RETENTION_STATUSES.map(s => (
                                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {['retained', 'churned'].includes(updateForm.status) && (
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase">Outcome Reason</Label>
                                    <Textarea
                                        value={updateForm.outcome_reason}
                                        onChange={(e) => setUpdateForm({...updateForm, outcome_reason: e.target.value})}
                                        className="bg-background border-border text-foreground min-h-[80px]"
                                        placeholder="Why was this student retained/churned?"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Notes (Optional)</Label>
                                <Textarea
                                    value={updateForm.notes}
                                    onChange={(e) => setUpdateForm({...updateForm, notes: e.target.value})}
                                    className="bg-background border-border text-foreground min-h-[80px]"
                                    placeholder="Any additional notes..."
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setUpdateDialogOpen(false)} className="border-border">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateStatus}
                            disabled={saving}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Status'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RetentionPage;
