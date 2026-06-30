import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  MessageCircle, Heart, Bookmark, Send, Search, Filter, Image,
  MoreVertical, Pin, Flag, Trash2, Shield, ChevronDown, Loader2,
  HelpCircle, Lightbulb, BookOpen, MessageSquare, Megaphone, Headphones,
  X, CheckCircle, Clock, AlertTriangle, ChevronLeft, Trophy, Package
} from 'lucide-react';
import SuccessStoryCard from '../components/SuccessStoryCard';
import TopRedeemersCard from '../components/TopRedeemersCard';

import { API } from "../lib/api";

const CATEGORY_ICONS = {
  'Help Request': HelpCircle,
  'Knowledge Share': BookOpen,
  'Tips & Tricks': Lightbulb,
  'General Discussion': MessageSquare,
  'Announcement': Megaphone,
  'Support': Headphones,
  'Success Story': Trophy,
  'Product Delivery': Package
};

const CATEGORY_COLORS = {
  'Help Request': 'bg-orange-100 text-orange-700 border-orange-200',
  'Knowledge Share': 'bg-blue-100 text-blue-700 border-blue-200',
  'Tips & Tricks': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'General Discussion': 'bg-slate-100 text-slate-700 border-slate-200',
  'Announcement': 'bg-purple-100 text-purple-700 border-purple-200',
  'Support': 'bg-rose-100 text-rose-700 border-rose-200',
  'Success Story': 'bg-amber-100 text-amber-700 border-amber-200',
  'Product Delivery': 'bg-teal-100 text-teal-700 border-teal-200'
};

