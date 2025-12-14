import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Crown, ArrowLeft, Save, Percent, DollarSign, Calendar, Tag, Info } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const AdminVIPPlans = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState({
    monthly: { price: 299, discount_percentage: 0, discount_fixed: 0 },
    quarterly: { price: 897, discount_percentage: 0, discount_fixed: 0 },
    half_yearly: { price: 1794, discount_percentage: 0, discount_fixed: 0 },
    yearly: { price: 3588, discount_percentage: 0, discount_fixed: 0 }
  });
  const [livePreview, setLivePreview] = useState({
    monthly: { final_price: 299, savings: 0 },
    quarterly: { final_price: 897, savings: 0 },
    half_yearly: { final_price: 1794, savings: 0 },
    yearly: { final_price: 3588, savings: 0 }
  });

  useEffect(() => {
    // Check if user is admin
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    
    fetchVIPPlans();
  }, [user, navigate]);

  const fetchVIPPlans = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/vip/plans`);
      const fetchedPlans = response.data.plans;
      
      // Convert array to object
      const plansObj = {};
      const previewObj = {};
      
      fetchedPlans.forEach(plan => {
        plansObj[plan.plan_type] = {
          price: plan.base_price,
          discount_percentage: plan.discount_percentage,
          discount_fixed: plan.discount_fixed
        };
        previewObj[plan.plan_type] = {
          final_price: plan.final_price,
          savings: plan.savings
        };
      });
      
      setPlans(plansObj);
      setLivePreview(previewObj);
    } catch (error) {
      console.error('Error fetching VIP plans:', error);
      toast.error('Failed to load VIP plans');
    }
  };

  const calculatePreview = (planType, price, discountPercentage, discountFixed) => {
    const percentDiscount = (price * discountPercentage) / 100;
    const totalDiscount = percentDiscount + discountFixed;
    const finalPrice = Math.max(0, price - totalDiscount);
    
    return {
      final_price: finalPrice,
      savings: totalDiscount
    };
  };

  const handlePlanChange = (planType, field, value) => {
    const numValue = parseFloat(value) || 0;
    
    setPlans(prev => {
      const updated = {
        ...prev,
        [planType]: {
          ...prev[planType],
          [field]: numValue
        }
      };
      
      // Update live preview
      const preview = calculatePreview(
        planType,
        updated[planType].price,
        updated[planType].discount_percentage,
        updated[planType].discount_fixed
      );
      
      setLivePreview(prevPreview => ({
        ...prevPreview,
        [planType]: preview
      }));
      
      return updated;
    });
  };

  const handleSavePlan = async (planType) => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/admin/vip/update-plan`, {
        plan_type: planType,
        price: plans[planType].price,
        discount_percentage: plans[planType].discount_percentage,
        discount_fixed: plans[planType].discount_fixed
      });
      
      toast.success(`${planType.charAt(0).toUpperCase() + planType.slice(1)} plan updated successfully!`, {
        description: `Users will now see the updated pricing`
      });
      
      fetchVIPPlans(); // Refresh to get server-calculated values
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update plan', {
        description: error.response?.data?.detail || 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      // Save all plans sequentially
      for (const planType of ['monthly', 'quarterly', 'half_yearly', 'yearly']) {
        await axios.post(`${API}/api/admin/vip/update-plan`, {
          plan_type: planType,
          price: plans[planType].price,
          discount_percentage: plans[planType].discount_percentage,
          discount_fixed: plans[planType].discount_fixed
        });
      }
      
      toast.success('All VIP plans updated successfully!', {
        description: 'Users will now see the updated pricing for all plans',
        duration: 5000
      });
      
      fetchVIPPlans();
    } catch (error) {
      console.error('Error updating plans:', error);
      toast.error('Failed to update all plans', {
        description: error.response?.data?.detail || 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  const planLabels = {
    monthly: { label: 'Monthly Plan', icon: '📅', duration: '30 days' },
    quarterly: { label: 'Quarterly Plan', icon: '📊', duration: '90 days' },
    half_yearly: { label: 'Half-Yearly Plan', icon: '⏰', duration: '180 days' },
    yearly: { label: 'Yearly Plan', icon: '🎯', duration: '365 days' }
  };

  const renderPlanCard = (planType) => {
    const planInfo = planLabels[planType];
    const planData = plans[planType];
    const preview = livePreview[planType];

    return (
      <Card key={planType} className="p-6 bg-white shadow-lg hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{planInfo.icon}</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{planInfo.label}</h3>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {planInfo.duration}
              </p>
            </div>
          </div>
          <Crown className="h-8 w-8 text-yellow-500" />
        </div>

        <div className="space-y-4">
          {/* Base Price */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Tag className="h-4 w-4 text-blue-600" />
              Base Price (₹)
            </label>
            <Input
              type="number"
              value={planData.price}
              onChange={(e) => handlePlanChange(planType, 'price', e.target.value)}
              min="0"
              step="1"
              className="text-lg"
            />
          </div>

          {/* Discount Percentage */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Percent className="h-4 w-4 text-green-600" />
              Discount Percentage (%)
            </label>
            <Input
              type="number"
              value={planData.discount_percentage}
              onChange={(e) => handlePlanChange(planType, 'discount_percentage', e.target.value)}
              min="0"
              max="100"
              step="0.1"
            />
          </div>

          {/* Fixed Discount */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              Fixed Discount (₹)
            </label>
            <Input
              type="number"
              value={planData.discount_fixed}
              onChange={(e) => handlePlanChange(planType, 'discount_fixed', e.target.value)}
              min="0"
              step="1"
            />
          </div>

          {/* Live Preview */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg border-2 border-yellow-200">
            <p className="text-xs text-gray-600 mb-2 font-semibold">Live Preview</p>
            <div className="space-y-1">
              {preview.savings > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Original Price:</span>
                    <span className="text-gray-600 line-through">₹{planData.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700 font-medium">Total Savings:</span>
                    <span className="text-green-700 font-bold">-₹{preview.savings.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-lg font-bold pt-2 border-t border-yellow-300">
                <span className="text-gray-900">Final Price:</span>
                <span className="text-orange-600">₹{preview.final_price.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={() => handleSavePlan(planType)}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            Save {planInfo.label}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                VIP Plans Management
              </h1>
              <p className="text-gray-600 text-sm mt-1">Configure pricing and discounts for all VIP membership plans</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="p-6 mb-8 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="h-6 w-6 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-900 mb-2">How Discounts Work</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Percentage Discount:</strong> Applied first (e.g., 10% of ₹299 = ₹29.90 off)</li>
                <li>• <strong>Fixed Discount:</strong> Applied after percentage (e.g., additional ₹50 off)</li>
                <li>• <strong>Both can be used together</strong> for maximum savings</li>
                <li>• Final price = Base Price - (Percentage Discount + Fixed Discount)</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {renderPlanCard('monthly')}
          {renderPlanCard('quarterly')}
          {renderPlanCard('half_yearly')}
          {renderPlanCard('yearly')}
        </div>

        {/* Save All Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSaveAll}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-6 text-lg shadow-xl"
          >
            <Save className="h-5 w-5 mr-2" />
            {loading ? 'Saving All Plans...' : 'Save All Plans'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminVIPPlans;
