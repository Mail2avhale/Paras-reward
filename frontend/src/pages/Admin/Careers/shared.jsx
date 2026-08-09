// Careers module — small shared UI primitives (StatPill, Input, Select, Textarea, Field)
import React from 'react';

const StatPill = ({ label, value, color }) => {
  const colors = {
    slate: 'bg-white border-slate-200',
    blue: 'bg-blue-500/10 border-blue-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
    emerald: 'bg-emerald-500/10 border-emerald-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
    green: 'bg-green-500/15 border-green-500/40',
    red: 'bg-red-500/10 border-red-500/30'
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
};

const Input = ({ label, value, onChange, type = 'text', testid }) => (
  <div>
    <label className="text-xs text-slate-500 mb-1 block">{label}</label>
    <input
      type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900"
      data-testid={testid}
    />
  </div>
);
const Select = ({ label, value, onChange, options, testid }) => (
  <div>
    <label className="text-xs text-slate-500 mb-1 block">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900" data-testid={testid}>
      <option value="">Select...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
const Textarea = ({ label, value, onChange, rows = 2, testid }) => (
  <div>
    <label className="text-xs text-slate-500 mb-1 block">{label}</label>
    <textarea
      value={value ?? ''} onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 resize-none"
      data-testid={testid}
    />
  </div>
);
const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-sm text-slate-200 truncate">{value || '—'}</p>
  </div>
);


export { StatPill, Input, Select, Textarea, Field };
