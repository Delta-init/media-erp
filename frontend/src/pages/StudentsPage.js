import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { studentsAPI, usersAPI, studentRequestsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Search,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Filter,
    X,
    Users,
    UserPlus,
    Upload,
    Download,
    UserMinus,
    ArrowRightLeft,
    AlertCircle,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const StudentsPage = () => {
    const { user, canManageStudents, hasRole } = useAuth();
    const { toast } = useToast();
    const [students, setStudents] = useState([]);
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
    const [studentToRelease, setStudentToRelease] = useState(null);
    
    // Request Student Transfer state
    const [requestStudentDialogOpen, setRequestStudentDialogOpen] = useState(false);
    const [searchingStudent, setSearchingStudent] = useState(false);
    const [foundStudent, setFoundStudent] = useState(null);
    const [studentSearchEmail, setStudentSearchEmail] = useState('');
    const [transferReason, setTransferReason] = useState('');
    const [submittingRequest, setSubmittingRequest] = useState(false);
    const [showRequestSuggestion, setShowRequestSuggestion] = useState(false);
    const [suggestionEmail, setSuggestionEmail] = useState('');

    // Check if user is admin (can assign mentors and levels)
    const isAdmin = hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']);
    // Check if user is a mentor
    const isMentor = hasRole(['junior_mentor', 'senior_mentor', 'subjunior_mentor']);

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        country: '',
        primary_mentor_id: '',
        senior_mentor_id: '',
        status: 'ACTIVE',
        student_level: 'LEVEL_1',
        notes: '',
    });

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const params = {};
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            
            const response = await studentsAPI.getAll(params);
            setStudents(response.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch students',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
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
        fetchStudents();
        fetchMentors();
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchStudents();
        }, 300);
        return () => clearTimeout(debounce);
    }, [search, statusFilter]);

    const handleOpenDialog = (student = null) => {
        if (student) {
            setEditingStudent(student);
            setFormData({
                full_name: student.full_name,
                email: student.email,
                phone: student.phone,
                country: student.country,
                primary_mentor_id: student.primary_mentor_id || '',
                senior_mentor_id: student.senior_mentor_id || '',
                status: student.status,
                student_level: student.student_level,
                notes: student.notes || '',
            });
        } else {
            setEditingStudent(null);
            setFormData({
                full_name: '',
                email: '',
                phone: '',
                country: '',
                primary_mentor_id: '',
                senior_mentor_id: '',
                status: 'ACTIVE',
                student_level: 'LEVEL_1',
                notes: '',
            });
        }
        setDialogOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const data = {
                ...formData,
                primary_mentor_id: formData.primary_mentor_id || null,
                senior_mentor_id: formData.senior_mentor_id || null,
            };

            if (editingStudent) {
                await studentsAPI.update(editingStudent.id, data);
                toast({
                    title: 'Success',
                    description: 'Student updated successfully',
                });
            } else {
                await studentsAPI.create(data);
                toast({
                    title: 'Success',
                    description: 'Student created successfully',
                });
            }
            setDialogOpen(false);
            fetchStudents();
        } catch (error) {
            const errorMessage = error.response?.data?.detail || 'Operation failed';
            
            // Check if error is about student already existing
            if (errorMessage.toLowerCase().includes('email already exists') || 
                errorMessage.toLowerCase().includes('already registered')) {
                // Show suggestion to request transfer
                setSuggestionEmail(formData.email);
                setShowRequestSuggestion(true);
                setDialogOpen(false);
            }
            
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!studentToDelete) return;
        
        try {
            await studentsAPI.delete(studentToDelete.id);
            toast({
                title: 'Success',
                description: 'Student deleted successfully',
            });
            setDeleteDialogOpen(false);
            setStudentToDelete(null);
            fetchStudents();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to delete student',
                variant: 'destructive',
            });
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        
        setImporting(true);
        setImportResult(null);
        
        try {
            const response = await studentsAPI.importCSV(importFile);
            setImportResult(response.data);
            if (response.data.successful > 0) {
                toast({
                    title: 'Import Complete',
                    description: `Successfully imported ${response.data.successful} students`,
                });
                fetchStudents();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to import students',
                variant: 'destructive',
            });
        } finally {
            setImporting(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await studentsAPI.getCSVTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'students_template.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to download template',
                variant: 'destructive',
            });
        }
    };

    const handleRelease = async () => {
        if (!studentToRelease) return;
        
        try {
            await studentsAPI.release(studentToRelease.id);
            toast({
                title: 'Success',
                description: 'Student released to open pool',
            });
            setReleaseDialogOpen(false);
            setStudentToRelease(null);
            fetchStudents();
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to release student',
                variant: 'destructive',
            });
        }
    };
    
    // Search for student by email (for transfer request)
    const handleSearchStudent = async () => {
        if (!studentSearchEmail) return;
        
        setSearchingStudent(true);
        setFoundStudent(null);
        
        try {
            const response = await studentsAPI.search({ email: studentSearchEmail });
            if (response.data && response.data.length > 0) {
                setFoundStudent(response.data[0]);
            } else {
                toast({
                    title: 'Not Found',
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
            setSearchingStudent(false);
        }
    };
    
    // Submit transfer request
    const handleSubmitTransferRequest = async () => {
        if (!foundStudent || !transferReason) return;
        
        setSubmittingRequest(true);
        
        try {
            await studentRequestsAPI.create({
                student_id: foundStudent.id,
                request_type: 'TRANSFER',
                reason: transferReason,
                new_mentor_id: user.id,  // The mentor requesting the transfer
            });
            
            toast({
                title: 'Request Submitted!',
                description: 'Your transfer request has been sent for approval',
            });
            
            // Reset dialog state
            setRequestStudentDialogOpen(false);
            setFoundStudent(null);
            setStudentSearchEmail('');
            setTransferReason('');
        } catch (error) {
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to submit request',
                variant: 'destructive',
            });
        } finally {
            setSubmittingRequest(false);
        }
    };
    
    // Open request dialog with pre-filled email (from suggestion)
    const openRequestDialogWithEmail = (email) => {
        setStudentSearchEmail(email);
        setShowRequestSuggestion(false);
        setRequestStudentDialogOpen(true);
        // Auto-search after opening
        setTimeout(() => {
            handleSearchStudentWithEmail(email);
        }, 100);
    };
    
    const handleSearchStudentWithEmail = async (email) => {
        if (!email) return;
        
        setSearchingStudent(true);
        setFoundStudent(null);
        
        try {
            const response = await studentsAPI.search({ email });
            if (response.data && response.data.length > 0) {
                setFoundStudent(response.data[0]);
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setSearchingStudent(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const juniorMentors = mentors.filter(m => m.role === 'junior_mentor' || m.role === 'subjunior_mentor');
    const seniorMentors = mentors.filter(m => m.role === 'senior_mentor');

    return (
        <div className="space-y-6 animate-fade-in" data-testid="students-page">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold text-foreground">Students</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your student portfolio
                    </p>
                </div>
                <div className="flex gap-2">
                    {hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']) && (
                        <Button
                            variant="outline"
                            onClick={() => setImportDialogOpen(true)}
                            className="gap-2"
                            data-testid="import-csv-btn"
                        >
                            <Upload className="w-4 h-4" />
                            Import CSV
                        </Button>
                    )}
                    {/* Request Student button for mentors */}
                    {isMentor && (
                        <Button
                            variant="outline"
                            onClick={() => setRequestStudentDialogOpen(true)}
                            className="gap-2 border-primary text-primary hover:bg-primary/10"
                            data-testid="request-student-btn"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                            Request Student
                        </Button>
                    )}
                    {canManageStudents() && (
                        <Button
                            onClick={() => handleOpenDialog()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                            data-testid="add-student-btn"
                        >
                            <UserPlus className="w-4 h-4" />
                            Add Student
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-card border-border shadow-soft">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search students..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 bg-background border-border"
                                data-testid="search-students-input"
                            />
                        </div>
                        <Select value={statusFilter || "all"} onValueChange={(val) => setStatusFilter(val === "all" ? "" : val)}>
                            <SelectTrigger className="w-full sm:w-40 bg-background border-border">
                                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        {(search || statusFilter) && (
                            <Button
                                variant="ghost"
                                onClick={() => { setSearch(''); setStatusFilter(''); }}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4 mr-1" />
                                Clear
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="bg-card border-border shadow-soft">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-20">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No students found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="data-table">
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="text-muted-foreground">Student</TableHead>
                                        <TableHead className="text-muted-foreground">Contact</TableHead>
                                        <TableHead className="text-muted-foreground">Mentor</TableHead>
                                        <TableHead className="text-muted-foreground">Net Deposit</TableHead>
                                        <TableHead className="text-muted-foreground">Level</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => (
                                        <TableRow 
                                            key={student.id} 
                                            className="border-border"
                                            data-testid={`student-row-${student.id}`}
                                        >
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground font-medium">{student.full_name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{student.student_code}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-foreground text-sm">{student.email}</p>
                                                    <p className="text-xs text-muted-foreground">{student.phone}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-foreground text-sm">{student.primary_mentor_name || '-'}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-primary font-mono font-medium">
                                                    {formatCurrency(student.net_deposit_usd)}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant="outline" 
                                                    className={`${
                                                        student.student_level === 'LEVEL_2'
                                                            ? 'bg-primary/10 text-primary border-primary/30'
                                                            : 'bg-foreground-subtle/10 text-muted-foreground border-foreground-subtle/30'
                                                    }`}
                                                >
                                                    {student.student_level.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant="outline" 
                                                    className={`${
                                                        student.status === 'ACTIVE'
                                                            ? 'bg-accent-success/10 text-accent-success border-accent-success/30'
                                                            : 'bg-foreground-subtle/10 text-muted-foreground border-foreground-subtle/30'
                                                    }`}
                                                >
                                                    {student.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOpenDialog(student)}
                                                        className="text-muted-foreground hover:text-primary"
                                                        data-testid={`edit-student-${student.id}`}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    {hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head']) && student.assignment_status === 'assigned' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setStudentToRelease(student);
                                                                setReleaseDialogOpen(true);
                                                            }}
                                                            className="text-muted-foreground hover:text-amber-500"
                                                            title="Release to Open Pool"
                                                            data-testid={`release-student-${student.id}`}
                                                        >
                                                            <UserMinus className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {hasRole(['super_admin', 'admin']) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setStudentToDelete(student);
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                            className="text-muted-foreground hover:text-accent-error"
                                                            data-testid={`delete-student-${student.id}`}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
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

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-2xl text-foreground">
                            {editingStudent ? 'Edit Student' : 'Add New Student'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {editingStudent ? 'Update student information' : 'Enter details to add a new student'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Full Name</Label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Enter full name"
                                    required
                                    className="bg-background border-border text-foreground rounded-lg"
                                    data-testid="student-fullname-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="Enter email"
                                    required
                                    className="bg-background border-border text-foreground rounded-lg"
                                    data-testid="student-email-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Phone</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="Enter phone number"
                                    required
                                    className="bg-background border-border text-foreground rounded-lg"
                                    data-testid="student-phone-input"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Country</Label>
                                <Input
                                    value={formData.country}
                                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    placeholder="Enter country"
                                    required
                                    className="bg-background border-border text-foreground rounded-lg"
                                    data-testid="student-country-input"
                                />
                            </div>
                            {/* Only show mentor and level fields for admins */}
                            {isAdmin && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Primary Mentor</Label>
                                        <Select
                                            value={formData.primary_mentor_id || "none"}
                                            onValueChange={(value) => setFormData({ ...formData, primary_mentor_id: value === "none" ? "" : value })}
                                        >
                                            <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                                <SelectValue placeholder="Select mentor" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value="none" className="text-muted-foreground">No Mentor</SelectItem>
                                                {juniorMentors.map((mentor) => (
                                                    <SelectItem key={mentor.id} value={mentor.id} className="text-foreground">
                                                        {mentor.full_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase tracking-wider">Senior Mentor</Label>
                                        <Select
                                            value={formData.senior_mentor_id || "none"}
                                            onValueChange={(value) => setFormData({ ...formData, senior_mentor_id: value === "none" ? "" : value })}
                                        >
                                            <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                                <SelectValue placeholder="Select senior mentor" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border">
                                                <SelectItem value="none" className="text-muted-foreground">No Senior Mentor</SelectItem>
                                                {seniorMentors.map((mentor) => (
                                                    <SelectItem key={mentor.id} value={mentor.id} className="text-foreground">
                                                        {mentor.full_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        <SelectItem value="ACTIVE" className="text-foreground">Active</SelectItem>
                                        <SelectItem value="INACTIVE" className="text-foreground">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Only show level field for admins */}
                            {isAdmin && (
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Level</Label>
                                    <Select
                                        value={formData.student_level}
                                        onValueChange={(value) => setFormData({ ...formData, student_level: value })}
                                    >
                                        <SelectTrigger className="bg-background border-border text-foreground rounded-lg">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border">
                                            <SelectItem value="LEVEL_1" className="text-foreground">Level 1</SelectItem>
                                            <SelectItem value="LEVEL_2" className="text-foreground">Level 2</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Additional notes..."
                                className="bg-background border-border text-foreground rounded-lg min-h-24"
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
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                                data-testid="save-student-btn"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingStudent ? 'Save Changes' : 'Add Student')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Delete Student</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            This action cannot be undone
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to delete <span className="text-foreground font-medium">{studentToDelete?.full_name}</span>? This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteDialogOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDelete}
                            className="bg-accent-error text-white hover:bg-accent-error/90 rounded-lg"
                            data-testid="confirm-delete-btn"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import CSV Dialog */}
            <Dialog open={importDialogOpen} onOpenChange={(open) => {
                setImportDialogOpen(open);
                if (!open) {
                    setImportFile(null);
                    setImportResult(null);
                }
            }}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Import Students from CSV</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Upload a CSV file to bulk import students
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Button
                            variant="outline"
                            onClick={handleDownloadTemplate}
                            className="w-full border-border hover:bg-background gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download CSV Template
                        </Button>
                        
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setImportFile(e.target.files[0])}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label htmlFor="csv-upload" className="cursor-pointer">
                                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-muted-foreground">
                                    {importFile ? importFile.name : 'Click to select CSV file'}
                                </p>
                            </label>
                        </div>

                        {importResult && (
                            <div className="bg-background p-4 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Rows:</span>
                                    <span className="text-foreground">{importResult.total_rows}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Successful:</span>
                                    <span className="text-green-500">{importResult.successful}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Failed:</span>
                                    <span className="text-red-500">{importResult.failed}</span>
                                </div>
                                {importResult.errors?.length > 0 && (
                                    <div className="mt-2 max-h-32 overflow-y-auto">
                                        <p className="text-xs text-muted-foreground mb-1">Errors:</p>
                                        {importResult.errors.map((err, i) => (
                                            <p key={i} className="text-xs text-red-400">{err}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setImportDialogOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Close
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={!importFile || importing}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2"
                            data-testid="import-btn"
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Import
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Release to Pool Dialog */}
            <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground">Release to Open Pool</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Student will be unassigned from their mentor
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to release <span className="text-foreground font-medium">{studentToRelease?.full_name}</span> to the open pool? They will be unassigned from their current mentor.
                    </p>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setReleaseDialogOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRelease}
                            className="bg-amber-500 text-primary-foreground hover:bg-amber-400 rounded-lg"
                            data-testid="confirm-release-btn"
                        >
                            Release
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Request Student Transfer Dialog */}
            <Dialog open={requestStudentDialogOpen} onOpenChange={(open) => {
                setRequestStudentDialogOpen(open);
                if (!open) {
                    setFoundStudent(null);
                    setStudentSearchEmail('');
                    setTransferReason('');
                }
            }}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-primary" />
                            Request Student Transfer
                        </DialogTitle>
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
                                    placeholder="Enter student email..."
                                    value={studentSearchEmail}
                                    onChange={(e) => setStudentSearchEmail(e.target.value)}
                                    className="bg-background border-border text-foreground"
                                    data-testid="request-student-email"
                                />
                                <Button
                                    onClick={handleSearchStudent}
                                    disabled={!studentSearchEmail || searchingStudent}
                                    className="bg-primary text-primary-foreground"
                                >
                                    {searchingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                        
                        {/* Found Student Info */}
                        {foundStudent && (
                            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-foreground font-medium">{foundStudent.full_name}</p>
                                        <p className="text-sm text-muted-foreground">{foundStudent.email}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{foundStudent.student_code}</p>
                                    </div>
                                    <Badge className={foundStudent.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                                        {foundStudent.status}
                                    </Badge>
                                </div>
                                
                                {/* Current mentor warning */}
                                {foundStudent.primary_mentor_name && (
                                    <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <p className="text-amber-500 font-medium">This student is assigned to another mentor</p>
                                            <p className="text-muted-foreground">Current Mentor: {foundStudent.primary_mentor_name}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* If student has no mentor */}
                                {!foundStudent.primary_mentor_name && (
                                    <div className="flex items-start gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                                        <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-blue-400">This student is currently in the open pool (no mentor assigned)</p>
                                    </div>
                                )}
                                
                                {/* Reason for transfer */}
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Reason for Transfer *</Label>
                                    <Textarea
                                        placeholder="Explain why you want this student transferred to you..."
                                        value={transferReason}
                                        onChange={(e) => setTransferReason(e.target.value)}
                                        className="bg-background border-border text-foreground"
                                        rows={3}
                                        data-testid="transfer-reason"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setRequestStudentDialogOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitTransferRequest}
                            disabled={!foundStudent || !transferReason || submittingRequest}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                            data-testid="submit-transfer-request"
                        >
                            {submittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Suggestion Dialog - when student email already exists */}
            <Dialog open={showRequestSuggestion} onOpenChange={setShowRequestSuggestion}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            Student Already Exists
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            This student is already registered in the system
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-muted-foreground">
                            A student with the email <span className="text-foreground font-mono">{suggestionEmail}</span> already exists and may be assigned to another mentor.
                        </p>
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="text-foreground font-medium mb-2">Would you like to request a transfer?</p>
                            <p className="text-sm text-muted-foreground">
                                You can submit a transfer request which will be reviewed by an admin. If approved, the student will be transferred to you.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setShowRequestSuggestion(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => openRequestDialogWithEmail(suggestionEmail)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                            data-testid="request-transfer-suggestion-btn"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                            Request Transfer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StudentsPage;
