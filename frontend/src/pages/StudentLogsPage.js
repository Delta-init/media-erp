import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { studentLogsAPI, studentsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '../components/ui/dialog';
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
    Tabs,
    TabsList,
    TabsTrigger,
} from '../components/ui/tabs';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '../components/ui/sheet';
import {
    Loader2,
    Search,
    Plus,
    User,
    Phone,
    Mail,
    Calendar,
    Target,
    BookOpen,
    TrendingUp,
    MessageSquare,
    Edit,
    FileText,
    Clock,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const LEAD_STAGES = ['LEAD', 'CONTACTED', 'QUALIFIED', 'ENROLLED', 'ACTIVE', 'AT_RISK', 'CHURNED', 'GRADUATED'];
const TRAINING_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED'];

const StudentLogsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [logs, setLogs] = useState([]);
    const [students, setStudents] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const [newLogData, setNewLogData] = useState({
        student_id: '',
        lead_stage: 'LEAD',
        training_status: 'NOT_STARTED',
    });

    const [interactionData, setInteractionData] = useState({
        type: 'call',
        summary: '',
    });

    const canManage = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (search) params.search = search;
            if (activeTab !== 'all') params.lead_stage = activeTab.toUpperCase();
            
            const [logsRes, studentsRes] = await Promise.all([
                studentLogsAPI.getAll(params),
                studentsAPI.getAll({})
            ]);
            setLogs(logsRes.data);
            setStudents(studentsRes.data);

            if (canManage) {
                try {
                    const summaryRes = await studentLogsAPI.getSummary();
                    setSummary(summaryRes.data);
                } catch (e) {
                    // Summary may not be accessible
                }
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch student logs',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData();
    };

    const handleCreate = async () => {
        if (!newLogData.student_id) {
            toast({ title: 'Error', description: 'Please select a student', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        try {
            await studentLogsAPI.create(newLogData);
            toast({ title: 'Success', description: 'Student log created' });
            setCreateDialogOpen(false);
            setNewLogData({ student_id: '', lead_stage: 'LEAD', training_status: 'NOT_STARTED' });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to create log',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedLog) return;
        setSubmitting(true);
        try {
            await studentLogsAPI.update(selectedLog.student_id, selectedLog);
            toast({ title: 'Success', description: 'Student log updated' });
            setEditMode(false);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update log',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddInteraction = async () => {
        if (!selectedLog || !interactionData.summary) return;
        setSubmitting(true);
        try {
            await studentLogsAPI.addInteraction(
                selectedLog.student_id,
                interactionData.type,
                interactionData.summary
            );
            toast({ title: 'Success', description: 'Interaction logged' });
            setInteractionDialogOpen(false);
            setInteractionData({ type: 'call', summary: '' });
            // Refresh the selected log
            const refreshed = await studentLogsAPI.getOne(selectedLog.student_id);
            setSelectedLog(refreshed.data);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to log interaction',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const openDetail = async (log) => {
        try {
            const res = await studentLogsAPI.getOne(log.student_id);
            setSelectedLog(res.data);
            setDetailSheetOpen(true);
            setEditMode(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load student log details',
                variant: 'destructive',
            });
        }
    };

    const getStageBadge = (stage) => {
        const colors = {
            LEAD: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
            CONTACTED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            QUALIFIED: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
            ENROLLED: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
            ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/30',
            AT_RISK: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
            CHURNED: 'bg-red-500/10 text-red-400 border-red-500/30',
            GRADUATED: 'bg-primary/10 text-primary border-primary/30',
        };
        return (
            <Badge variant="outline" className={colors[stage] || ''}>
                {stage?.replace('_', ' ')}
            </Badge>
        );
    };

    const getTrainingBadge = (status) => {
        const colors = {
            NOT_STARTED: 'bg-slate-500/10 text-slate-400',
            IN_PROGRESS: 'bg-blue-500/10 text-blue-400',
            COMPLETED: 'bg-green-500/10 text-green-400',
            PAUSED: 'bg-yellow-500/10 text-yellow-400',
        };
        return (
            <Badge variant="outline" className={colors[status] || ''}>
                {status?.replace('_', ' ')}
            </Badge>
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Filter students without logs
    const studentsWithoutLogs = students.filter(
        s => !logs.some(l => l.student_id === s.id)
    );

    return (
        <div className="space-y-6 animate-fade-in" data-testid="student-logs-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Student Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        Detailed CRM tracking for students
                    </p>
                </div>
                <Button
                    onClick={() => setCreateDialogOpen(true)}
                    disabled={studentsWithoutLogs.length === 0}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                    data-testid="create-log-btn"
                >
                    <Plus className="w-4 h-4" />
                    New Log
                </Button>
            </div>

            {/* Summary Stats (Admins only) */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.total_logs}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Total Logs</p>
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
                                    <p className="text-2xl font-heading text-foreground">{summary.by_lead_stage?.ACTIVE || 0}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Active</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.by_lead_stage?.AT_RISK || 0}</p>
                                    <p className="text-xs text-muted-foreground uppercase">At Risk</p>
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
                                    <p className="text-2xl font-heading text-foreground">{summary.needs_followup}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Need Followup</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Search & Filters */}
            <Card className="bg-card border-border">
                <CardContent className="p-4">
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name, code, or email..."
                                className="pl-10 bg-background border-border"
                                data-testid="search-input"
                            />
                        </div>
                        <Button type="submit" variant="outline" className="border-border">
                            Search
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Tabs & Table */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-background flex-wrap h-auto gap-1">
                            <TabsTrigger value="all">All</TabsTrigger>
                            {LEAD_STAGES.map(stage => (
                                <TabsTrigger key={stage} value={stage.toLowerCase()}>
                                    {stage.replace('_', ' ')}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="p-0 pt-2">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20">
                            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No student logs found</p>
                            {studentsWithoutLogs.length > 0 && (
                                <p className="text-muted-foreground text-sm mt-2">
                                    {studentsWithoutLogs.length} student(s) without logs
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Student</TableHead>
                                        <TableHead className="text-muted-foreground">Lead Stage</TableHead>
                                        <TableHead className="text-muted-foreground">Training</TableHead>
                                        <TableHead className="text-muted-foreground">Interactions</TableHead>
                                        <TableHead className="text-muted-foreground">Last Contact</TableHead>
                                        <TableHead className="text-muted-foreground">Next Followup</TableHead>
                                        <TableHead className="text-muted-foreground text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow
                                            key={log.id}
                                            className="border-border cursor-pointer hover:bg-background/50"
                                            onClick={() => openDetail(log)}
                                        >
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground font-medium">{log.student_name}</p>
                                                    <p className="text-xs text-muted-foreground">{log.student_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStageBadge(log.lead_stage)}</TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    {getTrainingBadge(log.training_status)}
                                                    {log.modules_completed > 0 && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {log.modules_completed}/{log.total_modules || 10} modules
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2 text-sm text-muted-foreground">
                                                    <span title="Calls">{log.total_calls || 0} calls</span>
                                                    <span>•</span>
                                                    <span title="Emails">{log.total_emails_sent || 0} emails</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(log.last_contact_date)}
                                            </TableCell>
                                            <TableCell>
                                                {log.next_followup_date ? (
                                                    <span className={`text-sm ${
                                                        new Date(log.next_followup_date) < new Date() 
                                                            ? 'text-red-400' 
                                                            : 'text-muted-foreground'
                                                    }`}>
                                                        {formatDate(log.next_followup_date)}
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDetail(log);
                                                    }}
                                                    className="text-muted-foreground hover:text-primary"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Log Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Create Student Log</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Start tracking detailed information for a student
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Student</Label>
                            <Select
                                value={newLogData.student_id}
                                onValueChange={(v) => setNewLogData({...newLogData, student_id: v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Select student" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {studentsWithoutLogs.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.full_name} ({s.student_code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Lead Stage</Label>
                            <Select
                                value={newLogData.lead_stage}
                                onValueChange={(v) => setNewLogData({...newLogData, lead_stage: v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {LEAD_STAGES.map((s) => (
                                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Training Status</Label>
                            <Select
                                value={newLogData.training_status}
                                onValueChange={(v) => setNewLogData({...newLogData, training_status: v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {TRAINING_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={submitting || !newLogData.student_id}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid="submit-log-btn"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Log
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Sheet */}
            <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
                <SheetContent className="bg-card border-border w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="font-heading text-xl text-foreground">
                            {selectedLog?.student_name}
                        </SheetTitle>
                        <SheetDescription className="text-muted-foreground">
                            {selectedLog?.student_code} • {selectedLog?.student_email}
                        </SheetDescription>
                    </SheetHeader>

                    {selectedLog && (
                        <div className="mt-6 space-y-6">
                            {/* Quick Actions */}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setInteractionDialogOpen(true)}
                                    className="border-border"
                                >
                                    <MessageSquare className="w-4 h-4 mr-1" />
                                    Log Interaction
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditMode(!editMode)}
                                    className="border-border"
                                >
                                    <Edit className="w-4 h-4 mr-1" />
                                    {editMode ? 'Cancel Edit' : 'Edit'}
                                </Button>
                            </div>

                            {/* Status Section */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase">Lead Stage</Label>
                                    {editMode ? (
                                        <Select
                                            value={selectedLog.lead_stage || 'LEAD'}
                                            onValueChange={(v) => setSelectedLog({...selectedLog, lead_stage: v})}
                                        >
                                            <SelectTrigger className="bg-background border-border">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border">
                                                {LEAD_STAGES.map(s => (
                                                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        getStageBadge(selectedLog.lead_stage)
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase">Training</Label>
                                    {editMode ? (
                                        <Select
                                            value={selectedLog.training_status || 'NOT_STARTED'}
                                            onValueChange={(v) => setSelectedLog({...selectedLog, training_status: v})}
                                        >
                                            <SelectTrigger className="bg-background border-border">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border">
                                                {TRAINING_STATUSES.map(s => (
                                                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        getTrainingBadge(selectedLog.training_status)
                                    )}
                                </div>
                            </div>

                            {/* Engagement Stats */}
                            <div className="bg-background p-4 rounded-lg">
                                <h4 className="text-foreground font-medium mb-3">Engagement</h4>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-2xl font-heading text-foreground">{selectedLog.total_calls || 0}</p>
                                        <p className="text-xs text-muted-foreground">Calls</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-heading text-foreground">{selectedLog.total_emails_sent || 0}</p>
                                        <p className="text-xs text-muted-foreground">Emails</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-heading text-foreground">{selectedLog.total_meetings || 0}</p>
                                        <p className="text-xs text-muted-foreground">Meetings</p>
                                    </div>
                                </div>
                            </div>

                            {/* Key Dates */}
                            <div className="space-y-3">
                                <h4 className="text-foreground font-medium">Key Dates</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-muted-foreground text-xs">First Contact</Label>
                                        {editMode ? (
                                            <Input
                                                type="date"
                                                value={selectedLog.first_contact_date?.split('T')[0] || ''}
                                                onChange={(e) => setSelectedLog({...selectedLog, first_contact_date: e.target.value})}
                                                className="bg-background border-border"
                                            />
                                        ) : (
                                            <p className="text-foreground">{formatDate(selectedLog.first_contact_date)}</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Last Contact</Label>
                                        <p className="text-foreground">{formatDate(selectedLog.last_contact_date)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Next Followup</Label>
                                        {editMode ? (
                                            <Input
                                                type="date"
                                                value={selectedLog.next_followup_date?.split('T')[0] || ''}
                                                onChange={(e) => setSelectedLog({...selectedLog, next_followup_date: e.target.value})}
                                                className="bg-background border-border"
                                            />
                                        ) : (
                                            <p className={`${
                                                selectedLog.next_followup_date && new Date(selectedLog.next_followup_date) < new Date()
                                                    ? 'text-red-400' : 'text-foreground'
                                            }`}>
                                                {formatDate(selectedLog.next_followup_date)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Internal Notes</Label>
                                {editMode ? (
                                    <Textarea
                                        value={selectedLog.internal_notes || ''}
                                        onChange={(e) => setSelectedLog({...selectedLog, internal_notes: e.target.value})}
                                        className="bg-background border-border min-h-[80px]"
                                    />
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        {selectedLog.internal_notes || 'No notes'}
                                    </p>
                                )}
                            </div>

                            {/* Last Interaction */}
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Last Interaction</Label>
                                <p className="text-muted-foreground text-sm">
                                    {selectedLog.last_interaction_summary || 'No interactions recorded'}
                                </p>
                            </div>

                            {/* Save Button (Edit Mode) */}
                            {editMode && (
                                <Button
                                    onClick={handleUpdate}
                                    disabled={submitting}
                                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Save Changes
                                </Button>
                            )}

                            {/* Metadata */}
                            <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                                <p>Created: {formatDate(selectedLog.created_date)} by {selectedLog.created_by_name}</p>
                                {selectedLog.updated_by_name && (
                                    <p>Updated: {formatDate(selectedLog.updated_date)} by {selectedLog.updated_by_name}</p>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Interaction Dialog */}
            <Dialog open={interactionDialogOpen} onOpenChange={setInteractionDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Log Interaction</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Record a call, email, or meeting with this student
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Type</Label>
                            <Select
                                value={interactionData.type}
                                onValueChange={(v) => setInteractionData({...interactionData, type: v})}
                            >
                                <SelectTrigger className="bg-background border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="call">Phone Call</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="meeting">Meeting</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Summary</Label>
                            <Textarea
                                value={interactionData.summary}
                                onChange={(e) => setInteractionData({...interactionData, summary: e.target.value})}
                                placeholder="Brief summary of the interaction..."
                                className="bg-background border-border min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setInteractionDialogOpen(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddInteraction}
                            disabled={submitting || !interactionData.summary}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Log Interaction
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StudentLogsPage;
