import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ticketsAPI, usersAPI, studentsAPI } from '../services/api';
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
} from '../components/ui/sheet';
import {
    Loader2,
    Plus,
    Ticket,
    MessageSquare,
    Clock,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    User,
    Send,
    RefreshCw,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORIES = ['TECHNICAL', 'BILLING', 'ACCOUNT', 'FEATURE_REQUEST', 'BUG_REPORT', 'OTHER'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED'];

const TicketsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [tickets, setTickets] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [detailSheetOpen, setDetailSheetOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [students, setStudents] = useState([]);
    const [admins, setAdmins] = useState([]);

    const [formData, setFormData] = useState({
        subject: '',
        description: '',
        category: 'OTHER',
        priority: 'MEDIUM',
        related_student_id: '',
    });

    const isSupport = hasRole(['super_admin', 'admin', 'broker_admin']);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (activeTab !== 'all') {
                if (activeTab === 'open') {
                    params.status = 'OPEN';
                } else if (activeTab === 'in_progress') {
                    params.status = 'IN_PROGRESS';
                } else if (activeTab === 'resolved') {
                    params.status = 'RESOLVED';
                }
            }
            
            const ticketsRes = await ticketsAPI.getAll(params);
            setTickets(ticketsRes.data);

            if (isSupport) {
                try {
                    const summaryRes = await ticketsAPI.getSummary();
                    setSummary(summaryRes.data);
                } catch (e) {}
            }

            // Fetch students for ticket creation
            const studentsRes = await studentsAPI.getAll({});
            setStudents(studentsRes.data);

            // Fetch admins for assignment
            if (isSupport) {
                const usersRes = await usersAPI.getAll();
                setAdmins(usersRes.data.filter(u => 
                    ['super_admin', 'admin', 'broker_admin'].includes(u.role)
                ));
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch tickets',
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
        if (!formData.subject || !formData.description) {
            toast({ title: 'Error', description: 'Subject and description are required', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        try {
            const data = { ...formData };
            if (!data.related_student_id) delete data.related_student_id;
            
            await ticketsAPI.create(data);
            toast({ title: 'Success', description: 'Ticket created successfully' });
            setCreateDialogOpen(false);
            setFormData({
                subject: '',
                description: '',
                category: 'OTHER',
                priority: 'MEDIUM',
                related_student_id: '',
            });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to create ticket',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const openTicketDetail = async (ticket) => {
        setSelectedTicket(ticket);
        setDetailSheetOpen(true);
        try {
            const messagesRes = await ticketsAPI.getMessages(ticket.id);
            setMessages(messagesRes.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load messages',
                variant: 'destructive',
            });
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedTicket) return;
        setSubmitting(true);
        try {
            await ticketsAPI.addMessage(selectedTicket.id, newMessage);
            setNewMessage('');
            const messagesRes = await ticketsAPI.getMessages(selectedTicket.id);
            setMessages(messagesRes.data);
            fetchData(); // Refresh ticket list
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to send message',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (status) => {
        if (!selectedTicket) return;
        try {
            await ticketsAPI.updateStatus(selectedTicket.id, status);
            toast({ title: 'Success', description: `Status updated to ${status}` });
            setSelectedTicket({ ...selectedTicket, status });
            fetchData();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update status',
                variant: 'destructive',
            });
        }
    };

    const handleAssign = async (assigneeId) => {
        if (!selectedTicket) return;
        try {
            await ticketsAPI.assign(selectedTicket.id, assigneeId || null);
            toast({ title: 'Success', description: 'Ticket assigned' });
            fetchData();
            // Refresh selected ticket
            const ticketRes = await ticketsAPI.getOne(selectedTicket.id);
            setSelectedTicket(ticketRes.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to assign ticket',
                variant: 'destructive',
            });
        }
    };

    const getPriorityBadge = (priority) => {
        const styles = {
            LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
            MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
            URGENT: 'bg-red-500/10 text-red-400 border-red-500/30',
        };
        const icons = {
            LOW: Clock,
            MEDIUM: AlertCircle,
            HIGH: AlertTriangle,
            URGENT: AlertTriangle,
        };
        const Icon = icons[priority] || Clock;
        return (
            <Badge variant="outline" className={`${styles[priority] || ''} gap-1`}>
                <Icon className="w-3 h-3" />
                {priority}
            </Badge>
        );
    };

    const getStatusBadge = (status) => {
        const styles = {
            OPEN: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            PENDING_USER: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
            RESOLVED: 'bg-green-500/10 text-green-400 border-green-500/30',
            CLOSED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        };
        return (
            <Badge variant="outline" className={styles[status] || ''}>
                {status?.replace('_', ' ')}
            </Badge>
        );
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const openCount = tickets.filter(t => ['OPEN', 'IN_PROGRESS', 'PENDING_USER'].includes(t.status)).length;

    return (
        <div className="space-y-6 animate-fade-in" data-testid="tickets-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Support Tickets</h1>
                    <p className="text-muted-foreground mt-1">
                        {isSupport ? 'Manage support requests' : 'Get help from the support team'}
                    </p>
                </div>
                <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                    data-testid="create-ticket-btn"
                >
                    <Plus className="w-4 h-4" />
                    New Ticket
                </Button>
            </div>

            {/* Summary Stats (Support only) */}
            {summary && isSupport && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Ticket className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.total_tickets}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Total</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.open_tickets}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Open</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-heading text-foreground">{summary.by_priority?.HIGH || 0}</p>
                                    <p className="text-xs text-muted-foreground uppercase">High Priority</p>
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
                                    <p className="text-2xl font-heading text-foreground">{summary.by_priority?.URGENT || 0}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Urgent</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs & Table */}
            <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-background">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="open">Open</TabsTrigger>
                            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                            <TabsTrigger value="resolved">Resolved</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="p-0 pt-2">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-20">
                            <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No tickets found</p>
                            <p className="text-muted-foreground text-sm mt-1">
                                Create a new ticket to get help
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Ticket</TableHead>
                                        <TableHead className="text-muted-foreground">Subject</TableHead>
                                        <TableHead className="text-muted-foreground">Category</TableHead>
                                        <TableHead className="text-muted-foreground">Priority</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        {isSupport && <TableHead className="text-muted-foreground">Assigned</TableHead>}
                                        <TableHead className="text-muted-foreground">Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tickets.map((ticket) => (
                                        <TableRow
                                            key={ticket.id}
                                            className="border-border cursor-pointer hover:bg-background/50"
                                            onClick={() => openTicketDetail(ticket)}
                                        >
                                            <TableCell>
                                                <p className="font-mono text-foreground text-sm">{ticket.ticket_number}</p>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-foreground truncate max-w-[200px]">
                                                        {ticket.subject}
                                                    </p>
                                                    {ticket.messages_count > 0 && (
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <MessageSquare className="w-3 h-3" />
                                                            {ticket.messages_count} message{ticket.messages_count !== 1 ? 's' : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {ticket.category.replace('_', ' ')}
                                            </TableCell>
                                            <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                                            <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                            {isSupport && (
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {ticket.assigned_to_name || '-'}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(ticket.created_date)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Ticket Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="bg-card border-border max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">New Support Ticket</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Describe your issue and we'll help you resolve it
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Subject *</Label>
                            <Input
                                value={formData.subject}
                                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                placeholder="Brief description of your issue"
                                className="bg-background border-border text-foreground"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v) => setFormData({...formData, category: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {CATEGORIES.map(c => (
                                            <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Priority</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v) => setFormData({...formData, priority: v})}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {PRIORITIES.map(p => (
                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Related Student (Optional)</Label>
                            <Select
                                value={formData.related_student_id || "none"}
                                onValueChange={(v) => setFormData({...formData, related_student_id: v === "none" ? "" : v})}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground">
                                    <SelectValue placeholder="Select student if relevant" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="none">None</SelectItem>
                                    {students.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.student_code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Description *</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="Please provide details about your issue..."
                                className="bg-background border-border text-foreground min-h-[120px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} className="text-muted-foreground">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={submitting || !formData.subject || !formData.description}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid="submit-ticket-btn"
                        >
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Ticket
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ticket Detail Sheet */}
            <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
                <SheetContent className="bg-card border-border w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="font-heading text-xl text-foreground">
                            {selectedTicket?.ticket_number}
                        </SheetTitle>
                    </SheetHeader>

                    {selectedTicket && (
                        <div className="mt-6 space-y-6">
                            {/* Ticket Info */}
                            <div className="space-y-3">
                                <h3 className="font-medium text-foreground">{selectedTicket.subject}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {getPriorityBadge(selectedTicket.priority)}
                                    {getStatusBadge(selectedTicket.status)}
                                    <Badge variant="outline" className="text-muted-foreground border-border">
                                        {selectedTicket.category.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                                    {selectedTicket.description}
                                </p>
                                <div className="text-xs text-muted-foreground">
                                    Created by {selectedTicket.created_by_name} • {formatDate(selectedTicket.created_date)}
                                </div>
                            </div>

                            {/* Admin Controls */}
                            {isSupport && (
                                <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase">Status</Label>
                                        <Select
                                            value={selectedTicket.status}
                                            onValueChange={handleStatusChange}
                                        >
                                            <SelectTrigger className="bg-card border-border">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border">
                                                {STATUSES.map(s => (
                                                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase">Assign To</Label>
                                        <Select
                                            value={selectedTicket.assigned_to_id || 'unassigned'}
                                            onValueChange={(v) => handleAssign(v === 'unassigned' ? null : v)}
                                        >
                                            <SelectTrigger className="bg-card border-border">
                                                <SelectValue placeholder="Unassigned" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                                {admins.map(a => (
                                                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {/* Messages */}
                            <div className="space-y-3">
                                <h4 className="font-medium text-foreground">Messages</h4>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                    {messages.length === 0 ? (
                                        <p className="text-muted-foreground text-sm text-center py-4">No messages yet</p>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`p-3 rounded-lg ${
                                                    msg.is_staff
                                                        ? 'bg-primary/10 ml-4'
                                                        : 'bg-background mr-4'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-medium text-foreground">
                                                        {msg.sender_name}
                                                    </span>
                                                    {msg.is_staff && (
                                                        <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
                                                            Staff
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                                                    {msg.message}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDate(msg.created_date)}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Reply Input */}
                            {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                                <div className="flex gap-2">
                                    <Textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type your message..."
                                        className="bg-background border-border text-foreground min-h-[60px]"
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={submitting || !newMessage.trim()}
                                        className="bg-primary text-primary-foreground hover:bg-primary/90 self-end"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
};

export default TicketsPage;
