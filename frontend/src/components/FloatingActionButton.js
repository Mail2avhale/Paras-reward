import React, { useState } from 'react';
import { Plus, Zap, ShoppingBag, CreditCard, Gift, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FloatingActionButton = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { icon: Zap, label: 'Start Mining', color: 'from-yellow-500 to-orange-500', route: '/mining' },
    { icon: ShoppingBag, label: 'Shop', color: 'from-purple-500 to-pink-500', route: '/marketplace' },
    { icon: CreditCard, label: 'Bill Pay', color: 'from-blue-500 to-cyan-500', route: '/bill-payments' },
    { icon: Gift, label: 'Vouchers', color: 'from-green-500 to-emerald-500', route: '/gift-vouchers' },
  ];

  const handleActionClick = (route) => {
    navigate(route);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {/* Action Menu */}
      {isOpen && (
        <div className="mb-4 space-y-2">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <div
                key={index}
                className="flex items-center justify-end space-x-2 animate-in slide-in-from-bottom duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="bg-white px-3 py-1 rounded-full text-sm font-medium shadow-lg text-gray-700 whitespace-nowrap">
                  {action.label}
                </span>
                <button
                  onClick={() => handleActionClick(action.route)}
                  className={`h-12 w-12 bg-gradient-to-br ${action.color} rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-14 w-14 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-2xl hover:shadow-3xl transform transition-all duration-300 ${
          isOpen ? 'rotate-45 scale-110' : 'hover:scale-105'
        }`}
      >
        {isOpen ? (
          <X className="h-7 w-7 text-white" />
        ) : (
          <Plus className="h-7 w-7 text-white" />
        )}
      </button>
    </div>
  );
};

export default FloatingActionButton;
