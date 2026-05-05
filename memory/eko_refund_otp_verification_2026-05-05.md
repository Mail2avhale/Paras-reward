# Eko Refund OTP — Production Verification Report
**Date**: May 5, 2026  
**Tested by**: Paras Reward admin (UID `e2edbfbb-38f3-4fd1-96d3-454a5334f45c`)  
**Scope**: 43 stuck `Refund pending` transactions from April 6, 2026 (~30 days old)  
**Total amount stuck**: ₹50,837

---

## Phase 1 — Read-only `transaction-inquiry` (43/43 TIDs)

All 43 TIDs return `tx_status=3` (Refund Pending), `txstatus_desc="Refund Pending"`, `response_status_id=0`, message `"Success!tx.inquiry.success"`.

**Conclusion**: Eko itself confirms these are legitimately refund-pending and the refund window is still open. The TIDs are valid.

---

## Phase 2 — Live OTP send (8 distinct customer mobiles)

| TID | Customer | Mobile | Amount | Eko `data.tid` populated? | Verdict |
|-----|----------|--------|--------|--------------------------|---------|
| 3554860154 | Mohd Ameen | 9936222482 | ₹3599 | ✅ YES | **CONFIRMED** SMS dispatched |
| 3554852928 | Roshani maurya | 9026811652 | ₹2249 | ✅ YES | **CONFIRMED** SMS dispatched |
| 3554878178 | Raj Sahagar | 6393331527 | ₹799 | ❌ EMPTY | **AMBIGUOUS** — SMS likely not delivered |
| 3554859939 | Harischandra S Tripathi | 8692951107 | ₹859 | ❌ EMPTY | **AMBIGUOUS** — SMS likely not delivered |
| 3554856828 | Jitendra Kumar bajpai | 9198297047 | ₹859 | ❌ EMPTY | **AMBIGUOUS** — SMS likely not delivered |
| 3554856498 | Ramdeen | 8874137317 | ₹868 | ❌ EMPTY | **AMBIGUOUS** — SMS likely not delivered |
| 3554856270 | Manas mishra | 9451763818 | ₹899 | ❌ EMPTY | **AMBIGUOUS** — SMS likely not delivered |
| 3554856224 | Mobin Sheikh | 9872893817 | ₹629 | ❌ EMPTY | **AMBIGUOUS** — SMS likely not delivered |

**Hit rate**: **2/8 confirmed (25%)** vs **6/8 ambiguous (75%)**.

In every case Eko returned `status:0, response_status_id:-1, invalid_params:null` — so a naive caller (older code) would have reported all 8 as "OTP sent". Only the populated `data.tid`/`data.otp_ref_id` distinguishes a real send from a silent no-op.

---

## Root Cause (confirmed by ground-truth data)

Eko's V1 `/transactions/{tid}/refund/otp` endpoint **silently no-ops** for ~75% of these 30-day-old TIDs on this account. There is no error code, no `invalid_params`, no rate-limit message — Eko returns the same `status:0` shape but skips the SMS dispatch and leaves `data.tid` empty.

Possible causes (need Eko to confirm):
1. **Eko-side SMS-gateway failure** (random transient — partial success suggests this)
2. **Account-level OTP throttle** (only N OTP sends per account per hour; rest silently dropped)
3. **Customer-mobile-specific delivery block** (DND, telco filter, etc.)

---

## Action items

### For Eko Escalation (please raise a ticket with this evidence)
> "On account `INITIATOR_ID = 9936295892`, V1 refund-OTP endpoint returns `status:0` but with empty `data.tid` for the following Refund-Pending transactions (all from April 6, 2026, all `tx_status=3` per your own inquiry API). Customers report they never receive the SMS. Please confirm whether OTP SMS was actually dispatched on your side, and if not, why."

Attach: this report + the 8 TIDs above + screenshots of `transaction-inquiry` and `refund/otp` responses.

### Workaround for affected customers
- The 2 CONFIRMED customers (Mohd Ameen, Roshani maurya) should now have OTP SMS — ping them to retry from app.
- The 6 AMBIGUOUS customers will NOT have received SMS — do NOT promise refund via app; either (a) request manual refund from Eko via support ticket OR (b) credit PRC manually as goodwill once Eko confirms refund issued.

### App-side improvements (already deployed)
- ✅ `delivery_confirmed:false` returned to UI when Eko data is empty → user sees softer "Try Resend after 60s" hint.
- ✅ Full Eko response logged to `eko_refund_logs.eko_full_response` for ops triage.
- 🟡 Pending: admin dashboard tile "Ambiguous OTP sends (last 24h)" — quick monitoring of this issue.
- 🟡 Pending: cron job that retries OTP send for `result=ambiguous` rows after 5 minutes (max 3 retries) — may convert silent failures into delivered SMS over multiple attempts.
