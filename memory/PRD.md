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
6. **Google Play Policy:** 
   - Use "Invite Friends" instead of "Referral"
   - Use "Reward Points" instead of "Balance"
   - Use "Estimated Redeem Value" not fixed "10 PRC = ₹1"
   - No "Earn Money", "Referral Income", "Guaranteed Cash"

## What's Been Implemented

### March 2026 - Latest
- [x] **Google Play Policy Safe PRC Card** - "Reward Points", "Estimated Redeem Value"
- [x] **Tap Game REMOVED** - Bottom nav shows "Invite Friends" instead
- [x] "Referral" → "Invite Friends" everywhere
- [x] Removed fixed currency conversion "10 PRC = ₹1" from user-facing pages
- [x] Added disclaimers "*Subject to terms"
- [x] Chatbot uses safe terminology

### Earlier Changes
- [x] New mining economy with additive formula
- [x] Level bonuses: L1=5%, L2=3%, L3=2% (total 10%)
- [x] Subscription consolidation to Elite plan only
- [x] Mining formula is SECRET (chatbot trained)

## REMOVED Features
- ❌ Tap Game (DELETED)
- ❌ L4/L5 referral levels
- ❌ Earnings History page
- ❌ PRC Vault / Auto-Savings
- ❌ Fixed "10 PRC = ₹1" text (user-facing)

## Pending Issues (P1)
1. **BBPS Billers:** AEML, JPDCL fail to fetch bills
2. **DMT in Preview:** 403 errors due to IP whitelist

## Test Credentials
- Admin: admin@paras.com / PIN: 153759
- Test: testmining@paras.com / PIN: 123456
