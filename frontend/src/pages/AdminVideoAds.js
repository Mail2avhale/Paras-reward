import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Eye, Play, Youtube, Video } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VideoPlayer from '@/components/VideoPlayer';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminVideoAds = ({ user, onLogout }) => {
  const [videoAds, setVideoAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [previewAd, setPreviewAd] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    video_url: '',
    video_type: 'youtube',
    thumbnail_url: '',
    description: '',
    placement: 'homepage',
    is_active: true,
    autoplay: true,
    skippable: true,
    skip_after: 5,
    start_date: '',
    end_date: '',
    target_roles: ['user']
  });

  useEffect(() => {
    fetchVideoAds();
  }, []);

  const fetchVideoAds = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/video-ads`);
      setVideoAds(response.data.video_ads || []);
    } catch (error) {
      console.error('Error fetching video ads:', error);
      toast.error('Failed to load video ads');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingAd) {
        await axios.put(`${API}/api/admin/video-ads/${editingAd.video_ad_id}`, formData);
        toast.success('Video ad updated successfully!');
      } else {
        await axios.post(`${API}/api/admin/video-ads`, formData);
        toast.success('Video ad created successfully!');
      }
      
      fetchVideoAds();
      closeModal();
    } catch (error) {
      console.error('Error saving video ad:', error);
      toast.error(error.response?.data?.detail || 'Failed to save video ad');
    }
  };

  const handleDelete = async (videoAdId) => {
    if (!window.confirm('Are you sure you want to delete this video ad?')) return;
    
    try {
      await axios.delete(`${API}/api/admin/video-ads/${videoAdId}`);
      toast.success('Video ad deleted successfully!');
      fetchVideoAds();
    } catch (error) {
      console.error('Error deleting video ad:', error);
      toast.error('Failed to delete video ad');
    }
  };

  const openModal = (ad = null) => {
    if (ad) {
      setEditingAd(ad);
      setFormData({
        title: ad.title,
        video_url: ad.video_url,
        video_type: ad.video_type,
        thumbnail_url: ad.thumbnail_url || '',
        description: ad.description || '',
        placement: ad.placement,
        is_active: ad.is_active,
        autoplay: ad.autoplay,
        skippable: ad.skippable,
        skip_after: ad.skip_after,
        start_date: ad.start_date || '',
        end_date: ad.end_date || '',
        target_roles: ad.target_roles
      });
    } else {
      setEditingAd(null);
      setFormData({
        title: '',
        video_url: '',
        video_type: 'youtube',
        thumbnail_url: '',
        description: '',
        placement: 'homepage',
        is_active: true,
        autoplay: true,
        skippable: true,
        skip_after: 5,
        start_date: '',
        end_date: '',
        target_roles: ['user']
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAd(null);
  };

  const getPlacementBadge = (placement) => {
    const badges = {
      homepage: 'bg-blue-100 text-blue-400',
      marketplace: 'bg-green-100 text-green-400',
      pre_game: 'bg-purple-100 text-purple-400',
      dashboard: 'bg-orange-100 text-orange-400'
    };
    return badges[placement] || 'bg-gray-800 text-gray-300';
  };

  const getVideoTypeIcon = (type) => {
    switch(type) {
      case 'youtube': return <Youtube className="w-5 h-5 text-red-600" />;
      case 'vimeo': return <Video className="w-5 h-5 text-blue-600" />;
      default: return <Play className="w-5 h-5 text-purple-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-800/50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Video Advertisements</h1>
            <p className="text-gray-400 mt-1">Manage promotional videos across the platform</p>
          </div>
          <Button onClick={() => openModal()} className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Video Ad
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-400">Total Ads</div>
            <div className="text-2xl font-bold text-white mt-1">{videoAds.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-400">Active Ads</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {videoAds.filter(ad => ad.is_active).length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-400">Total Views</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {videoAds.reduce((sum, ad) => sum + (ad.views || 0), 0)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-400">Completion Rate</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {videoAds.length > 0 
                ? Math.round((videoAds.reduce((sum, ad) => sum + (ad.completions || 0), 0) / 
                    videoAds.reduce((sum, ad) => sum + (ad.views || 1), 0)) * 100)
                : 0}%
            </div>
          </Card>
        </div>

        {/* Video Ads List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading video ads...</p>
          </div>
        ) : videoAds.length === 0 ? (
          <Card className="p-12 text-center">
            <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Video Ads Yet</h3>
            <p className="text-gray-400 mb-6">Create your first video advertisement to promote products and features</p>
            <Button onClick={() => openModal()}>Create First Video Ad</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videoAds.map((ad) => (
              <Card key={ad.video_ad_id} className="overflow-hidden">
                {/* Thumbnail/Preview */}
                <div className="relative bg-gray-900 h-48">
                  {ad.thumbnail_url ? (
                    <img src={ad.thumbnail_url} alt={ad.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {getVideoTypeIcon(ad.video_type)}
                    </div>
                  )}
                  <button
                    onClick={() => setPreviewAd(ad)}
                    className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Play className="w-12 h-12 text-white" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white flex-1">{ad.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPlacementBadge(ad.placement)}`}>
                      {ad.placement}
                    </span>
                  </div>

                  {ad.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{ad.description}</p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-gray-400">
                    <div>
                      <Eye className="w-3 h-3 inline mr-1" />
                      {ad.views || 0} views
                    </div>
                    <div>✓ {ad.completions || 0}</div>
                    <div>⏩ {ad.skips || 0}</div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className={`text-xs font-medium ${ad.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {ad.is_active ? '● Active' : '● Inactive'}
                    </span>
                    
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openModal(ad)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(ad.video_ad_id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">
                  {editingAd ? 'Edit Video Ad' : 'Create New Video Ad'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Video Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Video Type *
                    </label>
                    <select
                      value={formData.video_type}
                      onChange={(e) => setFormData({...formData, video_type: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="vimeo">Vimeo</option>
                      <option value="direct">Direct URL</option>
                    </select>
                  </div>

                  {/* Video URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Video URL *
                    </label>
                    <input
                      type="url"
                      value={formData.video_url}
                      onChange={(e) => setFormData({...formData, video_url: e.target.value})}
                      placeholder={
                        formData.video_type === 'youtube' ? 'https://youtube.com/watch?v=...' :
                        formData.video_type === 'vimeo' ? 'https://vimeo.com/...' :
                        'https://example.com/video.mp4'
                      }
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  {/* Thumbnail URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Thumbnail URL (optional)
                    </label>
                    <input
                      type="url"
                      value={formData.thumbnail_url}
                      onChange={(e) => setFormData({...formData, thumbnail_url: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Placement */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Placement *
                    </label>
                    <select
                      value={formData.placement}
                      onChange={(e) => setFormData({...formData, placement: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="homepage">Homepage</option>
                      <option value="marketplace">Marketplace</option>
                      <option value="pre_game">Before Games</option>
                      <option value="dashboard">Dashboard</option>
                    </select>
                  </div>

                  {/* Settings Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Skip After (seconds)
                      </label>
                      <input
                        type="number"
                        value={formData.skip_after}
                        onChange={(e) => setFormData({...formData, skip_after: parseInt(e.target.value)})}
                        min={3}
                        max={30}
                        className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-300">Active</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.autoplay}
                          onChange={(e) => setFormData({...formData, autoplay: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-300">Autoplay</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.skippable}
                          onChange={(e) => setFormData({...formData, skippable: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-300">Skippable</span>
                      </label>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1">
                      {editingAd ? 'Update Video Ad' : 'Create Video Ad'}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeModal}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}

        {/* Preview Modal */}
        {previewAd && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="max-w-4xl w-full">
              <VideoPlayer
                videoUrl={previewAd.video_url}
                videoType={previewAd.video_type}
                thumbnail={previewAd.thumbnail_url}
                title={previewAd.title}
                autoplay={false}
                muted={false}
                skippable={previewAd.skippable}
                skipAfter={previewAd.skip_after}
                showCloseButton={true}
                onClose={() => setPreviewAd(null)}
                className="h-[70vh]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVideoAds;
