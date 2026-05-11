import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { payoutsAPI, commissionsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
    Loader2,
    DollarSign,
    Clock,
    CheckCircle,
    XCircle,
    CreditCard,
    Send,
    RefreshCw,
    Plus,
    Banknote,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const PayoutsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [payouts, setPayouts] = useState([]);
    const [summary, setSummary] = useState(null);
    const [releasedCommissions, setReleasedCommissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [processDialogOpen, setProcessDialogOpen] = useState(false);
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
    const [selectedPayout, setSelectedPayout] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [paymentReference, setPaymentReference] = useState('');

    const [formData, setFormData] = useState({
        commission_ledger_id: '',
        payment_method: 'BANK_TRANSFER',
        payment_reference: '',
        notes: '',
    });

    const canManage = hasRole(['super_admin', 'finance_admin']);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch payouts (works for all roles)
            const payoutsRes = await payoutsAPI.getAll({});
            setPayouts(payoutsRes.data);

            // Fetch summary and released commissions only for admins
            if (canManage) {
                try {
                    const summaryRes = await payoutsAPI.getSummary();
                    setSummary(summaryRes.data);
                } catch (summaryError) {
                    console.log('Summary not available for this role');
                }

                const commissionsRes = await commissionsAPI.getAll({ status: 'released' });
                // Filter out ones that already have payouts
                const existingPayoutLedgerIds = payoutsRes.data.map(p => p.commission_ledger_id);
                const available = commissionsRes.data.filter(c => 
                    c.overall_status === 'released' && !existingPayoutLedgerIds.includes(c.id)
                );
                setReleasedCommissions(available);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch payouts',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await payoutsAPI.create(formData);
            toast({
                title: 'Success',
                description: 'Payout created successfully',
            });
            setCreateDialogOpen(false);
            setFormData({
                commission_ledger_id: '',
                payment_method: 'BANK_TRANSFER',
                payment_reference: '',
                notes: '',
            });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to create payout',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleProcess = async () => {
        if (!selectedPayout) return;
        setSubmitting(true);

        try {
            await payoutsAPI.process(selectedPayout.id);
            toast({
                title: 'Success',
                description: 'Payout marked as processing',
            });
            setProcessDialogOpen(false);
            setSelectedPayout(null);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to process payout',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleComplete = async () => {
        if (!selectedPayout) return;
        setSubmitting(true);

        try {
            await payoutsAPI.complete(selectedPayout.id, paymentReference);
            toast({
                title: 'Success',
                description: 'Payout completed! Mentor has been notified.',
            });
            setCompleteDialogOpen(false);
            setSelectedPayout(null);
            setPaymentReference('');
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to complete payout',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
            PROCESSING: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
            COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/30',
            FAILED: 'bg-red-500/10 text-red-500 border-red-500/30',
        };
        const icons = {
            PENDING: Clock,
            PROCESSING: RefreshCw,
            COMPLETED: CheckCircle,
            FAILED: XCircle,
        };
        const Icon = icons[status] || Clock;
        return (
            <Badge variant="outline" className={`${styles[status] || ''} gap-1`}>
                <Icon className="h-3 w-3" />
                {status}
            </Badge>
        );
    };

    const getPaymentMethodLabel = (method) => {
        const labels = {
            BANK_TRANSFER: 'Bank Transfer',
            PAYPAL: 'PayPal',
            CRYPTO: 'Cryptocurrency',
            CHECK: 'Check',
            CASH: 'Cash',
        };
        return labels[method] || method;
    };

    // Filter payouts by tab
    const filteredPayouts = payouts.filter(p => {
        if (activeTab === 'all') return true;
        if (activeTab === 'pending') return p.status === 'PENDING';
        if (activeTab === 'processing') return p.status === 'PROCESSING';
        if (activeTab === 'completed') return p.status === 'COMPLETED';
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in" data-testid="payouts-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Payouts</h1>
                    <p className="text-muted-foreground mt-1">
                        Commission payout management
                    </p>
                </div>
                {canManage && releasedCommissions.length > 0 && (
                    <Button
                        onClick={() => setCreateDialogOpen(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                        data-testid="create-payout-btn"
                    >
                        <Plus className="w-4 h-4" />
                        New Payout
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Card className="bg-card border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{summary.awaiting_payout_count}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Awaiting Payout</p>
                                <p className="text-sm text-amber-500">{formatCurrency(summary.awaiting_payout_amount)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <RefreshCw className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{summary.processing_count}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Processing</p>
                                <p className="text-sm text-blue-500">{formatCurrency(summary.processing_amount)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{summary.completed_count}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
                                <p className="text-sm text-green-500">{formatCurrency(summary.completed_amount)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Banknote className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{formatCurrency(summary.total_released_amount)}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Released</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Table with Tabs */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-background">
                            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                            <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
                            <TabsTrigger value="processing" data-testid="tab-processing">Processing</TabsTrigger>
                            <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="p-0 pt-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : filteredPayouts.length === 0 ? (
                        <div className="text-center py-20">
                            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No payouts found</p>
                            {canManage && releasedCommissions.length > 0 && (
                                <p className="text-muted-foreground text-sm mt-2">
                                    {releasedCommissions.length} commission(s) ready for payout
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="data-table">
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Mentor</TableHead>
                                        <TableHead className="text-muted-foreground">Quarter</TableHead>
                                        <TableHead className="text-muted-foreground">Amount</TableHead>
                                        <TableHead className="text-muted-foreground">Payment Method</TableHead>
                                        <TableHead className="text-muted-foreground">Reference</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-muted-foreground">Created</TableHead>
                                        <TableHead className="text-muted-foreground">Completed</TableHead>
                                        {canManage && (
                                            <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPayouts.map((payout) => (
                                        <TableRow key={payout.id} className="border-border">
                                            <TableCell className="text-foreground font-medium">
                                                {payout.mentor_name}
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {payout.quarter}
                                            </TableCell>
                                            <TableCell className="text-green-500 font-mono font-medium">
                                                {formatCurrency(payout.amount_usd)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {getPaymentMethodLabel(payout.payment_method)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {payout.payment_reference || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(payout.status)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(payout.created_date)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(payout.completed_date)}
                                            </TableCell>
                                            {canManage && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {payout.status === 'PENDING' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setSelectedPayout(payout);
                                                                    setProcessDialogOpen(true);
                                                                }}
                                                                className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                                                                data-testid={`process-btn-${payout.id}`}
                                                            >
                                                                <RefreshCw className="w-4 h-4 mr-1" />
                                                                Process
                                                            </Button>
                                                        )}
                                                        {(payout.status === 'PENDING' || payout.status === 'PROCESSING') && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedPayout(payout);
                                                                    setPaymentReference(payout.payment_reference || '');
                                                                    setCompleteDialogOpen(true);
                                                                }}
                                                                className="bg-green-500/20 text-green-500 hover:bg-green-500/30"
                                                                data-testid={`complete-btn-${payout.id}`}
                                                            >
                                                                <CheckCircle className="w-4 h-4 mr-1" />
                                                                Complete
                                                            </Button>
                                                        )}
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

            {/* Create Payout Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Create Payout</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Create a payout for a released commission
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                                Commission
                            </Label>
                            <Select
                                value={formData.commission_ledger_id}
                                onValueChange={(value) => setFormData({ ...formData, commission_ledger_id: value })}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Select commission" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {releasedCommissions.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.mentor_name} - {c.quarter} - {formatCurrency(c.commission_release_usd)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                                Payment Method
                            </Label>
                            <Select
                                value={formData.payment_method}
                                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                    <SelectItem value="PAYPAL">PayPal</SelectItem>
                                    <SelectItem value="CRYPTO">Cryptocurrency</SelectItem>
                                    <SelectItem value="CHECK">Check</SelectItem>
                                    <SelectItem value="CASH">Cash</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                                Payment Reference (Optional)
                            </Label>
                            <Input
                                value={formData.payment_reference}
                                onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                                placeholder="Transaction ID, Check number, etc."
                                className="bg-background border-border text-foreground"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                                Notes (Optional)
                            </Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Any additional notes..."
                                className="bg-background border-border text-foreground"
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setCreateDialogOpen(false)}
                                className="text-muted-foreground"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!formData.commission_ledger_id || submitting}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                data-testid="submit-payout-btn"
                            >
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Payout
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Process Dialog */}
            <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Process Payout</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Mark this payout as processing? This indicates payment is being initiated.
                    </p>
                    {selectedPayout && (
                        <div className="bg-background p-4 rounded-lg">
                            <p className="text-foreground font-medium">{selectedPayout.mentor_name}</p>
                            <p className="text-green-500 font-mono">{formatCurrency(selectedPayout.amount_usd)}</p>
                            <p className="text-muted-foreground text-sm">{selectedPayout.quarter}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setProcessDialogOpen(false)}
                            className="text-muted-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleProcess}
                            disabled={submitting}
                            className="bg-blue-500 text-white hover:bg-blue-600"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Mark as Processing
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Complete Dialog */}
            <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Complete Payout</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Mark this payout as completed? The mentor will be notified via email.
                    </p>
                    {selectedPayout && (
                        <div className="bg-background p-4 rounded-lg">
                            <p className="text-foreground font-medium">{selectedPayout.mentor_name}</p>
                            <p className="text-green-500 font-mono">{formatCurrency(selectedPayout.amount_usd)}</p>
                            <p className="text-muted-foreground text-sm">{selectedPayout.quarter}</p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                            Payment Reference
                        </Label>
                        <Input
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Transaction ID, confirmation number, etc."
                            className="bg-background border-border text-foreground"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setCompleteDialogOpen(false)}
                            className="text-muted-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleComplete}
                            disabled={submitting}
                            className="bg-green-500 text-white hover:bg-green-600"
                            data-testid="confirm-complete-btn"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Complete Payout
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PayoutsPage;
