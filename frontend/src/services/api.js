import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (data) => api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
};

// Users API
export const usersAPI = {
    getAll: () => api.get('/users'),
    getMentors: () => api.get('/users/mentors'),
};

// Students API
export const studentsAPI = {
    getAll: (params) => api.get('/students', { params }),
    getOne: (id) => api.get(`/students/${id}`),
    create: (data) => api.post('/students', data),
    update: (id, data) => api.put(`/students/${id}`, data),
    delete: (id) => api.delete(`/students/${id}`),
    // Open Pool
    getOpenPool: () => api.get('/students/open-pool'),
    claim: (id) => api.post(`/students/${id}/claim`),
    release: (id) => api.post(`/students/${id}/release`),
    search: (params) => api.get('/students/search', { params }),
    // CSV Import
    importCSV: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/students/import-csv', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    getCSVTemplate: () => api.get('/students/csv-template', { responseType: 'blob' }),
};

// Student Requests API
export const studentRequestsAPI = {
    getAll: (params) => api.get('/student-requests', { params }),
    create: (data) => api.post('/student-requests', data),
    approve: (id) => api.put(`/student-requests/${id}/approve`),
    reject: (id, reason) => api.put(`/student-requests/${id}/reject?rejection_reason=${encodeURIComponent(reason || '')}`),
};

// Funding API
export const fundingAPI = {
    getAll: (params) => api.get('/funding', { params }),
    create: (data) => api.post('/funding', data),
    approve: (id, data) => api.put(`/funding/${id}/approve`, data),
    reject: (id, data) => api.put(`/funding/${id}/reject`, data),
    uploadScreenshot: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/upload/screenshot', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

// Dashboard API
export const dashboardAPI = {
    getStats: () => api.get('/dashboard/stats'),
    getPendingCounts: () => api.get('/dashboard/pending-counts'),
};

// AI Insights API
export const aiInsightsAPI = {
    getInsight: (query, contextType = 'general') => 
        api.post('/ai-insights', { query, context_type: contextType }),
    getDashboard: () => api.get('/ai-insights/dashboard'),
    generateReport: () => api.post('/ai-insights/generate-report'),
    query: (query, contextType = 'general') =>
        api.post('/ai-insights/query', { query, context_type: contextType }),
};

// Payouts API
export const payoutsAPI = {
    getAll: (params) => api.get('/payouts', { params }),
    create: (data) => api.post('/payouts', data),
    process: (id) => api.put(`/payouts/${id}/process`),
    complete: (id, paymentReference) => api.put(`/payouts/${id}/complete${paymentReference ? `?payment_reference=${encodeURIComponent(paymentReference)}` : ''}`),
    getSummary: () => api.get('/payouts/summary'),
};

// Commissions API
export const commissionsAPI = {
    getAll: (params) => api.get('/commissions', { params }),
    generate: (year, quarter) => api.post(`/commissions/generate?year=${year}&quarter=${quarter}`),
    approve: (id, data) => api.put(`/commissions/${id}/approve`, data),
    getTransactions: (mentorId) => api.get('/commissions/transactions', { params: mentorId ? { mentor_id: mentorId } : {} }),
};

// Student Logs API (Detailed CRM)
export const studentLogsAPI = {
    getAll: (params) => api.get('/student-logs', { params }),
    getOne: (studentId) => api.get(`/student-logs/${studentId}`),
    create: (data) => api.post('/student-logs', data),
    update: (studentId, data) => api.put(`/student-logs/${studentId}`, data),
    addInteraction: (studentId, interactionType, summary) => 
        api.post(`/student-logs/${studentId}/interaction?interaction_type=${interactionType}&summary=${encodeURIComponent(summary)}`),
    getSummary: () => api.get('/student-logs/stats/summary'),
};

// Support Tickets API
export const ticketsAPI = {
    getAll: (params) => api.get('/tickets', { params }),
    getOne: (id) => api.get(`/tickets/${id}`),
    create: (data) => api.post('/tickets', data),
    assign: (id, assigneeId) => api.put(`/tickets/${id}/assign${assigneeId ? `?assignee_id=${assigneeId}` : ''}`),
    updateStatus: (id, status) => api.put(`/tickets/${id}/status?status=${status}`),
    addMessage: (id, message) => api.post(`/tickets/${id}/messages`, { message }),
    getMessages: (id) => api.get(`/tickets/${id}/messages`),
    getSummary: () => api.get('/tickets/stats/summary'),
};

// MT5 Accounts API
export const mt5AccountsAPI = {
    getAll: (params) => api.get('/mt5-accounts', { params }),
    getOne: (id) => api.get(`/mt5-accounts/${id}`),
    create: (data) => api.post('/mt5-accounts', data),
    update: (id, data) => api.put(`/mt5-accounts/${id}`, data),
    delete: (id) => api.delete(`/mt5-accounts/${id}`),
};

// Audit Logs API
export const auditLogsAPI = {
    getAll: (params) => api.get('/audit-logs', { params }),
    getActions: () => api.get('/audit-logs/actions'),
};

// Reminders API
export const remindersAPI = {
    getSummary: () => api.get('/reminders/summary'),
    triggerCheck: () => api.get('/reminders/check'),
};

// Leaderboard API
export const leaderboardAPI = {
    getAll: () => api.get('/leaderboard'),
    sendMonthlyNotifications: () => api.post('/leaderboard/send-monthly-notifications'),
};

// Gamification Settings API
export const gamificationAPI = {
    getSettings: () => api.get('/gamification-settings'),
    updateSetting: (settingKey, value) => api.put(`/gamification-settings/${settingKey}`, { setting_value: value }),
};

// Personnel API
export const personnelAPI = {
    getAll: (params) => api.get('/personnel', { params }),
    getById: (id) => api.get(`/personnel/${id}`),
    update: (id, data) => api.put(`/personnel/${id}`, data),
    deactivate: (id) => api.delete(`/personnel/${id}`),
    reactivate: (id) => api.put(`/personnel/${id}/reactivate`),
    getStats: () => api.get('/personnel/summary/stats'),
};

// Invitations API
export const invitationsAPI = {
    getAll: (params) => api.get('/invitations', { params }),
    create: (data) => api.post('/invitations', data),
    cancel: (id) => api.delete(`/invitations/${id}`),
    resend: (id) => api.post(`/invitations/${id}/resend`),
};

// Academic Counselors API
export const counselorsAPI = {
    getAll: () => api.get('/counselors'),
    getAssignments: (counselorId) => api.get('/counselors/assignments', { params: { counselor_id: counselorId } }),
    assign: (data) => api.put('/counselors/assign', data),
    unassign: (studentId) => api.put(`/counselors/unassign/${studentId}`),
    getSummary: () => api.get('/counselors/summary'),
};

// Retention API
export const retentionAPI = {
    getCases: (params) => api.get('/retention/cases', { params }),
    getSummary: () => api.get('/retention/summary'),
    getDrawAdmins: () => api.get('/retention/draw-admins'),
    assign: (data) => api.put('/retention/assign', data),
    updateStatus: (studentId, data) => api.put(`/retention/${studentId}/status`, data),
};

// Reports API
export const reportsAPI = {
    getDailySummary: () => api.get('/reports/daily-summary'),
    sendDailySummary: () => api.post('/reports/send-daily-summary'),
};

export default api;
