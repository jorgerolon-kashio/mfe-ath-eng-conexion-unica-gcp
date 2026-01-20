
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple simulation of markdown rendering logic for brevity in this example.
  // In a real app, one would use 'react-markdown'.
  // Here we split by sections and handle code blocks.

  const parts = content.split('```');
  
  return (
    <div className="prose prose-invert max-w-none space-y-4">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          // It's a code block
          const lines = part.split('\n');
          const lang = lines[0].trim();
          const code = lines.slice(1).join('\n');
          return (
            <div key={index} className="relative group">
              <div className="absolute top-2 right-4 text-[10px] text-slate-500 font-mono uppercase">
                {lang || 'code'}
              </div>
              <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800 font-mono text-sm text-blue-300">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        return (
          <div key={index} className="whitespace-pre-wrap leading-relaxed text-slate-300">
            {part.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-white mt-6 mb-2 border-b border-slate-700 pb-2">{line.replace('# ', '')}</h1>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold text-slate-100 mt-5 mb-2">{line.replace('## ', '')}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-medium text-slate-200 mt-4 mb-1">{line.replace('### ', '')}</h3>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-slate-400">{line.replace('- ', '')}</li>;
              return <p key={i}>{line}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

export default MarkdownRenderer;
