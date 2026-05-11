import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fundingAPI, studentsAPI } from '../services/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
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
    Plus,
    Loader2,
    Clock,
    CheckCircle,
    XCircle,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    Filter,
    Upload,
    Image,
    X,
    Eye,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

// Payment methods dropdown options
const PAYMENT_METHODS = [
    { value: 'wire_transfer', label: 'Wire Transfer' },
    { value: 'crypto_btc', label: 'Crypto (BTC)' },
    { value: 'crypto_usdt', label: 'Crypto (USDT)' },
    { value: 'crypto_eth', label: 'Crypto (ETH)' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'skrill', label: 'Skrill' },
    { value: 'neteller', label: 'Neteller' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'bank_deposit', label: 'Bank Deposit' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
];

const FundingPage = () => {
    const { user, canApprove, hasRole } = useAuth();
    const { toast } = useToast();
    const [transactions, setTransactions] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);
    const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [rejectionReason, setRejectionReason] = useState('');
    const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
    const fileInputRef = useRef(null);

    // Approval form state
    const [approvalData, setApprovalData] = useState({
        transaction_id: '',
        amount_usd: '',
    });

    const [formData, setFormData] = useState({
        type: 'DEPOSIT',
        student_id: '',
        amount_usd: '',
        payment_method: '',
        mt5_login: '',
        transaction_id: '',
        screenshot_url: '',
        notes: '',
    });

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const params = {};
            if (activeTab !== 'all') {
                params.status = activeTab.toUpperCase();
            }
            const response = await fundingAPI.getAll(params);
            setTransactions(response.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch transactions',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const response = await studentsAPI.getAll({});
            setStudents(response.data);
        } catch (error) {
            console.error('Failed to fetch students:', error);
        }
    };

    useEffect(() => {
        fetchTransactions();
        fetchStudents();
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [activeTab]);

    const handleOpenDialog = () => {
        setFormData({
            type: 'DEPOSIT',
            student_id: '',
            amount_usd: '',
            payment_method: '',
            mt5_login: '',
            transaction_id: '',
            screenshot_url: '',
            notes: '',
        });
        setDialogOpen(true);
    };

    const handleScreenshotUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast({
                title: 'Error',
                description: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)',
                variant: 'destructive',
            });
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast({
                title: 'Error',
                description: 'File size must be less than 10MB',
                variant: 'destructive',
            });
            return;
        }

        setUploadingScreenshot(true);
        try {
            const response = await fundingAPI.uploadScreenshot(file);
            setFormData({ ...formData, screenshot_url: response.data.url });
            toast({
                title: 'Success',
                description: 'Screenshot uploaded successfully',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to upload screenshot',
                variant: 'destructive',
            });
        } finally {
            setUploadingScreenshot(false);
        }
    };

    const handleRemoveScreenshot = () => {
        setFormData({ ...formData, screenshot_url: '' });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await fundingAPI.create({
                ...formData,
                amount_usd: parseFloat(formData.amount_usd),
            });
            toast({
                title: 'Success',
                description: 'Funding request created successfully',
            });
            setDialogOpen(false);
            fetchTransactions();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to create request',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenApproveDialog = (txn) => {
        setSelectedTxn(txn);
        setApprovalData({
            transaction_id: txn.transaction_id || '',
            amount_usd: txn.amount_usd.toString(),
        });
        setApproveDialogOpen(true);
    };

    const handleApprove = async () => {
        if (!selectedTxn) return;
        
        if (!approvalData.transaction_id.trim()) {
            toast({
                title: 'Error',
                description: 'Transaction ID is required',
                variant: 'destructive',
            });
            return;
        }

        setSubmitting(true);
        try {
            await fundingAPI.approve(selectedTxn.id, {
                transaction_id: approvalData.transaction_id,
                amount_usd: parseFloat(approvalData.amount_usd),
            });
            toast({
                title: 'Success',
                description: 'Transaction approved successfully',
            });
            setApproveDialogOpen(false);
            setSelectedTxn(null);
            fetchTransactions();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to approve',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!selectedTxn) return;
        
        try {
            await fundingAPI.reject(selectedTxn.id, { rejection_reason: rejectionReason });
            toast({
                title: 'Success',
                description: 'Transaction rejected',
            });
            setRejectDialogOpen(false);
            setSelectedTxn(null);
            setRejectionReason('');
            fetchTransactions();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to reject',
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
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status) => {
        const variants = {
            PENDING: { class: 'badge-warning', icon: Clock },
            APPROVED: { class: 'badge-success', icon: CheckCircle },
            REJECTED: { class: 'badge-error', icon: XCircle },
        };
        const variant = variants[status] || variants.PENDING;
        const Icon = variant.icon;

        return (
            <Badge variant="outline" className={`${variant.class} gap-1 font-normal`}>
                <Icon className="w-3 h-3" />
                {status}
            </Badge>
        );
    };

    const getPaymentMethodLabel = (value) => {
        const method = PAYMENT_METHODS.find(m => m.value === value);
        return method ? method.label : value;
    };

    const pendingCount = transactions.filter(t => t.status === 'PENDING').length;

    return (
        <div className="space-y-6 animate-fade-in" data-testid="funding-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Funding Requests</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage deposits and withdrawals
                    </p>
                </div>
                <Button
                    onClick={handleOpenDialog}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                    data-testid="new-funding-btn"
                >
                    <Plus className="w-4 h-4" />
                    New Request
                </Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-card border border-border p-1 gap-1">
                    <TabsTrigger 
                        value="all" 
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                    >
                        All
                    </TabsTrigger>
                    <TabsTrigger 
                        value="pending" 
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg gap-2"
                    >
                        Pending
                        {pendingCount > 0 && (
                            <Badge className="bg-accent-warning/20 text-accent-warning border-0 text-xs ml-1">
                                {pendingCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger 
                        value="approved" 
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                    >
                        Approved
                    </TabsTrigger>
                    <TabsTrigger 
                        value="rejected" 
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                    >
                        Rejected
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-20">
                            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No transactions found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="data-table">
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Type</TableHead>
                                        <TableHead className="text-muted-foreground">Student</TableHead>
                                        <TableHead className="text-muted-foreground">Mentor</TableHead>
                                        <TableHead className="text-muted-foreground">Amount</TableHead>
                                        <TableHead className="text-muted-foreground">Requested By</TableHead>
                                        <TableHead className="text-muted-foreground">Date</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-muted-foreground">Transaction ID</TableHead>
                                        <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map((txn) => (
                                        <TableRow 
                                            key={txn.id} 
                                            className="border-border"
                                            data-testid={`txn-row-${txn.id}`}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                        txn.type === 'DEPOSIT' 
                                                            ? 'bg-accent-success/10' 
                                                            : 'bg-accent-error/10'
                                                    }`}>
                                                        {txn.type === 'DEPOSIT' ? (
                                                            <ArrowUpRight className="w-4 h-4 text-accent-success" />
                                                        ) : (
                                                            <ArrowDownRight className="w-4 h-4 text-accent-error" />
                                                        )}
                                                    </div>
                                                    <span className="text-foreground text-sm">{txn.type}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground text-sm">{txn.student_name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{txn.student_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-foreground text-sm">{txn.primary_mentor_name || '-'}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className={`font-mono font-medium ${
                                                    txn.type === 'DEPOSIT' ? 'text-accent-success' : 'text-accent-error'
                                                }`}>
                                                    {txn.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(txn.amount_usd)}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-foreground text-sm">{txn.requested_by_name}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-muted-foreground text-sm">{formatDate(txn.requested_at)}</p>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(txn.status)}
                                            </TableCell>
                                            <TableCell>
                                                {txn.status === 'APPROVED' && txn.transaction_id ? (
                                                    <p className="text-foreground text-sm font-mono bg-muted px-2 py-1 rounded">
                                                        {txn.transaction_id}
                                                    </p>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* View Details button for all transactions */}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setSelectedTxn(txn);
                                                            setViewDetailsDialogOpen(true);
                                                        }}
                                                        className="text-muted-foreground hover:text-primary"
                                                        data-testid={`view-txn-${txn.id}`}
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    
                                                    {/* Approve/Reject buttons for pending transactions (admins only) */}
                                                    {canApprove() && txn.status === 'PENDING' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleOpenApproveDialog(txn)}
                                                                className="bg-accent-success/20 text-accent-success hover:bg-accent-success/30 rounded-lg"
                                                                data-testid={`approve-txn-${txn.id}`}
                                                            >
                                                                <CheckCircle className="w-4 h-4 mr-1" />
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setSelectedTxn(txn);
                                                                    setRejectDialogOpen(true);
                                                                }}
                                                                className="text-accent-error hover:bg-accent-error/10"
                                                                data-testid={`reject-txn-${txn.id}`}
                                                            >
                                                                <XCircle className="w-4 h-4 mr-1" />
                                                                Reject
                                                            </Button>
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

            {/* New Request Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-2xl text-foreground">
                            New Funding Request
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Submit a deposit or withdrawal request for a student
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) => setFormData({ ...formData, type: value })}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="DEPOSIT" className="text-foreground">Deposit</SelectItem>
                                    <SelectItem value="WITHDRAWAL" className="text-foreground">Withdrawal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Student</Label>
                            <Select
                                value={formData.student_id}
                                onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                    <SelectValue placeholder="Select student" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border max-h-60">
                                    {students.map((student) => (
                                        <SelectItem key={student.id} value={student.id} className="text-foreground">
                                            {student.full_name} ({student.student_code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Amount (USD)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.amount_usd}
                                    onChange={(e) => setFormData({ ...formData, amount_usd: e.target.value })}
                                    placeholder="0.00"
                                    required
                                    className="bg-background border-border text-foreground rounded-lg"
                                    data-testid="funding-amount-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Payment Method</Label>
                                <Select
                                    value={formData.payment_method}
                                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {PAYMENT_METHODS.map((method) => (
                                            <SelectItem key={method.value} value={method.value} className="text-foreground">
                                                {method.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">MT5 Login</Label>
                                <Input
                                    value={formData.mt5_login}
                                    onChange={(e) => setFormData({ ...formData, mt5_login: e.target.value })}
                                    placeholder="MT5 Account ID"
                                    className="bg-background border-border text-foreground rounded-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Transaction ID</Label>
                                <Input
                                    value={formData.transaction_id}
                                    onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                                    placeholder="External TX ID"
                                    className="bg-background border-border text-foreground rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Screenshot</Label>
                            {formData.screenshot_url ? (
                                <div className="flex items-center gap-2 p-3 bg-background border border-border rounded-lg">
                                    <Image className="w-5 h-5 text-primary" />
                                    <span className="text-foreground text-sm flex-1 truncate">Screenshot uploaded</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveScreenshot}
                                        className="text-muted-foreground hover:text-accent-error"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div 
                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploadingScreenshot ? (
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                            <p className="text-muted-foreground text-sm">Click to upload screenshot</p>
                                            <p className="text-muted-foreground text-xs mt-1">JPEG, PNG, GIF, WebP (max 10MB)</p>
                                        </>
                                    )}
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={handleScreenshotUpload}
                                className="hidden"
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
                                disabled={submitting || !formData.student_id || !formData.amount_usd || !formData.payment_method}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                                data-testid="submit-funding-btn"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Approve Dialog */}
            <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Approve Transaction</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Enter transaction details to approve this funding request
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedTxn && (
                            <div className="bg-background p-4 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className="text-foreground font-medium">{selectedTxn.type}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Student:</span>
                                    <span className="text-foreground">{selectedTxn.student_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Payment Method:</span>
                                    <span className="text-foreground">{getPaymentMethodLabel(selectedTxn.payment_method)}</span>
                                </div>
                                {selectedTxn.screenshot_url && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Screenshot:</span>
                                        <a 
                                            href={`${process.env.REACT_APP_BACKEND_URL}${selectedTxn.screenshot_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline text-sm"
                                        >
                                            View Screenshot
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                                Transaction ID <span className="text-accent-error">*</span>
                            </Label>
                            <Input
                                value={approvalData.transaction_id}
                                onChange={(e) => setApprovalData({ ...approvalData, transaction_id: e.target.value })}
                                placeholder="Enter verified transaction ID"
                                className="bg-background border-border text-foreground rounded-lg"
                                data-testid="approval-txn-id-input"
                            />
                            <p className="text-xs text-muted-foreground">Transaction ID must be unique across all approved transactions</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Amount (USD)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={approvalData.amount_usd}
                                onChange={(e) => setApprovalData({ ...approvalData, amount_usd: e.target.value })}
                                className="bg-background border-border text-foreground rounded-lg"
                                data-testid="approval-amount-input"
                            />
                            <p className="text-xs text-muted-foreground">You can edit the amount if it differs from the original request</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setApproveDialogOpen(false);
                                setSelectedTxn(null);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApprove}
                            disabled={submitting || !approvalData.transaction_id.trim()}
                            className="bg-accent-success text-white hover:bg-accent-success/90 rounded-lg"
                            data-testid="confirm-approve-btn"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Approve
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Reject Transaction</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Please provide a reason for rejecting this transaction
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-muted-foreground">
                            Rejecting {selectedTxn?.type?.toLowerCase()} of {formatCurrency(selectedTxn?.amount_usd || 0)} for {selectedTxn?.student_name}
                        </p>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Reason for rejection</Label>
                            <Textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Enter reason..."
                                className="bg-background border-border text-foreground rounded-lg"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setRejectDialogOpen(false);
                                setSelectedTxn(null);
                                setRejectionReason('');
                            }}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleReject}
                            disabled={!rejectionReason}
                            className="bg-accent-error text-white hover:bg-accent-error/90 rounded-lg"
                        >
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Details Dialog */}
            <Dialog open={viewDetailsDialogOpen} onOpenChange={setViewDetailsDialogOpen}>
                <DialogContent className="bg-card border-border max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
                            <Eye className="w-5 h-5 text-primary" />
                            Transaction Details
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Full details of this funding request
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTxn && (
                        <div className="space-y-4 mt-2">
                            {/* Status Badge */}
                            <div className="flex justify-center">
                                {getStatusBadge(selectedTxn.status)}
                            </div>
                            
                            {/* Transaction Info */}
                            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className={`font-medium ${selectedTxn.type === 'DEPOSIT' ? 'text-accent-success' : 'text-accent-error'}`}>
                                        {selectedTxn.type}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Amount:</span>
                                    <span className={`font-mono font-bold ${selectedTxn.type === 'DEPOSIT' ? 'text-accent-success' : 'text-accent-error'}`}>
                                        {selectedTxn.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(selectedTxn.amount_usd)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Student:</span>
                                    <span className="text-foreground">{selectedTxn.student_name} ({selectedTxn.student_code})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Payment Method:</span>
                                    <span className="text-foreground">{getPaymentMethodLabel(selectedTxn.payment_method)}</span>
                                </div>
                                {selectedTxn.mt5_login && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">MT5 Login:</span>
                                        <span className="text-foreground font-mono">{selectedTxn.mt5_login}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Requested By:</span>
                                    <span className="text-foreground">{selectedTxn.requested_by_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Student's Mentor:</span>
                                    <span className="text-foreground">{selectedTxn.primary_mentor_name || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Requested At:</span>
                                    <span className="text-foreground">{formatDate(selectedTxn.requested_at)}</span>
                                </div>
                                
                                {/* Transaction ID for approved */}
                                {selectedTxn.status === 'APPROVED' && selectedTxn.transaction_id && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Transaction ID:</span>
                                        <span className="text-foreground font-mono bg-background px-2 py-1 rounded">{selectedTxn.transaction_id}</span>
                                    </div>
                                )}
                                
                                {/* Approved by */}
                                {selectedTxn.status === 'APPROVED' && selectedTxn.approved_by_name && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Approved By:</span>
                                        <span className="text-foreground">{selectedTxn.approved_by_name}</span>
                                    </div>
                                )}
                                
                                {/* Rejection reason */}
                                {selectedTxn.status === 'REJECTED' && selectedTxn.rejection_reason && (
                                    <div className="pt-2 border-t border-border">
                                        <span className="text-muted-foreground text-sm">Rejection Reason:</span>
                                        <p className="text-accent-error mt-1">{selectedTxn.rejection_reason}</p>
                                    </div>
                                )}
                                
                                {/* Notes */}
                                {selectedTxn.notes && (
                                    <div className="pt-2 border-t border-border">
                                        <span className="text-muted-foreground text-sm">Notes:</span>
                                        <p className="text-foreground mt-1">{selectedTxn.notes}</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Screenshot Section */}
                            {selectedTxn.screenshot_url && (
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Screenshot</Label>
                                    <div className="border border-border rounded-lg overflow-hidden">
                                        <a 
                                            href={`${process.env.REACT_APP_BACKEND_URL}${selectedTxn.screenshot_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block"
                                        >
                                            <img 
                                                src={`${process.env.REACT_APP_BACKEND_URL}${selectedTxn.screenshot_url}`}
                                                alt="Transaction screenshot"
                                                className="w-full h-auto max-h-64 object-contain bg-background"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                            <div className="hidden items-center justify-center p-4 bg-muted text-muted-foreground">
                                                <Image className="w-6 h-6 mr-2" />
                                                Click to view screenshot
                                            </div>
                                        </a>
                                    </div>
                                    <a 
                                        href={`${process.env.REACT_APP_BACKEND_URL}${selectedTxn.screenshot_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline text-sm flex items-center gap-1"
                                    >
                                        <Image className="w-4 h-4" />
                                        Open screenshot in new tab
                                    </a>
                                </div>
                            )}
                            
                            {!selectedTxn.screenshot_url && (
                                <div className="text-center py-4 bg-muted/30 rounded-lg">
                                    <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-muted-foreground text-sm">No screenshot uploaded</p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                setViewDetailsDialogOpen(false);
                                setSelectedTxn(null);
                            }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FundingPage;
