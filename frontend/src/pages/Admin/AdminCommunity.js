import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  MessageCircle, Pin, PinOff, Trash2, Eye, Heart, MessageSquare,
  Search, Loader2, Ban, UserCheck, AlertTriangle, Shield, UserX,
  Filter, RefreshCw, X, Clock, User, Flag
} from 'lucide-react';

import { API } from "../../lib/api";

const AdminCommunity = () => {
  const admin = JSON.parse(localStorage.getItem('paras_user') || '{}');
  const adminId = admin?.uid || admin?.user_id || admin?.id;

  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(false);

  // Posts state
  const [posts, setPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('latest');
  const [categories, setCategories] = useState([]);

  // Reports state
  const [reports, setReports] = useState([]);
  const [reportStatus, setReportStatus] = useState('pending');

  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState([]);

  // Moderators state
  const [moderators, setModerators] = useState([]);
  const [modUserId, setModUserId] = useState('');

  // Post detail
  const [viewPost, setViewPost] = useState(null);
  const [postDetail, setPostDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total_posts: 0, pending_reports: 0, blocked_users: 0, moderators: 0 });

  /* -------------------- Fetchers -------------------- */
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page), limit: '20', sort,
        ...(category !== 'All' && { category }),
        ...(searchQuery && { search: searchQuery })
      });
      const res = await axios.get(`${API}/community/posts?${params}`);
      setPosts(res.data?.posts || []);
      setTotalPosts(res.data?.total || 0);
    } catch (e) {
      toast.error('Failed to load posts');
    } finally { setLoading(false); }
  }, [page, sort, category, searchQuery]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/community/categories`);
      setCategories(['All', ...(res.data?.categories || [])]);
    } catch {}
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/community/mod/reports?status=${reportStatus}`);
      setReports(res.data?.reports || []);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, [reportStatus]);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/community/mod/blocked-users`);
      setBlockedUsers(res.data?.blocked_users || []);
    } catch { toast.error('Failed to load blocked users'); }
    finally { setLoading(false); }
  }, []);

  const fetchModerators = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/community/mod/list`);
      setModerators(res.data?.moderators || []);
    } catch { toast.error('Failed to load moderators'); }
    finally { setLoading(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [pRes, rRes, bRes, mRes] = await Promise.all([
        axios.get(`${API}/community/posts?limit=1`),
        axios.get(`${API}/community/mod/reports?status=pending`),
        axios.get(`${API}/community/mod/blocked-users`),
        axios.get(`${API}/community/mod/list`)
      ]);
      setStats({
        total_posts: pRes.data?.total || 0,
        pending_reports: rRes.data?.reports?.length || 0,
        blocked_users: bRes.data?.blocked_users?.length || 0,
        moderators: mRes.data?.moderators?.length || 0
      });
    } catch {}
  }, []);

  /* -------------------- Effects -------------------- */
  useEffect(() => { fetchCategories(); fetchStats(); }, [fetchCategories, fetchStats]);

  useEffect(() => {
    if (activeTab === 'posts') fetchPosts();
    else if (activeTab === 'reports') fetchReports();
    else if (activeTab === 'blocked') fetchBlockedUsers();
    else if (activeTab === 'moderators') fetchModerators();
  }, [activeTab, fetchPosts, fetchReports, fetchBlockedUsers, fetchModerators]);

  /* -------------------- Actions -------------------- */
  const togglePin = async (postId) => {
    try {
      const res = await axios.post(`${API}/community/posts/${postId}/pin`, { user_id: adminId });
      toast.success(res.data?.is_pinned ? 'Post pinned' : 'Post unpinned');
      fetchPosts();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to pin'); }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await axios.delete(`${API}/community/posts/${postId}`, { data: { user_id: adminId } });
      toast.success('Post deleted');
      fetchPosts();
      setViewPost(null);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to delete'); }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(`${API}/community/comments/${commentId}`, { data: { user_id: adminId } });
      toast.success('Comment deleted');
      if (viewPost) openPostDetail(viewPost);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const openPostDetail = async (post) => {
    setViewPost(post);
    setLoadingDetail(true);
    try {
      const res = await axios.get(`${API}/community/posts/${post.post_id}`);
      setPostDetail(res.data);
    } catch { toast.error('Failed to load post detail'); }
    finally { setLoadingDetail(false); }
  };

  const blockUser = async (userId, reason = 'Community guidelines violation') => {
    if (!window.confirm(`Block user ${userId} from community?`)) return;
    try {
      await axios.post(`${API}/community/mod/block-user`, { mod_id: adminId, user_id: userId, reason });
      toast.success('User blocked');
      fetchBlockedUsers();
      fetchStats();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to block'); }
  };

  const unblockUser = async (userId) => {
    try {
      await axios.post(`${API}/community/mod/unblock-user`, { mod_id: adminId, user_id: userId });
      toast.success('User unblocked');
      fetchBlockedUsers();
      fetchStats();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const addModerator = async () => {
    if (!modUserId) return toast.error('Enter user UID');
    try {
      await axios.post(`${API}/community/mod/add`, { admin_id: adminId, user_id: modUserId });
      toast.success('Moderator added');
      setModUserId('');
      fetchModerators();
      fetchStats();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const removeModerator = async (userId) => {
    if (!window.confirm('Remove moderator privileges?')) return;
    try {
      await axios.post(`${API}/community/mod/remove`, { admin_id: adminId, user_id: userId });
      toast.success('Moderator removed');
      fetchModerators();
      fetchStats();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const resolveReport = async (postId, action) => {
    const msg = action === 'delete_post' ? 'Delete this post?' : action === 'block_user' ? 'Block author AND delete post?' : 'Dismiss this report?';
    if (!window.confirm(msg)) return;
    try {
      await axios.post(`${API}/community/mod/resolve-report`, { mod_id: adminId, post_id: postId, action });
      toast.success('Report resolved');
      fetchReports();
      fetchStats();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  /* -------------------- Render -------------------- */
  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Community Forum Management</h1>
              <p className="text-xs text-slate-500">Moderate posts, reports, users & moderators</p>
            </div>
          </div>
          <button
            onClick={() => { fetchStats(); if (activeTab === 'posts') fetchPosts(); else if (activeTab === 'reports') fetchReports(); else if (activeTab === 'blocked') fetchBlockedUsers(); else fetchModerators(); }}
            data-testid="refresh-btn"
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={MessageCircle} label="Total Posts" value={stats.total_posts} color="rose" />
          <StatCard icon={Flag} label="Pending Reports" value={stats.pending_reports} color="amber" highlight={stats.pending_reports > 0} />
          <StatCard icon={Ban} label="Blocked Users" value={stats.blocked_users} color="red" />
          <StatCard icon={Shield} label="Moderators" value={stats.moderators} color="emerald" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 overflow-x-auto">
          {[
            { id: 'posts', label: 'All Posts', icon: MessageCircle },
            { id: 'reports', label: `Reports${stats.pending_reports ? ` (${stats.pending_reports})` : ''}`, icon: Flag },
            { id: 'blocked', label: 'Blocked Users', icon: Ban },
            { id: 'moderators', label: 'Moderators', icon: Shield }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === t.id ? 'bg-slate-200 text-white' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          {activeTab === 'posts' && (
            <PostsTab
              posts={posts} loading={loading} totalPosts={totalPosts} page={page} setPage={setPage}
              categories={categories} category={category} setCategory={setCategory}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              sort={sort} setSort={setSort}
              onView={openPostDetail} onPin={togglePin} onDelete={deletePost} onBlock={blockUser}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsTab reports={reports} loading={loading} reportStatus={reportStatus} setReportStatus={setReportStatus} onResolve={resolveReport} />
          )}
          {activeTab === 'blocked' && (
            <BlockedTab blockedUsers={blockedUsers} loading={loading} onUnblock={unblockUser} />
          )}
          {activeTab === 'moderators' && (
            <ModeratorsTab moderators={moderators} loading={loading} modUserId={modUserId} setModUserId={setModUserId} onAdd={addModerator} onRemove={removeModerator} />
          )}
        </div>
      </div>

      {/* Post Detail Modal */}
      {viewPost && (
        <PostDetailModal
          post={viewPost} detail={postDetail} loading={loadingDetail}
          onClose={() => { setViewPost(null); setPostDetail(null); }}
          onDeleteComment={deleteComment}
          onDeletePost={() => deletePost(viewPost.post_id)}
          onPin={() => togglePin(viewPost.post_id)}
          onBlockUser={() => blockUser(viewPost.user_id)}
        />
      )}
    </div>
  );
};

/* ============================ Sub-Components ============================ */
const StatCard = ({ icon: Icon, label, value, color, highlight }) => {
  const colors = {
    rose: 'bg-rose-500/20 text-rose-600',
    amber: 'bg-amber-500/20 text-amber-600',
    red: 'bg-red-500/20 text-red-600',
    emerald: 'bg-emerald-500/20 text-emerald-600'
  };
  return (
    <div className={`bg-slate-100 border ${highlight ? 'border-amber-500/50' : 'border-slate-200'} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-1">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
};

const PostsTab = ({ posts, loading, totalPosts, page, setPage, categories, category, setCategory, searchQuery, setSearchQuery, sort, setSort, onView, onPin, onDelete, onBlock }) => {
  const totalPages = Math.max(1, Math.ceil(totalPosts / 20));
  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900"
            data-testid="search-posts"
          />
        </div>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="filter-category">
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900" data-testid="filter-sort">
          <option value="latest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="popular">Most Liked</option>
          <option value="most_commented">Most Commented</option>
          <option value="most_viewed">Most Viewed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No posts found</div>
      ) : (
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.post_id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-slate-600 transition-colors" data-testid={`post-${p.post_id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {p.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-600" />}
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full">{p.category}</span>
                    {p.is_helpful && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 text-[10px] rounded-full">Helpful</span>}
                    {p.is_edited && <span className="text-[10px] text-slate-500">edited</span>}
                  </div>
                  <h3 className="font-semibold text-slate-900 truncate">{p.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mt-1">{p.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.user_name || p.user_id?.slice(0, 8)}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{p.like_count || 0}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{p.comment_count || 0}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{p.view_count || 0}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{p.created_at?.slice(0, 10)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onView(p)} title="View" className="p-2 text-slate-500 hover:text-white hover:bg-slate-100 rounded-lg" data-testid={`view-${p.post_id}`}>
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => onPin(p.post_id)} title={p.is_pinned ? 'Unpin' : 'Pin'} className="p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg" data-testid={`pin-${p.post_id}`}>
                    {p.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button onClick={() => onBlock(p.user_id)} title="Block Author" className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg" data-testid={`block-${p.post_id}`}>
                    <UserX className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(p.post_id)} title="Delete" className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg" data-testid={`delete-${p.post_id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-sm">Prev</button>
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-sm">Next</button>
        </div>
      )}
    </div>
  );
};

const ReportsTab = ({ reports, loading, reportStatus, setReportStatus, onResolve }) => (
  <div>
    <div className="flex gap-2 mb-4">
      {['pending', 'resolved'].map(s => (
        <button
          key={s}
          onClick={() => setReportStatus(s)}
          data-testid={`report-status-${s}`}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${reportStatus === s ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-600'}`}
        >
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </div>
    {loading ? (
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
    ) : reports.length === 0 ? (
      <div className="text-center py-12 text-slate-500">No {reportStatus} reports</div>
    ) : (
      <div className="space-y-3">
        {reports.map((r, i) => (
          <div key={r.report_id || i} className="bg-slate-50 border border-amber-500/20 rounded-lg p-4" data-testid={`report-${r.report_id || i}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-300">{r.reason || 'Reported'}</span>
                  <span className="text-xs text-slate-500">by {r.reported_by?.slice(0, 8) || 'user'}</span>
                </div>
                <h4 className="font-semibold text-slate-900">{r.post_title || '(Post unavailable)'}</h4>
                <p className="text-xs text-slate-500 mb-1">by {r.post_author}</p>
                <p className="text-sm text-slate-500 mt-1">{r.post_content}</p>
                {r.comment && <p className="text-xs text-slate-500 mt-2 italic">"{r.comment}"</p>}
                {r.action && <p className="text-xs text-emerald-600 mt-2">Resolved with: {r.action}</p>}
              </div>
              {reportStatus === 'pending' && (
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => onResolve(r.post_id, 'dismiss')} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-600 rounded-lg text-xs" data-testid={`dismiss-${r.post_id}`}>Dismiss</button>
                  <button onClick={() => onResolve(r.post_id, 'delete_post')} className="px-3 py-1.5 bg-red-500/20 text-red-600 hover:bg-red-500/30 rounded-lg text-xs" data-testid={`delete-post-${r.post_id}`}>Delete Post</button>
                  <button onClick={() => onResolve(r.post_id, 'block_user')} className="px-3 py-1.5 bg-red-600/30 text-red-300 hover:bg-red-600/40 rounded-lg text-xs" data-testid={`block-user-${r.post_id}`}>Delete + Block</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const BlockedTab = ({ blockedUsers, loading, onUnblock }) => (
  <div>
    {loading ? (
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
    ) : blockedUsers.length === 0 ? (
      <div className="text-center py-12 text-slate-500">No blocked users</div>
    ) : (
      <div className="space-y-2">
        {blockedUsers.map(u => (
          <div key={u.user_id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between" data-testid={`blocked-${u.user_id}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <Ban className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{u.user_id}</p>
                <p className="text-xs text-slate-500">{u.reason} • {u.blocked_at?.slice(0, 10)}</p>
              </div>
            </div>
            <button onClick={() => onUnblock(u.user_id)} data-testid={`unblock-${u.user_id}`} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 rounded-lg text-xs font-medium">
              <UserCheck className="w-3 h-3" /> Unblock
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ModeratorsTab = ({ moderators, loading, modUserId, setModUserId, onAdd, onRemove }) => (
  <div>
    <div className="flex gap-2 mb-4">
      <input
        type="text" value={modUserId} onChange={e => setModUserId(e.target.value)}
        placeholder="Enter User UID to promote as moderator"
        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900"
        data-testid="mod-user-input"
      />
      <button onClick={onAdd} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white" data-testid="add-mod-btn">Add Moderator</button>
    </div>
    {loading ? (
      <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
    ) : moderators.length === 0 ? (
      <div className="text-center py-12 text-slate-500">No moderators assigned</div>
    ) : (
      <div className="space-y-2">
        {moderators.map(m => (
          <div key={m.user_id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between" data-testid={`mod-${m.user_id}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{m.name || m.user_id}</p>
                <p className="text-xs text-slate-500">{m.user_id} • Since {m.created_at?.slice(0, 10)}</p>
              </div>
            </div>
            <button onClick={() => onRemove(m.user_id)} data-testid={`remove-mod-${m.user_id}`} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-600 hover:bg-red-500/30 rounded-lg text-xs font-medium">
              <X className="w-3 h-3" /> Remove
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PostDetailModal = ({ post, detail, loading, onClose, onDeleteComment, onDeletePost, onPin, onBlockUser }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="font-bold text-slate-900 truncate">{post.title}</h3>
        <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-4 overflow-y-auto flex-1">
        <div className="mb-4 flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2 py-0.5 bg-white text-slate-700 rounded-full">{post.category}</span>
          <span className="text-slate-500">by <b className="text-slate-700">{post.user_name}</b> ({post.user_id})</span>
          <span className="text-slate-500">• {post.created_at?.slice(0, 16).replace('T', ' ')}</span>
          {post.is_edited && <span className="text-amber-600">edited</span>}
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{post.content}</p>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
          <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {post.like_count || 0} likes</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> {post.comment_count || 0} comments</span>
          <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {post.view_count || 0} views</span>
        </div>

        <h4 className="font-semibold text-slate-200 mb-2">Comments ({detail?.comments?.length || 0})</h4>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
        ) : !detail?.comments?.length ? (
          <p className="text-sm text-slate-500 italic">No comments</p>
        ) : (
          <div className="space-y-2">
            {detail.comments.map(c => (
              <div key={c.comment_id} className="bg-slate-50 border border-slate-200 rounded-lg p-3" data-testid={`comment-${c.comment_id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-700">{c.user_name || c.user_id?.slice(0, 8)}</span>
                      <span className="text-[10px] text-slate-500">{c.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-700">{c.content}</p>
                  </div>
                  <button onClick={() => onDeleteComment(c.comment_id)} className="p-1 text-slate-500 hover:text-red-600" data-testid={`delete-comment-${c.comment_id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 flex-wrap">
        <button onClick={onPin} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 rounded-lg text-sm font-medium">
          {post.is_pinned ? <><PinOff className="w-4 h-4" /> Unpin</> : <><Pin className="w-4 h-4" /> Pin</>}
        </button>
        <button onClick={onBlockUser} className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/20 text-orange-600 hover:bg-orange-500/30 rounded-lg text-sm font-medium">
          <UserX className="w-4 h-4" /> Block Author
        </button>
        <button onClick={onDeletePost} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-600 hover:bg-red-500/30 rounded-lg text-sm font-medium">
          <Trash2 className="w-4 h-4" /> Delete Post
        </button>
      </div>
    </div>
  </div>
);

export default AdminCommunity;
