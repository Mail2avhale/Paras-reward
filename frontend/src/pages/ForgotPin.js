import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft, Mail, Phone, AlertCircle } from 'lucide-react';

const ForgotPin = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 bg-gradient-to-r from-orange-500 to-red-600">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Forgot PIN?
          </h1>
          <p className="text-gray-600">
            Don't worry! We'll help you reset it.
          </p>
        </div>

        {/* Contact Admin Message */}
        <div className="space-y-6">
          {/* Alert Box */}
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-2">
                  Contact Admin to Reset PIN
                </h3>
                <p className="text-sm text-amber-700 leading-relaxed">
                  Please contact our admin team with your registered email and mobile number for resetting your PIN.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl space-y-4">
            <h4 className="font-semibold text-gray-800 text-center">Contact Details</h4>
            
            {/* Email */}
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email us at</p>
                <a 
                  href="mailto:Info@parasreward.com" 
                  className="text-purple-600 font-semibold hover:underline"
                  data-testid="admin-email-link"
                >
                  Info@parasreward.com
                </a>
              </div>
            </div>

            {/* What to Include */}
            <div className="p-3 bg-white rounded-lg border border-purple-100">
              <p className="text-sm font-medium text-gray-700 mb-2">Include in your email:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                  Your registered Email ID
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                  Your registered Mobile Number
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                  Request for PIN Reset
                </li>
              </ul>
            </div>
          </div>

          {/* Response Time Notice */}
          <p className="text-center text-sm text-gray-500">
            Our team will respond within <strong>24-48 hours</strong>
          </p>

          {/* Send Email Button */}
          <a 
            href="mailto:Info@parasreward.com?subject=PIN Reset Request&body=Hello,%0D%0A%0D%0AI would like to request a PIN reset for my account.%0D%0A%0D%0ARegistered Email: %0D%0ARegistered Mobile: %0D%0A%0D%0AThank you."
            className="block"
          >
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-6 rounded-xl text-lg font-semibold"
              data-testid="send-email-btn"
            >
              <Mail className="h-5 w-5 mr-2" />
              Send Email to Admin
            </Button>
          </a>
        </div>

        {/* Back to Login */}
        <div className="mt-6 text-center border-t border-gray-200 pt-6">
          <Link to="/login" className="text-purple-600 font-medium hover:underline flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPin;
