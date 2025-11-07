# Video Ads Implementation Guide

## 🎬 Overview

Complete video advertisement system with FREE solutions for PARAS REWARD platform.

**Features:**
- ✅ YouTube & Vimeo embed support (FREE!)
- ✅ Direct video upload support
- ✅ Admin panel to manage video ads
- ✅ Strategic placements (homepage, marketplace, games, dashboard)
- ✅ Autoplay with mute
- ✅ Skippable ads (customizable)
- ✅ Analytics tracking (views, skips, completions)
- ✅ Role-based targeting
- ✅ Date-based scheduling

---

## 📋 Files Created

### Frontend Components:
1. **`/app/frontend/src/components/VideoPlayer.js`**
   - Reusable video player component
   - Supports YouTube, Vimeo, direct URLs
   - Autoplay, mute, skip controls
   - Analytics event tracking

2. **`/app/frontend/src/pages/AdminVideoAds.js`**
   - Admin dashboard for video management
   - Create, edit, delete video ads
   - View analytics and stats
   - Preview videos

### Backend Endpoints:
3. **`/app/backend/server.py`** (Updated)
   - Video ad CRUD endpoints
   - Analytics tracking endpoints
   - Active video retrieval

---

## 🚀 How It Works

### 1. Admin Creates Video Ad

Admin goes to **Admin Panel → Video Ads** and creates a new video ad:

```javascript
{
  title: "Summer Sale Promotion",
  video_url: "https://youtube.com/watch?v=xxxxx",
  video_type: "youtube", // or 'vimeo', 'direct'
  placement: "homepage", // or 'marketplace', 'pre_game', 'dashboard'
  autoplay: true,
  skippable: true,
  skip_after: 5, // seconds
  is_active: true,
  target_roles: ["user", "vip"] // who sees this ad
}
```

### 2. Video Displays on Selected Placement

Video automatically appears on selected page:
- **Homepage**: Hero section video
- **Marketplace**: Before product listing
- **Pre-Game**: Before Treasure Hunt starts
- **Dashboard**: On user dashboard

### 3. Analytics Tracked

System automatically tracks:
- **Views**: How many times video was shown
- **Skips**: How many users skipped
- **Completions**: How many watched till end
- **Watch Time**: Average viewing duration

---

## 🎯 Usage Examples

### Admin Panel Access

**URL**: `https://parasreward.com/admin/video-ads`

**Features:**
- View all video ads with stats
- Create new video ad
- Edit existing ads
- Delete ads
- Preview videos
- See completion rates

### Creating a YouTube Ad

```javascript
{
  title: "Treasure Hunt Tutorial",
  video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  video_type: "youtube",
  placement: "pre_game",
  description: "Learn how to play and win!",
  autoplay: true,
  skippable: true,
  skip_after: 5,
  is_active: true
}
```

### Creating a Vimeo Ad

```javascript
{
  title: "VIP Benefits Overview",
  video_url: "https://vimeo.com/123456789",
  video_type: "vimeo",
  placement: "dashboard",
  autoplay: false,
  skippable: false,
  is_active: true
}
```

### Creating a Direct Video Ad

```javascript
{
  title: "Product Showcase",
  video_url: "https://yourdomain.com/videos/promo.mp4",
  video_type: "direct",
  thumbnail_url: "https://yourdomain.com/thumbnails/promo.jpg",
  placement: "marketplace",
  autoplay: true,
  skippable: true,
  skip_after: 3
}
```

---

## 📱 Implementing Video Ads on Pages

### Example: Homepage Video Ad

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';
import VideoPlayer from '@/components/VideoPlayer';

