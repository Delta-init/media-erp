import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mt5AccountsAPI, studentsAPI } from '../services/api';
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
    Loader2,
    Plus,
    Edit,
    Trash2,
    Server,
    DollarSign,
    TrendingUp,
    Activity,
    RefreshCw,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const ACCOUNT_TYPES = ['DEMO', 'LIVE'];
const STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'];
const LEVERAGE_OPTIONS = ['1:50', '1:100', '1:200', '1:500'];

const MT5AccountsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [accounts, setAccounts] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        student_id: '',
        mt5_login: '',
        mt5_server: 'Demo',
        account_type: 'DEMO',
        leverage: '1:100',
        base_currency: 'USD',
        notes: '',
    });

    const [editData, setEditData] = useState({});

    const canManage = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);
    const canDelete = hasRole(['super_admin', 'admin']);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (activeTab !== 'all') {
                params.status = activeTab.toUpperCase();
            }
            
            const [accountsRes, studentsRes] = await Promise.all([
                mt5AccountsAPI.getAll(params),
                studentsAPI.getAll({})
            ]);
            setAccounts(accountsRes.data);
            setStudents(studentsRes.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch MT5 accounts',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleCreate = async () => {
        if (!formData.student_id || !formData.mt5_login) {
            toast({ title: 'Error', description: 'Student and MT5 Login are required', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        try {
            await mt5AccountsAPI.create(formData);
            toast({ title: 'Success', description: 'MT5 account created' });
            setDialogOpen(false);
            setFormData({
                student_id: '',
                mt5_login: '',
                mt5_server: 'Demo',
                account_type: 'DEMO',
                leverage: '1:100',
                base_currency: 'USD',
                notes: '',
            });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to create account',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = async () => {
        if (!selectedAccount) return;
        setSubmitting(true);
        try {
            await mt5AccountsAPI.update(selectedAccount.id, editData);
            toast({ title: 'Success', description: 'MT5 account updated' });
            setEditDialogOpen(false);
            setSelectedAccount(null);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update account',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedAccount) return;
        setSubmitting(true);
        try {
            await mt5AccountsAPI.delete(selectedAccount.id);
            toast({ title: 'Success', description: 'MT5 account deleted' });
            setDeleteDialogOpen(false);
            setSelectedAccount(null);
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to delete account',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const openEditDialog = (account) => {
        setSelectedAccount(account);
        setEditData({
            mt5_server: account.mt5_server,
            account_type: account.account_type,
            leverage: account.leverage,
            status: account.status,
            balance: account.balance,
            equity: account.equity,
            notes: account.notes || '',
        });
        setEditDialogOpen(true);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(amount || 0);
    };

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/30',
            SUSPENDED: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
            CLOSED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        };
        return (
            <Badge variant="outline" className={styles[status] || ''}>
                {status}
            </Badge>
        );
    };

    const getTypeBadge = (type) => {
        return (
            <Badge 
                variant="outline" 
                className={type === 'LIVE' 
                    ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                }
            >
                {type}
            </Badge>
        );
    };

    // Stats
    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter(a => a.status === 'ACTIVE').length;
    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const liveAccounts = accounts.filter(a => a.account_type === 'LIVE').length;

    return (
        <div className="space-y-6 animate-fade-in" data-testid="mt5-accounts-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">MT5 Accounts</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage student trading accounts
                    </p>
                </div>
                {canManage && (
                    <Button
                        onClick={() => setDialogOpen(true)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                        data-testid="add-account-btn"
                    >
                        <Plus className="w-4 h-4" />
                        Add Account
                    </Button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Server className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{totalAccounts}</p>
                                <p className="text-xs text-muted-foreground uppercase">Total</p>
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
                                <p className="text-2xl font-heading text-foreground">{activeAccounts}</p>
                                <p className="text-xs text-muted-foreground uppercase">Active</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-heading text-foreground">{liveAccounts}</p>
                                <p className="text-xs text-muted-foreground uppercase">Live</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xl font-heading text-foreground">{formatCurrency(totalBalance)}</p>
                                <p className="text-xs text-muted-foreground uppercase">Total Balance</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-background">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="active">Active</TabsTrigger>
                            <TabsTrigger value="suspended">Suspended</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="p-0 pt-2">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="text-center py-20">
                            <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No MT5 accounts found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Student</TableHead>
                                        <TableHead className="text-muted-foreground">MT5 Login</TableHead>
                                        <TableHead className="text-muted-foreground">Server</TableHead>
                                        <TableHead className="text-muted-foreground">Type</TableHead>
                                        <TableHead className="text-muted-foreground">Leverage</TableHead>
                                        <TableHead className="text-muted-foreground">Balance</TableHead>
                                        <TableHead className="text-muted-foreground">Equity</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        {canManage && (
                                            <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accounts.map((account) => (
                                        <TableRow key={account.id} className="border-border">
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-foreground">{account.student_name}</p>
                                                    <p className="text-xs text-muted-foreground">{account.student_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-foreground">
                                                {account.mt5_login}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {account.mt5_server}
                                            </TableCell>
                                            <TableCell>{getTypeBadge(account.account_type)}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {account.leverage}
                                            </TableCell>
                                            <TableCell className="font-mono text-foreground">
                                                {formatCurrency(account.balance)}
                                            </TableCell>
                                            <TableCell className="font-mono text-foreground">
                                                {formatCurrency(account.equity)}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(account.status)}</TableCell>
                                            {canManage && (
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => openEditDialog(account)}
                                                            className="text-muted-foreground hover:text-primary"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        {canDelete && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setSelectedAccount(account);
                                                                    setDeleteDialogOpen(true);
                                                                }}
                                                                className="text-muted-foreground hover:text-red-500"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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

            {/* Create Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Add MT5 Account</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Link a MetaTrader 5 account to a student
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Student *</Label>
                            <Select
                                value={formData.student_id}
                                onValueChange={(v) => setFormData({...formData, student_id: v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Select student" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {students.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.full_name} ({s.student_code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">MT5 Login *</Label>
                                <Input
                                    value={formData.mt5_login}
                                    onChange={(e) => setFormData({...formData, mt5_login: e.target.value})}
                                    placeholder="12345678"
                                    className="bg-background border-border text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Server</Label>
                                <Input
                                    value={formData.mt5_server}
                                    onChange={(e) => setFormData({...formData, mt5_server: e.target.value})}
                                    placeholder="Demo"
                                    className="bg-background border-border text-foreground"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Account Type</Label>
                                <Select
                                    value={formData.account_type}
                                    onValueChange={(v) => setFormData({...formData, account_type: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {ACCOUNT_TYPES.map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Leverage</Label>
                                <Select
                                    value={formData.leverage}
                                    onValueChange={(v) => setFormData({...formData, leverage: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {LEVERAGE_OPTIONS.map(l => (
                                            <SelectItem key={l} value={l}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                placeholder="Optional notes..."
                                className="bg-background border-border text-foreground"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={submitting || !formData.student_id || !formData.mt5_login}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add Account
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Edit MT5 Account</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Update account details for {selectedAccount?.mt5_login}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Server</Label>
                                <Input
                                    value={editData.mt5_server || ''}
                                    onChange={(e) => setEditData({...editData, mt5_server: e.target.value})}
                                    className="bg-background border-border text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Status</Label>
                                <Select
                                    value={editData.status || ''}
                                    onValueChange={(v) => setEditData({...editData, status: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {STATUSES.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Balance</Label>
                                <Input
                                    type="number"
                                    value={editData.balance || 0}
                                    onChange={(e) => setEditData({...editData, balance: parseFloat(e.target.value)})}
                                    className="bg-background border-border text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase">Equity</Label>
                                <Input
                                    type="number"
                                    value={editData.equity || 0}
                                    onChange={(e) => setEditData({...editData, equity: parseFloat(e.target.value)})}
                                    className="bg-background border-border text-foreground"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase">Notes</Label>
                            <Textarea
                                value={editData.notes || ''}
                                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                                className="bg-background border-border text-foreground"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEdit}
                            disabled={submitting}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Delete MT5 Account</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to delete MT5 account <span className="text-foreground font-mono">{selectedAccount?.mt5_login}</span>?
                    </p>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={submitting}
                            className="bg-red-500 text-white hover:bg-red-600"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MT5AccountsPage;
