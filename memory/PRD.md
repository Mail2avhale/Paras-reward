# PARAS REWARD - Product Requirements Document

## Original Problem Statement
A mining reward application with subscription-based economy. Users mine PRC tokens daily based on:
- Base rate (500 PRC/day = 20.83 PRC/hr)
- Single leg bonus (users who joined after them)
- Team boost from 3 levels of friends (L1=5%, L2=3%, L3=2% = **10% total**)

### Key Requirements
1. **Mining Economy:** Additive formula: `Total = Base + L1_bonus + L2_bonus + L3_bonus`
2. **Subscription:** ₹799/month Elite plan required for bonuses
3. **Gift Feature:** Gift 24hr subscription to L1 friends for 600 PRC
4. **BBPS/DMT:** Bill payments and money transfer services via Eko API
5. **Mining Formula:** CONFIDENTIAL - Chatbot must NOT share exact formula
6. **Google Play Policy:** Use "Invite Friends" instead of "Referral"

## What's Been Implemented

### March 2026 - Latest
- [x] **Google Play Policy Safe UI** - "Referral" → "Invite Friends" everywhere
- [x] Updated: BottomNav, Sidebar, Navbar, FAQ, Mining page, Network Tree
- [x] Updated translations in all 9 languages
- [x] Chatbot uses "Invite Friends" terminology
- [x] No "Referral Income/Commission" language
- [x] Rewards tied to user activity (policy safe)

### Earlier in March 2026
- [x] New mining economy with additive formula (P0 fix)
- [x] `calculate_mining_rate()` returns correct base_rate
- [x] Level bonuses: L1=5%, L2=3%, L3=2% (total 10%)
- [x] Subscription consolidation: Removed ₹299/₹549 plans
- [x] **Tap Game REMOVED** - All references deleted
- [x] UI shows "Up to +10% bonus"
- [x] Chatbot - mining formula marked as proprietary/confidential

## REMOVED Features
- ❌ Tap Game (DELETED)
- ❌ L4/L5 referral levels
- ❌ Earnings History page
- ❌ AI Referral Coach
- ❌ PRC Vault / Auto-Savings

## Pending Issues (P1)
1. **BBPS Billers:** AEML, JPDCL fail to fetch bills
2. **DMT in Preview:** 403 errors due to IP whitelist

## Backlog
- DMT v3 with Aadhaar/eKYC
- Payment Status Check on Login

## Test Credentials
- Admin: admin@paras.com / PIN: 153759
- Test: testmining@paras.com / PIN: 123456