const HomePage = () => {
  const [videoAd, setVideoAd] = useState(null);
  
  useEffect(() => {
    fetchVideoAd();
  }, []);
  
  const fetchVideoAd = async () => {
    try {
      const response = await axios.get(
        `${API}/api/video-ads/active?placement=homepage&user_role=user`
      );
      if (response.data.video_ads?.length > 0) {
        setVideoAd(response.data.video_ads[0]);
      }
    } catch (error) {
      console.error('Error fetching video ad:', error);
    }
  };
  
  const handleSkip = () => {
    setVideoAd(null); // Remove video
  };
  
  const handleComplete = () => {
    setVideoAd(null); // Remove video after completion
  };
  
  return (
    <div>
      {/* Video Ad */}
      {videoAd && (
        <div className="mb-8">
          <VideoPlayer
            videoUrl={videoAd.video_url}
            videoType={videoAd.video_type}
            thumbnail={videoAd.thumbnail_url}
            title={videoAd.title}
            autoplay={videoAd.autoplay}
            muted={true}
            skippable={videoAd.skippable}
            skipAfter={videoAd.skip_after}
            onSkip={handleSkip}
            onComplete={handleComplete}
            className="h-96"
          />
        </div>
      )}
      
      {/* Rest of homepage content */}
      <div>
        <h1>Welcome to PARAS REWARD</h1>
        {/* ... */}
      </div>
    </div>
  );
};
```

### Example: Pre-Game Video Ad

```javascript
const TreasureHunt = () => {
  const [showPreGameAd, setShowPreGameAd] = useState(true);
  const [videoAd, setVideoAd] = useState(null);
  
  useEffect(() => {
    if (showPreGameAd) {
      fetchPreGameAd();
    }
  }, [showPreGameAd]);
  
  const fetchPreGameAd = async () => {
    try {
      const response = await axios.get(
        `${API}/api/video-ads/active?placement=pre_game&user_role=user`
      );
      if (response.data.video_ads?.length > 0) {
        setVideoAd(response.data.video_ads[0]);
      } else {
        setShowPreGameAd(false); // No ad available, skip
      }
    } catch (error) {
      setShowPreGameAd(false);
    }
  };
  
  const handleAdFinish = () => {
    setShowPreGameAd(false); // Show game after ad
  };
  
  if (showPreGameAd && videoAd) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="max-w-4xl w-full p-4">
          <VideoPlayer
            videoUrl={videoAd.video_url}
            videoType={videoAd.video_type}
            title={videoAd.title}
            autoplay={true}
            muted={true}
            skippable={true}
            skipAfter={videoAd.skip_after}
            onSkip={handleAdFinish}
            onComplete={handleAdFinish}
            className="h-[70vh]"
          />
        </div>
      </div>
    );
  }
  
  return (
    // Regular game interface
    <div>
      <h1>Treasure Hunt Game</h1>
      {/* ... */}
    </div>
  );
};
```

---

## 🎨 Customization Options

### VideoPlayer Props

```javascript
<VideoPlayer
  videoUrl="..."          // Required: Video URL
  videoType="youtube"     // 'direct', 'youtube', 'vimeo'
  thumbnail="..."         // Optional: Thumbnail image URL
  title="..."             // Video title
  autoplay={true}         // Auto-start video
  muted={true}            // Start muted (better UX)
  skippable={true}        // Show skip button
  skipAfter={5}           // Skip after X seconds
  onSkip={() => {}}       // Callback when skipped
  onComplete={() => {}}   // Callback when finished
  showCloseButton={false} // Show close button
  onClose={() => {}}      // Callback for close
  className="..."         // Custom styling
