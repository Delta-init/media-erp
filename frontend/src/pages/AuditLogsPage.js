import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auditLogsAPI, usersAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
} from '../components/ui/dialog';
import {
    Loader2,
    Search,
    History,
    User,
    Activity,
    Eye,
    RefreshCw,
    Calendar,
    Filter,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const AuditLogsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    
    const [filters, setFilters] = useState({
        user_id: '',
        action: '',
        entity: '',
        start_date: '',
        end_date: '',
    });

    const canView = hasRole(['super_admin', 'admin', 'broker_admin']);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filters.user_id) params.user_id = filters.user_id;
            if (filters.action) params.action = filters.action;
            if (filters.entity) params.entity = filters.entity;
            if (filters.start_date) params.start_date = filters.start_date;
            if (filters.end_date) params.end_date = filters.end_date;

            const [logsRes, usersRes, actionsRes] = await Promise.all([
                auditLogsAPI.getAll(params),
                usersAPI.getAll(),
                auditLogsAPI.getActions(),
            ]);
            setLogs(logsRes.data);
            setUsers(usersRes.data);
            // actionsRes.data returns {actions: [], entity_types: []}
            setActions(actionsRes.data.actions || []);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch audit logs',
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
    }, []);

    const handleFilter = () => {
        fetchData();
    };

    const handleClearFilters = () => {
        setFilters({
            user_id: '',
            action: '',
            entity: '',
            start_date: '',
            end_date: '',
        });
        fetchData();
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionBadge = (action) => {
        const colors = {
            CREATE: 'bg-green-500/10 text-green-400 border-green-500/30',
            UPDATE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            DELETE: 'bg-red-500/10 text-red-400 border-red-500/30',
            APPROVE: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
            REJECT: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
            LOGIN: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
            CLAIM: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
        return (
            <Badge variant="outline" className={colors[action] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'}>
                {action}
            </Badge>
        );
    };

    const getEntityBadge = (entity) => {
        return (
            <Badge variant="outline" className="bg-background text-muted-foreground border-border">
                {entity}
            </Badge>
        );
    };

    const openDetail = (log) => {
        setSelectedLog(log);
        setDetailDialogOpen(true);
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="audit-logs-page">
                <History className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="font-heading text-2xl text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to view audit logs.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="audit-logs-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Audit Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        Track system activity and changes
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

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <History className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{logs.length}</p>
                                <p className="text-xs text-muted-foreground uppercase">Total Logs</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">
                                    {logs.filter(l => l.action === 'CREATE').length}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase">Created</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">
                                    {logs.filter(l => l.action === 'UPDATE').length}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase">Updated</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">
                                    {logs.filter(l => l.action === 'DELETE').length}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase">Deleted</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-lg flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">User</Label>
                            <Select
                                value={filters.user_id || "all"}
                                onValueChange={(v) => setFilters({...filters, user_id: v === "all" ? "" : v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="All Users" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="all">All Users</SelectItem>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Action</Label>
                            <Select
                                value={filters.action || "all"}
                                onValueChange={(v) => setFilters({...filters, action: v === "all" ? "" : v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="All Actions" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="all">All Actions</SelectItem>
                                    {actions.map(a => (
                                        <SelectItem key={a} value={a}>{a}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Entity</Label>
                            <Input
                                value={filters.entity}
                                onChange={(e) => setFilters({...filters, entity: e.target.value})}
                                placeholder="e.g., Student"
                                className="bg-background border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Start Date</Label>
                            <Input
                                type="date"
                                value={filters.start_date}
                                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                                className="bg-background border-border text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">End Date</Label>
                            <Input
                                type="date"
                                value={filters.end_date}
                                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
                                className="bg-background border-border text-foreground"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button
                            onClick={handleFilter}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid="apply-filters-btn"
                        >
                            Apply Filters
                        </Button>
                        <Button
                            onClick={handleClearFilters}
                            variant="outline"
                            className="border-border"
                        >
                            Clear
                        </Button>
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
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20">
                            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No audit logs found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Timestamp</TableHead>
                                        <TableHead className="text-muted-foreground">User</TableHead>
                                        <TableHead className="text-muted-foreground">Action</TableHead>
                                        <TableHead className="text-muted-foreground">Entity</TableHead>
                                        <TableHead className="text-muted-foreground">Details</TableHead>
                                        <TableHead className="text-muted-foreground text-right">View</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id} className="border-border">
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(log.created_date)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-foreground">{log.user_name || 'System'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getActionBadge(log.action)}</TableCell>
                                            <TableCell>{getEntityBadge(log.entity_type)}</TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <p className="text-muted-foreground text-sm truncate">
                                                    {log.summary || 'No details'}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => openDetail(log)}
                                                    className="text-muted-foreground hover:text-primary"
                                                    data-testid={`view-log-${log.id}`}
                                                >
                                                    <Eye className="w-4 h-4" />
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

            {/* Detail Dialog */}
            <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
                <DialogContent className="bg-card border-border max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Audit Log Detail</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Full details of the activity
                        </DialogDescription>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground text-xs uppercase">Timestamp</Label>
                                    <p className="text-foreground">{formatDate(selectedLog.created_date)}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs uppercase">User</Label>
                                    <p className="text-foreground">{selectedLog.user_name || 'System'}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs uppercase">Action</Label>
                                    <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs uppercase">Entity</Label>
                                    <div className="mt-1">{getEntityBadge(selectedLog.entity_type)}</div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs uppercase">Entity ID</Label>
                                <p className="text-foreground font-mono text-sm">{selectedLog.entity_id || '-'}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground text-xs uppercase">Summary</Label>
                                <p className="text-foreground">{selectedLog.summary || 'No summary'}</p>
                            </div>
                            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                                <div>
                                    <Label className="text-muted-foreground text-xs uppercase">Details</Label>
                                    <pre className="mt-1 p-3 bg-background rounded text-muted-foreground text-xs overflow-auto max-h-40">
                                        {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                </div>
                            )}
                            <div>
                                <Label className="text-muted-foreground text-xs uppercase">IP Address</Label>
                                <p className="text-foreground font-mono text-sm">{selectedLog.ip_address || '-'}</p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AuditLogsPage;
