import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, MapPin, Phone, Mail, Globe, MessageSquare, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ContactUs = () => {
  const navigate = useNavigate();
  const [contactDetails, setContactDetails] = useState({
    address: "PARAS REWARD\nMaharashtra, India",
    phone: "+91-XXXXXXXXXX",
    email: "support@parasreward.com",
    website: "www.parasreward.com"
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchContactDetails();
  }, []);

  const fetchContactDetails = async () => {
    try {
      const response = await axios.get(`${API}/admin/contact-settings`);
      if (response.data) {
        // Map the contact settings to the format expected by the UI
        const data = response.data;
        const fullAddress = [
          data.company_name,
          data.address_line1,
          data.address_line2,
          `${data.city}${data.city && data.state ? ', ' : ''}${data.state} ${data.pincode}`.trim(),
          data.country
        ].filter(Boolean).join('\n');
        
        setContactDetails({
          address: fullAddress || "PARAS REWARD\nMaharashtra, India",
          phone: data.phone_primary || "+91-XXXXXXXXXX",
          phone_secondary: data.phone_secondary || "",
          email: data.email_support || "support@parasreward.com",
          email_business: data.email_business || "",
          website: "www.parasreward.com",
          working_hours: data.working_hours || "9:00 AM - 6:00 PM (Mon-Sat)"
        });
      }
    } catch (error) {
      console.error('Error fetching contact details:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill all required fields');
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/contact/submit`, formData);
      toast.success('Message sent successfully!');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const contactItems = [
    {
      icon: MapPin,
      title: 'Address',
      value: contactDetails.address,
      color: 'amber'
    },
    {
      icon: Phone,
      title: 'Phone',
      value: contactDetails.phone,
      color: 'emerald'
    },
    {
      icon: Mail,
      title: 'Email',
      value: contactDetails.email,
      color: 'blue'
    },
    {
      icon: Globe,
      title: 'Website',
      value: contactDetails.website,
      color: 'purple'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">Contact Us</h1>
            <p className="text-gray-500 text-sm">We&apos;d love to hear from you!</p>
          </div>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {contactItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <div className={`w-10 h-10 rounded-xl bg-${item.color}-500/20 flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 text-${item.color}-500`} />
                </div>
                <p className="text-gray-500 text-xs mb-1">{item.title}</p>
                <p className="text-white text-sm font-medium whitespace-pre-line">{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Support Hours */}
      <div className="px-5 mb-6">
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 rounded-2xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-white font-semibold">Support Hours</p>
              <p className="text-gray-400 text-sm">Mon-Sat: 9 AM - 6 PM IST</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <div className="px-5">
        <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-white font-bold">Send us a Message</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Your Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
                placeholder="Enter your name"
                required
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
                placeholder="What's this about?"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Message *</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                rows={4}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors resize-none"
                placeholder="Write your message..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 font-bold rounded-xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
