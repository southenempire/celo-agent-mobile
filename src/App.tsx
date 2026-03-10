import React, { useState, useRef, useEffect } from 'react';
import {
    Send, Wallet, Smartphone, ShieldCheck, MapPin, Loader2, Link as LinkIcon,
    LayoutDashboard, MessageSquare, ArrowUpRight, Coins, Zap, BarChart3, ChevronRight,
    Sun, Moon, Info, X, Sparkles, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useAgent } from './hooks/useAgent';
import { type TransactionHistory } from './lib/agent-core';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'agent';
    status?: 'pending' | 'success' | 'error';
    hash?: string;
    provider?: string;
    isSupport?: boolean;
}

const App: React.FC = () => {
    const { address, isConnected } = useAccount();
    const { open } = useAppKit();
    const agent = useAgent();

    const [view, setView] = useState<'chat' | 'dashboard'>('chat');
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: 'Eyoo! I am CRIA, your intelligent Celo Remittance Agent. You can speak naturally to me—how can I help move value today?', sender: 'agent' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSupportMode, setIsSupportMode] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showTour, setShowTour] = useState(() => !localStorage.getItem('cria_tour_seen'));
    const [history, setHistory] = useState<TransactionHistory[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    useEffect(() => {
        if (view === 'dashboard' && isConnected && address && agent) {
            const fetchHistory = async () => {
                setIsLoadingHistory(true);
                try {
                    const txs = await agent.getTransactionHistory(address as `0x${string}`);
                    setHistory(txs);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoadingHistory(false);
                }
            };
            fetchHistory();
        }
    }, [view, isConnected, address, agent]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userText = input;
        const userMsgId = Date.now().toString();
        setMessages(prev => [...prev, { id: userMsgId, text: userText, sender: 'user' }]);
        setInput('');

        if (isSupportMode) {
            setIsTyping(true);
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: "I'm in Support Mode! I can help with wallet issues, network errors, or transaction stuck cases. How specifically can I help?",
                    sender: 'agent',
                    isSupport: true
                }]);
                setIsTyping(false);
            }, 1000);
            return;
        }

        if (!isConnected) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: "Please connect your wallet first so I can help you with that!",
                sender: 'agent'
            }]);
            return;
        }

        setIsTyping(true);

        try {
            if (agent) {
                const result = await agent.processIntent(userText);
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: `Transaction executed! I've sent ${result.intent.amount} ${result.intent.currency} to ${result.intent.recipient.slice(0, 6)}... A small service fee of 0.01 USDC was applied.`,
                    sender: 'agent',
                    status: 'success',
                    hash: result.hash,
                    provider: result.provider
                }]);
            }
        } catch (error: any) {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: `Error: ${error.message}`,
                sender: 'agent',
                status: 'error'
            }]);
        }
    };

    const closeTour = () => {
        setShowTour(false);
        localStorage.setItem('cria_tour_seen', 'true');
    };

    const totalValueMoved = history.reduce((acc, tx) => acc + parseFloat(tx.amount), 0).toFixed(2);

    return (
        <div className={`flex flex-col h-screen max-w-md mx-auto ${isDarkMode ? 'bg-[#0F1115] text-white' : 'bg-[#F2F4F7] text-[#2E3338]'} shadow-2xl relative overflow-hidden font-sans transition-colors duration-500`}>

            {/* Dynamic Animated Background Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-celo-gold/20 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-celo-green/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />

            {/* Tour Card Overlay */}
            <AnimatePresence>
                {showTour && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            className={`${isDarkMode ? 'glass-dark' : 'glass'} p-8 rounded-[40px] relative overflow-hidden max-w-[340px]`}
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <button onClick={closeTour} className="text-gray-400 hover:text-celo-green transition-colors"><X size={24} /></button>
                            </div>
                            <div className="w-16 h-16 bg-celo-gold/30 rounded-[24px] flex items-center justify-center mb-6 shadow-lg shadow-celo-gold/20">
                                <Sparkles className="text-celo-gold w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black mb-4 tracking-tight">CRIA Pro</h2>
                            <p className="text-sm opacity-80 leading-relaxed mb-6 font-medium">
                                The future of remittances is here. Just speak to send value across borders with military-grade resilience.
                            </p>
                            <ul className="space-y-4 mb-8">
                                <li className="flex gap-3 text-sm font-bold items-center">
                                    <div className="w-6 h-6 bg-celo-green/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Zap size={12} className="text-celo-green" />
                                    </div>
                                    Zero-Friction Flows
                                </li>
                                <li className="flex gap-3 text-sm font-bold items-center">
                                    <div className="w-6 h-6 bg-celo-green/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        <ShieldCheck size={12} className="text-celo-green" />
                                    </div>
                                    ERC-8004 Identity
                                </li>
                            </ul>
                            <button
                                onClick={closeTour}
                                className="w-full py-4 bg-celo-green text-white font-black rounded-[20px] hover:shadow-[0_12px_24px_rgba(53,208,127,0.4)] transition-all active:scale-95 shadow-lg"
                            >
                                UNLEASH CRIA
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Glass Header */}
            <header className={`sticky top-0 z-40 px-6 py-5 flex items-center justify-between transition-all duration-300 ${isDarkMode ? 'bg-black/20' : 'bg-white/20'} backdrop-blur-2xl border-b ${isDarkMode ? 'border-white/5' : 'border-white/40'}`}>
                <div className="flex items-center gap-4">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="w-11 h-11 bg-celo-gold rounded-2xl flex items-center justify-center shadow-2xl shadow-celo-gold/40 transform -rotate-2"
                    >
                        <Smartphone className="text-white w-6 h-6" />
                    </motion.div>
                    <div>
                        <h1 className="text-xl font-black tracking-tighter leading-none mb-1">CRIA <span className="text-celo-green">PRO</span></h1>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-celo-green animate-pulse' : 'bg-orange-400'}`}></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`p-3 rounded-2xl transition-all shadow-sm border ${isDarkMode ? 'bg-white/10 border-white/10 text-celo-gold' : 'bg-white/60 border-white/60 text-celo-dark'}`}
                    >
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button
                        onClick={() => setView(view === 'chat' ? 'dashboard' : 'chat')}
                        className={`p-3 rounded-2xl transition-all shadow-sm border ${view === 'dashboard' ? 'bg-celo-green text-white border-celo-green' : isDarkMode ? 'bg-white/10 border-white/10 text-white' : 'bg-white/60 border-white/60 text-celo-dark'}`}
                    >
                        {view === 'chat' ? <LayoutDashboard size={18} /> : <MessageSquare size={18} />}
                    </button>
                    <button
                        onClick={() => open()}
                        className={`p-3 rounded-2xl transition-all active:scale-95 shadow-sm border ${isConnected ? 'bg-celo-green/20 border-celo-green/30 text-celo-green' : isDarkMode ? 'bg-white/10 border-white/10 text-white' : 'bg-white/60 border-white/60 text-celo-dark'
                            }`}
                    >
                        <Wallet className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <AnimatePresence mode="wait">
                {view === 'chat' ? (
                    <motion.div
                        key="chat"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="flex-1 flex flex-col overflow-hidden relative"
                    >
                        <main className={`flex-1 overflow-y-auto px-5 py-8 space-y-8 scrollbar-hide z-10`}>
                            <AnimatePresence initial={false}>
                                {messages.map((m) => (
                                    <motion.div
                                        key={m.id}
                                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] px-6 py-4 transition-all ${m.sender === 'user'
                                                ? 'bg-celo-green text-white rounded-[32px] rounded-tr-none shadow-2xl shadow-celo-green/20 font-bold'
                                                : isDarkMode
                                                    ? 'glass-dark rounded-[32px] rounded-tl-none font-medium'
                                                    : 'glass rounded-[32px] rounded-tl-none font-medium'
                                            } ${m.isSupport ? 'ring-2 ring-celo-gold/30' : ''} ${m.status === 'error' ? 'ring-2 ring-red-500/30' : ''}`}>
                                            <p className="text-[15px] leading-relaxed">{m.text}</p>

                                            <div className="flex items-center gap-3 mt-3">
                                                {m.provider && (
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${m.provider === 'openai' ? 'text-blue-400 border-blue-400/20 bg-blue-400/10' :
                                                            m.provider === 'gemini' ? 'text-purple-400 border-purple-400/20 bg-purple-400/10' :
                                                                'text-gray-400 border-gray-400/20 bg-gray-400/10'
                                                        }`}>
                                                        MODEL: {m.provider}
                                                    </span>
                                                )}
                                                {m.hash && (
                                                    <a
                                                        href={`https://sepolia.celoscan.io/tx/${m.hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[11px] flex items-center gap-1.5 text-celo-green font-black active:scale-95 transition-all hover:bg-celo-green/20 bg-celo-green/10 px-3 py-1 rounded-full border border-celo-green/20"
                                                    >
                                                        <LinkIcon size={12} /> EXPLORER
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                {isTyping && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                        <div className={`${isDarkMode ? 'glass-dark' : 'glass'} px-5 py-4 rounded-[24px] rounded-tl-none flex gap-2 items-center`}>
                                            <span className="w-1.5 h-1.5 bg-celo-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-1.5 h-1.5 bg-celo-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-1.5 h-1.5 bg-celo-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </main>

                        {/* Glass Input Area */}
                        <footer className={`p-6 pt-4 z-20 transition-all ${isDarkMode ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-3xl border-t ${isDarkMode ? 'border-white/5' : 'border-white/20'}`}>
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setIsSupportMode(!isSupportMode)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 shadow-sm ${isSupportMode ? 'bg-celo-gold text-white border-celo-gold' : 'bg-white/10 text-gray-400 border-white/10'
                                        }`}
                                >
                                    <HelpCircle size={14} /> SUPPORT RADAR
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={isConnected ? (isSupportMode ? "Explain issue to CRIA..." : "e.g. Give 0.05 USDC to Mario...") : "Awaiting Wallet..."}
                                    disabled={isTyping}
                                    className={`w-full pl-6 pr-16 py-6 rounded-[32px] border focus:outline-none focus:ring-4 focus:ring-celo-green/20 transition-all shadow-2xl placeholder:text-gray-500 font-bold text-[15px] ${isDarkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-white/80 border-white/40 text-celo-dark'
                                        }`}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isTyping}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-celo-green p-4.5 rounded-[24px] text-white hover:shadow-[0_12px_32px_rgba(53,208,127,0.5)] transition-all active:scale-90 disabled:opacity-50 shadow-lg"
                                >
                                    {isTyping ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                                </button>
                            </div>
                            <div className="mt-5 flex justify-between items-center px-4 opacity-40">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest italic">Encrypted Agentic Layer</span>
                                </div>
                                <span className="text-[10px] font-black tracking-widest italic">V2.4_ULTRA</span>
                            </div>
                        </footer>
                    </motion.div>
                ) : (
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="flex-1 overflow-y-auto p-6 space-y-8 z-10"
                    >
                        {/* Stats Overview */}
                        <div className="grid grid-cols-2 gap-5">
                            <div className={`${isDarkMode ? 'glass-card-dark' : 'glass-card'} rounded-[32px] p-6 relative overflow-hidden group transition-all hover:scale-[1.02]`}>
                                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <BarChart3 className="text-celo-green w-10 h-10" />
                                </div>
                                <p className="text-[10px] font-black text-celo-green uppercase tracking-[0.2em] mb-2">FLOWS</p>
                                <h3 className="text-3xl font-black italic">{history.length}</h3>
                            </div>
                            <div className={`${isDarkMode ? 'glass-card-dark' : 'glass-card'} rounded-[32px] p-6 relative overflow-hidden group transition-all hover:scale-[1.02]`}>
                                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <Coins className="text-celo-gold w-10 h-10" />
                                </div>
                                <p className="text-[10px] font-black text-celo-gold uppercase tracking-[0.2em] mb-2">VALUE</p>
                                <h3 className="text-3xl font-black italic">${totalValueMoved}</h3>
                            </div>
                        </div>

                        {/* Agent Identity Glass Card */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-celo-gold to-celo-green rounded-[40px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                            <div className={`relative ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white/60 border-white/40'} border backdrop-blur-3xl rounded-[40px] p-8 shadow-2xl`}>
                                <div className="flex justify-between items-center mb-8">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tighter mb-1 uppercase">Passport</h2>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">ERC-8004 SOULBOUND IDENTITY</p>
                                    </div>
                                    <div className="w-12 h-12 bg-celo-green/20 rounded-2xl flex items-center justify-center text-celo-green border border-celo-green/30 animate-pulse">
                                        <ShieldCheck size={28} />
                                    </div>
                                </div>
                                {isConnected ? (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">HOLDER</span>
                                            <span className="font-mono text-sm font-black truncate max-w-[180px]">{address}</span>
                                        </div>
                                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">RANK</span>
                                            <span className="font-black text-celo-gold uppercase tracking-tighter italic text-lg">DIAMOND PRIME</span>
                                        </div>
                                        <div className="pt-2 flex items-center gap-3">
                                            <Zap size={16} className="text-celo-gold animate-bounce" />
                                            <p className="text-[11px] font-bold opacity-60 leading-tight">Identity cryptographically anchored to Celo Sepolia Mainframe.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => open()} className="w-full py-5 rounded-[24px] font-black uppercase tracking-widest text-xs bg-celo-green text-white shadow-xl shadow-celo-green/20 active:scale-95 transition-all">SIGN IDENTITY</button>
                                )}
                            </div>
                        </div>

                        {/* List Glass Card */}
                        <div className={`${isDarkMode ? 'glass-card-dark' : 'glass-card'} rounded-[40px] p-8`}>
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="font-black uppercase text-[12px] tracking-[0.2em] opacity-40 italic">TRANSMISSION LOG</h3>
                                <span className="text-[10px] text-celo-green font-black flex items-center gap-2 bg-celo-green/10 px-3 py-1 rounded-full border border-celo-green/20">
                                    <span className="w-1.5 h-1.5 bg-celo-green rounded-full animate-ping"></span> LIVE SYNC
                                </span>
                            </div>
                            <div className="space-y-4">
                                {isLoadingHistory ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} className="h-24 glass rounded-[32px] animate-pulse" />
                                    ))
                                ) : history.length > 0 ? (
                                    history.map((tx) => (
                                        <div key={tx.hash} className={`flex items-center justify-between p-5 rounded-[32px] border transition-all hover:scale-[1.03] active:scale-95 cursor-pointer ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white/40 border-white/60'} group`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 ${isDarkMode ? 'bg-white/10 text-celo-green' : 'bg-celo-green text-white'} rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform`}>
                                                    <ArrowUpRight size={22} font-black />
                                                </div>
                                                <div>
                                                    <p className={`text-[15px] font-black ${isDarkMode ? 'text-white' : 'text-celo-dark'} leading-tight`}>{tx.amount} {tx.currency}</p>
                                                    <p className="text-[11px] font-bold opacity-40 uppercase tracking-widest">{tx.recipient.slice(0, 12)}...</p>
                                                </div>
                                            </div>
                                            <a href={`https://sepolia.celoscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                                                <div className="p-2 rounded-xl bg-celo-green/10 text-celo-green border border-celo-green/20">
                                                    <ChevronRight size={18} />
                                                </div>
                                            </a>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-12 text-center opacity-40">
                                        <Info className="mx-auto mb-4" size={40} />
                                        <p className="text-sm font-black uppercase tracking-widest italic">Logs Empty</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default App;
