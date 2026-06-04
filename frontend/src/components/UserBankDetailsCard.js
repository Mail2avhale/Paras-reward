/**
 * UserBankDetailsCard
 *
 * Self-contained card for the user Profile page that lets users save:
 *   • Bank Account holder name
 *   • Bank Account number
 *   • IFSC code
 *   • Bank name
 *   • UPI ID
 *   • PhonePe/GPay number
 *
 * Backed by:
 *   GET  /api/admin/redeem-limits/users/:uid/bank-details
 *   PUT  /api/admin/redeem-limits/users/:uid/bank-details
 *
 * Admin uses these saved details to process direct bank redeems.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Building2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { API } from '@/lib/api';

export default function UserBankDetailsCard({ uid }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    bank_name: '',
    upi_id: '',
    phonepe_gpay_number: '',
  });
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API}/admin/redeem-limits/users/${uid}/bank-details`)
      .then((res) => {
        if (cancelled || !res.data?.success) return;
        setForm({
          account_holder_name: res.data.account_holder_name || '',
          account_number: res.data.account_number || '',
          ifsc_code: res.data.ifsc_code || '',
          bank_name: res.data.bank_name || '',
          upi_id: res.data.upi_id || '',
          phonepe_gpay_number: res.data.phonepe_gpay_number || '',
        });
        setUpdatedAt(res.data.updated_at);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSave = async () => {
    if (!uid) return;
    // Trim to only send fields with content; UPI is optional but if provided must contain '@'
    if (form.upi_id && !form.upi_id.includes('@')) {
      toast.error('UPI ID must contain "@" (e.g., name@bank).');
      return;
    }
    if (form.account_number && !/^\d{8,18}$/.test(form.account_number)) {
      toast.error('Account number must be 8–18 digits.');
      return;
    }
    if (form.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc_code)) {
      toast.error('IFSC must look like HDFC0001234.');
      return;
    }
    if (form.phonepe_gpay_number && !/^\d{10,15}$/.test(form.phonepe_gpay_number)) {
      toast.error('PhonePe/GPay number must be 10–15 digits.');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.put(`${API}/admin/redeem-limits/users/${uid}/bank-details`, {
        account_holder_name: form.account_holder_name || null,
        account_number: form.account_number || null,
        ifsc_code: form.ifsc_code ? form.ifsc_code.toUpperCase() : null,
        bank_name: form.bank_name || null,
        upi_id: form.upi_id || null,
        phonepe_gpay_number: form.phonepe_gpay_number || null,
      });
      if (res.data?.success) {
        toast.success('Bank details saved');
        setUpdatedAt(new Date().toISOString());
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-white border border-slate-200 p-5 shadow-sm" data-testid="user-bank-details-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            Bank &amp; UPI Details
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Used by admin for direct Bank Redeem. Saved securely — visible only to you and admins.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3 h-3" /> Encrypted
        </span>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600">Account Holder Name</Label>
              <Input
                data-testid="bank-account-holder"
                value={form.account_holder_name}
                onChange={onChange('account_holder_name')}
                placeholder="As per bank passbook"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Bank Name</Label>
              <Input
                data-testid="bank-name"
                value={form.bank_name}
                onChange={onChange('bank_name')}
                placeholder="HDFC Bank"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Account Number</Label>
              <Input
                data-testid="bank-account-number"
                value={form.account_number}
                onChange={onChange('account_number')}
                inputMode="numeric"
                placeholder="12-digit a/c number"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">IFSC Code</Label>
              <Input
                data-testid="bank-ifsc"
                value={form.ifsc_code}
                onChange={(e) => setForm((f) => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                placeholder="HDFC0001234"
                maxLength={11}
                className="mt-1 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">UPI ID</Label>
              <Input
                data-testid="bank-upi"
                value={form.upi_id}
                onChange={onChange('upi_id')}
                placeholder="yourname@upi"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">PhonePe / GPay Number</Label>
              <Input
                data-testid="bank-phonepe"
                value={form.phonepe_gpay_number}
                onChange={onChange('phonepe_gpay_number')}
                inputMode="numeric"
                placeholder="10-digit mobile linked to PhonePe/GPay"
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-400">
              {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : 'Not saved yet'}
            </p>
            <Button
              onClick={onSave}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="bank-details-save"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Bank Details
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