const CommunityPage = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [timeFilter, setTimeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});
  const [trending, setTrending] = useState([]);
  const [viewMode, setViewMode] = useState('feed'); // feed, my_posts, bookmarks, trending

  // Create post
  const [showCreate, setShowCreate] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'General Discussion' });
  const [postImage, setPostImage] = useState(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef(null);

  // Post detail
  const [selectedPost, setSelectedPost] = useState(null);
  const [postDetail, setPostDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  // Menu
  const [menuOpen, setMenuOpen] = useState(null);
  // Edit post
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const [userStats, setUserStats] = useState(null);

  // Profile view
  const [profileData, setProfileData] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);

  const token = localStorage.getItem('token');
  const paras_user = JSON.parse(localStorage.getItem('paras_user') || '{}');
  const headers = { Authorization: `Bearer ${token || paras_user?.token}` };
  const currentUserId = user?.uid || paras_user?.uid;
  const currentUserName = user?.name || paras_user?.name || 'User';

  const categories = ['All', '🎉 Wins', '🚚 Product Delivery', 'Help Request', 'Knowledge Share', 'Tips & Tricks', 'General Discussion', 'Announcement', 'Support'];

  const fetchPosts = useCallback(async (append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const params = new URLSearchParams({ page, limit: 20, sort: sortBy });
      if (activeCategory !== 'All') {
        // Chip → backend category mapping. New "🚚 Product Delivery" chip
        // maps to backend `Product Delivery` (auto-generated when admin
        // marks a Mall booking as delivered).
        let mapped = activeCategory;
        if (activeCategory === '🎉 Wins') mapped = 'Success Story';
        else if (activeCategory === '🚚 Product Delivery') mapped = 'Product Delivery';
        params.append('category', mapped);
      }
      if (searchQuery) params.append('search', searchQuery);
      if (currentUserId) params.append('user_id', currentUserId);
      if (timeFilter) params.append('time_filter', timeFilter);
      if (viewMode === 'my_posts') params.append('author_id', currentUserId);

      const res = await axios.get(`${API}/community/posts?${params}`, { headers });
      const newPosts = res.data?.posts || [];
      if (append) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.post_id));
          return [...prev, ...newPosts.filter(p => !existingIds.has(p.post_id))];
        });
      } else {
        setPosts(newPosts);
      }
      setTotalPages(res.data?.pages || 1);
    } catch { toast.error('Failed to load posts'); }
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, activeCategory, searchQuery, sortBy, timeFilter, viewMode]);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, userRes, trendRes] = await Promise.all([
        axios.get(`${API}/community/stats`, { headers }),
        currentUserId ? axios.get(`${API}/community/user/${currentUserId}/stats`, { headers }) : Promise.resolve({ data: null }),
        axios.get(`${API}/community/trending?limit=5`, { headers })
      ]);
      setStats(statsRes.data || {});
      setUserStats(userRes.data);
      setTrending(trendRes.data?.trending || []);
    } catch {}
  }, [currentUserId]);

  useEffect(() => { fetchPosts(page > 1); }, [fetchPosts, page]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Infinite scroll: auto-trigger Load More when sentinel enters viewport
  const loadMoreRef = useRef(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    if (loading || loadingMore) return;
    if (page >= totalPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, page, totalPages, posts.length]);

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) { toast.error('Title and content required'); return; }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/community/posts/create`, {
        user_id: currentUserId,
        user_name: currentUserName,
        category: newPost.category,
        title: newPost.title,
        content: newPost.content
      }, { headers });

      if (res.data?.success && postImage) {
        const formData = new FormData();
        formData.append('file', postImage);
        await axios.post(`${API}/community/posts/${res.data.post.post_id}/upload-image`, formData, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Post created!');
      setNewPost({ title: '', content: '', category: 'General Discussion' });
      setPostImage(null);
      setShowCreate(false);
      fetchPosts();
      fetchStats();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create post'); }
    finally { setCreating(false); }
  };

  const handleLike = async (postId, e) => {
    e?.stopPropagation();
    try {
      const res = await axios.post(`${API}/community/posts/${postId}/like`, { user_id: currentUserId }, { headers });
      setPosts(prev => prev.map(p => p.post_id === postId ? {
        ...p, like_count: p.like_count + (res.data?.liked ? 1 : -1), user_liked: res.data?.liked
      } : p));
      if (postDetail?.post?.post_id === postId) {
        setPostDetail(prev => ({ ...prev, post: { ...prev.post, like_count: prev.post.like_count + (res.data?.liked ? 1 : -1), user_liked: res.data?.liked } }));
      }
    } catch {}
  };

  const handleBookmark = async (postId, e) => {
    e?.stopPropagation();
    try {
      const res = await axios.post(`${API}/community/posts/${postId}/bookmark`, { user_id: currentUserId }, { headers });
      setPosts(prev => prev.map(p => p.post_id === postId ? { ...p, user_bookmarked: res.data?.bookmarked } : p));
    } catch {}
  };

  const openPostDetail = async (postId) => {
    setLoadingDetail(true);
    setSelectedPost(postId);
    try {
      const res = await axios.get(`${API}/community/posts/${postId}?user_id=${currentUserId}`, { headers });
      setPostDetail(res.data);
      // Track view
      axios.post(`${API}/community/posts/${postId}/view`, {}, { headers }).catch(() => {});
    } catch { toast.error('Failed to load post'); }
    finally { setLoadingDetail(false); }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setCommenting(true);
    try {
      await axios.post(`${API}/community/posts/${selectedPost}/comment`, {
        user_id: currentUserId,
        user_name: currentUserName,
        content: newComment,
        parent_comment_id: replyTo?.comment_id || null
      }, { headers });
      setNewComment('');
      setReplyTo(null);
      openPostDetail(selectedPost);
      fetchPosts();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setCommenting(false); }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API}/community/posts/${postId}`, { data: { user_id: currentUserId }, headers });
      toast.success('Post deleted');
      setSelectedPost(null);
      fetchPosts();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleReport = async (postId) => {
    try {
      await axios.post(`${API}/community/posts/${postId}/report`, { user_id: currentUserId, reason: 'Inappropriate content' }, { headers });
      toast.success('Post reported');
    } catch (err) { toast.error(err.response?.data?.detail || 'Already reported'); }
  };

  const handleEditPost = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    try {
      await axios.put(`${API}/community/posts/${selectedPost}`, {
        user_id: currentUserId, title: editTitle, content: editContent
      }, { headers });
      toast.success('Post updated');
      setEditingPost(false);
      openPostDetail(selectedPost);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to edit'); }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(`${API}/community/comments/${commentId}`, { data: { user_id: currentUserId }, headers });
      toast.success('Comment deleted');
      openPostDetail(selectedPost);
      fetchPosts();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleCommentLike = async (commentId) => {
    try {
      await axios.post(`${API}/community/comments/${commentId}/like`, { user_id: currentUserId }, { headers });
      openPostDetail(selectedPost);
    } catch {}
  };

  const handleSharePost = (postId) => {
    const url = `${window.location.origin}/community?post=${postId}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => toast.error('Failed to copy'));
  };

  const openProfile = async (userId) => {
    try {
      const res = await axios.get(`${API}/community/profile/${userId}`, { headers });
      setProfileData(res.data);
      setViewingProfile(userId);
    } catch { toast.error('Failed to load profile'); }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const PostCard = ({ post }) => {
    const CatIcon = CATEGORY_ICONS[post.category] || MessageSquare;
    const catColor = CATEGORY_COLORS[post.category] || CATEGORY_COLORS['General Discussion'];
    return (
      <div
        onClick={() => openPostDetail(post.post_id)}
        className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all"
        data-testid={`post-${post.post_id}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold">
              {post.user_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 hover:text-blue-600 cursor-pointer inline-flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); openProfile(post.user_id); }}>
                <span>{post.user_name}</span>
                {post.user_total_redeemed_inr > 0 && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                    title={`Lifetime redeemed: ₹${post.user_total_redeemed_inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    data-testid={`post-lifetime-${post.post_id}`}
                  >
                    ₹{post.user_total_redeemed_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-400">{timeAgo(post.created_at)} {post.view_count > 0 ? `· ${post.view_count} views` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {post.is_pinned && <Pin className="w-3.5 h-3.5 text-purple-500" />}
            {post.is_helpful && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${catColor}`}>
              <CatIcon className="w-3 h-3 inline mr-0.5" />{post.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <h3 className="font-semibold text-slate-900 text-sm mb-1">
          {post.title}
          {post.is_edited && <span className="text-[10px] text-slate-400 font-normal ml-1">(edited)</span>}
        </h3>
        <p className="text-slate-600 text-xs line-clamp-3 mb-2">{post.content}</p>

        {/* Image */}
        {post.image_url && (
          <div className="mb-2 rounded-lg overflow-hidden border border-slate-100">
            <img src={`${API.replace('/api', '')}${post.image_url}`} alt="" className="w-full max-h-48 object-cover" />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <button onClick={(e) => handleLike(post.post_id, e)} className={`flex items-center gap-1 text-xs ${post.user_liked ? 'text-red-500' : 'text-slate-400 hover:text-red-400'}`}>
            <Heart className={`w-3.5 h-3.5 ${post.user_liked ? 'fill-current' : ''}`} />{post.like_count || 0}
          </button>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <MessageCircle className="w-3.5 h-3.5" />{post.comment_count || 0}
          </span>
          <button onClick={(e) => handleBookmark(post.post_id, e)} className={`flex items-center gap-1 text-xs ${post.user_bookmarked ? 'text-blue-500' : 'text-slate-400 hover:text-blue-400'}`}>
            <Bookmark className={`w-3.5 h-3.5 ${post.user_bookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    );
  };

  // Post Detail View
  if (selectedPost) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 pt-16" data-testid="post-detail-view">
        <button onClick={() => { setSelectedPost(null); setPostDetail(null); }} className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to Community
        </button>

        {loadingDetail ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : postDetail?.post ? (
          <div className="space-y-4">
            {/* Post */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-bold">
                    {postDetail.post.user_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 inline-flex items-center gap-2">
                      <span>{postDetail.post.user_name}</span>
                      {postDetail.post.user_total_redeemed_inr > 0 && (
                        <span
                          className="px-1.5 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title={`Lifetime redeemed: ₹${postDetail.post.user_total_redeemed_inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                          data-testid="post-detail-lifetime"
                        >
                          ₹{postDetail.post.user_total_redeemed_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">{timeAgo(postDetail.post.created_at)} | {postDetail.post.category}</p>
                  </div>
                </div>
                <div className="relative">
                  <button onClick={() => setMenuOpen(menuOpen ? null : 'post')} className="p-1 hover:bg-slate-100 rounded"><MoreVertical className="w-4 h-4 text-slate-400" /></button>
                  {menuOpen === 'post' && (
                    <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 w-40">
                      {postDetail.post.user_id === currentUserId && (
                        <button onClick={() => { setEditingPost(true); setEditTitle(postDetail.post.title); setEditContent(postDetail.post.content); setMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5" />Edit</button>
                      )}
                      <button onClick={() => { handleReport(postDetail.post.post_id); setMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Flag className="w-3.5 h-3.5" />Report</button>
                      {(postDetail.post.user_id === currentUserId || userStats?.is_moderator) && (
                        <button onClick={() => { handleDelete(postDetail.post.post_id); setMenuOpen(null); }} className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <h2 className="text-lg font-bold text-slate-900 mb-2">
                {postDetail.post.title}
                {postDetail.post.is_edited && <span className="text-xs text-slate-400 font-normal ml-1">(edited)</span>}
              </h2>
              
              {editingPost ? (
                <div className="space-y-2 mb-3">
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" />
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white resize-none" />
                  <div className="flex gap-2">
                    <button onClick={handleEditPost} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs">Save</button>
                    <button onClick={() => setEditingPost(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-700 text-sm whitespace-pre-wrap mb-3">{postDetail.post.content}</p>
              )}

              {postDetail.post.image_url && (
                <div className="mb-3 rounded-lg overflow-hidden border border-slate-100">
                  <img src={`${API.replace('/api', '')}${postDetail.post.image_url}`} alt="" className="w-full max-h-96 object-contain bg-slate-50" />
                </div>
              )}

              <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                <button onClick={(e) => handleLike(postDetail.post.post_id, e)} className={`flex items-center gap-1.5 text-sm ${postDetail.post.user_liked ? 'text-red-500' : 'text-slate-500 hover:text-red-400'}`}>
                  <Heart className={`w-4 h-4 ${postDetail.post.user_liked ? 'fill-current' : ''}`} />{postDetail.post.like_count || 0} Likes
                </button>
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MessageCircle className="w-4 h-4" />{postDetail.post.comment_count || 0} Comments
                </span>
                <button onClick={(e) => handleBookmark(postDetail.post.post_id, e)} className={`flex items-center gap-1.5 text-sm ${postDetail.post.user_bookmarked ? 'text-blue-500' : 'text-slate-500 hover:text-blue-400'}`}>
                  <Bookmark className={`w-4 h-4 ${postDetail.post.user_bookmarked ? 'fill-current' : ''}`} />Save
                </button>
                <button onClick={() => handleSharePost(postDetail.post.post_id)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                  <Send className="w-4 h-4" />Share
                </button>
                {postDetail.post.view_count > 0 && (
                  <span className="text-sm text-slate-400 ml-auto">{postDetail.post.view_count} views</span>
                )}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Comments ({postDetail.comments?.length || 0})</h3>

              {/* Comment Input */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-1 px-2 py-1 bg-blue-50 rounded text-xs text-blue-600">
                      Replying to {replyTo.user_name}
                      <button onClick={() => setReplyTo(null)}><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                    placeholder="Write a comment..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                    data-testid="comment-input"
                  />
                </div>
                <button onClick={handleComment} disabled={commenting || !newComment.trim()} className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {commenting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>

              {/* Comment List */}
              <div className="space-y-3">
                {(postDetail.comments || []).filter(c => !c.parent_comment_id).map(comment => (
                  <div key={comment.comment_id} className="group">
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold flex-shrink-0">
                        {comment.user_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-xs font-medium text-slate-900">{comment.user_name}</p>
                          <p className="text-xs text-slate-700">{comment.content}</p>
                        </div>
                        <div className="flex gap-3 mt-0.5 px-1">
                          <span className="text-[10px] text-slate-400">{timeAgo(comment.created_at)}</span>
                          <button onClick={() => handleCommentLike(comment.comment_id)} className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-0.5">
                            <Heart className="w-3 h-3" />{comment.like_count || 0}
                          </button>
                          <button onClick={() => setReplyTo(comment)} className="text-[10px] text-blue-500 hover:underline">Reply</button>
                          {(comment.user_id === currentUserId || userStats?.is_moderator) && (
                            <button onClick={() => handleDeleteComment(comment.comment_id)} data-testid={`delete-comment-${comment.comment_id}`} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-0.5">
                              <Trash2 className="w-3 h-3" />Delete
                            </button>
                          )}
                        </div>
                        {/* Nested replies */}
                        {(postDetail.comments || []).filter(c => c.parent_comment_id === comment.comment_id).map(reply => (
                          <div key={reply.comment_id} className="flex gap-2 mt-2 ml-4">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[9px] font-bold flex-shrink-0">
                              {reply.user_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-1.5 flex-1">
                              <p className="text-[10px] font-medium text-slate-900">{reply.user_name}</p>
                              <p className="text-[10px] text-slate-700">{reply.content}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-slate-400">{timeAgo(reply.created_at)}</span>
                                {(reply.user_id === currentUserId || userStats?.is_moderator) && (
                                  <button onClick={() => handleDeleteComment(reply.comment_id)} data-testid={`delete-reply-${reply.comment_id}`} className="text-[9px] text-slate-400 hover:text-red-500 flex items-center gap-0.5">
                                    <Trash2 className="w-2.5 h-2.5" />Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {(!postDetail.comments || postDetail.comments.length === 0) && (
                  <p className="text-center text-slate-400 text-sm py-4">No comments yet. Be the first!</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pt-16 space-y-4" data-testid="community-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community</h1>
          <p className="text-slate-500 text-sm">Help each other, share knowledge, grow together</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
          data-testid="create-post-btn"
        >
          + New Post
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              activeCategory === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
            data-testid={`cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Top Redeemers Leaderboard (pinned - builds community trust) */}
      <TopRedeemersCard compact limit={50} />

      {/* View Mode Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'feed', label: 'Feed' },
          { id: 'trending', label: 'Trending' },
          { id: 'my_posts', label: 'My Posts' },
          { id: 'bookmarks', label: 'Saved' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setViewMode(tab.id); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              viewMode === tab.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Sort + Time Filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[150px] relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchPosts()}
            placeholder="Search posts..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
            data-testid="search-input"
          />
        </div>
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
          <option value="latest">Latest</option>
          <option value="popular">Most Liked</option>
          <option value="most_commented">Most Commented</option>
          <option value="most_viewed">Most Viewed</option>
          <option value="helpful">Helpful</option>
          <option value="oldest">Oldest</option>
        </select>
        <select value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white">
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Create Post Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()} data-testid="create-post-modal">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Create Post</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <select value={newPost.category} onChange={e => setNewPost(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="post-category">
              {categories.filter(c => c !== 'All' && c !== '🎉 Wins').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white" data-testid="post-title" />
            <textarea value={newPost.content} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))} placeholder="Share your thoughts..." rows={5} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white resize-none" data-testid="post-content" />
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={e => setPostImage(e.target.files?.[0])} />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
                <Image className="w-3.5 h-3.5" />{postImage ? postImage.name : 'Add Image'}
              </button>
              {postImage && <button onClick={() => setPostImage(null)} className="text-xs text-red-500">Remove</button>}
            </div>
            <button onClick={handleCreatePost} disabled={creating} className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50" data-testid="submit-post">
              {creating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {viewingProfile && profileData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingProfile(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900">Community Profile</h2>
              <button onClick={() => setViewingProfile(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xl font-bold mx-auto mb-2">
                {profileData.profile?.name?.charAt(0)?.toUpperCase()}
              </div>
              <p className="font-bold text-slate-900">{profileData.profile?.name}</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 text-purple-700">{profileData.profile?.plan?.toUpperCase()}</span>
                {profileData.profile?.is_moderator && <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-700">MODERATOR</span>}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900">{profileData.profile?.post_count || 0}</p>
                <p className="text-[10px] text-slate-400">Posts</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900">{profileData.profile?.comment_count || 0}</p>
                <p className="text-[10px] text-slate-400">Comments</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900">{profileData.profile?.total_likes_received || 0}</p>
                <p className="text-[10px] text-slate-400">Likes</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-600">{profileData.profile?.helpful_count || 0}</p>
                <p className="text-[10px] text-slate-400">Helpful</p>
              </div>
            </div>
            {profileData.posts?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Recent Posts</p>
                <div className="space-y-2">
                  {profileData.posts.slice(0, 5).map(p => (
                    <div key={p.post_id} onClick={() => { setViewingProfile(null); openPostDetail(p.post_id); }} className="p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">{p.title}</p>
                      <p className="text-[10px] text-slate-400">{timeAgo(p.created_at)} · {p.like_count} likes · {p.comment_count} comments</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Posts Feed */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : viewMode === 'trending' ? (
        trending.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No trending posts yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-500">Trending this week</p>
            {trending.map(post => (
              post.category === 'Success Story' ? (
                <SuccessStoryCard
                  key={post.post_id}
                  post={post}
                  currentUserId={currentUserId}
                  onClick={openPostDetail}
                />
              ) : (
                <PostCard key={post.post_id} post={post} />
              )
            ))}
          </div>
        )
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No posts yet</p>
          <p className="text-slate-400 text-sm">Be the first to start a discussion!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            post.category === 'Success Story' ? (
              <SuccessStoryCard
                key={post.post_id}
                post={post}
                currentUserId={currentUserId}
                onClick={openPostDetail}
              />
            ) : (
              <PostCard key={post.post_id} post={post} />
            )
          ))}
        </div>
      )}

      {/* Load More / Infinite Scroll */}
      {page < totalPages && (
        <div ref={loadMoreRef} className="flex justify-center pt-4" data-testid="load-more-sentinel">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading more wins...
            </div>
          ) : (
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-5 py-2 rounded-full text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              data-testid="load-more-btn"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
