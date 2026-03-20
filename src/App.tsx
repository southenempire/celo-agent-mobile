import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Send, Wallet, Loader2, Link as LinkIcon,
    LayoutDashboard, MessageSquare, ArrowUpRight, ArrowDownLeft,
    Coins, BarChart3, ChevronRight, Sun, Moon, Info,
    ShieldCheck, Zap, CheckCircle2, Clock, Globe, RefreshCw, Bot, Sparkles,
    Copy, ExternalLink, Trophy, Flame, History, RefreshCcw, Users, TrendingUp, Mic, MicOff, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useChainId, useWalletClient, usePublicClient } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useAgent } from './hooks/useAgent';
import { registerAgentOnChain, formatAgentRegistry, ERC8004_REGISTRY_MAINNET, ERC8004_REGISTRY_SEPOLIA, ERC8004_ABI } from './lib/erc8004';
import { type TransactionHistory, AGENT_TREASURY } from './lib/agent-core';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'agent';
    status?: 'pending' | 'success' | 'error' | 'initiating' | 'broadcasting' | 'securing' | 'info';
    hash?: string;
    provider?: string;
}

const QUICK_ACTIONS = [
    { label: '💸 Send Solana', prompt: 'Send 0.05 USDC from Solana to ', fillOnly: true },
    { label: '💸 Send USDC', prompt: 'Send 0.05 USDC to ', fillOnly: true },
    { label: '₦ Send NGN', prompt: 'Send 5000 NGN to ', fillOnly: true },
    { label: 'KES Send', prompt: 'Send 500 KES to ', fillOnly: true },
    { label: '💰 Balance', prompt: 'What is my current balance?', fillOnly: false },
    { label: '📈 NGN Rate', prompt: 'What is the NGN exchange rate?', fillOnly: false },
    { label: '🌍 KES Rate', prompt: 'What is the KES exchange rate?', fillOnly: false },
    { label: '🤖 Help', prompt: 'What can you do?', fillOnly: false },
];

const spring = { type: 'spring', damping: 22, stiffness: 300 };

