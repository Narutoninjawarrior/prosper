import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useLMStudioStore } from './store';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const ChatInterface = () => {
  const { temperature, maxTokens, systemPromptOverride, soulfile, markLmResponse, loadSoulfile } = useLMStudioStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure persona is present even if user lands directly on the Multi-Tool chat.
    if (!soulfile) loadSoulfile().catch(() => {});
  }, [soulfile, loadSoulfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const personaSystemPrompt = (() => {
    const fromSoulfile =
      soulfile && typeof soulfile.persona_prompt === 'string' && soulfile.persona_prompt.trim().length > 0
        ? soulfile.persona_prompt
        : soulfile
          ? [
              `You are ${soulfile.name} (${soulfile.type}).`,
              soulfile.physical_state?.current_action
                ? `Current action: ${soulfile.physical_state.current_action}.`
                : null,
              soulfile.mempalace_wing_ref ? `MemPalace wing: ${soulfile.mempalace_wing_ref}.` : null,
              `You are running inside Hearth OS. Be concise, solarpunk, and ethical.`,
            ]
              .filter(Boolean)
              .join('\n')
          : '';

    return (systemPromptOverride && systemPromptOverride.trim().length > 0 ? systemPromptOverride : fromSoulfile) ||
      'You are running inside Hearth OS. Be concise, solarpunk, and ethical.';
  })();

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);

      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'local-model', 
          temperature: temperature,
          max_tokens: maxTokens,
          messages: [{ role: 'system', content: personaSystemPrompt }, ...messages, userMsg]
        })
      });
      window.clearTimeout(timeout);

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      const botReply = data.choices[0].message.content;
      
      setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);
      markLmResponse();
    } catch (error) {
      // Keep UI resilient when LM Studio is offline.
      setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ ERROR: Cannot connect to LM Studio at localhost:1234. Is it running and hosting an active model?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020804]/50 border-2 border-[#10b981]/10 rounded-xl overflow-hidden shadow-[inset_0_0_20px_rgba(16,185,129,0.05)] w-full">
      <div className="bg-[#10b981]/10 px-4 py-3 border-b border-[#10b981]/20 flex justify-between items-center backdrop-blur-md">
        <span className="font-mono text-sm tracking-widest text-[#10b981] font-bold flex items-center gap-2"><Bot size={16}/> LOCAL INFERENCE CONSOLE</span>
        <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981] animate-pulse"></div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="m-auto text-center opacity-40 max-w-sm flex flex-col items-center">
             <Bot size={48} className="text-[#10b981] mb-4"/>
             <p className="font-mono text-sm text-[#10b981]">Engine Online.</p>
             <p className="text-xs text-gray-400 mt-2">I am routing through Port 1234 using the parameters specified in the Tuner.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30' : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'}`}>
              {msg.role === 'user' ? <User size={16}/> : <Bot size={16}/>}
            </div>
            <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#3b82f6]/10 text-gray-200 border border-[#3b82f6]/20 rounded-tr-none' : 'bg-[#10b981]/10 text-gray-200 border border-[#10b981]/20 rounded-tl-none font-sans whitespace-pre-wrap'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="self-start flex gap-3 max-w-[80%] opacity-50">
             <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30"><Bot size={16}/></div>
             <div className="px-4 py-3 rounded-xl bg-[#10b981]/10 text-gray-200 text-sm italic">Thinking offline...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/40 border-t border-[#10b981]/10 flex flex-col gap-2">
        <div className="flex relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Send command to offline engine..." 
            className="w-full bg-[#051a0d]/80 border border-[#10b981]/30 text-gray-200 rounded-lg px-4 py-3 pr-12 outline-none focus:border-[#10b981] transition-all font-sans text-sm shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
          />
          <button onClick={handleSend} disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-[#10b981]/20 text-[#10b981] transition-all">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
