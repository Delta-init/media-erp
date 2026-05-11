import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Target,
    Plus,
    Edit,
    Trash2,
    Loader2,
    TrendingUp,
    CheckCircle,
    XCircle,
    Clock,
    Calendar,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TargetsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [targets, setTargets] = useState([]);
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [targetToDelete, setTargetToDelete] = useState(null);

    const canManageTargets = hasRole(['super_admin', 'broker_admin', 'academic_head']);

    const [formData, setFormData] = useState({
        mentor_id: '',
        period_type: 'MONTHLY',
        period_start_date: '',
        period_end_date: '',
        target_net_deposit_usd: '',
        notes: '',
    });

    const getToken = () => localStorage.getItem('token');

    const fetchTargets = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/api/targets`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setTargets(response.data);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch targets', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchMentors = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/users/mentors`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setMentors(response.data);
        } catch (error) {
            console.error('Failed to fetch mentors:', error);
        }
    };

    useEffect(() => {
        fetchTargets();
        if (canManageTargets) {
            fetchMentors();
        }
    }, []);

    const handleOpenDialog = (target = null) => {
        if (target) {
            setEditingTarget(target);
            setFormData({
                mentor_id: target.mentor_id,
                period_type: target.period_type,
                period_start_date: target.period_start_date,
                period_end_date: target.period_end_date,
                target_net_deposit_usd: target.target_net_deposit_usd,
                notes: target.notes || '',
            });
        } else {
            setEditingTarget(null);
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
            setFormData({
                mentor_id: '',
                period_type: 'MONTHLY',
                period_start_date: startOfMonth,
                period_end_date: endOfMonth,
                target_net_deposit_usd: '',
                notes: '',
            });
        }
        setDialogOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const data = {
                ...formData,
                target_net_deposit_usd: parseFloat(formData.target_net_deposit_usd),
            };

            if (editingTarget) {
                await axios.put(`${API_URL}/api/targets/${editingTarget.id}`, data, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                });
                toast({ title: 'Success', description: 'Target updated successfully' });
            } else {
                await axios.post(`${API_URL}/api/targets`, data, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                });
                toast({ title: 'Success', description: 'Target created successfully' });
            }
            setDialogOpen(false);
            fetchTargets();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Operation failed',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!targetToDelete) return;
        
        try {
            await axios.delete(`${API_URL}/api/targets/${targetToDelete.id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            toast({ title: 'Success', description: 'Target deleted successfully' });
            setDeleteDialogOpen(false);
            setTargetToDelete(null);
            fetchTargets();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to delete target',
                variant: 'destructive',
            });
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getStatusBadge = (status) => {
        const variants = {
            NOT_STARTED: { class: 'bg-foreground-subtle/20 text-muted-foreground border-foreground-subtle/30', icon: Clock },
            IN_PROGRESS: { class: 'bg-accent-info/20 text-accent-info border-accent-info/30', icon: TrendingUp },
            ACHIEVED: { class: 'bg-accent-success/20 text-accent-success border-accent-success/30', icon: CheckCircle },
            MISSED: { class: 'bg-accent-error/20 text-accent-error border-accent-error/30', icon: XCircle },
        };
        const variant = variants[status] || variants.NOT_STARTED;
        const Icon = variant.icon;

        return (
            <Badge variant="outline" className={`${variant.class} gap-1 font-normal`}>
                <Icon className="w-3 h-3" />
                {status.replace('_', ' ')}
            </Badge>
        );
    };

    // Stats
    const achieved = targets.filter(t => t.target_status === 'ACHIEVED').length;
    const inProgress = targets.filter(t => t.target_status === 'IN_PROGRESS').length;
    const missed = targets.filter(t => t.target_status === 'MISSED').length;

    return (
        <div className="space-y-6 animate-fade-in" data-testid="targets-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Mentor Targets</h1>
                    <p className="text-muted-foreground mt-1">
                        {canManageTargets ? 'Set and track mentor performance targets' : 'Track your performance targets'}
                    </p>
                </div>
                {canManageTargets && (
                    <Button
                        onClick={() => handleOpenDialog()}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                        data-testid="new-target-btn"
                    >
                        <Plus className="w-4 h-4" />
                        New Target
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-accent-success/10 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-accent-success" />
                        </div>
                        <div>
                            <p className="text-2xl font-heading text-foreground">{achieved}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Achieved</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-accent-info/10 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-accent-info" />
                        </div>
                        <div>
                            <p className="text-2xl font-heading text-foreground">{inProgress}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">In Progress</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-accent-error/10 flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-accent-error" />
                        </div>
                        <div>
                            <p className="text-2xl font-heading text-foreground">{missed}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Missed</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : targets.length === 0 ? (
                        <div className="text-center py-20">
                            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No targets found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="data-table">
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Mentor</TableHead>
                                        <TableHead className="text-muted-foreground">Period</TableHead>
                                        <TableHead className="text-muted-foreground">Target</TableHead>
                                        <TableHead className="text-muted-foreground">Achievement</TableHead>
                                        <TableHead className="text-muted-foreground">Progress</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        {canManageTargets && (
                                            <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {targets.map((target) => (
                                        <TableRow key={target.id} className="border-border">
                                            <TableCell>
                                                <p className="text-foreground font-medium">{target.mentor_name}</p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                                    <div>
                                                        <p className="text-foreground text-sm">{target.period_type}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatDate(target.period_start_date)} - {formatDate(target.period_end_date)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-foreground font-mono">{formatCurrency(target.target_net_deposit_usd)}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-primary font-mono font-medium">
                                                    {formatCurrency(target.achievement_net_deposit_usd)}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="w-32">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-muted-foreground">{Math.round(target.achievement_percent)}%</span>
                                                    </div>
                                                    <Progress 
                                                        value={Math.min(target.achievement_percent, 100)} 
                                                        className="h-2 bg-background"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(target.target_status)}
                                            </TableCell>
                                            {canManageTargets && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleOpenDialog(target)}
                                                            className="text-muted-foreground hover:text-primary"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setTargetToDelete(target);
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                            className="text-muted-foreground hover:text-accent-error"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-2xl text-foreground">
                            {editingTarget ? 'Edit Target' : 'New Target'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Mentor</Label>
                            <Select
                                value={formData.mentor_id}
                                onValueChange={(value) => setFormData({ ...formData, mentor_id: value })}
                                disabled={!!editingTarget}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                    <SelectValue placeholder="Select mentor" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {mentors.map((mentor) => (
                                        <SelectItem key={mentor.id} value={mentor.id} className="text-foreground">
                                            {mentor.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Period Type</Label>
                            <Select
                                value={formData.period_type}
                                onValueChange={(value) => setFormData({ ...formData, period_type: value })}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="WEEKLY" className="text-foreground">Weekly</SelectItem>
                                    <SelectItem value="MONTHLY" className="text-foreground">Monthly</SelectItem>
                                    <SelectItem value="QUARTERLY" className="text-foreground">Quarterly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Start Date</Label>
                                <Input
                                    type="date"
                                    value={formData.period_start_date}
                                    onChange={(e) => setFormData({ ...formData, period_start_date: e.target.value })}
                                    required
                                    className="bg-background border-border text-foreground rounded-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">End Date</Label>
                                <Input
                                    type="date"
                                    value={formData.period_end_date}
                                    onChange={(e) => setFormData({ ...formData, period_end_date: e.target.value })}
                                    required
                                    className="bg-background border-border text-foreground rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Target Amount (USD)</Label>
                            <Input
                                type="number"
                                step="100"
                                min="0"
                                value={formData.target_net_deposit_usd}
                                onChange={(e) => setFormData({ ...formData, target_net_deposit_usd: e.target.value })}
                                placeholder="10000"
                                required
                                className="bg-background border-border text-foreground rounded-lg"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Additional notes..."
                                className="bg-background border-border text-foreground rounded-lg"
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDialogOpen(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting || !formData.mentor_id}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTarget ? 'Save Changes' : 'Create Target')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Delete Target</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to delete this target for <span className="text-foreground font-medium">{targetToDelete?.mentor_name}</span>?
                    </p>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button onClick={handleDelete} className="bg-accent-error text-white hover:bg-accent-error/90 rounded-lg">
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TargetsPage;
