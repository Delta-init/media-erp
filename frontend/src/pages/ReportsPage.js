import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
    Loader2,
    FileText,
    RefreshCw,
    Send,
    Users,
    DollarSign,
    Clock,
    AlertTriangle,
    TrendingUp,
    Calendar,
    Mail,
    CheckCircle,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const ReportsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const canView = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'finance_admin']);
    const canSend = hasRole(['super_admin', 'academic_head']);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            const response = await reportsAPI.getDailySummary();
            setSummary(response.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch report data',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canView) {
            fetchSummary();
        }
    }, []);

    const handleSendReport = async () => {
        setSending(true);
        try {
            const response = await reportsAPI.sendDailySummary();
            toast({
                title: 'Report Sent!',
                description: `Daily summary sent to ${response.data.sent_to} department heads`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to send report',
                variant: 'destructive',
            });
        } finally {
            setSending(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="reports-page">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="font-heading text-2xl text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to view reports.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in" data-testid="reports-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Reports Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Daily summary and automated reports
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={fetchSummary}
                        variant="outline"
                        className="border-border gap-2"
                        data-testid="refresh-btn"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                    {canSend && (
                        <Button
                            onClick={handleSendReport}
                            disabled={sending || loading}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                            data-testid="send-report-btn"
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Send Daily Report
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : summary && (
                <>
                    {/* Report Date */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="text-foreground font-medium">Report Date</p>
                                    <p className="text-muted-foreground">{formatDate(summary.report_date)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Today's Activity */}
                    <div>
                        <h2 className="font-heading text-xl text-foreground mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            Today's Activity
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="bg-card border-border">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-muted-foreground text-sm uppercase">New Students</p>
                                            <p className="text-4xl font-heading text-foreground mt-2">{summary.today.new_students}</p>
                                        </div>
                                        <div className="w-14 h-14 rounded-lg bg-green-500/10 flex items-center justify-center">
                                            <Users className="w-7 h-7 text-green-500" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-muted-foreground text-sm uppercase">Funding Approved</p>
                                            <p className="text-4xl font-heading text-primary mt-2">
                                                ${summary.today.funding_approved_amount.toLocaleString()}
                                            </p>
                                            <p className="text-sm text-muted-foreground">{summary.today.funding_approved_count} transactions</p>
                                        </div>
                                        <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <DollarSign className="w-7 h-7 text-primary" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Pending Actions */}
                    <div>
                        <h2 className="font-heading text-xl text-foreground mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Pending Actions
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Card className="bg-card border-border">
                                <CardContent className="p-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-heading text-orange-400">{summary.pending.funding_requests}</p>
                                        <p className="text-xs text-muted-foreground uppercase mt-1">Funding Requests</p>
                                        <p className="text-sm text-muted-foreground mt-1">${summary.pending.funding_amount.toLocaleString()}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border">
                                <CardContent className="p-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-heading text-blue-400">{summary.pending.commission_approvals}</p>
                                        <p className="text-xs text-muted-foreground uppercase mt-1">Commission Approvals</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border">
                                <CardContent className="p-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-heading text-red-400">{summary.pending.retention_cases}</p>
                                        <p className="text-xs text-muted-foreground uppercase mt-1">Retention Cases</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border">
                                <CardContent className="p-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-heading text-purple-400">{summary.pending.support_tickets}</p>
                                        <p className="text-xs text-muted-foreground uppercase mt-1">Open Tickets</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Week to Date */}
                    <div>
                        <h2 className="font-heading text-xl text-foreground mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-cyan-500" />
                            Week to Date (7 days)
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="bg-card border-border border-l-4 border-l-cyan-500">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-muted-foreground text-sm">New Students (7 days)</p>
                                            <p className="text-3xl font-heading text-foreground mt-1">{summary.week_to_date.new_students}</p>
                                        </div>
                                        <Users className="w-8 h-8 text-cyan-500" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border border-l-4 border-l-primary">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-muted-foreground text-sm">Funding Approved (7 days)</p>
                                            <p className="text-3xl font-heading text-primary mt-1">
                                                ${summary.week_to_date.funding_approved_amount.toLocaleString()}
                                            </p>
                                        </div>
                                        <DollarSign className="w-8 h-8 text-primary" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Email Recipients Info */}
                    {canSend && (
                        <Card className="bg-card border-border">
                            <CardHeader>
                                <CardTitle className="font-heading text-lg flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-primary" />
                                    Daily Report Recipients
                                </CardTitle>
                                <CardDescription>
                                    The daily summary report will be sent to these department heads
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    <Badge className="bg-red-500/20 text-red-400">Super Admin</Badge>
                                    <Badge className="bg-amber-500/20 text-amber-400">Broker Admin</Badge>
                                    <Badge className="bg-purple-500/20 text-purple-400">Academic Head</Badge>
                                    <Badge className="bg-yellow-500/20 text-yellow-400">Finance Admin</Badge>
                                </div>
                                <p className="text-muted-foreground text-sm mt-3">
                                    Note: Emails are currently <strong className="text-orange-400">MOCKED</strong> and logged to the system for testing purposes.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
};

export default ReportsPage;
