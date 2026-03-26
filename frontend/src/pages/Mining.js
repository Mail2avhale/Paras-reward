import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Mining = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/rewards')}
            className="p-2 rounded-full hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-lg font-semibold text-slate-800">Mining</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Mining Feature Removed
          </h2>
          
          <p className="text-slate-600 mb-6">
            Mining feature has been discontinued. We are working on exciting new features for you.
          </p>
          
          <p className="text-sm text-amber-700 bg-amber-100 rounded-lg p-3 mb-6">
            Your existing PRC balance is safe and can still be used for redemptions.
          </p>
          
          <Button
            onClick={() => navigate('/rewards')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8"
          >
            Go to Rewards
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Mining;
