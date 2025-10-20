import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Navbar = ({ user, onLogout }) => {
  // Define role-based visibility
  const isRegularUser = !user.role || user.role === 'user';
  const isAdmin = user.role === 'admin';
  const isStockist = ['master_stockist', 'sub_stockist'].includes(user.role);
  const isOutlet = user.role === 'outlet';
  
  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <span className="text-xl font-bold text-gray-900">PARAS APP</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {/* Dashboard - Show for everyone */}
            <Link to="/dashboard" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Dashboard
            </Link>
            
            {/* Regular User Features - Only for users */}
            {isRegularUser && (
              <>
                <Link to="/mining" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
                  Mining
                </Link>
                <Link to="/game" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
                  Game
                </Link>
                <Link to="/referrals" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
                  Referrals
                </Link>
                <Link to="/marketplace" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
                  Marketplace
                </Link>
                <Link to="/leaderboard" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
                  Leaderboard
                </Link>
              </>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <img
                    src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`}
                    alt={user.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="font-medium text-gray-900">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">My Profile</Link>
                </DropdownMenuItem>
                
                {/* VIP & KYC - Only for regular users */}
                {isRegularUser && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/vip" className="cursor-pointer">VIP Membership</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/kyc" className="cursor-pointer">KYC Verification</Link>
                    </DropdownMenuItem>
                  </>
                )}
                
                {/* Wallet - Show for all */}
                <DropdownMenuItem asChild>
                  <Link to="/wallet" className="cursor-pointer">Wallet</Link>
                </DropdownMenuItem>
                
                {/* Orders - Only for regular users */}
                {isRegularUser && (
                  <DropdownMenuItem asChild>
                    <Link to="/orders" className="cursor-pointer">My Orders</Link>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                {/* Admin Panel */}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer font-semibold text-purple-600">Admin Panel</Link>
                  </DropdownMenuItem>
                )}
                
                {/* Stockist Panels */}
                {user.role === 'master_stockist' && (
                  <DropdownMenuItem asChild>
                    <Link to="/master-stockist" className="cursor-pointer font-semibold text-blue-600">Stockist Panel</Link>
                  </DropdownMenuItem>
                )}
                {user.role === 'sub_stockist' && (
                  <DropdownMenuItem asChild>
                    <Link to="/sub-stockist" className="cursor-pointer font-semibold text-blue-600">Stockist Panel</Link>
                  </DropdownMenuItem>
                )}
                
                {/* Outlet Panel */}
                {isOutlet && (
                  <DropdownMenuItem asChild>
                    <Link to="/outlet" className="cursor-pointer font-semibold text-green-600">Outlet Panel</Link>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer">Dashboard</Link>
                </DropdownMenuItem>
                
                {/* Regular User Features - Only for users */}
                {isRegularUser && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/mining" className="cursor-pointer">Mining</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/game" className="cursor-pointer">Game</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/referrals" className="cursor-pointer">Referrals</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/marketplace" className="cursor-pointer">Marketplace</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/leaderboard" className="cursor-pointer">Leaderboard</Link>
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">My Profile</Link>
                </DropdownMenuItem>
                
                {/* VIP & KYC - Only for regular users */}
                {isRegularUser && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/vip" className="cursor-pointer">VIP Membership</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/kyc" className="cursor-pointer">KYC Verification</Link>
                    </DropdownMenuItem>
                  </>
                )}
                
                {/* Wallet - Show for all */}
                <DropdownMenuItem asChild>
                  <Link to="/wallet" className="cursor-pointer">Wallet</Link>
                </DropdownMenuItem>
                
                {/* Orders - Only for regular users */}
                {isRegularUser && (
                  <DropdownMenuItem asChild>
                    <Link to="/orders" className="cursor-pointer">My Orders</Link>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                {/* Admin Panel */}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer font-semibold text-purple-600">Admin Panel</Link>
                  </DropdownMenuItem>
                )}
                
                {/* Stockist Panels */}
                {user.role === 'master_stockist' && (
                  <DropdownMenuItem asChild>
                    <Link to="/master-stockist" className="cursor-pointer font-semibold text-blue-600">Stockist Panel</Link>
                  </DropdownMenuItem>
                )}
                {user.role === 'sub_stockist' && (
                  <DropdownMenuItem asChild>
                    <Link to="/sub-stockist" className="cursor-pointer font-semibold text-blue-600">Stockist Panel</Link>
                  </DropdownMenuItem>
                )}
                
                {/* Outlet Panel */}
                {isOutlet && (
                  <DropdownMenuItem asChild>
                    <Link to="/outlet" className="cursor-pointer font-semibold text-green-600">Outlet Panel</Link>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;