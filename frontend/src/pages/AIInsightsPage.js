import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiInsightsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
    Brain, Loader2, Sparkles, Send, Users, Wallet, TrendingUp, TrendingDown,
    AlertTriangle, Shield, RefreshCw, Target, Award, Activity, Zap,
    ChevronRight, ArrowUpRight, ArrowDownRight, Minus, MessageSquare,
    BarChart3, PieChart, Lightbulb, Clock, DollarSign,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    PieChart as RechartsPie, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const TrendIcon = ({ trend }) => {
    if (trend === 'up') return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
};

const RiskBadge = ({ level }) => {
    const styles = {
        low: 'bg-green-500/15 text-green-400 border-green-500/30',
        medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    };
    return <Badge className={`${styles[level] || styles.medium} border`}>{level?.toUpperCase()}</Badge>;
};

const PriorityDot = ({ priority }) => {
    const colors = { high: 'bg-red-500', medium: 'bg-yellow-500', low: 'bg-blue-500' };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[priority] || colors.medium}`} />;
};

// ---- Health Score Ring ----
const HealthRing = ({ score }) => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
    return (
        <div className="relative w-36 h-36 mx-auto" data-testid="health-score-ring">
            <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                <circle cx="64" cy="64" r={radius} fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground">{score}</span>
                <span className="text-xs text-muted-foreground">Health Score</span>
            </div>
        </div>
    );
};

// ---- Main Page ----
const AIInsightsPage = () => {
    const { user } = useAuth();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Query state
    const [query, setQuery] = useState('');
    const [queryContext, setQueryContext] = useState('general');
    const [queryResult, setQueryResult] = useState(null);
    const [querying, setQuerying] = useState(false);

    const loadDashboard = useCallback(async (force = false) => {
        try {
            if (force) setRefreshing(true); else setLoading(true);
            const resp = force
                ? await aiInsightsAPI.generateReport()
                : await aiInsightsAPI.getDashboard();
            setDashboard(resp.data);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    const handleQuery = async (e) => {
        e?.preventDefault();
        if (!query.trim()) return;
        setQuerying(true);
        try {
            const resp = await aiInsightsAPI.query(query, queryContext);
            setQueryResult(resp.data);
        } catch (err) {
            setQueryResult({ insight: 'Failed to generate insight. Please try again.', is_fallback: true });
        } finally {
            setQuerying(false);
        }
    };

    const presetQueries = [
        { icon: Users, label: 'Churn Analysis', q: 'Which students are most likely to churn and why? What retention actions should we take?', ctx: 'students' },
        { icon: Wallet, label: 'Revenue Forecast', q: 'Project our revenue for next month and quarter based on current trends. What factors could impact this?', ctx: 'funding' },
        { icon: Target, label: 'Mentor Coaching', q: 'Which mentors need coaching and what specific actions would improve their performance?', ctx: 'mentors' },
        { icon: AlertTriangle, label: 'Risk Assessment', q: 'What are the top 5 business risks right now and how should we mitigate them?', ctx: 'general' },
        { icon: DollarSign, label: 'Commission Review', q: 'Analyze our commission structure. Are there optimization opportunities?', ctx: 'mentors' },
        { icon: Activity, label: 'Engagement Trends', q: 'Analyze student engagement patterns. What trends do you see in deposit frequency and amounts?', ctx: 'students' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]" data-testid="ai-insights-loading">
                <div className="text-center space-y-4">
                    <Brain className="w-16 h-16 text-primary mx-auto animate-pulse" />
                    <p className="text-muted-foreground">Analyzing platform data with AI...</p>
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </div>
            </div>
        );
    }

    const d = dashboard || {};
    const rawData = d.raw_data || {};
    const monthlyTrends = rawData?.funding?.monthly_trends || {};
    const chartData = Object.entries(monthlyTrends).map(([month, v]) => ({
        month: month.slice(5), deposits: v.deposits, withdrawals: v.withdrawals,
    }));

    const mentorChartData = (d.mentor_rankings || []).slice(0, 6).map(m => ({
        name: m.name?.split(' ')[0] || '?', score: m.score,
    }));

    const riskPieData = [
        { name: 'Active', value: rawData?.students?.active || 0 },
        { name: 'Inactive', value: rawData?.students?.inactive || 0 },
        { name: 'At Risk', value: rawData?.students?.at_risk_count || 0 },
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-6 animate-fade-in" data-testid="ai-insights-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading text-3xl lg:text-4xl text-foreground flex items-center gap-3">
                        <Brain className="w-10 h-10 text-primary" strokeWidth={1.5} />
                        AI Insights
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        GPT-5.2 powered analytics &middot; {d.generated_at ? `Updated ${new Date(d.generated_at).toLocaleString()}` : ''}
                    </p>
                </div>
                <Button onClick={() => loadDashboard(true)} disabled={refreshing}
                    variant="outline" className="gap-2 border-border" data-testid="refresh-insights-btn">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Regenerating...' : 'Refresh'}
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-muted/50 border border-border">
                    <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <BarChart3 className="w-4 h-4" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="churn" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <AlertTriangle className="w-4 h-4" /> Churn Risk
                    </TabsTrigger>
                    <TabsTrigger value="mentors" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Award className="w-4 h-4" /> Mentors
                    </TabsTrigger>
                    <TabsTrigger value="ask" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <MessageSquare className="w-4 h-4" /> Ask AI
                    </TabsTrigger>
                </TabsList>

                {/* ============ OVERVIEW TAB ============ */}
                <TabsContent value="overview" className="space-y-6 mt-6">
                    {/* Health + Executive Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="bg-card border-border" data-testid="health-score-card">
                            <CardContent className="p-6 text-center">
                                <HealthRing score={d.health_score || 0} />
                                <p className="text-sm text-muted-foreground mt-3">Platform Health</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border lg:col-span-2" data-testid="executive-summary-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-lg text-foreground flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-primary" /> Executive Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-foreground leading-relaxed">{d.executive_summary}</p>
                                {d.is_fallback && <Badge className="mt-2 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">Data-only mode (AI unavailable)</Badge>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-highlights">
                        {(d.kpi_highlights || []).slice(0, 4).map((kpi, i) => (
                            <Card key={i} className="bg-card border-border">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                                        <TrendIcon trend={kpi.trend} />
                                    </div>
                                    <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                                    <p className="text-xs text-muted-foreground mt-1">{kpi.insight}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Monthly Trends */}
                        <Card className="bg-card border-border" data-testid="monthly-trends-chart">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground">Funding Trends</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                                                formatter={v => [`$${v.toLocaleString()}`, '']} />
                                            <Bar dataKey="deposits" fill="#22c55e" radius={[4, 4, 0, 0]} name="Deposits" />
                                            <Bar dataKey="withdrawals" fill="#ef4444" radius={[4, 4, 0, 0]} name="Withdrawals" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <p className="text-muted-foreground text-sm py-8 text-center">No trend data available</p>}
                            </CardContent>
                        </Card>

                        {/* Student Risk Pie */}
                        <Card className="bg-card border-border" data-testid="risk-distribution-chart">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground">Student Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {riskPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <RechartsPie>
                                            <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                                {riskPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                                            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} />
                                        </RechartsPie>
                                    </ResponsiveContainer>
                                ) : <p className="text-muted-foreground text-sm py-8 text-center">No student data</p>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Revenue Projection + Anomalies */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="bg-card border-border" data-testid="revenue-projection-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-primary" /> Revenue Projection
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {d.revenue_projection && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Next Month</span>
                                            <span className="text-lg font-bold text-foreground">${(d.revenue_projection.next_month || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Next Quarter</span>
                                            <span className="text-lg font-bold text-foreground">${(d.revenue_projection.next_quarter || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Confidence</span>
                                            <RiskBadge level={d.revenue_projection.confidence === 'high' ? 'low' : d.revenue_projection.confidence === 'low' ? 'high' : 'medium'} />
                                        </div>
                                        <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">{d.revenue_projection.reasoning}</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border" data-testid="anomalies-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-yellow-500" /> Anomalies & Alerts
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {(d.funding_analysis?.anomalies || []).length > 0 ? (
                                        d.funding_analysis.anomalies.map((a, i) => (
                                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                                                <RiskBadge level={a.severity} />
                                                <span className="text-sm text-foreground">{a.description}</span>
                                            </div>
                                        ))
                                    ) : <p className="text-sm text-muted-foreground">No anomalies detected</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recommendations */}
                    <Card className="bg-card border-border" data-testid="recommendations-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-yellow-500" /> AI Recommendations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(d.recommendations || []).map((rec, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border space-y-1">
                                        <div className="flex items-center gap-2">
                                            <PriorityDot priority={rec.priority} />
                                            <span className="text-sm font-medium text-foreground">{rec.title}</span>
                                            <Badge variant="outline" className="ml-auto text-xs border-border">{rec.category}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                                        <p className="text-xs text-primary flex items-center gap-1"><Zap className="w-3 h-3" /> {rec.impact}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Commission Insights */}
                    {d.commission_insights && (
                        <Card className="bg-card border-border" data-testid="commission-insights-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-green-500" /> Commission Insights
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-foreground mb-3">{d.commission_insights.summary}</p>
                                <div className="space-y-1">
                                    {(d.commission_insights.optimization_tips || []).map((tip, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                            <span className="text-sm text-muted-foreground">{tip}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ============ CHURN RISK TAB ============ */}
                <TabsContent value="churn" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="bg-card border-border" data-testid="churn-summary-card">
                            <CardContent className="p-6 text-center">
                                <AlertTriangle className={`w-12 h-12 mx-auto mb-3 ${d.churn_risk?.risk_level === 'high' || d.churn_risk?.risk_level === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                                <h3 className="font-heading text-lg text-foreground">Churn Risk Level</h3>
                                <div className="mt-2"><RiskBadge level={d.churn_risk?.risk_level || 'medium'} /></div>
                                <p className="text-sm text-muted-foreground mt-3">{d.churn_risk?.summary}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-border lg:col-span-2" data-testid="churn-students-list">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground">At-Risk Students</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {(d.churn_risk?.students || []).length > 0 ? d.churn_risk.students.map((s, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                                                    <Badge variant="outline" className="text-xs border-border">Score: {s.risk_score}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-red-400">${(s.value_at_risk || 0).toLocaleString()}</div>
                                                <p className="text-xs text-muted-foreground">at risk</p>
                                            </div>
                                            <div className="w-24">
                                                <Progress value={s.risk_score} className="h-2" />
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-muted-foreground py-4 text-center">No at-risk students identified</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recommended Actions for Churn */}
                    <Card className="bg-card border-border" data-testid="churn-actions-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary" /> Recommended Retention Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(d.churn_risk?.students || []).filter(s => s.action).map((s, i) => (
                                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/20">
                                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-sm font-medium text-foreground">{s.name}:</span>
                                            <span className="text-sm text-muted-foreground ml-1">{s.action}</span>
                                        </div>
                                    </div>
                                ))}
                                {!(d.churn_risk?.students || []).some(s => s.action) && (
                                    <p className="text-sm text-muted-foreground text-center py-4">No specific actions needed at this time</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============ MENTORS TAB ============ */}
                <TabsContent value="mentors" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Mentor Radar Chart */}
                        <Card className="bg-card border-border" data-testid="mentor-radar-chart">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground">Mentor Performance Scores</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {mentorChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <RadarChart data={mentorChartData}>
                                            <PolarGrid stroke="hsl(var(--border))" />
                                            <PolarAngleAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                                            <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                ) : <p className="text-muted-foreground text-sm py-8 text-center">No mentor data</p>}
                            </CardContent>
                        </Card>

                        {/* Mentor Rankings */}
                        <Card className="bg-card border-border" data-testid="mentor-rankings-list">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                    <Award className="w-4 h-4 text-yellow-500" /> Rankings & Insights
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {(d.mentor_rankings || []).map((m, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-sm font-medium text-foreground">{m.name}</span>
                                                </div>
                                                <Badge variant="outline" className="border-border text-xs">{m.score}/100</Badge>
                                            </div>
                                            <div className="ml-8 space-y-1">
                                                <p className="text-xs text-green-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {m.strengths}</p>
                                                <p className="text-xs text-yellow-400 flex items-center gap-1"><Target className="w-3 h-3" /> {m.improvement}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Mentors Needing Attention */}
                    {rawData?.mentors?.needs_attention?.length > 0 && (
                        <Card className="bg-card border-border border-l-4 border-l-yellow-500" data-testid="mentors-attention-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-yellow-500" /> Mentors Needing Attention
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-3">These mentors have students but zero deposits in the last 30 days:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {rawData.mentors.needs_attention.map((m, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                                            <span className="text-sm text-foreground">{m.name}</span>
                                            <span className="text-xs text-muted-foreground">{m.students} students, $0 (30d)</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ============ ASK AI TAB ============ */}
                <TabsContent value="ask" className="space-y-6 mt-6">
                    {/* Preset Queries */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="preset-queries">
                        {presetQueries.map((pq, i) => {
                            const Icon = pq.icon;
                            return (
                                <Card key={i} className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
                                    onClick={() => { setQuery(pq.q); setQueryContext(pq.ctx); }}>
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                                            <Icon className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="text-sm font-medium text-foreground">{pq.label}</span>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Query Form */}
                    <Card className="bg-card border-border" data-testid="ask-ai-form">
                        <CardContent className="p-6">
                            <form onSubmit={handleQuery} className="space-y-4">
                                <Textarea value={query} onChange={e => setQuery(e.target.value)}
                                    placeholder="Ask anything about your platform data..."
                                    className="bg-background border-border text-foreground rounded-lg min-h-20 resize-none"
                                    data-testid="ai-query-input" />
                                <div className="flex items-center gap-3">
                                    <Select value={queryContext} onValueChange={setQueryContext}>
                                        <SelectTrigger className="w-48 bg-background border-border text-foreground rounded-lg">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border">
                                            <SelectItem value="general">All Data</SelectItem>
                                            <SelectItem value="students">Students</SelectItem>
                                            <SelectItem value="funding">Funding</SelectItem>
                                            <SelectItem value="mentors">Mentors</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit" disabled={querying || !query.trim()}
                                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2 px-6"
                                        data-testid="generate-insight-btn">
                                        {querying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Ask AI</>}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Query Result */}
                    {queryResult && (
                        <Card className="bg-card border-border border-l-4 border-l-primary" data-testid="ai-query-result">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="font-heading text-base text-foreground flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-primary" /> AI Response
                                    </CardTitle>
                                    {queryResult.generated_at && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {new Date(queryResult.generated_at).toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">{queryResult.insight}</div>
                                {queryResult.is_fallback && <Badge className="mt-3 bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">Fallback mode</Badge>}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AIInsightsPage;
