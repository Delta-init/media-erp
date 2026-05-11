import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { studentLogsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
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
    Loader2,
    Search,
    RefreshCw,
    User,
    Phone,
    Mail,
    Calendar,
    ChevronRight,
    GripVertical,
    MoreVertical,
    Eye,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const PIPELINE_STAGES = [
    { id: 'LEAD', label: 'Lead', color: 'bg-slate-500' },
    { id: 'CONTACTED', label: 'Contacted', color: 'bg-blue-500' },
    { id: 'QUALIFIED', label: 'Qualified', color: 'bg-purple-500' },
    { id: 'ENROLLED', label: 'Enrolled', color: 'bg-cyan-500' },
    { id: 'ACTIVE', label: 'Active', color: 'bg-green-500' },
    { id: 'AT_RISK', label: 'At Risk', color: 'bg-orange-500' },
];

const PipelinePage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [draggedItem, setDraggedItem] = useState(null);
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [newStage, setNewStage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params = {};
            if (search) params.search = search;
            const response = await studentLogsAPI.getAll(params);
            // Filter out churned and graduated for pipeline view
            const pipelineLogs = response.data.filter(
                l => !['CHURNED', 'GRADUATED'].includes(l.lead_stage)
            );
            setLogs(pipelineLogs);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch pipeline data',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchLogs();
    };

    const getLogsByStage = (stageId) => {
        return logs.filter(log => log.lead_stage === stageId);
    };

    const handleDragStart = (e, log) => {
        setDraggedItem(log);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', log.id);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetStage) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.lead_stage === targetStage) {
            setDraggedItem(null);
            return;
        }

        try {
            await studentLogsAPI.update(draggedItem.student_id, {
                lead_stage: targetStage
            });
            toast({
                title: 'Success',
                description: `Moved ${draggedItem.student_name} to ${targetStage.replace('_', ' ')}`,
            });
            fetchLogs();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update stage',
                variant: 'destructive',
            });
        }
        setDraggedItem(null);
    };

    const handleMoveClick = (log) => {
        setSelectedLog(log);
        setNewStage(log.lead_stage);
        setMoveDialogOpen(true);
    };

    const handleMoveSubmit = async () => {
        if (!selectedLog || !newStage || selectedLog.lead_stage === newStage) {
            setMoveDialogOpen(false);
            return;
        }

        setSubmitting(true);
        try {
            await studentLogsAPI.update(selectedLog.student_id, {
                lead_stage: newStage
            });
            toast({
                title: 'Success',
                description: `Moved ${selectedLog.student_name} to ${newStage.replace('_', ' ')}`,
            });
            setMoveDialogOpen(false);
            setSelectedLog(null);
            fetchLogs();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update stage',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return null;
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const totalValue = logs.reduce((sum, log) => sum + (log.initial_deposit_target || 0), 0);

    return (
        <div className="space-y-6 animate-fade-in" data-testid="pipeline-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Pipeline</h1>
                    <p className="text-muted-foreground mt-1">
                        Drag and drop students through lead stages
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={fetchLogs}
                        className="border-border"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 p-4 bg-card border border-border rounded-lg">
                <div>
                    <p className="text-2xl font-heading text-foreground">{logs.length}</p>
                    <p className="text-xs text-muted-foreground uppercase">Total in Pipeline</p>
                </div>
                <div className="h-8 w-px bg-border" />
                {PIPELINE_STAGES.slice(0, 4).map(stage => (
                    <div key={stage.id} className="text-center">
                        <p className="text-lg font-heading text-foreground">{getLogsByStage(stage.id).length}</p>
                        <p className="text-xs text-muted-foreground">{stage.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search students..."
                        className="pl-10 bg-card border-border"
                        data-testid="pipeline-search"
                    />
                </div>
                <Button type="submit" variant="outline" className="border-border">
                    Search
                </Button>
            </form>

            {/* Pipeline Board */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="overflow-x-auto pb-4">
                    <div className="flex gap-4 min-w-max">
                        {PIPELINE_STAGES.map((stage) => {
                            const stageLogs = getLogsByStage(stage.id);
                            return (
                                <div
                                    key={stage.id}
                                    className="w-72 flex-shrink-0"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, stage.id)}
                                    data-testid={`pipeline-column-${stage.id}`}
                                >
                                    {/* Column Header */}
                                    <div className="flex items-center gap-2 mb-3 px-1">
                                        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                                        <h3 className="font-medium text-foreground">{stage.label}</h3>
                                        <Badge variant="outline" className="ml-auto text-muted-foreground border-border">
                                            {stageLogs.length}
                                        </Badge>
                                    </div>

                                    {/* Column Body */}
                                    <div className="bg-background/50 rounded-lg p-2 min-h-[400px] border border-border/50">
                                        {stageLogs.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground text-sm">
                                                Drop students here
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {stageLogs.map((log) => (
                                                    <div
                                                        key={log.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, log)}
                                                        className={`bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors ${
                                                            draggedItem?.id === log.id ? 'opacity-50' : ''
                                                        }`}
                                                        data-testid={`pipeline-card-${log.id}`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-foreground truncate">
                                                                    {log.student_name}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground truncate">
                                                                    {log.student_code}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleMoveClick(log)}
                                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </div>

                                                        {/* Card Details */}
                                                        <div className="mt-2 space-y-1">
                                                            {log.student_email && (
                                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <Mail className="w-3 h-3" />
                                                                    <span className="truncate">{log.student_email}</span>
                                                                </div>
                                                            )}
                                                            {log.next_followup_date && (
                                                                <div className={`flex items-center gap-1 text-xs ${
                                                                    new Date(log.next_followup_date) < new Date()
                                                                        ? 'text-red-400'
                                                                        : 'text-muted-foreground'
                                                                }`}>
                                                                    <Calendar className="w-3 h-3" />
                                                                    <span>Followup: {formatDate(log.next_followup_date)}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Tags / Engagement */}
                                                        <div className="mt-2 flex items-center gap-2">
                                                            {log.total_calls > 0 && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {log.total_calls} calls
                                                                </span>
                                                            )}
                                                            {log.total_emails_sent > 0 && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {log.total_emails_sent} emails
                                                                </span>
                                                            )}
                                                            {log.training_status && log.training_status !== 'NOT_STARTED' && (
                                                                <Badge 
                                                                    variant="outline" 
                                                                    className="text-xs h-5 bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                                >
                                                                    {log.training_status.replace('_', ' ')}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Move Dialog */}
            <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">
                            Move Student
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Change the pipeline stage for this student
                        </DialogDescription>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4">
                            <div className="bg-background p-3 rounded-lg">
                                <p className="font-medium text-foreground">{selectedLog.student_name}</p>
                                <p className="text-sm text-muted-foreground">{selectedLog.student_code}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-muted-foreground text-xs uppercase tracking-wider">
                                    New Stage
                                </label>
                                <Select value={newStage} onValueChange={setNewStage}>
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {PIPELINE_STAGES.map((stage) => (
                                            <SelectItem key={stage.id} value={stage.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                                                    {stage.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="CHURNED">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                                Churned
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="GRADUATED">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                Graduated
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setMoveDialogOpen(false)}
                            className="text-muted-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleMoveSubmit}
                            disabled={submitting || !newStage || selectedLog?.lead_stage === newStage}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid="move-submit-btn"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Move
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PipelinePage;
