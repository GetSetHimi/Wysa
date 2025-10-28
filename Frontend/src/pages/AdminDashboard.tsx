import React, { useState, useEffect } from 'react';
import { Card } from '../Components/ui/card';
import { BarChart3, Users, Clock, TrendingUp, Shield, Eye } from 'lucide-react';

interface ActivityStats {
  active15Min: number;
  active1Hour: number;
  active1Day: number;
  timestamp: string;
}

interface UserActivityDetail {
  id: number;
  userId: number;
  lastActiveAt: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AdminInfo {
  email: string;
  username: string;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<UserActivityDetail[]>([]);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState(15);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/analytics/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to fetch stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/analytics/active-users-details/${selectedTimeWindow}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recent activity');
      }

      const data = await response.json();
      if (data.success) {
        setRecentActivity(data.data.activeUsers || []);
      }
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };

  const fetchAdminInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/analytics/admin-info', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAdminInfo(data.data.adminInfo);
        }
      }
    } catch (err) {
      console.error('Error fetching admin info:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
    fetchAdminInfo();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchRecentActivity();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [selectedTimeWindow]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading Admin Dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ Access Denied</div>
          <div className="text-gray-600">Error: {error}</div>
          <div className="text-sm text-gray-500 mt-2">This dashboard is for administrators only.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">User Activity Analytics</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {adminInfo && (
                <div className="text-sm text-gray-500">
                  <div className="font-medium">Logged in as: {adminInfo.username}</div>
                  <div className="text-xs">{adminInfo.email}</div>
                </div>
              )}
              <div className="text-sm text-gray-500">
                Last updated: {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : 'Never'}
              </div>
              <button 
                onClick={() => {
                  fetchStats();
                  fetchRecentActivity();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Active Users (15 min)</h3>
                <div className="text-4xl font-bold">
                  {stats?.active15Min || 0}
                </div>
                <p className="text-blue-100 mt-1">Currently online</p>
              </div>
              <Users className="h-12 w-12 text-blue-200" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Active Users (1 hour)</h3>
                <div className="text-4xl font-bold">
                  {stats?.active1Hour || 0}
                </div>
                <p className="text-green-100 mt-1">Last hour</p>
              </div>
              <Clock className="h-12 w-12 text-green-200" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Active Users (24 hours)</h3>
                <div className="text-4xl font-bold">
                  {stats?.active1Day || 0}
                </div>
                <p className="text-purple-100 mt-1">Last 24 hours</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-200" />
            </div>
          </Card>
        </div>

        {/* Time Window Selector */}
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Detailed Activity Analysis
          </h3>
          <div className="flex items-center space-x-4 mb-4">
            <label className="text-sm font-medium text-gray-700">Time Window:</label>
            <select 
              value={selectedTimeWindow} 
              onChange={(e) => setSelectedTimeWindow(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value={15}>15 minutes</option>
              <option value={60}>1 hour</option>
              <option value={240}>4 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>
        </Card>

        {/* Recent Activity Table */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2" />
            Recent User Activity ({selectedTimeWindow} minutes)
          </h3>
          
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent activity found for the selected time window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Agent
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {activity.userId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(activity.lastActiveAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activity.ipAddress || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {activity.sessionId ? activity.sessionId.substring(0, 8) + '...' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {activity.userAgent || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Admin Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-blue-800">Admin Dashboard</h4>
              <p className="text-sm text-blue-700 mt-1">
                This dashboard provides real-time insights into user activity on your platform. 
                Data refreshes automatically every 30 seconds.
              </p>
              <div className="text-xs text-blue-600 mt-2">
                📊 Total Active Users: {stats?.active1Day || 0} | 
                🔄 Auto-refresh: Every 30s | 
                🛡️ Admin Only Access
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
