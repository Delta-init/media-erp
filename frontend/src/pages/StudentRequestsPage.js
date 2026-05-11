import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { studentRequestsAPI, studentsAPI, usersAPI } from '../services/api';
import { Card, CardContent } from '../components/ui/card';
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
    ArrowRightLeft,
    TrendingUp,
    Plus,
    Loader2,
    Check,
    X,
    Clock,
    Search,
    UserPlus,
    AlertCircle,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const StudentRequestsPage = () => {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState([]);
    const [students, setStudents] = useState([]);
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [claimDialogOpen, setClaimDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Search state for claim dialog
    const [searchEmail, setSearchEmail] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [claimReason, setClaimReason] = useState('');

    const [formData, setFormData] = useState({
        student_id: '',
        request_type: 'TRANSFER',
        new_mentor_id: '',
        new_level: '',
        reason: '',
    });

    const isAdmin = hasRole(['super_admin', 'broker_admin', 'academic_head']);
    const isMentor = hasRole(['junior_mentor', 'senior_mentor']);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const params = {};
            if (activeTab !== 'all') {
                params.status = activeTab.toUpperCase();
            }
            const response = await studentRequestsAPI.getAll(params);
            setRequests(response.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch requests',
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

    const fetchMentors = async () => {
        try {
            const response = await usersAPI.getMentors();
            setMentors(response.data);
        } catch (error) {
            console.error('Failed to fetch mentors:', error);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchStudents();
        fetchMentors();
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [activeTab]);

    const handleSearchStudent = async () => {
        if (!searchEmail.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter an email to search',
                variant: 'destructive',
            });
            return;
        }

        setSearching(true);
        setSelectedStudent(null);
        try {
            const response = await studentsAPI.search({ email: searchEmail });
            setSearchResults(response.data);
            if (response.data.length === 0) {
                toast({
                    title: 'No Results',
                    description: 'No student found with this email',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Search failed',
                variant: 'destructive',
            });
        } finally {
            setSearching(false);
        }
    };

    const handleClaimSubmit = async () => {
        if (!selectedStudent) {
            toast({
                title: 'Error',
                description: 'Please select a student',
                variant: 'destructive',
            });
            return;
        }

        if (!claimReason.trim()) {
            toast({
                title: 'Error',
                description: 'Please provide a reason for the transfer request',
                variant: 'destructive',
            });
            return;
        }

        setSubmitting(true);
        try {
            await studentRequestsAPI.create({
                student_id: selectedStudent.id,
                request_type: 'TRANSFER',
                new_mentor_id: user.id,
                reason: claimReason,
            });
            toast({
                title: 'Success',
                description: 'Transfer request submitted for approval',
            });
            setClaimDialogOpen(false);
            resetClaimForm();
            fetchRequests();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to submit request',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const resetClaimForm = () => {
        setSearchEmail('');
        setSearchResults([]);
        setSelectedStudent(null);
        setClaimReason('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const data = {
                student_id: formData.student_id,
                request_type: formData.request_type,
                reason: formData.reason,
            };

            if (formData.request_type === 'TRANSFER') {
                data.new_mentor_id = formData.new_mentor_id;
            } else {
                data.new_level = formData.new_level;
            }

            await studentRequestsAPI.create(data);
            toast({
                title: 'Success',
                description: 'Request submitted successfully',
            });
            setDialogOpen(false);
            resetForm();
            fetchRequests();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to submit request',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (requestId) => {
        try {
            await studentRequestsAPI.approve(requestId);
            toast({
                title: 'Success',
                description: 'Request approved successfully',
            });
            fetchRequests();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to approve request',
                variant: 'destructive',
            });
        }
    };

    const handleRejectClick = (request) => {
        setSelectedRequest(request);
        setRejectionReason('');
        setRejectDialogOpen(true);
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        
        try {
            await studentRequestsAPI.reject(selectedRequest.id, rejectionReason);
            toast({
                title: 'Success',
                description: 'Request rejected',
            });
            setRejectDialogOpen(false);
            setSelectedRequest(null);
            fetchRequests();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to reject request',
                variant: 'destructive',
            });
        }
    };

    const resetForm = () => {
        setFormData({
            student_id: '',
            request_type: 'TRANSFER',
            new_mentor_id: '',
            new_level: '',
            reason: '',
        });
    };

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
            APPROVED: 'bg-green-500/10 text-green-500 border-green-500/30',
            REJECTED: 'bg-red-500/10 text-red-500 border-red-500/30',
        };
        return (
            <Badge variant="outline" className={styles[status] || ''}>
                {status}
            </Badge>
        );
    };

    const getTypeBadge = (type) => {
        if (type === 'TRANSFER') {
            return (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Transfer
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                <TrendingUp className="h-3 w-3 mr-1" />
                Level Upgrade
            </Badge>
        );
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const pendingCount = requests.filter(r => r.status === 'PENDING').length;

    return (
        <div className="space-y-6" data-testid="student-requests-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl text-foreground">Student Requests</h1>
                    <p className="text-muted-foreground mt-1">
                        Transfer and level upgrade requests
                    </p>
                </div>
                <div className="flex gap-2">
                    {isMentor && (
                        <Button
                            onClick={() => setClaimDialogOpen(true)}
                            className="bg-accent-info text-white hover:bg-accent-info/90 rounded-lg"
                            data-testid="claim-student-btn"
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Request Student
                        </Button>
                    )}
                    <Button
                        onClick={() => setDialogOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                        data-testid="new-request-btn"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Request
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-accent-warning/10">
                                <Clock className="h-5 w-5 text-accent-warning" />
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Pending</p>
                                <p className="text-xl font-bold text-foreground">{pendingCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-accent-info/10">
                                <ArrowRightLeft className="h-5 w-5 text-accent-info" />
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Transfers</p>
                                <p className="text-xl font-bold text-foreground">
                                    {requests.filter(r => r.request_type === 'TRANSFER').length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-purple-500/10">
                                <TrendingUp className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Upgrades</p>
                                <p className="text-xl font-bold text-foreground">
                                    {requests.filter(r => r.request_type === 'LEVEL_UPGRADE').length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                    >
                        Pending {pendingCount > 0 && `(${pendingCount})`}
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
                    ) : requests.length === 0 ? (
                        <div className="text-center py-20">
                            <ArrowRightLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No requests found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="data-table">
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Type</TableHead>
                                        <TableHead className="text-muted-foreground">Student</TableHead>
                                        <TableHead className="text-muted-foreground">Current Mentor</TableHead>
                                        <TableHead className="text-muted-foreground">New Mentor/Level</TableHead>
                                        <TableHead className="text-muted-foreground">Requested By</TableHead>
                                        <TableHead className="text-muted-foreground">Date</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        {isAdmin && (
                                            <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requests.map((request) => (
                                        <TableRow key={request.id} className="border-border">
                                            <TableCell>{getTypeBadge(request.request_type)}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground">{request.student_name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{request.student_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {request.current_mentor_name || '-'}
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {request.request_type === 'TRANSFER' 
                                                    ? request.new_mentor_name 
                                                    : request.new_level?.replace('_', ' ')}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {request.requested_by_name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(request.created_date)}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                                            {isAdmin && (
                                                <TableCell className="text-right">
                                                    {request.status === 'PENDING' && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleApprove(request.id)}
                                                                className="border-green-500/30 text-green-500 hover:bg-green-500/10"
                                                                data-testid={`approve-btn-${request.id}`}
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleRejectClick(request)}
                                                                className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                                                                data-testid={`reject-btn-${request.id}`}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
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

            {/* Request Student (Claim) Dialog - For Mentors */}
            <Dialog open={claimDialogOpen} onOpenChange={(open) => {
                setClaimDialogOpen(open);
                if (!open) resetClaimForm();
            }}>
                <DialogContent className="bg-card border-border max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Request Student Transfer</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Search for a student by email and request to have them transferred to you
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Search Section */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Search by Email</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    value={searchEmail}
                                    onChange={(e) => setSearchEmail(e.target.value)}
                                    placeholder="Enter student email..."
                                    className="bg-background border-border text-foreground rounded-lg"
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearchStudent()}
                                    data-testid="search-student-email"
                                />
                                <Button
                                    type="button"
                                    onClick={handleSearchStudent}
                                    disabled={searching}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                                    data-testid="search-student-btn"
                                >
                                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Search Results</Label>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {searchResults.map((student) => (
                                        <div
                                            key={student.id}
                                            onClick={() => setSelectedStudent(student)}
                                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                                selectedStudent?.id === student.id
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border hover:border-foreground-subtle'
                                            }`}
                                            data-testid={`search-result-${student.id}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-foreground font-medium">{student.full_name}</p>
                                                    <p className="text-muted-foreground text-sm">{student.email}</p>
                                                    <p className="text-muted-foreground text-xs font-mono">{student.student_code}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-muted-foreground text-xs">Current Mentor:</p>
                                                    <p className="text-foreground text-sm">{student.primary_mentor_name || 'Unassigned'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Selected Student Info */}
                        {selectedStudent && (
                            <div className="p-3 bg-background rounded-lg border border-primary/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <Check className="h-4 w-4 text-primary" />
                                    <span className="text-muted-foreground text-sm">Selected Student:</span>
                                </div>
                                <p className="text-foreground font-medium">{selectedStudent.full_name}</p>
                                <p className="text-muted-foreground text-sm">{selectedStudent.email}</p>
                                {selectedStudent.primary_mentor_name && selectedStudent.primary_mentor_id !== user.id && (
                                    <div className="mt-2 p-2 bg-accent-warning/10 rounded-lg flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-accent-warning mt-0.5" />
                                        <p className="text-accent-warning text-sm">
                                            This student is currently assigned to <strong>{selectedStudent.primary_mentor_name}</strong>. 
                                            Your request will need approval from the Academic Head.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Reason */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Reason for Transfer Request</Label>
                            <Textarea
                                value={claimReason}
                                onChange={(e) => setClaimReason(e.target.value)}
                                placeholder="Explain why you want this student transferred to you..."
                                className="bg-background border-border text-foreground rounded-lg min-h-[80px]"
                                data-testid="claim-reason-input"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setClaimDialogOpen(false);
                                resetClaimForm();
                            }}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleClaimSubmit}
                            disabled={submitting || !selectedStudent || !claimReason.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                            data-testid="submit-claim-btn"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Request Dialog (Original) */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">New Request</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Submit a transfer or level upgrade request for your students
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Student</Label>
                            <Select
                                value={formData.student_id}
                                onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                    <SelectValue placeholder="Select student" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {students.map((student) => (
                                        <SelectItem key={student.id} value={student.id} className="text-foreground">
                                            {student.full_name} ({student.student_code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Request Type</Label>
                            <Select
                                value={formData.request_type}
                                onValueChange={(value) => setFormData({ ...formData, request_type: value, new_mentor_id: '', new_level: '' })}
                            >
                                <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    <SelectItem value="TRANSFER" className="text-foreground">Transfer to Another Mentor</SelectItem>
                                    <SelectItem value="LEVEL_UPGRADE" className="text-foreground">Level Upgrade</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.request_type === 'TRANSFER' && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">New Mentor</Label>
                                <Select
                                    value={formData.new_mentor_id}
                                    onValueChange={(value) => setFormData({ ...formData, new_mentor_id: value })}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                        <SelectValue placeholder="Select new mentor" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {mentors.map((mentor) => (
                                            <SelectItem key={mentor.id} value={mentor.id} className="text-foreground">
                                                {mentor.full_name} ({mentor.role.replace('_', ' ')})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {formData.request_type === 'LEVEL_UPGRADE' && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">New Level</Label>
                                <Select
                                    value={formData.new_level}
                                    onValueChange={(value) => setFormData({ ...formData, new_level: value })}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                        <SelectValue placeholder="Select new level" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        <SelectItem value="LEVEL_1" className="text-foreground">Level 1</SelectItem>
                                        <SelectItem value="LEVEL_2" className="text-foreground">Level 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Reason</Label>
                            <Textarea
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                placeholder="Explain why this request is needed..."
                                className="bg-background border-border text-foreground rounded-lg min-h-[80px]"
                                required
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
                                disabled={submitting}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                                data-testid="submit-request-btn"
                            >
                                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Submit Request
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Reject Request</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Please provide a reason for rejecting this request
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="bg-background border-border text-foreground rounded-lg min-h-[80px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setRejectDialogOpen(false);
                                setSelectedRequest(null);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleReject}
                            className="bg-accent-error text-white hover:bg-accent-error/90 rounded-lg"
                        >
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StudentRequestsPage;
