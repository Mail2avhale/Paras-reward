import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { API } from '../../../lib/api';

const EkoPauseBanner = () => {
  const [flag, setFlag] = useState(null);

  const load = useCallback(() => {
    axios.get(`${API}/recharge/admin/low-balance`).then((r) => setFlag(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (!flag?.active) return null;

  const resume = async () => {
    await axios.post(`${API}/recharge/admin/low-balance/clear`);
    toast.success('Recharges resumed');
    load();
  };

  return (
    <div data-testid="eko-low-balance-banner" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2 text-red-700">
        <AlertTriangle className="h-5 w-5 mt-0.5" />
        <div>
          <p className="font-bold text-sm">Recharges paused — Eko returned "Low balance"</p>
          <p className="text-xs">
            Paused until {new Date(flag.until).toLocaleTimeString('en-IN')} · {flag.hits || 0} low-balance failures so far.
            Top up the Eko wallet used for bill payments, then resume.
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={resume} data-testid="eko-resume-btn">Resume now</Button>
    </div>
  );
};

export default EkoPauseBanner;