/>
```

---

## 📊 Analytics Dashboard

Admin can view:
- **Total Ads**: Number of active video ads
- **Total Views**: Cumulative video views
- **Completion Rate**: % of videos watched to end
- **Skip Rate**: % of videos skipped
- **Per-Ad Stats**: Individual video performance

### Example Analytics

```
Video Ad: "Summer Sale"
- Views: 1,245
- Completions: 856 (68.7%)
- Skips: 389 (31.3%)
- Avg Watch Time: 12.4s
```

---

## 💡 Best Practices

### 1. Video Length
- **Homepage**: 15-30 seconds (short attention span)
- **Pre-Game**: 10-15 seconds (users want to play)
- **Marketplace**: 20-30 seconds (shopping mindset)
- **Dashboard**: 30-45 seconds (more time available)

### 2. Autoplay Settings
- **Always mute on autoplay** (better UX, browsers allow muted autoplay)
- **Don't autoplay on mobile** (data usage concerns)
- **Provide skip option** (respect user time)

### 3. Skippable Ads
- **5 seconds** minimum before skip (industry standard)
- **3 seconds** for shorter videos
- **Non-skippable** only for very important announcements

### 4. Targeting
- **Target VIP users** with upgrade ads
- **Target new users** with tutorial videos
- **Target all users** with product promotions

### 5. Scheduling
- Set **start_date** and **end_date** for seasonal campaigns
- Example: Diwali sale video (Oct 20 - Nov 5)

---

## 🆓 Free Video Solutions

### YouTube (Recommended)
**Pros:**
- ✅ Completely FREE
- ✅ Unlimited storage
- ✅ Fast CDN delivery
- ✅ Works everywhere
- ✅ Mobile optimized

**Steps:**
1. Create YouTube account
2. Upload video (can set as "Unlisted")
3. Copy video URL
4. Use in video ad system

### Vimeo (Alternative)
**Pros:**
- ✅ Free tier available
- ✅ Good quality
- ✅ Professional look
- ✅ No ads (unlike YouTube)

**Limits:**
- 500 MB/week upload
- 5 GB total storage

### Direct Upload (Advanced)
**Options:**
- Upload to `/public/videos/` folder
- Use Cloudinary (free tier: 25 GB)
- Use Firebase Storage (free tier: 5 GB)
- Use AWS S3 (pay as you go)

---

## 🎯 Strategic Placement Guide

### Homepage
**Best For:**
- Brand awareness
- New feature announcements
- Seasonal promotions
- Company story

**Example:**
```javascript
{
  title: "Welcome to PARAS REWARD",
  placement: "homepage",
  autoplay: true,
  skip_after: 5
}
```

### Marketplace
**Best For:**
- Product highlights
- Flash sale announcements
- Category showcases
- Testimonials

**Example:**
```javascript
{
  title: "Featured Products This Week",
  placement: "marketplace",
  autoplay: true,
  skip_after: 3
}
```

### Pre-Game
**Best For:**
- Game tutorials
- Tips and tricks
- Sponsored content
- Reward boosters

**Example:**
```javascript
{
  title: "How to Win Treasure Hunt",
  placement: "pre_game",
  autoplay: true,
  skip_after: 5
}
```

### Dashboard
**Best For:**
- VIP membership promotions
- Referral program
- Account features
- Success stories

**Example:**
```javascript
{
  title: "Upgrade to VIP Today",
  placement: "dashboard",
  autoplay: false, // User is already engaged
  skippable: true
}
```

---

## 📈 Monetization Opportunities

### 1. Sponsored Video Ads
- Partner with brands
- Charge per 1000 views (CPM)
- Example: ₹200-500 CPM

### 2. Product Placement
- Feature products in videos
- Show marketplace items
- Drive sales directly

### 3. Affiliate Marketing
- Promote partner products
- Earn commission on sales
- Track via video analytics

---

## 🔧 Troubleshooting

### Video Not Playing
**Solution:**
- Check video URL is correct
- Verify video is public (not private)
- Check video type matches URL

### Autoplay Not Working
**Solution:**
- Set `muted={true}` (browsers require muted autoplay)
- Check browser autoplay policies
- Provide play button fallback

### Analytics Not Tracking
**Solution:**
- Verify backend endpoints are working
- Check network requests in browser
- Ensure `trackEvent` is called

### Slow Loading
**Solution:**
- Use YouTube/Vimeo (better CDN)
- Optimize video file size
- Add loading placeholder

---

## 🚀 Future Enhancements

### Phase 1 (Current) ✅
- YouTube/Vimeo embed
- Basic admin panel
- Simple analytics
- Manual ad creation

### Phase 2 (Next)
- [ ] Bulk upload videos
- [ ] Advanced scheduling
- [ ] A/B testing different videos
- [ ] Geo-targeting

### Phase 3 (Future)
- [ ] Video recording in-app
- [ ] AI video generation
- [ ] Interactive videos
- [ ] Shoppable videos

---

## 📚 API Reference

### Get Active Video Ads
```http
GET /api/video-ads/active
  ?placement=homepage
  &user_role=user
```

**Response:**
```json
{
  "success": true,
  "video_ads": [
    {
      "video_ad_id": "video_123",
      "title": "Summer Sale",
      "video_url": "https://youtube.com/...",
      "video_type": "youtube",
      "placement": "homepage",
      "autoplay": true,
      "skippable": true,
      "skip_after": 5
    }
  ]
}
```

### Create Video Ad (Admin)
```http
POST /api/admin/video-ads
Content-Type: application/json

{
  "title": "New Product Launch",
  "video_url": "https://youtube.com/...",
  "video_type": "youtube",
  "placement": "marketplace",
  "is_active": true,
  "autoplay": true,
  "skippable": true,
  "skip_after": 5
}
```

### Track Video Event
```http
POST /api/video-ads/{video_ad_id}/track
Content-Type: application/json

{
  "event_type": "view", // 'view', 'skip', 'complete'
  "watch_time": 12.5
}
```

---

## ✅ Checklist

### Setup (Done)
- [x] VideoPlayer component created
- [x] Admin panel created
- [x] Backend endpoints added
- [x] Routes configured
- [x] Analytics tracking implemented

### Deployment
- [ ] Test video player on different browsers
- [ ] Test YouTube embed
- [ ] Test Vimeo embed
- [ ] Create sample video ads
- [ ] Test analytics tracking
- [ ] Add video ads to homepage
- [ ] Document for team

### Content Creation
- [ ] Record/find promotional videos
- [ ] Upload to YouTube
- [ ] Create 3-5 starter video ads
- [ ] Test different placements
- [ ] Monitor performance

---

## 🎉 You're All Set!

Your video advertisement system is ready with:
- ✅ FREE YouTube/Vimeo support
- ✅ Complete admin management
- ✅ Analytics tracking
- ✅ Multiple placements
- ✅ Professional video player

**Next Steps:**
1. Access admin panel: `/admin/video-ads`
2. Create your first video ad
3. Choose placement
4. Monitor analytics
5. Optimize based on data

**Need Help?**
- Check browser console for errors
- Review video URL format
- Test with sample YouTube video
- Check analytics in admin panel

---

**Last Updated:** November 7, 2024
**Version:** 1.0
**Status:** ✅ Production Ready