const App: React.FC = () => {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { data: walletClientRaw } = useWalletClient();
    const publicClientRaw = usePublicClient();
    const isTestnet = chainId === 11155111 || chainId === 44787;
    const isCeloMainnet = chainId === 42220;
    const currentRegistry = isCeloMainnet ? ERC8004_REGISTRY_MAINNET : ERC8004_REGISTRY_SEPOLIA;
    const explorerUrl = isTestnet ? 'https://sepolia.celoscan.io' : 'https://celoscan.io';
    const networkName = isCeloMainnet ? 'Celo Mainnet ✓' : isTestnet ? 'Celo Sepolia' : 'Unknown Net';

    const { open } = useAppKit();
    const agent = useAgent();

    const [view, setView] = useState<'chat' | 'dashboard'>('chat');
    const [messages, setMessages] = useState<Message[]>([{ id: '1', text: "👋 Hey there! I'm CRIA, your friendly Celo finance buddy. \n\nI can help you send money globally in seconds, remember your favorite contacts, and even save you a ton on fees! \n\nHow can I help you today? ✨", sender: 'agent', status: 'info', provider: 'gemini' }]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('cria_v2_seen'));
    const [history, setHistory] = useState<TransactionHistory[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [liveRate, setLiveRate] = useState<string>('...');
    const [agentId, setAgentId] = useState<string | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isSendingDemo, setIsSendingDemo] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [tourStep, setTourStep] = useState<number | null>(null);
    const [spotlightRect, setSpotlightRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const TOUR_STEPS = [
        { id: 'tour-wallet', title: 'Connect Your Wallet', content: 'First things first! Connect your Celo wallet to start sending funds globally.', position: 'bottom' },
        { id: 'tour-view-toggle', title: 'Dashboard & Chat', content: 'Switch between the AI Chat and your personal Dashboard to see your stats.', position: 'bottom' },
        { id: 'tour-actions', title: 'Quick Actions', content: 'Use these shortcuts to check rates or start a transfer with one tap.', position: 'top' },
        { id: 'tour-input', title: 'Talk to CRIA', content: 'Just say "Send 10 to Mom" or "NGN rate". CRIA understands natural language!', position: 'top' },
    ];

    useEffect(() => {
        if (tourStep !== null && containerRef.current) {
            const step = TOUR_STEPS[tourStep];
            const el = document.getElementById(step.id);
            if (el) {
                const rect = el.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();
                setSpotlightRect({ 
                    x: rect.x - containerRect.x, 
                    y: rect.y - containerRect.y, 
                    width: rect.width, 
                    height: rect.height 
                });
            }
        } else {
            setSpotlightRect(null);
        }
    }, [tourStep]);

    // Handle window resize for spotlight
    useEffect(() => {
        const handleResize = () => {
            if (tourStep !== null && containerRef.current) {
                const step = TOUR_STEPS[tourStep];
                const el = document.getElementById(step.id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const containerRect = containerRef.current.getBoundingClientRect();
                    setSpotlightRect({ 
                        x: rect.x - containerRect.x, 
                        y: rect.y - containerRect.y, 
                        width: rect.width, 
                        height: rect.height 
                    });
                }
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [tourStep]);

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        });
    }, []);

    const AGENT_REGISTRY = `eip155:${chainId}:${currentRegistry}`;
    const AGENTSCAN_URL = `https://www.agentscan.io/agents/${chainId}/${currentRegistry}`;
    const APP_URL = 'https://celo-agent-mobile.vercel.app';

    const startSpeechRecognition = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            alert("Speech recognition not supported in this browser. Please try Chrome or Safari.");
            return;
        }
    
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
    
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error("Speech Recognition Error", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                alert("Microphone access denied. Please enable it in your browser settings.");
            }
        };
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            if (event.results[0].isFinal) {
                setIsListening(false);
                // Optional: auto-send on final result
                // handleSend(transcript);
            }
        };
    
        try {
            recognition.start();
        } catch (e) {
            console.error("Failed to start recognition:", e);
            setIsListening(false);
        }
    };

    const handleDemoTx = async () => {
        if (!agent || isSendingDemo) return;
        setIsSendingDemo(true);
        const demoPrompt = 'Send 0.01 USDC to 0xF622F2b62bd76D9D7e66f5085e2f9f30fA36748A';
        setView('chat');
        await handleSend(demoPrompt);
        setIsSendingDemo(false);
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
    useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

    useEffect(() => {
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
            .then(r => r.json())
            .then(d => { if (d.rates?.NGN) setLiveRate(`₦${Math.round(d.rates.NGN).toLocaleString()}`); })
            .catch(() => setLiveRate('₦1,600'));
    }, []);

    useEffect(() => {
        if (publicClientRaw) {
            const fetchGlobalAgentId = async () => {
                try {
                    const balance = await publicClientRaw.readContract({
                        address: currentRegistry,
                        abi: ERC8004_ABI,
                        functionName: 'balanceOf',
                        args: [AGENT_TREASURY as `0x${string}`],
                    });
                    if (balance > 0n) {
                        // tokenOfOwnerByIndex is not supported on these registries —
                        // use known agent IDs from deployment transactions
                        const knownIds: Record<number, string> = {
                            42220: '2335',  // Celo Mainnet  — tx 0x4cd0ccf...
                            44787: '39',    // Celo Sepolia  — previously registered
                        };
                        const known = knownIds[chainId];
                        if (known) setAgentId(known);
                    }
                } catch (e) {
                    console.warn("Failed to fetch agent ID:", e);
                }
            };
            fetchGlobalAgentId();
        }
    }, [publicClientRaw, currentRegistry, chainId]);

    useEffect(() => {
        if (view === 'dashboard' && agent) {
            setIsLoadingHistory(true);
            agent.getTransactionHistory(AGENT_TREASURY as `0x${string}`)
                .then(setHistory).catch(console.error)
                .finally(() => setIsLoadingHistory(false));
        }
    }, [view, agent]);

    const handleSend = async (customText?: string) => {
        const text = customText || input;
        if (!text.trim() || isTyping) return;

        setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user' }]);
        if (!customText) setInput('');

        if (!isConnected) {
            setTimeout(() => setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "Connect your wallet first to get started! Tap the wallet icon ↗",
                sender: 'agent', status: 'info'
            }]), 300);
            return;
        }

        if (!agent) return;
        setIsTyping(true);
        const agentMsgId = (Date.now() + 1).toString();

        try {
            setMessages(prev => [...prev, { id: agentMsgId, text: "Analyzing intent...", sender: 'agent', status: 'initiating' }]);
            const result = await agent.processIntent(text);

            if (result.replyText) {
                setIsTyping(false);
                setMessages(prev => prev.map(m => m.id === agentMsgId ? {
                    ...m, text: result.replyText!, status: result.hash ? 'success' : 'info', provider: result.provider, hash: result.hash
                } : m));
                return;
            }

            // Send flow steps
            setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, text: `Broadcasting to ${networkName}...`, status: 'broadcasting' } : m));
            await new Promise(r => setTimeout(r, 1200));
            setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, text: "Confirming on-chain...", status: 'securing' } : m));
            await new Promise(r => setTimeout(r, 800));

            setIsTyping(false);
            const { intent, hash, provider, comparison } = result;

            let savingsText = '';
            if (comparison && comparison.savings > 0) {
                savingsText = `\n\n💰 **Celo Savings: $${comparison.savings}**\nCompared to Western Union ($${comparison.traditionalFee})`;
            }

            setMessages(prev => prev.map(m => m.id === agentMsgId ? {
                ...m,
                text: `✅ Sent ${intent.amount} ${intent.currency || 'USDC'} to ${intent.recipient?.slice(0, 6)}...${intent.recipient?.slice(-4)}\nFee: 0.01 ${intent.currency || 'USDC'} · ~5s settlement${savingsText}`,
                status: 'success', hash, provider
            } : m));
        } catch (err: any) {
            setIsTyping(false);
            setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, text: `❌ ${err.message}`, status: 'error' } : m));
        }
    };

    const handleRegisterAgent = async () => {
        if (!walletClientRaw || !publicClientRaw || isRegistering) return;
        setIsRegistering(true);
        try {
            const { agentId: id, txHash } = await registerAgentOnChain(walletClientRaw as any, publicClientRaw as any);
            setAgentId(id);
            localStorage.setItem('cria_agent_id', id);
            if (txHash) {
                setView('chat');
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: `🎉 CRIA registered on-chain!\nERC-8004 Agent ID: #${id}`,
                    sender: 'agent', status: 'success', hash: txHash
                }]);
            }
        } catch (err: any) {
            setView('chat');
            setMessages(prev => [...prev, { id: Date.now().toString(), text: `❌ Registration failed: ${err.message}`, sender: 'agent', status: 'error' }]);
        } finally {
            setIsRegistering(false);
        }
    };

    const rank = (() => {
        const c = history.length;
        if (c > 20) return { label: 'DIAMOND', color: 'text-cyan-400' };
        if (c > 10) return { label: 'GOLD', color: 'text-celo-gold' };
        if (c > 2) return { label: 'SILVER', color: 'text-gray-300' };
        return { label: 'NOVICE', color: 'text-white/50' };
    })();

    const totalValue = history.filter(t => t.status === 'sent').reduce((s, t) => s + parseFloat(t.amount), 0).toFixed(2);

    const dark = isDarkMode;

    return (
        <div ref={containerRef} className={`flex flex-col h-screen max-w-md mx-auto relative overflow-hidden font-sans transition-colors duration-500 ${dark ? 'bg-[#080B12] text-white' : 'bg-[#EEF1F6] text-[#1A1F2E]'}`}>

            {/* Ambient background blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className={`absolute -top-24 -left-16 w-80 h-80 rounded-full blur-[120px] transition-colors duration-700 ${dark ? 'bg-celo-green/10' : 'bg-celo-green/15'}`} />
                <div className={`absolute -bottom-24 -right-16 w-80 h-80 rounded-full blur-[120px] transition-colors duration-700 ${dark ? 'bg-celo-gold/8' : 'bg-celo-gold/15'}`} />
                <div className={`absolute top-1/2 left-1/3 w-48 h-48 rounded-full blur-[100px] ${dark ? 'bg-purple-500/5' : 'bg-purple-400/8'}`} />
            </div>

            {/* Welcome Modal */}
            <AnimatePresence>
                {showWelcome && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-xl"
                    >
                        <motion.div
                            initial={{ scale: 0.88, y: 32 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.88, opacity: 0 }}
                            transition={spring}
                            className={`w-full max-w-[340px] rounded-[32px] p-7 relative overflow-hidden ${dark ? 'bg-[#0F1520] border border-white/10' : 'bg-white border border-gray-100'} shadow-2xl`}
                        >
                            {/* Gradient accent top */}
                            <div className="absolute inset-x-0 top-0 h-1 gradient-border rounded-t-[32px]" />

                            <div className="w-14 h-14 bg-gradient-to-br from-celo-gold via-amber-400 to-celo-green rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-celo-gold/30 float">
                                <Sparkles className="text-white w-7 h-7" />
                            </div>
                            <h2 className="text-[22px] font-black tracking-tight mb-1">Welcome to CRIA</h2>
                            <p className={`text-[13px] leading-relaxed mb-6 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
                                The fastest way to move money on Celo. Just talk to it.
                            </p>
                            <div className="space-y-3 mb-7">
                                {[
                                    { icon: <Zap size={12} className="text-celo-green" />, label: 'Natural language payments' },
                                    { icon: <Globe size={12} className="text-celo-green" />, label: 'Live exchange rates' },
                                    { icon: <ShieldCheck size={12} className="text-celo-green" />, label: 'ERC-8004 agent identity' },
                                    { icon: <CheckCircle2 size={12} className="text-celo-green" />, label: '~5 second settlement' },
                                ].map((f, i) => (
                                    <div key={i} className={`flex items-center gap-3 text-[13px] font-semibold ${dark ? 'text-white/80' : 'text-gray-700'}`}>
                                        <div className="w-6 h-6 rounded-lg bg-celo-green/15 flex items-center justify-center">{f.icon}</div>
                                        {f.label}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => { 
                                    setShowWelcome(false); 
                                    localStorage.setItem('cria_v2_seen', '1');
                                    setTourStep(0); // Start the tour right away
                                }}
                                className="btn-primary w-full py-4 text-[13px] tracking-widest uppercase"
                            >
                                Let's Go →
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── HEADER ── */}
            <header className={`sticky top-0 z-40 flex items-center justify-between px-5 py-3.5 border-b backdrop-blur-2xl transition-all ${dark ? 'border-white/6 bg-[#080B12]/80' : 'border-black/5 bg-[#EEF1F6]/80'}`}>
                <div className="flex items-center gap-3">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 8 }} whileTap={{ scale: 0.92 }}
                        className="w-10 h-10 bg-gradient-to-br from-celo-gold to-amber-400 rounded-[14px] flex items-center justify-center shadow-lg shadow-celo-gold/25"
                    >
                        <Bot className="text-white w-5 h-5" />
                    </motion.div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[16px] font-black tracking-tight">CRIA <span className="text-celo-green">PRO</span></span>
                            {agentId && (
                                <motion.span
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-celo-green/20 text-celo-green border border-celo-green/30"
                                >
                                    #{agentId}
                                </motion.span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full glow-dot ${isConnected ? 'bg-celo-green' : 'bg-amber-400'}`} />
                            <span className={`text-[9px] font-bold uppercase tracking-widest ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                                {isConnected ? `${networkName} · Live` : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button onClick={() => setIsDarkMode(!dark)}
                        className={`p-2 rounded-xl transition-all ${dark ? 'text-white/40 hover:text-white/80 hover:bg-white/6' : 'text-gray-400 hover:text-gray-700 hover:bg-black/5'}`}>
                        {dark ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <button id="tour-view-toggle"
                        onClick={() => setView(v => v === 'chat' ? 'dashboard' : 'chat')}
                        className={`p-2 rounded-xl transition-all ${view === 'dashboard' ? 'bg-celo-green/20 text-celo-green' : dark ? 'text-white/40 hover:text-white/80 hover:bg-white/6' : 'text-gray-400 hover:text-gray-700 hover:bg-black/5'}`}>
                        {view === 'chat' ? <LayoutDashboard size={16} /> : <MessageSquare size={16} />}
                    </button>
                    <button id="tour-wallet"
                        onClick={() => open()}
                        className={`p-2 rounded-xl transition-all active:scale-90 ${isConnected ? 'bg-celo-green/15 text-celo-green border border-celo-green/25' : dark ? 'text-white/40 hover:text-white/80 hover:bg-white/6' : 'text-gray-400 hover:bg-black/5'}`}>
                        <Wallet className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* ── VIEWS ── */}
            <AnimatePresence mode="wait">

                {/* ━━ CHAT ━━ */}
                {view === 'chat' ? (
                    <motion.div key="chat"
                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.22 }}
                        className="flex-1 flex flex-col overflow-hidden">


                        {/* Messages */}
                        <main className="flex-1 overflow-y-auto px-4 py-5 space-y-3 scrollbar-hide">
                            <AnimatePresence initial={false}>
                                {messages.map((m) => (
                                    <motion.div key={m.id}
                                        initial={{ opacity: 0, y: 14, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={spring}
                                        className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
                                    >
                                        {/* Avatar */}
                                        {m.sender === 'agent' && (
                                            <div className="w-7 h-7 flex-shrink-0 rounded-xl bg-gradient-to-br from-celo-gold to-amber-400 flex items-center justify-center shadow-md mb-0.5">
                                                <Bot size={13} className="text-white" />
                                            </div>
                                        )}

                                        <div className={`max-w-[78%] relative rounded-2xl px-4 py-3 ${
                                            m.sender === 'user'
                                                ? 'bg-gradient-to-br from-celo-green to-emerald-500 text-white rounded-br-[6px] shadow-lg shadow-celo-green/20'
                                                : m.status === 'error'
                                                    ? dark ? 'bg-red-500/12 border border-red-500/20 rounded-bl-[6px]' : 'bg-red-50 border border-red-200 rounded-bl-[6px]'
                                                    : m.status === 'success'
                                                        ? dark ? 'bg-celo-green/10 border border-celo-green/20 rounded-bl-[6px]' : 'bg-emerald-50 border border-emerald-300 rounded-bl-[6px]'
                                                        : dark ? 'bg-white/6 border border-white/8 rounded-bl-[6px]' : 'bg-white border border-gray-200 rounded-bl-[6px] shadow-sm'
                                        }`}>

                                            {/* Progress bar */}
                                            {m.status && !['success', 'error', 'info'].includes(m.status) && (
                                                <div className="flex gap-1 mb-2">
                                                    {['initiating', 'broadcasting', 'securing'].map((s, i) => {
                                                        const idx = ['initiating', 'broadcasting', 'securing'].indexOf(m.status || '');
                                                        return <div key={s} className={`h-[2px] flex-1 rounded-full transition-all duration-700 ${i <= idx ? i === idx ? 'bg-celo-green animate-pulse' : 'bg-celo-green' : dark ? 'bg-white/10' : 'bg-gray-200'}`} />;
                                                    })}
                                                </div>
                                            )}

                                            {/* Success badge */}
                                            {m.status === 'success' && (
                                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-celo-green rounded-full flex items-center justify-center shadow-md">
                                                    <CheckCircle2 size={11} className="text-white" />
                                                </div>
                                            )}

                                            <p className={`text-[13.5px] leading-relaxed whitespace-pre-line font-medium ${m.sender === 'user' ? 'text-white' : dark ? 'text-white/90' : 'text-gray-900'}`}>
                                                {m.text}
                                            </p>

                                            {(m.hash || m.provider) && (
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    {m.provider && (
                                                        <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${
                                                            m.provider === 'openai' ? 'text-blue-400 border-blue-400/20 bg-blue-400/8'
                                                            : m.provider === 'gemini' ? 'text-purple-400 border-purple-400/20 bg-purple-400/8'
                                                            : 'text-gray-400 border-gray-400/20 bg-gray-400/8'}`}>
                                                            {m.provider}
                                                        </span>
                                                    )}
                                                    {m.hash && (
                                                        <a href={`${explorerUrl}/tx/${m.hash}`} target="_blank" rel="noopener noreferrer"
                                                            className="text-[10px] flex items-center gap-1 font-bold text-celo-green bg-celo-green/10 border border-celo-green/25 px-2 py-0.5 rounded-full hover:bg-celo-green/20 transition-all">
                                                            <LinkIcon size={9} /> Verify on-chain
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}

                                {/* Typing indicator */}
                                {isTyping && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2">
                                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-celo-gold to-amber-400 flex items-center justify-center shadow-md">
                                            <Bot size={13} className="text-white" />
                                        </div>
                                        <div className={`px-4 py-3.5 rounded-2xl rounded-bl-[6px] flex gap-1.5 items-center ${dark ? 'bg-white/6 border border-white/8' : 'bg-white/90 border border-gray-100 shadow-sm'}`}>
                                            {[0, 150, 300].map((d, i) => (
                                                <span key={i} className="w-1.5 h-1.5 bg-celo-green rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </main>

                        {/* Rate + Quick Actions */}
                        <div className={`px-4 pt-3 pb-1 border-t backdrop-blur-xl ${dark ? 'border-white/5 bg-[#080B12]/60' : 'border-black/5 bg-[#EEF1F6]/60'}`}>
                            <div className="flex items-center justify-between px-1 mb-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-celo-green rounded-full animate-pulse" />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                                        1 USDC = {liveRate} · NGN
                                    </span>
                                </div>
                                <div className={`flex items-center gap-1 ${dark ? 'text-white/25' : 'text-gray-300'}`}>
                                    <Clock size={9} />
                                    <span className="text-[9px] font-bold">~5s settle</span>
                                </div>
                            </div>
                            <div id="tour-actions" className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                {QUICK_ACTIONS.map(a => (
                                    <button key={a.label} onClick={() => {
                                        if (a.fillOnly) {
                                            setInput(a.prompt);
                                            setTimeout(() => {
                                                const el = document.querySelector('input[type="text"]') as HTMLInputElement;
                                                el?.focus();
                                                el?.setSelectionRange(el.value.length, el.value.length);
                                            }, 50);
                                        } else {
                                            handleSend(a.prompt);
                                        }
                                    }} disabled={isTyping}
                                        className={`whitespace-nowrap px-3.5 py-2 rounded-full text-[11px] font-semibold border transition-all active:scale-95 disabled:opacity-40 ${dark ? 'bg-white/5 border-white/8 text-white/70 hover:bg-white/10' : 'bg-white/80 border-gray-200 text-gray-600 hover:bg-white'}`}>
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Input */}
                        <footer id="tour-input" className={`px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl ${dark ? 'bg-[#080B12]/80' : 'bg-[#EEF1F6]/80'}`}>
                            <div className="flex gap-2">

                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={isListening ? "Listening..." : "Tell CRIA what to do... (e.g. 'Hi!') "}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                    disabled={isTyping}
                                />
                                <button
                                    onClick={startSpeechRecognition}
                                    disabled={isTyping}
                                    className={`p-3 rounded-2xl transition-all shadow-md ${
                                        isListening ? 'bg-red-500 text-white' : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/80'
                                    }`}
                                >
                                    {isListening ? (
                                        <div className="relative">
                                            <MicOff size={20} />
                                            <span className="absolute -inset-1 rounded-full border-2 border-white/20 animate-ping" />
                                        </div>
                                    ) : (
                                        <Mic size={20} />
                                    )}
                                </button>
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isTyping}
                                    className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black p-3 rounded-2xl transition-all shadow-lg shadow-yellow-500/20"
                                >
                                    {isTyping ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                </button>
                            </div>
                            <p className={`text-center text-[9px] font-bold uppercase tracking-widest mt-2 ${dark ? 'text-white/20' : 'text-gray-300'}`}>
                                Encrypted · Celo L2 · ERC-8004
                            </p>
                        </footer>
                    </motion.div>

                ) : (
                    /* ━━ DASHBOARD ━━ */
                    <motion.div key="dash"
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.22 }}
                        className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-hide pb-8">

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Flows', value: history.length, icon: <BarChart3 size={18} />, accent: 'text-celo-green', bg: 'from-celo-green/15 to-emerald-500/5' },
                                { label: 'Value Sent', value: `$${totalValue}`, icon: <Coins size={18} />, accent: 'text-celo-gold', bg: 'from-celo-gold/15 to-amber-500/5' },
                            ].map(s => (
                                <div key={s.label} className={`bg-gradient-to-br ${s.bg} border ${dark ? 'border-white/6' : 'border-white/80'} rounded-[22px] p-5 backdrop-blur-xl group transition-all hover:scale-[1.02]`}>
                                    <div className={`${s.accent} mb-2 opacity-60 group-hover:opacity-100 transition-opacity`}>{s.icon}</div>
                                    <p className={`text-[9px] font-black uppercase tracking-[0.18em] mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{s.label}</p>
                                    <h3 className="text-2xl font-black">{s.value}</h3>
                                </div>
                            ))}
                        </div>

                        {/* Agent Passport */}
                        <div className="relative">
                            <div className="absolute -inset-[1px] rounded-[26px] gradient-border opacity-50 blur-sm" />
                            <div className={`relative rounded-[26px] p-6 border ${dark ? 'bg-[#0C1018] border-white/8' : 'bg-white/95 border-white/60'} backdrop-blur-2xl`}>
                                <div className="flex justify-between items-center mb-5">
                                    <div>
                                        <h2 className="text-[16px] font-black tracking-tight uppercase">Agent Passport</h2>
                                        <p className={`text-[9px] font-black uppercase tracking-widest ${dark ? 'text-white/30' : 'text-gray-400'}`}>ERC-8004 · Soulbound Identity</p>
                                    </div>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${agentId ? 'bg-celo-green/15 border-celo-green/30 text-celo-green' : dark ? 'bg-white/5 border-white/8 text-white/30' : 'bg-gray-100 border-gray-200 text-gray-300'}`}>
                                        <ShieldCheck size={20} />
                                    </div>
                                </div>

                                {isConnected ? (
                                    <div className="space-y-0">
                                        {[
                                            { label: 'Agent Wallet', value: `${AGENT_TREASURY.slice(0, 10)}...${AGENT_TREASURY.slice(-6)}` },
                                            { label: 'Agent ID', value: agentId ? `#${agentId}` : 'Registered', valueClass: 'text-celo-green font-black text-lg' },
                                            { label: 'Status', value: 'ACTIVE', valueClass: 'text-celo-green font-black tracking-wider' },
                                        ].map((row, i) => (
                                            <div key={i} className={`flex justify-between items-center py-3 ${i < 2 ? `border-b ${dark ? 'border-white/6' : 'border-gray-100'}` : ''}`}>
                                                <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${dark ? 'text-white/35' : 'text-gray-400'}`}>{row.label}</span>
                                                <span className={`font-semibold text-[13px] ${row.valueClass || ''}`}>{row.value}</span>
                                            </div>
                                        ))}

                                        <div className="pt-4">
                                            <div className={`flex items-center gap-2 text-[12px] font-semibold ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                                                <CheckCircle2 size={14} className="text-celo-green" />
                                                Verified Identity · Discoverable on Celo
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => open()} className="btn-primary w-full py-3.5 text-[12px] tracking-widest uppercase">
                                        Connect Wallet
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Transmission Log */}
                        <div className={`rounded-[26px] p-5 border ${dark ? 'bg-white/3 border-white/6' : 'bg-white/70 border-white/70'} backdrop-blur-xl`}>
                            <div className="flex justify-between items-center mb-4">
                                <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${dark ? 'text-white/40' : 'text-gray-400'}`}>Transmission Log</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => {
                                        if (address && agent) {
                                            setIsLoadingHistory(true);
                                            agent.getTransactionHistory(address as `0x${string}`).then(setHistory).catch(console.error).finally(() => setIsLoadingHistory(false));
                                        }
                                    }} className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-white/25 hover:text-white/60 hover:bg-white/5' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}>
                                        <RefreshCw size={11} className={isLoadingHistory ? 'animate-spin text-celo-green' : ''} />
                                    </button>
                                    <span className="text-[9px] font-black text-celo-green bg-celo-green/12 border border-celo-green/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="w-1 h-1 bg-celo-green rounded-full animate-ping" /> LIVE
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {isLoadingHistory ? (
                                    [1, 2, 3].map(i => <div key={i} className={`h-14 rounded-[16px] shimmer ${dark ? 'bg-white/5' : 'bg-gray-100'}`} />)
                                ) : history.length > 0 ? (
                                    history.map(tx => (
                                        <motion.div key={tx.hash}
                                            whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}
                                            className={`flex items-center justify-between p-3.5 rounded-[18px] border transition-all ${dark ? 'bg-white/4 border-white/5 hover:bg-white/7' : 'bg-white/60 border-gray-100 hover:bg-white'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${tx.status === 'sent' ? 'bg-celo-green/15 text-celo-green' : 'bg-blue-500/15 text-blue-400'}`}>
                                                    {tx.status === 'sent' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-bold">{tx.amount} {tx.currency}</p>
                                                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-white/30' : 'text-gray-400'}`}>
                                                        {tx.status === 'sent' ? '→' : '←'} {tx.recipient.slice(0, 8)}...
                                                    </p>
                                                </div>
                                            </div>
                                            <a href={`${explorerUrl}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                                                className={`p-2 rounded-xl transition-all ${dark ? 'text-white/20 hover:text-celo-green hover:bg-celo-green/10' : 'text-gray-300 hover:text-celo-green hover:bg-celo-green/10'}`}>
                                                <ChevronRight size={15} />
                                            </a>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className={`text-center py-10 ${dark ? 'text-white/20' : 'text-gray-300'}`}>
                                        <Info className="mx-auto mb-2" size={28} />
                                        <p className="text-[12px] font-bold">No transactions yet</p>
                                        <p className="text-[11px] mt-0.5">Send your first remittance!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Spotlight Tour */}
            <AnimatePresence>
                {tourStep !== null && spotlightRect && (
                    <div className="absolute inset-0 z-[60] overflow-hidden pointer-events-none">
                        {/* SVG Mask Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 pointer-events-none"
                        >
                            <svg className="w-full h-full">
                                <defs>
                                    <mask id="spotlight-mask">
                                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                        <motion.rect
                                            initial={spotlightRect}
                                            animate={{ 
                                                x: spotlightRect.x - 8, 
                                                y: spotlightRect.y - 8, 
                                                width: spotlightRect.width + 16, 
                                                height: spotlightRect.height + 16,
                                                rx: 16
                                            }}
                                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                            fill="black"
                                        />
                                    </mask>
                                </defs>
                                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#spotlight-mask)" className="pointer-events-auto" onClick={() => setTourStep(null)} />
                            </svg>
                        </motion.div>

                        {/* Floating Tooltip */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ 
                                opacity: 1, 
                                scale: 1, 
                                x: Math.max(16, Math.min(375 - 316, spotlightRect.x + spotlightRect.width / 2 - 150)), // Clamped to mobile width (375-ish)
                                y: Math.max(80, Math.min(800, spotlightRect.y > 400 
                                    ? spotlightRect.y - 180 
                                    : spotlightRect.y + spotlightRect.height + 24))
                            }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`absolute z-[70] w-[300px] p-6 rounded-[24px] border shadow-2xl backdrop-blur-2xl ${dark ? 'bg-[#151B28]/95 border-white/10' : 'bg-white border-gray-300'} overflow-hidden shadow-celo-green/5 pointer-events-auto`}
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-celo-green" />
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-md bg-celo-green/20 flex items-center justify-center">
                                        <Sparkles size={12} className="text-celo-green" />
                                    </div>
                                    <h3 className="text-[12px] font-black uppercase tracking-widest text-celo-green">{TOUR_STEPS[tourStep].title}</h3>
                                </div>
                                <button onClick={() => setTourStep(null)} className={`${dark ? 'text-white/20 hover:text-white/60' : 'text-black/20 hover:text-black/60'} transition-colors`}>
                                    <X size={14} />
                                </button>
                            </div>
                            <p className={`text-[13px] font-medium leading-relaxed mb-6 ${dark ? 'text-white/60' : 'text-gray-700'}`}>
                                {TOUR_STEPS[tourStep].content}
                            </p>
                            <div className="flex justify-between items-center">
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => tourStep > 0 && setTourStep(tourStep - 1)}
                                        disabled={tourStep === 0}
                                        className={`text-[10px] font-bold uppercase tracking-tight transition-opacity ${tourStep === 0 ? 'opacity-0' : dark ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                                    >
                                        ← Back
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        if (tourStep < TOUR_STEPS.length - 1) {
                                            setTourStep(tourStep + 1);
                                        } else {
                                            setTourStep(null);
                                        }
                                    }}
                                    className={`bg-white text-black text-[11px] font-black px-5 py-2.5 rounded-xl hover:bg-celo-green hover:text-white transition-all shadow-lg active:scale-95 border ${!dark && 'border-gray-200'}`}
                                >
                                    {tourStep < TOUR_STEPS.length - 1 ? 'Next Step' : 'Finish ✨'}
                                </button>
                            </div>
                            <div className="mt-4 flex gap-1 justify-center">
                                {TOUR_STEPS.map((_, i) => (
                                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === tourStep ? 'w-6 bg-celo-green' : 'w-2 bg-white/10'}`} />
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default App;
