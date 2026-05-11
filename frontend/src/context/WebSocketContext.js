import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/use-toast';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { toast } = useToast();
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const pingIntervalRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [notifications, setNotifications] = useState([]);

    const getWebSocketUrl = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        
        // Get base URL and convert http(s) to ws(s)
        const baseUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
        const wsUrl = baseUrl.replace(/^http/, 'ws');
        return `${wsUrl}/ws/${token}`;
    }, []);

    const showNotificationToast = useCallback((notification) => {
        // Map notification types to toast variants and icons
        const typeConfig = {
            funding_approved: { variant: 'default', icon: '✅' },
            payout_completed: { variant: 'default', icon: '💰' },
            commission_stage_approved: { variant: 'default', icon: '📊' },
            ticket_assigned: { variant: 'default', icon: '🎫' },
            new_funding_request: { variant: 'default', icon: '📝' },
        };

        const config = typeConfig[notification.type] || { variant: 'default', icon: '🔔' };

        toast({
            title: `${config.icon} ${notification.title}`,
            description: notification.message,
            variant: config.variant,
            duration: 5000,
        });

        // Add to notifications list
        setNotifications(prev => [{
            ...notification,
            id: Date.now(),
            read: false
        }, ...prev].slice(0, 50)); // Keep last 50
    }, [toast]);

    const connect = useCallback(() => {
        const wsUrl = getWebSocketUrl();
        if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                
                // Start ping interval to keep connection alive
                pingIntervalRef.current = setInterval(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send('ping');
                    }
                }, 30000); // Ping every 30 seconds
            };

            wsRef.current.onmessage = (event) => {
                if (event.data === 'pong') return; // Ignore ping responses
                
                try {
                    const notification = JSON.parse(event.data);
                    showNotificationToast(notification);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            wsRef.current.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                setIsConnected(false);
                
                // Clear ping interval
                if (pingIntervalRef.current) {
                    clearInterval(pingIntervalRef.current);
                }
                
                // Attempt reconnect after 5 seconds (if not intentional close)
                if (event.code !== 1000 && isAuthenticated) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, 5000);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }, [getWebSocketUrl, isAuthenticated, showNotificationToast]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close(1000, 'User logout');
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    // Connect when user is authenticated
    useEffect(() => {
        if (isAuthenticated && user) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [isAuthenticated, user, connect, disconnect]);

    const markAsRead = useCallback((notificationId) => {
        setNotifications(prev => 
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const value = {
        isConnected,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export default WebSocketContext;
