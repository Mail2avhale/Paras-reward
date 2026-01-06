import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Settings, X, Check } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Dashboard Card Customizer
 * Allows users to reorder and toggle visibility of dashboard cards
 */
const DashboardCustomizer = ({ 
  userId, 
  isOpen, 
  onClose, 
  onLayoutChange,
  currentLayout,
  translations = {}
}) => {
  const [layout, setLayout] = useState([]);
  const [saving, setSaving] = useState(false);

  const t = (key) => translations[key] || defaultTranslations[key] || key;

  const defaultTranslations = {
    customizeDashboard: 'Customize Dashboard',
    dragToReorder: 'Drag to reorder cards',
    showHide: 'Toggle visibility',
    save: 'Save Layout',
    cancel: 'Cancel',
    reset: 'Reset to Default'
  };

  const cardLabels = {
    prc_balance: { label: 'PRC Balance', icon: '💰' },
    live_transparency: { label: 'Live Stats Panel', icon: '📊' },
    smart_insights: { label: 'Smart Insights', icon: '💡' },
    stats_cards: { label: 'Stats Cards', icon: '📈' },
    quick_actions: { label: 'Quick Actions', icon: '⚡' },
    security_center: { label: 'Security Center', icon: '🛡️' },
    user_controls: { label: 'User Controls', icon: '⚙️' },
    statement_export: { label: 'Statement Export', icon: '📄' },
    live_activity: { label: 'Live Activity Feed', icon: '🔔' }
  };

  const defaultLayout = [
    { id: 'prc_balance', visible: true, order: 0 },
    { id: 'live_transparency', visible: true, order: 1 },
    { id: 'smart_insights', visible: true, order: 2 },
    { id: 'stats_cards', visible: true, order: 3 },
    { id: 'quick_actions', visible: true, order: 4 },
    { id: 'security_center', visible: true, order: 5 },
    { id: 'user_controls', visible: true, order: 6 },
    { id: 'statement_export', visible: true, order: 7 },
    { id: 'live_activity', visible: true, order: 8 }
  ];

  useEffect(() => {
    if (currentLayout && currentLayout.length > 0) {
      setLayout(currentLayout);
    } else {
      fetchLayout();
    }
  }, [currentLayout]);

  const fetchLayout = async () => {
    try {
      const response = await axios.get(`${API}/api/user/dashboard-layout/${userId}`);
      if (response.data?.layout?.length > 0) {
        setLayout(response.data.layout);
      } else {
        setLayout(defaultLayout);
      }
    } catch (error) {
      setLayout(defaultLayout);
    }
  };

  const handleReorder = (newOrder) => {
    const updatedLayout = newOrder.map((item, index) => ({
      ...item,
      order: index
    }));
    setLayout(updatedLayout);
  };

  const toggleVisibility = (cardId) => {
    setLayout(prev => prev.map(card => 
      card.id === cardId ? { ...card, visible: !card.visible } : card
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/user/dashboard-layout/${userId}`, { layout });
      onLayoutChange(layout);
      toast.success('Dashboard layout saved!');
      onClose();
    } catch (error) {
      toast.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLayout(defaultLayout);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <h2 className="font-bold text-lg">{t('customizeDashboard')}</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-white/80 mt-1">{t('dragToReorder')}</p>
        </div>

        {/* Card List */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <Reorder.Group axis="y" values={layout} onReorder={handleReorder} className="space-y-2">
            {layout.map((card) => (
              <Reorder.Item
                key={card.id}
                value={card}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing transition-colors ${
                  card.visible 
                    ? 'bg-white border-purple-200 hover:border-purple-400' 
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                {/* Drag Handle */}
                <GripVertical className="w-5 h-5 text-gray-400" />

                {/* Card Icon & Label */}
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-lg">{cardLabels[card.id]?.icon || '📦'}</span>
                  <span className={`font-medium ${card.visible ? 'text-gray-800' : 'text-gray-400'}`}>
                    {cardLabels[card.id]?.label || card.id}
                  </span>
                </div>

                {/* Visibility Toggle */}
                <button
                  onClick={() => toggleVisibility(card.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    card.visible 
                      ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {card.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {t('reset')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {t('save')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DashboardCustomizer;
