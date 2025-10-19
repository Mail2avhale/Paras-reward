import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Phone, Mail, MessageSquare } from 'lucide-react';

const ContactUs = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="text-xl font-bold text-gray-900">PARAS REWARD</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Contact Us</h1>
          <p className="text-xl text-gray-600">We'd love to hear from you!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Information */}
          <Card className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Get in Touch</h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Office Address</h3>
                  <p className="text-gray-600">
                    PARAS REWARD<br />
                    Maharashtra, India
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Phone / WhatsApp</h3>
                  <p className="text-gray-600">+91-XXXXXXXXXX</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                  <p className="text-gray-600">support@parasreward.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-6 w-6 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Website</h3>
                  <p className="text-gray-600">www.parasreward.com</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Support Information */}
          <Card className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-8 rounded-3xl shadow-2xl">
            <h2 className="text-3xl font-bold mb-6">Customer Support</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">In-App Support</h3>
                <p className="opacity-90">
                  For support and queries, users can raise a ticket via the in-app Customer Service section.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Response Time</h3>
                <p className="opacity-90">
                  We aim to respond to all queries within 24-48 hours.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Common Queries</h3>
                <ul className="space-y-2 opacity-90">
                  <li>• Mining & Rewards</li>
                  <li>• VIP Membership</li>
                  <li>• KYC Verification</li>
                  <li>• Product Redemption</li>
                  <li>• Wallet Withdrawals</li>
                  <li>• Technical Issues</li>
                </ul>
              </div>

              <div className="pt-6 border-t border-white/20">
                <p className="text-sm opacity-90">
                  For urgent matters, please contact us directly via phone or email.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="mt-12 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Quick Links</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/about">
              <Button variant="outline" className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50">
                About Us
              </Button>
            </Link>
            <Link to="/terms">
              <Button variant="outline" className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50">
                Terms & Conditions
              </Button>
            </Link>
            <Link to="/privacy">
              <Button variant="outline" className="border-2 border-purple-600 text-purple-600 hover:bg-purple-50">
                Privacy Policy
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;