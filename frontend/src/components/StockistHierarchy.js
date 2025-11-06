import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Users, ArrowUp, ArrowDown, Building2, Store, User } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StockistHierarchy = ({ user, userRole }) => {
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHierarchy();
  }, [user.uid]);

  const fetchHierarchy = async () => {
    try {
      // Fetch parent if not master_stockist
      if (userRole !== 'master_stockist') {
        // Try multiple fields to find parent: parent_id, assigned_sub_stockist, assigned_master_stockist
        let parentId = null;
        
        if (userRole === 'outlet') {
          // For outlets, check parent_id first, then assigned_sub_stockist
          parentId = user.parent_id || user.assigned_sub_stockist;
        } else if (userRole === 'sub_stockist') {
          // For sub stockists, check parent_id first, then assigned_master_stockist
          parentId = user.parent_id || user.assigned_master_stockist;
        }
        
        if (parentId) {
          try {
            const parentResponse = await axios.get(`${API}/users/${parentId}`);
            setParent(parentResponse.data);
          } catch (err) {
            console.warn('Could not fetch parent:', err);
          }
        } else {
          console.log('No parent ID found in user data:', {
            parent_id: user.parent_id,
            assigned_sub_stockist: user.assigned_sub_stockist,
            assigned_master_stockist: user.assigned_master_stockist,
            role: userRole
          });
        }
      }

      // Fetch children
      const childrenResponse = await axios.get(`${API}/users/children/${user.uid}`);
      setChildren(childrenResponse.data.children || []);
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    if (role === 'master_stockist') return Building2;
    if (role === 'sub_stockist') return Store;
    if (role === 'outlet') return User;
    return Users;
  };

  const getRoleColor = (role) => {
    if (role === 'master_stockist') return 'from-purple-50 to-purple-100 text-purple-600';
    if (role === 'sub_stockist') return 'from-blue-50 to-blue-100 text-blue-600';
    if (role === 'outlet') return 'from-green-50 to-green-100 text-green-600';
    return 'from-gray-50 to-gray-100 text-gray-600';
  };

  const getRoleName = (role) => {
    if (role === 'master_stockist') return 'Master Stockist';
    if (role === 'sub_stockist') return 'Sub Stockist';
    if (role === 'outlet') return 'Outlet';
    return role;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </Card>
        <Card className="p-6 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Parent/Superior Card */}
      {userRole !== 'master_stockist' && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUp className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">My Parent</h3>
          </div>
          
          {parent ? (
            <div className={`p-4 bg-gradient-to-br ${getRoleColor(parent.role)} rounded-lg`}>
              <div className="flex items-start gap-4">
                {(() => {
                  const Icon = getRoleIcon(parent.role);
                  return (
                    <div className="w-12 h-12 bg-white/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6" />
                    </div>
                  );
                })()}
                <div className="flex-1">
                  <p className="font-bold text-lg">{parent.name}</p>
                  <p className="text-sm opacity-80">{getRoleName(parent.role)}</p>
                  <p className="text-xs opacity-70 mt-1">{parent.email}</p>
                  <p className="text-xs opacity-70">{parent.mobile}</p>
                  {parent.district && parent.state && (
                    <p className="text-xs opacity-70 mt-1">
                      {parent.district}, {parent.state}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <ArrowUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No parent assigned</p>
            </div>
          )}
        </Card>
      )}

      {/* Children/Subordinates Card */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDown className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-bold text-gray-900">
            {userRole === 'master_stockist' ? 'My Sub Stockists' : 
             userRole === 'sub_stockist' ? 'My Outlets' : 
             'My Team'}
          </h3>
          <span className="ml-auto bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
            {children.length}
          </span>
        </div>

        {children.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {children.map((child) => {
              const Icon = getRoleIcon(child.role);
              return (
                <div 
                  key={child.uid}
                  className={`p-3 bg-gradient-to-br ${getRoleColor(child.role)} rounded-lg hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-white/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{child.name}</p>
                      <p className="text-xs opacity-80">{getRoleName(child.role)}</p>
                      <p className="text-xs opacity-70 truncate">{child.email}</p>
                      {child.district && (
                        <p className="text-xs opacity-70 truncate">{child.district}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <ArrowDown className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {userRole === 'master_stockist' ? 'No sub stockists yet' :
               userRole === 'sub_stockist' ? 'No outlets yet' :
               'No team members'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default StockistHierarchy;
