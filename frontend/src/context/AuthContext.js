import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (token && storedUser) {
            setUser(JSON.parse(storedUser));
            // Verify token is still valid
            authAPI.getMe()
                .then(response => {
                    setUser(response.data);
                    localStorage.setItem('user', JSON.stringify(response.data));
                })
                .catch(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        try {
            setError(null);
            const response = await authAPI.login(email, password);
            const { access_token, user: userData } = response.data;
            
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            
            return userData;
        } catch (err) {
            const message = err.response?.data?.detail || 'Login failed';
            setError(message);
            throw new Error(message);
        }
    };

    const register = async (data) => {
        try {
            setError(null);
            const response = await authAPI.register(data);
            const { access_token, user: userData } = response.data;
            
            // For pending users, don't save to localStorage (they can't login yet)
            if (userData.role === 'pending') {
                return { user: userData, isPending: true };
            }
            
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            
            return { user: userData, isPending: false };
        } catch (err) {
            const message = err.response?.data?.detail || 'Registration failed';
            setError(message);
            throw new Error(message);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const hasRole = (roles) => {
        if (!user) return false;
        if (typeof roles === 'string') return user.role === roles;
        return roles.includes(user.role);
    };

    const canApprove = () => {
        return hasRole(['super_admin', 'broker_admin', 'academic_head']);
    };

    const canManageStudents = () => {
        return hasRole(['super_admin', 'admin', 'broker_admin', 'academic_head', 'junior_mentor', 'senior_mentor', 'assistance']);
    };

    const value = {
        user,
        loading,
        error,
        setError,
        login,
        register,
        logout,
        hasRole,
        canApprove,
        canManageStudents,
        isAuthenticated: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
