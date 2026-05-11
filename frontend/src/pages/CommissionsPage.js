import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Loader2,
    Clock,
    CheckCircle,
    XCircle,
    Wallet,
    RefreshCw,
    ChevronRight,
    AlertCircle,
    UserCheck,
    Inbox,
    ArrowUpRight,
    ArrowDownRight,
    History,
    Filter,
    DollarSign,
    TrendingUp,
    TrendingDown,
    ShieldAlert,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CommissionsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [commissions, setCommissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [selectedCommission, setSelectedCommission] = useState(null);
    const [approvalAction, setApprovalAction] = useState('approve');
    const [rejectionReason, setRejectionReason] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [mainTab, setMainTab] = useState('ledger');
    
    // Transaction History state
    const [txnData, setTxnData] = useState(null);
    const [txnLoading, setTxnLoading] = useState(false);
    const [txnMentorFilter, setTxnMentorFilter] = useState('all');

    const canApprove = hasRole(['super_admin', 'broker_admin', 'academic_head', 'finance_admin']);
    const canGenerate = hasRole(['super_admin', 'academic_head']);

    const getToken = () => localStorage.getItem('token');

    const fetchCommissions = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/api/commissions`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setCommissions(response.data);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch commissions', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCommissions();
    }, []);

    useEffect(() => {
        if (mainTab === 'transactions') {
            fetchTransactions();
        }
    }, [mainTab, txnMentorFilter]);

    const fetchTransactions = async () => {
        setTxnLoading(true);
        try {
            const params = txnMentorFilter && txnMentorFilter !== 'all' ? `?mentor_id=${txnMentorFilter}` : '';
            const response = await axios.get(`${API_URL}/api/commissions/transactions${params}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setTxnData(response.data);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch transactions', variant: 'destructive' });
        } finally {
            setTxnLoading(false);
        }
    };

    const handleGenerateCommissions = async () => {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const quarter = Math.ceil((currentDate.getMonth() + 1) / 3);

        setGenerating(true);
        try {
            const response = await axios.post(
                `${API_URL}/api/commissions/generate?year=${year}&quarter=${quarter}`,
                {},
                { headers: { Authorization: `Bearer ${getToken()}` } }
            );
            toast({ title: 'Success', description: response.data.message });
            fetchCommissions();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to generate commissions',
                variant: 'destructive',
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleApprovalAction = async () => {
        if (!selectedCommission) return;

        try {
            await axios.put(
                `${API_URL}/api/commissions/${selectedCommission.id}/approve`,
                {
                    action: approvalAction,
                    rejection_reason: approvalAction === 'reject' ? rejectionReason : null,
                },
                { headers: { Authorization: `Bearer ${getToken()}` } }
            );
            toast({
                title: 'Success',
                description: `Commission ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully`,
            });
            setApprovalDialogOpen(false);
            setSelectedCommission(null);
            setRejectionReason('');
            fetchCommissions();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Action failed',
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

    const getStatusInfo = (commission) => {
        const status = commission.overall_status;
        const statusMap = {
            pending_broker_approval: { label: 'Broker Review', icon: Clock, class: 'bg-accent-warning/20 text-accent-warning' },
            pending_academic_approval: { label: 'Academic Review', icon: Clock, class: 'bg-accent-info/20 text-accent-info' },
            pending_finance_approval: { label: 'Finance Review', icon: Clock, class: 'bg-primary/20 text-primary' },
            released: { label: 'Released', icon: CheckCircle, class: 'bg-accent-success/20 text-accent-success' },
            rejected: { label: 'Rejected', icon: XCircle, class: 'bg-accent-error/20 text-accent-error' },
        };
        return statusMap[status] || statusMap.pending_broker_approval;
    };

    const canUserApprove = (commission) => {
        const role = user?.role;
        const status = commission.overall_status;

        if (role === 'super_admin') return status !== 'released' && status !== 'rejected';
        if (role === 'broker_admin' && status === 'pending_broker_approval') return true;
        if (role === 'academic_head' && status === 'pending_academic_approval') return true;
        if (role === 'finance_admin' && status === 'pending_finance_approval') return true;
        return false;
    };

    const getApprovalStage = (commission) => {
        const stages = [
            { key: 'broker', label: 'Broker', status: commission.broker_admin_approval_status },
            { key: 'academic', label: 'Academic', status: commission.academic_head_approval_status },
            { key: 'finance', label: 'Finance', status: commission.finance_admin_approval_status },
        ];
        return stages;
    };

    // Stats
    const totalCommissions = commissions.reduce((sum, c) => sum + c.commission_release_usd, 0);
    const totalBuffer = commissions.reduce((sum, c) => sum + c.commission_buffer_usd, 0);
    const pendingCount = commissions.filter(c => !['released', 'rejected'].includes(c.overall_status)).length;
    
    // Calculate "My Queue" - commissions waiting for current user's role to approve
    const getMyQueueCount = () => {
        const role = user?.role;
        if (role === 'super_admin') return pendingCount;
        if (role === 'broker_admin') return commissions.filter(c => c.overall_status === 'pending_broker_approval').length;
        if (role === 'academic_head') return commissions.filter(c => c.overall_status === 'pending_academic_approval').length;
        if (role === 'finance_admin') return commissions.filter(c => c.overall_status === 'pending_finance_approval').length;
        return 0;
    };
    const myQueueCount = getMyQueueCount();
    
    // Filter commissions based on active tab
    const getFilteredCommissions = () => {
        switch (activeTab) {
            case 'my-queue':
                const role = user?.role;
                if (role === 'super_admin') return commissions.filter(c => !['released', 'rejected'].includes(c.overall_status));
                if (role === 'broker_admin') return commissions.filter(c => c.overall_status === 'pending_broker_approval');
                if (role === 'academic_head') return commissions.filter(c => c.overall_status === 'pending_academic_approval');
                if (role === 'finance_admin') return commissions.filter(c => c.overall_status === 'pending_finance_approval');
                return [];
            case 'pending':
                return commissions.filter(c => !['released', 'rejected'].includes(c.overall_status));
            case 'released':
                return commissions.filter(c => c.overall_status === 'released');
            case 'rejected':
                return commissions.filter(c => c.overall_status === 'rejected');
            default:
                return commissions;
        }
    };
    const filteredCommissions = getFilteredCommissions();

    const isAdmin = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);

    return (
        <div className="space-y-6 animate-fade-in" data-testid="commissions-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Commission Ledger</h1>
                    <p className="text-muted-foreground mt-1">
                        Quarterly commission calculations, approvals & transaction history
                    </p>
                </div>
                {canGenerate && mainTab === 'ledger' && (
                    <Button
                        onClick={handleGenerateCommissions}
                        disabled={generating}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                        data-testid="generate-commissions-btn"
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Generate Current Quarter
                    </Button>
                )}
            </div>

            {/* Main Tabs: Ledger / Transaction History */}
            <Tabs value={mainTab} onValueChange={setMainTab}>
                <TabsList className="bg-muted/50 border border-border">
                    <TabsTrigger value="ledger" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="main-tab-ledger">
                        <Wallet className="w-4 h-4" /> Commission Ledger
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="main-tab-transactions">
                        <History className="w-4 h-4" /> Transaction History
                    </TabsTrigger>
                </TabsList>

                {/* ========= LEDGER TAB ========= */}
                <TabsContent value="ledger" className="space-y-6 mt-4">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-accent-success/10 flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-accent-success" />
                        </div>
                        <div>
                            <p className="text-2xl font-heading text-foreground">{formatCurrency(totalCommissions)}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Releasable</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-accent-warning/10 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-accent-warning" />
                        </div>
                        <div>
                            <p className="text-2xl font-heading text-foreground">{formatCurrency(totalBuffer)}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Buffer (25%)</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-heading text-foreground">{pendingCount}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Approval</p>
                        </div>
                    </CardContent>
                </Card>
                {canApprove && (
                    <Card className={`border-border ${myQueueCount > 0 ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${myQueueCount > 0 ? 'bg-primary/20' : 'bg-foreground-subtle/10'}`}>
                                <Inbox className={`w-6 h-6 ${myQueueCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                                <p className={`text-2xl font-heading ${myQueueCount > 0 ? 'text-primary' : 'text-foreground'}`}>{myQueueCount}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">My Queue</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Table with Tabs */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-background">
                            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                            {canApprove && (
                                <TabsTrigger value="my-queue" data-testid="tab-my-queue" className="relative">
                                    My Queue
                                    {myQueueCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 text-xs bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                            {myQueueCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
                            <TabsTrigger value="released" data-testid="tab-released">Released</TabsTrigger>
                            <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="p-0 pt-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredCommissions.length === 0 ? (
                        <div className="text-center py-20">
                            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">
                                {activeTab === 'my-queue' ? 'No commissions waiting for your approval' : 
                                 activeTab === 'all' ? 'No commission ledgers found' : 
                                 `No ${activeTab} commissions`}
                            </p>
                            {canGenerate && activeTab === 'all' && (
                                <p className="text-muted-foreground text-sm mt-2">Click "Generate Current Quarter" to create commission records</p>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="data-table">
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Mentor</TableHead>
                                        <TableHead className="text-muted-foreground">Quarter</TableHead>
                                        <TableHead className="text-muted-foreground">Net Deposit</TableHead>
                                        <TableHead className="text-muted-foreground">Gross (4%)</TableHead>
                                        <TableHead className="text-muted-foreground">Release (75%)</TableHead>
                                        <TableHead className="text-muted-foreground">Buffer (25%)</TableHead>
                                        <TableHead className="text-muted-foreground">Approval Flow</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        {canApprove && (
                                            <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCommissions.map((commission) => {
                                        const statusInfo = getStatusInfo(commission);
                                        const StatusIcon = statusInfo.icon;
                                        const stages = getApprovalStage(commission);
                                        const isMyAction = canUserApprove(commission);

                                        return (
                                            <TableRow 
                                                key={commission.id} 
                                                className={`border-border ${isMyAction ? 'bg-primary/5' : ''}`}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {isMyAction && <UserCheck className="w-4 h-4 text-primary" />}
                                                        <p className="text-foreground font-medium">{commission.mentor_name}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-foreground">{commission.quarter}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-foreground font-mono">{formatCurrency(commission.net_deposit_usd)}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-foreground font-mono">{formatCurrency(commission.gross_commission_usd)}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-accent-success font-mono font-medium">{formatCurrency(commission.commission_release_usd)}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-accent-warning font-mono">{formatCurrency(commission.commission_buffer_usd)}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {stages.map((stage, idx) => (
                                                            <React.Fragment key={stage.key}>
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                                                    stage.status === 'approved' ? 'bg-accent-success/20 text-accent-success' :
                                                                    stage.status === 'rejected' ? 'bg-accent-error/20 text-accent-error' :
                                                                    'bg-foreground-subtle/20 text-muted-foreground'
                                                                }`} title={`${stage.label}: ${stage.status}`}>
                                                                    {stage.status === 'approved' ? '✓' : stage.status === 'rejected' ? '✗' : idx + 1}
                                                                </div>
                                                                {idx < stages.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`${statusInfo.class} gap-1 font-normal border-0`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusInfo.label}
                                                    </Badge>
                                                </TableCell>
                                                {canApprove && (
                                                    <TableCell className="text-right">
                                                        {canUserApprove(commission) && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedCommission(commission);
                                                                        setApprovalAction('approve');
                                                                        setApprovalDialogOpen(true);
                                                                    }}
                                                                    className="bg-accent-success/20 text-accent-success hover:bg-accent-success/30 rounded-lg"
                                                                >
                                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                                    Approve
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        setSelectedCommission(commission);
                                                                        setApprovalAction('reject');
                                                                        setApprovalDialogOpen(true);
                                                                    }}
                                                                    className="text-accent-error hover:bg-accent-error/10"
                                                                >
                                                                    <XCircle className="w-4 h-4 mr-1" />
                                                                    Reject
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Approval Dialog */}
            <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">
                            {approvalAction === 'approve' ? 'Approve' : 'Reject'} Commission
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-muted-foreground">
                            {approvalAction === 'approve' 
                                ? `Approve commission of ${formatCurrency(selectedCommission?.commission_release_usd || 0)} for ${selectedCommission?.mentor_name}?`
                                : `Reject commission for ${selectedCommission?.mentor_name}?`
                            }
                        </p>
                        {approvalAction === 'reject' && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Reason for rejection</Label>
                                <Textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter reason..."
                                    className="bg-background border-border text-foreground rounded-lg"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setApprovalDialogOpen(false);
                                setSelectedCommission(null);
                                setRejectionReason('');
                            }}
                            className="text-muted-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApprovalAction}
                            disabled={approvalAction === 'reject' && !rejectionReason}
                            className={approvalAction === 'approve' 
                                ? 'bg-accent-success text-white hover:bg-accent-success/90 rounded-lg'
                                : 'bg-accent-error text-white hover:bg-accent-error/90 rounded-lg'
                            }
                        >
                            {approvalAction === 'approve' ? 'Approve' : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
                </TabsContent>

                {/* ========= TRANSACTION HISTORY TAB ========= */}
                <TabsContent value="transactions" className="space-y-6 mt-4">
                    {/* Summary Stats */}
                    {txnData?.summary && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="txn-summary-cards">
                            <Card className="bg-card border-border">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <History className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-heading text-foreground">{txnData.summary.total_transactions}</p>
                                        <p className="text-xs text-muted-foreground">Total Transactions</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-accent-success/10 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-accent-success" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-heading text-accent-success">{formatCurrency(txnData.summary.total_earned)}</p>
                                        <p className="text-xs text-muted-foreground">Commission Earned</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-accent-error/10 flex items-center justify-center">
                                        <TrendingDown className="w-5 h-5 text-accent-error" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-heading text-accent-error">{formatCurrency(Math.abs(txnData.summary.total_deducted))}</p>
                                        <p className="text-xs text-muted-foreground">Commission Deducted</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <DollarSign className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-heading text-foreground">{formatCurrency(txnData.summary.net_commission)}</p>
                                        <p className="text-xs text-muted-foreground">Net Commission</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Mentor Filter (Admin only) */}
                    {isAdmin && txnData?.mentor_options?.length > 0 && (
                        <div className="flex items-center gap-3" data-testid="txn-mentor-filter">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <Select value={txnMentorFilter} onValueChange={setTxnMentorFilter}>
                                <SelectTrigger className="w-64 bg-background border-border text-foreground rounded-lg">
                                    <SelectValue placeholder="Filter by Mentor" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="all">All Mentors</SelectItem>
                                    {txnData.mentor_options.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name} ({m.role.replace('_', ' ')})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Transaction Table */}
                    <Card className="bg-card border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="font-heading text-lg text-foreground flex items-center gap-2">
                                <History className="w-5 h-5 text-primary" />
                                Commission Transaction History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 pt-2">
                            {txnLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : !txnData?.transactions?.length ? (
                                <div className="text-center py-20">
                                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-muted-foreground">No commission transactions found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table className="data-table">
                                        <TableHeader>
                                            <TableRow className="border-border hover:bg-transparent">
                                                <TableHead className="text-muted-foreground">Date</TableHead>
                                                {isAdmin && <TableHead className="text-muted-foreground">Mentor</TableHead>}
                                                <TableHead className="text-muted-foreground">Student</TableHead>
                                                <TableHead className="text-muted-foreground">Type</TableHead>
                                                <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                                                <TableHead className="text-muted-foreground text-right">Rate</TableHead>
                                                <TableHead className="text-muted-foreground text-right">Commission</TableHead>
                                                <TableHead className="text-muted-foreground text-right">Running Deposit</TableHead>
                                                <TableHead className="text-muted-foreground">Cap Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {txnData.transactions.map((txn) => (
                                                <TableRow key={txn.id} className={`border-border ${txn.cap_hit ? 'bg-yellow-500/5' : ''}`}>
                                                    <TableCell className="text-foreground text-sm">
                                                        {txn.date ? new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                                    </TableCell>
                                                    {isAdmin && (
                                                        <TableCell className="text-foreground text-sm font-medium">{txn.mentor_name}</TableCell>
                                                    )}
                                                    <TableCell>
                                                        <div>
                                                            <p className="text-foreground text-sm font-medium">{txn.student_name}</p>
                                                            <p className="text-muted-foreground text-xs">{txn.student_code}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`gap-1 font-normal border-0 ${
                                                            txn.type === 'DEPOSIT' 
                                                                ? 'bg-accent-success/15 text-accent-success' 
                                                                : 'bg-accent-error/15 text-accent-error'
                                                        }`}>
                                                            {txn.type === 'DEPOSIT' 
                                                                ? <ArrowUpRight className="w-3 h-3" /> 
                                                                : <ArrowDownRight className="w-3 h-3" />}
                                                            {txn.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-foreground">
                                                        {formatCurrency(txn.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground text-sm">
                                                        {txn.commission_rate}%
                                                    </TableCell>
                                                    <TableCell className={`text-right font-mono font-medium ${
                                                        txn.commission_earned > 0 ? 'text-accent-success' : 
                                                        txn.commission_earned < 0 ? 'text-accent-error' : 'text-muted-foreground'
                                                    }`}>
                                                        {txn.commission_earned > 0 ? '+' : ''}{formatCurrency(txn.commission_earned)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-foreground text-sm">
                                                        {formatCurrency(txn.running_deposit)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {txn.cap_hit ? (
                                                            <Badge className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 gap-1">
                                                                <ShieldAlert className="w-3 h-3" /> $25K Cap
                                                            </Badge>
                                                        ) : txn.commission_earned === 0 && txn.type === 'DEPOSIT' ? (
                                                            <Badge variant="outline" className="text-muted-foreground border-border text-xs">No commission</Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Active</span>
                                                        )}
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
        </div>
    );
};

export default CommissionsPage;
