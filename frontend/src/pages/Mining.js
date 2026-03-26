import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Rocket } from 'lucide-react';
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
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-200">
            <Rocket className="w-10 h-10 text-white" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-bold text-slate-800">
              Coming Soon!
            </h2>
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          
          <p className="text-lg font-medium text-purple-700 mb-2">
            New & Improved Mining Engine
          </p>
          
          <p className="text-slate-600 mb-6">
            We're building something amazing! Our new mining system will bring better rewards and an enhanced experience for you.
          </p>
          
          <div className="bg-white/80 rounded-xl p-4 mb-6 border border-purple-100">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-purple-600">Please wait and have patience.</span>
              <br />
              Your existing PRC balance is safe and can still be used for redemptions.
            </p>
          </div>
          
          <Button
            onClick={() => navigate('/rewards')}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-8 shadow-lg shadow-purple-200"
          >
            Go to Rewards
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Mining;
