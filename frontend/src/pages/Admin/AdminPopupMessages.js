import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  MessageSquare, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2,
  Info, AlertTriangle, CheckCircle, AlertCircle, Save, X, Upload,
  ExternalLink, Youtube, ImagePlus, Trash,
} from 'lucide-react';
import { toast } from 'sonner';
import PopupEditor from '../../components/admin/PopupEditor';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Backend serves normalized 800x450 JPEGs under /api/static/popups/{fname}.
// Keep the raw URL absolute against BACKEND_URL for both dev and prod.
const absolute = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

// Extract YouTube video id from any common URL variant. Return '' if none.
const parseYtId = (url) => {
  if (!url) return '';
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
};

const emptyForm = {
  title: '',
  message_html: '',
  image_url: '',
  youtube_url: '',
  cta_buttons: [{ text: 'Close', link: '', style: 'primary' }],
  message_type: 'info',
  enabled: true,
};

const AdminPopupMessages = ({ user }) => {
  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPopup, setEditingPopup] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const authHeaders = { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchPopups(); }, []);

  const fetchPopups = async () => {
    try {
      const r = await fetch(`${API_URL}/api/admin/popup/all`, { headers: authHeaders });
      const d = await r.json();
      if (d.success) setPopups(d.data || []);
    } catch {
      toast.error('Failed to load popup messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return toast.error('Title is required');
    const plainMsg = formData.message_html.replace(/<[^>]*>/g, '').trim();
    if (!plainMsg && !formData.image_url && !formData.youtube_url) {
      return toast.error('Add at least a message body, image, or video');
    }
    // Filter out empty CTA buttons
    const ctas = formData.cta_buttons.filter((b) => b.text?.trim());
    const payload = { ...formData, cta_buttons: ctas };

    setSaving(true);
    try {
      const url = editingPopup
        ? `${API_URL}/api/admin/popup/update/${editingPopup.popup_id}`
        : `${API_URL}/api/admin/popup/create`;
      const method = editingPopup ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.success) {
        toast.success(editingPopup ? 'Popup updated!' : 'Popup created!');
        closeForm();
        fetchPopups();
      } else {
        toast.error(d.message || 'Operation failed');
      }
    } catch {
      toast.error('Failed to save popup');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (popupId) => {
    try {
      const r = await fetch(`${API_URL}/api/admin/popup/toggle/${popupId}`, { method: 'PATCH', headers: authHeaders });
      const d = await r.json();
      if (d.success) { toast.success(d.message); fetchPopups(); }
      else toast.error(d.message || 'Toggle failed');
    } catch { toast.error('Failed to toggle popup'); }
  };

  const handleDelete = async (popupId) => {
    if (!window.confirm('Delete this popup?')) return;
    try {
      const r = await fetch(`${API_URL}/api/admin/popup/delete/${popupId}`, { method: 'DELETE', headers: authHeaders });
      const d = await r.json();
      if (d.success) { toast.success('Popup deleted'); fetchPopups(); }
      else toast.error(d.message || 'Delete failed');
    } catch { toast.error('Failed to delete popup'); }
  };

  const handleEdit = (p) => {
    setEditingPopup(p);
    setFormData({
      title: p.title || '',
      message_html: p.message_html || (p.message ? `<p>${p.message.replace(/</g, '&lt;')}</p>` : ''),
      image_url: p.image_url || '',
      youtube_url: p.youtube_url || '',
      cta_buttons: (p.cta_buttons && p.cta_buttons.length)
        ? p.cta_buttons
        : [{ text: p.button_text || 'Close', link: p.button_link || '', style: 'primary' }],
      message_type: p.message_type || 'info',
      enabled: p.enabled,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPopup(null);
    setFormData(emptyForm);
  };

  const uploadImage = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Image too large (max 5 MB)');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API_URL}/api/admin/popup/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token}` },
        body: fd,
      });
      const d = await r.json();
      if (d.success) {
        setFormData((f) => ({ ...f, image_url: d.image_url }));
        toast.success(`Image uploaded (${d.compression_ratio} smaller)`);
      } else {
        toast.error(d.detail || d.message || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // CTA button helpers
  const addCTA = () => {
    if (formData.cta_buttons.length >= 3) return toast.info('Max 3 buttons per popup');
    setFormData((f) => ({ ...f, cta_buttons: [...f.cta_buttons, { text: '', link: '', style: 'secondary' }] }));
  };
  const updateCTA = (idx, patch) => {
    setFormData((f) => ({
      ...f,
      cta_buttons: f.cta_buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  };
  const removeCTA = (idx) => {
    setFormData((f) => ({ ...f, cta_buttons: f.cta_buttons.filter((_, i) => i !== idx) }));
  };

  const typeIcon = (t) => {
    const map = {
      warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      success: <CheckCircle className="w-4 h-4 text-green-500" />,
      error: <AlertCircle className="w-4 h-4 text-red-500" />,
    };
    return map[t] || <Info className="w-4 h-4 text-blue-500" />;
  };
  const typeBadge = (t) => ({
    warning: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
    success: 'bg-green-500/20 text-green-700 border-green-500/30',
    error: 'bg-red-500/20 text-red-700 border-red-500/30',
  }[t] || 'bg-blue-500/20 text-blue-700 border-blue-500/30');

  return (
    <div className="space-y-6 p-6" data-testid="admin-popup-messages-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-amber-500" />
            Popup Messages
          </h1>
          <p className="text-slate-500 mt-1">Broadcast rich messages to all users on app open</p>
        </div>
        <Button
          onClick={() => { setFormData(emptyForm); setEditingPopup(null); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-black"
          data-testid="admin-popup-new-btn"
        >
          <Plus className="w-4 h-4 mr-2" /> New Popup
        </Button>
      </div>

      {/* Create / Edit form + LIVE preview side-by-side */}
      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — form */}
          <Card className="bg-white border-slate-200" data-testid="admin-popup-form">
            <CardHeader>
              <CardTitle>{editingPopup ? 'Edit Popup' : 'Create New Popup'}</CardTitle>
              <CardDescription>Shown to all users when they open the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Big Diwali Bonus"
                    data-testid="admin-popup-title-input"
                  />
                </div>
                <div>
                  <Label>Message Type</Label>
                  <Select value={formData.message_type} onValueChange={(v) => setFormData({ ...formData, message_type: v })}>
                    <SelectTrigger data-testid="admin-popup-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info (Blue)</SelectItem>
                      <SelectItem value="success">Success (Green)</SelectItem>
                      <SelectItem value="warning">Warning (Amber)</SelectItem>
                      <SelectItem value="error">Error (Red)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Rich Message *</Label>
                <div className="mt-1">
                  <PopupEditor
                    value={formData.message_html}
                    onChange={(html) => setFormData((f) => ({ ...f, message_html: html }))}
                    placeholder="Type your announcement… use the toolbar for bold, lists, headings, and links."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Image upload */}
                <div>
                  <Label>Banner Image (optional, 16:9)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => uploadImage(e.target.files?.[0])}
                    data-testid="admin-popup-image-input"
                  />
                  {formData.image_url ? (
                    <div className="mt-1 relative rounded-lg overflow-hidden border border-slate-200 group">
                      <img
                        src={absolute(formData.image_url)}
                        alt="banner"
                        className="w-full h-32 object-cover"
                        data-testid="admin-popup-image-preview"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, image_url: '' }))}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
                        data-testid="admin-popup-image-remove"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="mt-1 w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-60"
                      data-testid="admin-popup-image-upload-btn"
                    >
                      {uploading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs">Uploading…</span></>
                      ) : (
                        <><ImagePlus className="w-5 h-5" /><span className="text-xs">Upload PNG/JPG (max 5MB)</span></>
                      )}
                    </button>
                  )}
                </div>

                {/* YouTube URL */}
                <div>
                  <Label className="flex items-center gap-1">
                    <Youtube className="w-3 h-3 text-red-500" /> YouTube Video URL (optional)
                  </Label>
                  <Input
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    placeholder="https://youtube.com/watch?v=…"
                    data-testid="admin-popup-youtube-input"
                  />
                  {formData.youtube_url && !parseYtId(formData.youtube_url) && (
                    <p className="text-xs text-red-500 mt-1">Cannot parse YouTube ID from URL</p>
                  )}
                </div>
              </div>

              {/* CTA buttons builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>CTA Buttons (max 3)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addCTA}
                    disabled={formData.cta_buttons.length >= 3}
                    data-testid="admin-popup-cta-add-btn"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.cta_buttons.map((btn, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`admin-popup-cta-row-${idx}`}>
                      <Input
                        className="col-span-4"
                        value={btn.text}
                        onChange={(e) => updateCTA(idx, { text: e.target.value })}
                        placeholder="Button text"
                        data-testid={`admin-popup-cta-text-${idx}`}
                      />
                      <Input
                        className="col-span-5"
                        value={btn.link || ''}
                        onChange={(e) => updateCTA(idx, { link: e.target.value })}
                        placeholder="https:// (optional)"
                        data-testid={`admin-popup-cta-link-${idx}`}
                      />
                      <Select value={btn.style || 'primary'} onValueChange={(v) => updateCTA(idx, { style: v })}>
                        <SelectTrigger className="col-span-2" data-testid={`admin-popup-cta-style-${idx}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                          <SelectItem value="ghost">Ghost</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="col-span-1 text-red-500"
                        onClick={() => removeCTA(idx)}
                        data-testid={`admin-popup-cta-remove-${idx}`}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, enabled: v })}
                  data-testid="admin-popup-enabled-switch"
                />
                <Label>Enable immediately (disables any other active popup)</Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600 text-black"
                  data-testid="admin-popup-save-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {editingPopup ? 'Update' : 'Create'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={closeForm}
                  data-testid="admin-popup-cancel-btn"
                >
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT — live preview */}
          <div className="lg:sticky lg:top-4 self-start">
            <Card className="bg-slate-900 border-slate-700 text-slate-100" data-testid="admin-popup-preview">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Live Preview
                </CardTitle>
                <CardDescription className="text-slate-400">Exactly as end-users will see it</CardDescription>
              </CardHeader>
              <CardContent>
                <PopupPreviewCard data={formData} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Popup list */}
      <Card>
        <CardHeader>
          <CardTitle>All Popup Messages</CardTitle>
          <CardDescription>Only one popup can be active at a time</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
          ) : popups.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>No popup messages yet</p>
              <p className="text-sm">Create one to broadcast to all users</p>
            </div>
          ) : (
            <div className="space-y-4">
              {popups.map((p) => (
                <div
                  key={p.popup_id}
                  className={`p-4 rounded-xl border ${p.enabled ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'}`}
                  data-testid={`admin-popup-row-${p.popup_id}`}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${typeBadge(p.message_type)}`}>
                          {typeIcon(p.message_type)}
                          {p.message_type}
                        </span>
                        {p.enabled && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-700 border border-green-500/30">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> ACTIVE
                          </span>
                        )}
                        {p.image_url && <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">📷 Image</span>}
                        {p.youtube_id && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">▶ Video</span>}
                        {p.cta_buttons?.length > 1 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">{p.cta_buttons.length} CTAs</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-800">{p.title}</h3>
                      <p className="text-slate-500 text-sm mt-1 line-clamp-2">{p.message}</p>
                      <p className="text-slate-400 text-xs mt-2">Updated: {p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(p.popup_id)} data-testid={`admin-popup-toggle-${p.popup_id}`}
                        className={p.enabled ? 'text-green-600' : 'text-slate-500'}>
                        {p.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(p)} className="text-blue-600" data-testid={`admin-popup-edit-${p.popup_id}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.popup_id)} className="text-red-600" data-testid={`admin-popup-delete-${p.popup_id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------
// Live-preview card — mirrors what the end-user sees in PopupMessage.js.
// Kept locally so tweaks to the preview UX don't require plumbing props.
// -----------------------------------------------------------------------
const PopupPreviewCard = ({ data }) => {
  const ytId = parseYtId(data.youtube_url);
  const typeStyles = {
    info: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    warning: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    success: 'from-green-500/20 to-green-600/10 border-green-500/30',
    error: 'from-red-500/20 to-red-600/10 border-red-500/30',
  }[data.message_type] || 'from-blue-500/20 to-blue-600/10 border-blue-500/30';

  const btnStyleCls = (style) => ({
    primary: 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-600 hover:to-amber-700',
    secondary: 'bg-white/10 text-white hover:bg-white/20 border border-white/20',
    ghost: 'text-slate-300 hover:text-white',
  }[style] || 'bg-amber-500 text-black');

  return (
    <div className={`bg-gradient-to-br ${typeStyles} border rounded-2xl overflow-hidden`}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h4 className="font-bold text-white truncate">{data.title || 'Popup Title'}</h4>
        <X className="w-4 h-4 text-slate-400" />
      </div>
      <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
        {data.image_url && (
          <img src={absolute(data.image_url)} alt="" className="w-full rounded-lg" />
        )}
        {ytId && (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
            <img
              src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent ml-1" />
              </div>
            </div>
          </div>
        )}
        <div
          className="text-slate-100 text-sm prose prose-invert prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-amber-400 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: data.message_html || '<p class="text-slate-400 italic">Message body preview…</p>' }}
        />
      </div>
      <div className="p-4 pt-3 border-t border-white/10 space-y-2 bg-black/20">
        {(data.cta_buttons?.length ? data.cta_buttons : [{ text: 'Close', style: 'primary' }])
          .filter((b) => b.text?.trim())
          .map((b, i) => (
            <button
              key={i}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 ${btnStyleCls(b.style)}`}
              type="button"
            >
              {b.text}
              {b.link && <ExternalLink className="w-3.5 h-3.5" />}
            </button>
          ))}
      </div>
    </div>
  );
};

export default AdminPopupMessages;
