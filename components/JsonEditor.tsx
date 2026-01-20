
import React, { useState, useEffect } from 'react';

interface JsonEditorProps {
  initialValue: any;
  onChange: (data: any) => void;
  title: string;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ initialValue, onChange, title }) => {
  const [text, setText] = useState(JSON.stringify(initialValue, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(initialValue, null, 2));
  }, [initialValue]);

  const handleChange = (val: string) => {
    setText(val);
    try {
      const parsed = JSON.parse(val);
      setError(null);
      onChange(parsed);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
      <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
        {error ? (
          <span className="text-xs text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-400/20">Invalid JSON</span>
        ) : (
          <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">Valid JSON</span>
        )}
      </div>
      <textarea
        className="flex-1 p-4 bg-transparent text-slate-300 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
      />
      {error && (
        <div className="px-4 py-2 bg-rose-900/20 text-rose-300 text-xs font-mono border-t border-rose-500/30">
          {error}
        </div>
      )}
    </div>
  );
};

export default JsonEditor;
