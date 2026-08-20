import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Home, Wallet, List, Settings as SettingsIcon, LogOut, ArrowUpRight,
  ArrowDownRight, Bell, Plus, X, ShieldCheck, Star, ChevronRight, Menu,
  TrendingUp, Search, Check, AlertCircle, CreditCard, Bitcoin, Copy,
  ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";

/* ----------------------------- design tokens ----------------------------- */
const T = {
  bg: "#FFFFFF",
  surface: "#F6F7F5",
  surfaceAlt: "#EFF1EE",
  border: "#E3E6E1",
  text: "#16211C",
  textMuted: "#5B665F",
  accent: "#0F5132",
  accentSoft: "#E7F0EA",
  pos: "#1E8E5A",
  neg: "#C1443A",
  promo: "#A66A00",
  promoSoft: "#FBF3E3",
};

const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
    .vf-serif { font-family: 'Fraunces', serif; }
    .vf-sans { font-family: 'Inter', -apple-system, sans-serif; }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 8px; }
    @keyframes vf-draw { from { stroke-dashoffset: 600; } to { stroke-dashoffset: 0; } }
    .vf-hero-path { stroke-dasharray: 600; animation: vf-draw 1.8s ease forwards; }
    @keyframes vf-fade { from { opacity:0; transform: translateY(6px);} to {opacity:1; transform:none;} }
    .vf-fade { animation: vf-fade .4s ease both; }
  `}</style>
);

/* ------------------------------ sim engine ------------------------------- */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genSeries(symbol, base, points, volatility) {
  const rand = mulberry32(hashStr(symbol + points));
  let price = base * (0.9 + rand() * 0.05);
  const data = [];
  for (let i = 0; i < points; i++) {
    const drift = (rand() - 0.48) * volatility * base;
    price = Math.max(price + drift, base * 0.4);
    data.push({ t: i, price: Number(price.toFixed(2)) });
  }
  data[data.length - 1].price = Number(base.toFixed(2));
  return data;
}

const ASSETS = [
  { symbol: "AAPL", name: "Apple", type: "stock", base: 227.5, vol: 0.012 },
  { symbol: "MSFT", name: "Microsoft", type: "stock", base: 415.2, vol: 0.01 },
  { symbol: "NVDA", name: "NVIDIA", type: "stock", base: 118.3, vol: 0.022 },
  { symbol: "AMZN", name: "Amazon", type: "stock", base: 186.4, vol: 0.014 },
  { symbol: "GOOGL", name: "Alphabet", type: "stock", base: 172.8, vol: 0.013 },
  { symbol: "BTC", name: "Bitcoin", type: "crypto", base: 68420.21, vol: 0.03 },
  { symbol: "ETH", name: "Ethereum", type: "crypto", base: 3450.1, vol: 0.035 },
  { symbol: "USDT", name: "Tether", type: "crypto", base: 1.0, vol: 0.0005 },
  { symbol: "BNB", name: "BNB", type: "crypto", base: 590.2, vol: 0.028 },
  { symbol: "SOL", name: "Solana", type: "crypto", base: 172.4, vol: 0.04 },
];

const TIME_FILTERS = { "1D": 24, "1W": 42, "1M": 60, "3M": 80, "1Y": 100, ALL: 140 };

function useAssetData() {
  return useMemo(() => {
    const map = {};
    ASSETS.forEach((a) => {
      const series = {};
      Object.entries(TIME_FILTERS).forEach(([k, pts]) => {
        series[k] = genSeries(a.symbol, a.base, pts, a.vol);
      });
      const day = series["1D"];
      const change = ((day[day.length - 1].price - day[0].price) / day[0].price) * 100;
      map[a.symbol] = { ...a, series, price: a.base, change24h: change };
    });
    return map;
  }, []);
}

const fmt = (n, d = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n) => `$${fmt(n)}`;

/* ------------------------------- storage --------------------------------- */
const USERS_KEY = "modibbo_users_v1";

async function loadUsers() {
  try {
    const r = await window.storage.get(USERS_KEY, false);
    return r ? JSON.parse(r.value) : {};
  } catch {
    return {};
  }
}
async function saveUsers(users) {
  try {
    await window.storage.set(USERS_KEY, JSON.stringify(users), false);
  } catch (e) {
    console.error("storage error", e);
  }
}

function seedUsers(assetMap) {
  const demoHoldings = [
    { symbol: "BTC", qty: 0.04, avgPrice: assetMap.BTC.base * 0.94 },
    { symbol: "AAPL", qty: 6, avgPrice: assetMap.AAPL.base * 0.9 },
  ];
  const demoTx = [
    { id: "t1", date: "2026-07-02", symbol: "AAPL", type: "BUY", qty: 6, price: assetMap.AAPL.base * 0.9, amount: 6 * assetMap.AAPL.base * 0.9, status: "Completed" },
    { id: "t2", date: "2026-07-14", symbol: "BTC", type: "BUY", qty: 0.04, price: assetMap.BTC.base * 0.94, amount: 0.04 * assetMap.BTC.base * 0.94, status: "Completed" },
    { id: "t3", date: "2026-07-01", symbol: null, type: "PROMO_CREDIT", qty: null, price: null, amount: 100, status: "Completed" },
  ];
  return {
    "demo@modibbo.com": {
      firstName: "Jordan", lastName: "Demo", email: "demo@modibbo.com", password: "demo1234",
      country: "United States", dob: "1998-04-12",
      cashBalance: 850, promoCredit: 100, promoRedeemed: true,
      holdings: demoHoldings, transactions: demoTx,
      watchlist: ["ETH", "NVDA"], notifications: [
        { id: "n1", text: "Your promotional credit has been added.", read: false },
        { id: "n2", text: "Your order for AAPL was completed.", read: true },
      ],
    },
    "admin@modibbo.com": {
      firstName: "Admin", lastName: "User", email: "admin@modibbo.com", password: "admin1234",
      country: "United States", dob: "1990-01-01", isAdmin: true,
      cashBalance: 0, promoCredit: 0, promoRedeemed: false,
      holdings: [], transactions: [], watchlist: [], notifications: [],
    },
  };
}

/* --------------------------------- app ------------------------------------ */
export default function App() {
  const assetMap = useAssetData();
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState({});
  const [sessionEmail, setSessionEmail] = useState(null);
  const [screen, setScreen] = useState("landing");
  const [authMode, setAuthMode] = useState("signup");
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [tradeState, setTradeState] = useState(null); // {symbol, side}
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    (async () => {
      let u = await loadUsers();
      if (!u["demo@modibbo.com"]) {
        u = { ...u, ...seedUsers(assetMap) };
        await saveUsers(u);
      }
      setUsers(u);
      setReady(true);
    })();
    // eslint-disable-next-line
  }, []);

  const user = sessionEmail ? users[sessionEmail] : null;

  const showToast = (msg, kind = "success") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  };

  const persist = useCallback(
    async (nextUsers) => {
      setUsers(nextUsers);
      await saveUsers(nextUsers);
    },
    []
  );

  const updateUser = (email, patch) => {
    const cur = users[email];
    const next = typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
    const nextUsers = { ...users, [email]: next };
    persist(nextUsers);
    return next;
  };

  const handleSignup = ({ firstName, lastName, email, password, country, dob, promo }) => {
    if (users[email]) { showToast("An account with that email already exists.", "error"); return; }
    let promoCredit = 0, promoRedeemed = false, txs = [];
    if (promo && promo.trim()) {
      if (promo.trim().toUpperCase() === "MODIBBO100") {
        promoCredit = 100; promoRedeemed = true;
        txs = [{ id: "t" + Date.now(), date: new Date().toISOString().slice(0, 10), symbol: null, type: "PROMO_CREDIT", qty: null, price: null, amount: 100, status: "Completed" }];
      } else {
        showToast("That promotional code is invalid or expired.", "error");
        return;
      }
    }
    const newUser = {
      firstName, lastName, email, password, country, dob,
      cashBalance: 0, promoCredit, promoRedeemed,
      holdings: [], transactions: txs, watchlist: [], notifications: promoCredit ? [{ id: "n" + Date.now(), text: "Your promotional credit has been added.", read: false }] : [],
    };
    const nextUsers = { ...users, [email]: newUser };
    persist(nextUsers);
    setSessionEmail(email);
    setScreen("dashboard");
    showToast(promoCredit ? "Account created — $100 promotional credit added." : "Account created.");
  };

  const handleLogin = (email, password) => {
    const u = users[email];
    if (!u || u.password !== password) { showToast("Incorrect email or password.", "error"); return; }
    setSessionEmail(email);
    setScreen(u.isAdmin ? "admin" : "dashboard");
  };

  const handleLogout = () => { setSessionEmail(null); setScreen("landing"); };

  const executeTrade = ({ symbol, side, qty, fundingSource }) => {
    const asset = assetMap[symbol];
    const price = asset.price;
    const orderValue = qty * price;
    const fee = orderValue * 0.0025;
    const total = orderValue + fee;

    updateUser(user.email, (cur) => {
      let cash = cur.cashBalance, promo = cur.promoCredit;
      const holdings = [...cur.holdings];
      const idx = holdings.findIndex((h) => h.symbol === symbol);

      if (side === "BUY") {
        if (fundingSource === "promo") {
          if (promo < total) return cur;
          promo -= total;
        } else {
          if (cash < total) return cur;
          cash -= total;
        }
        if (idx >= 0) {
          const h = holdings[idx];
          const newQty = h.qty + qty;
          const newAvg = (h.avgPrice * h.qty + price * qty) / newQty;
          holdings[idx] = { ...h, qty: newQty, avgPrice: newAvg };
        } else {
          holdings.push({ symbol, qty, avgPrice: price });
        }
      } else {
        if (idx < 0 || holdings[idx].qty < qty) return cur;
        holdings[idx] = { ...holdings[idx], qty: holdings[idx].qty - qty };
        cash += orderValue - fee;
        if (holdings[idx].qty <= 0.00001) holdings.splice(idx, 1);
      }

      const tx = {
        id: "t" + Date.now(), date: new Date().toISOString().slice(0, 10),
        symbol, type: side, qty, price, amount: total, status: "Completed",
      };
      return {
        ...cur, cashBalance: cash, promoCredit: promo,
        holdings, transactions: [tx, ...cur.transactions],
        notifications: [{ id: "n" + Date.now(), text: `Your order for ${symbol} was completed.`, read: false }, ...(cur.notifications || [])],
      };
    });
    showToast(`${side === "BUY" ? "Bought" : "Sold"} ${qty} ${symbol}.`);
    setTradeState(null);
  };

  const toggleWatch = (symbol) => {
    updateUser(user.email, (cur) => {
      const has = cur.watchlist.includes(symbol);
      return { ...cur, watchlist: has ? cur.watchlist.filter((s) => s !== symbol) : [...cur.watchlist, symbol] };
    });
  };

  const cardFee = (amount) => Math.max(amount * 0.029, 0.3);

  const doCardDeposit = (amount) => {
    const fee = cardFee(amount);
    updateUser(user.email, (cur) => ({
      ...cur,
      cashBalance: cur.cashBalance + amount,
      transactions: [{ id: "t" + Date.now(), date: new Date().toISOString().slice(0, 10), symbol: null, type: "DEPOSIT_CARD", qty: null, price: null, amount, fee, status: "Completed" }, ...cur.transactions],
      notifications: [{ id: "n" + Date.now(), text: `Your ${money(amount)} card deposit was successful.`, read: false }, ...(cur.notifications || [])],
    }));
    showToast("Simulated deposit successful.");
  };

  const doCryptoDeposit = (symbol, usdAmount) => {
    const price = assetMap[symbol].price;
    const qty = usdAmount / price;
    updateUser(user.email, (cur) => {
      const holdings = [...cur.holdings];
      const idx = holdings.findIndex((h) => h.symbol === symbol);
      if (idx >= 0) {
        const h = holdings[idx];
        const newQty = h.qty + qty;
        holdings[idx] = { ...h, qty: newQty, avgPrice: (h.avgPrice * h.qty + price * qty) / newQty };
      } else {
        holdings.push({ symbol, qty, avgPrice: price });
      }
      return {
        ...cur, holdings,
        transactions: [{ id: "t" + Date.now(), date: new Date().toISOString().slice(0, 10), symbol, type: "DEPOSIT_CRYPTO", qty, price, amount: usdAmount, fee: 0, status: "Completed" }, ...cur.transactions],
        notifications: [{ id: "n" + Date.now(), text: `Your ${symbol} crypto deposit was confirmed.`, read: false }, ...(cur.notifications || [])],
      };
    });
    showToast("Simulated deposit successful.");
  };

  const doCardWithdraw = (amount) => {
    if (amount > user.cashBalance) { showToast("That exceeds your withdrawable cash balance.", "error"); return; }
    const fee = cardFee(amount);
    updateUser(user.email, (cur) => ({
      ...cur,
      cashBalance: cur.cashBalance - amount,
      transactions: [{ id: "t" + Date.now(), date: new Date().toISOString().slice(0, 10), symbol: null, type: "WITHDRAWAL_CARD", qty: null, price: null, amount, fee, status: "Completed" }, ...cur.transactions],
      notifications: [{ id: "n" + Date.now(), text: `Your ${money(amount)} withdrawal has been completed.`, read: false }, ...(cur.notifications || [])],
    }));
    showToast("Simulated withdrawal successful.");
  };

  const doCryptoWithdraw = (symbol, qty) => {
    const holding = user.holdings.find((h) => h.symbol === symbol);
    if (!holding || qty > holding.qty) { showToast(`You don't have enough ${symbol} to withdraw that amount.`, "error"); return; }
    const price = assetMap[symbol].price;
    updateUser(user.email, (cur) => {
      const holdings = cur.holdings.map((h) => h.symbol === symbol ? { ...h, qty: h.qty - qty } : h).filter((h) => h.qty > 0.00001);
      return {
        ...cur, holdings,
        transactions: [{ id: "t" + Date.now(), date: new Date().toISOString().slice(0, 10), symbol, type: "WITHDRAWAL_CRYPTO", qty, price, amount: qty * price, fee: 0, status: "Completed" }, ...cur.transactions],
        notifications: [{ id: "n" + Date.now(), text: `Your ${symbol} withdrawal is processing.`, read: false }, ...(cur.notifications || [])],
      };
    });
    showToast("Simulated withdrawal submitted.");
  };

  if (!ready) {
    return (
      <div style={{ background: T.bg, color: T.text }} className="vf-sans min-h-screen flex items-center justify-center">
        <FontLoader />
        <div className="text-sm" style={{ color: T.textMuted }}>Loading MODIBBO…</div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh" }} className="vf-sans">
      <FontLoader />
      {toast && <Toast toast={toast} />}
      {!user && screen === "landing" && (
        <Landing onStart={() => { setAuthMode("signup"); setScreen("auth"); }} onLogin={() => { setAuthMode("login"); setScreen("auth"); }} />
      )}
      {!user && screen === "auth" && (
        <AuthScreen
          mode={authMode} setMode={setAuthMode}
          onSignup={handleSignup} onLogin={handleLogin}
          onBack={() => setScreen("landing")}
        />
      )}
      {user && !user.isAdmin && (
        <AppShell
          user={user} screen={screen} setScreen={setScreen}
          onLogout={handleLogout} navOpen={navOpen} setNavOpen={setNavOpen}
        >
          {screen === "dashboard" && (
            <Dashboard user={user} assetMap={assetMap} goAsset={(s) => { setActiveSymbol(s); setScreen("asset"); }} goMarkets={() => setScreen("markets")} />
          )}
          {screen === "markets" && (
            <Markets assetMap={assetMap} watchlist={user.watchlist} toggleWatch={toggleWatch}
              onOpen={(s) => { setActiveSymbol(s); setScreen("asset"); }} onTrade={(s, side) => setTradeState({ symbol: s, side })} />
          )}
          {screen === "asset" && activeSymbol && (
            <AssetDetail asset={assetMap[activeSymbol]} user={user}
              onBack={() => setScreen("markets")}
              onTrade={(side) => setTradeState({ symbol: activeSymbol, side })}
              onWatch={() => toggleWatch(activeSymbol)} isWatch={user.watchlist.includes(activeSymbol)} />
          )}
          {screen === "portfolio" && <Portfolio user={user} assetMap={assetMap} onOpen={(s) => { setActiveSymbol(s); setScreen("asset"); }} />}
          {screen === "wallet" && (
            <WalletScreen user={user} assetMap={assetMap} onDeposit={() => setScreen("deposit")} onWithdraw={() => setScreen("withdraw")} />
          )}
          {screen === "deposit" && (
            <DepositScreen user={user} assetMap={assetMap} onBack={() => setScreen("wallet")}
              onCardDeposit={doCardDeposit} onCryptoDeposit={doCryptoDeposit} />
          )}
          {screen === "withdraw" && (
            <WithdrawScreen user={user} assetMap={assetMap} onBack={() => setScreen("wallet")}
              onCardWithdraw={doCardWithdraw} onCryptoWithdraw={doCryptoWithdraw} />
          )}
          {screen === "transactions" && <Transactions user={user} />}
          {screen === "watchlist" && (
            <WatchlistScreen user={user} assetMap={assetMap} toggleWatch={toggleWatch}
              onOpen={(s) => { setActiveSymbol(s); setScreen("asset"); }} onTrade={(s, side) => setTradeState({ symbol: s, side })} />
          )}
          {screen === "settings" && <SettingsScreen user={user} onLogout={handleLogout} />}
        </AppShell>
      )}
      {user && user.isAdmin && <AdminScreen users={users} onLogout={handleLogout} />}
      {tradeState && (
        <TradeModal
          asset={assetMap[tradeState.symbol]} side={tradeState.side} user={user}
          onClose={() => setTradeState(null)} onConfirm={executeTrade}
          setSide={(side) => setTradeState((s) => ({ ...s, side }))}
        />
      )}
    </div>
  );
}

/* -------------------------------- toast ----------------------------------- */
function Toast({ toast }) {
  const ok = toast.kind !== "error";
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 vf-fade">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm"
        style={{ background: ok ? T.text : T.neg, color: "#fff" }}>
        {ok ? <Check size={14} /> : <AlertCircle size={14} />}
        {toast.msg}
      </div>
    </div>
  );
}

/* ------------------------------- landing ----------------------------------- */
function Landing({ onStart, onLogin }) {
  const hero = useMemo(() => genSeries("HERO", 100, 60, 0.02), []);
  const pathD = useMemo(() => {
    const w = 560, h = 160;
    const min = Math.min(...hero.map((d) => d.price));
    const max = Math.max(...hero.map((d) => d.price));
    return hero
      .map((d, i) => {
        const x = (i / (hero.length - 1)) * w;
        const y = h - ((d.price - min) / (max - min)) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [hero]);

  const Nav = () => (
    <div className="flex items-center justify-between px-5 md:px-10 py-5 border-b" style={{ borderColor: T.border }}>
      <div className="vf-serif text-xl tracking-tight">MODIBBO</div>
      <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: T.textMuted }}>
        <span>Markets</span><span>Features</span><span>How it works</span><span>Security</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button onClick={onLogin} className="hidden sm:block" style={{ color: T.text }}>Sign in</button>
        <button onClick={onStart} className="px-4 py-2 rounded-full text-white" style={{ background: T.accent }}>Get started</button>
      </div>
    </div>
  );

  return (
    <div>
      <Nav />
      <section className="px-5 md:px-10 pt-14 pb-16 md:pt-20 md:pb-24 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="vf-serif leading-[1.05] text-[2.6rem] md:text-6xl mb-5">Invest with clarity.</h1>
            <p className="text-base md:text-lg mb-8 max-w-md" style={{ color: T.textMuted }}>
              Build your portfolio with stocks and crypto through a simple, modern investment experience.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={onStart} className="px-6 py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Start investing</button>
              <button onClick={onStart} className="px-6 py-3 rounded-full text-sm font-medium border" style={{ borderColor: T.border }}>Explore markets</button>
            </div>
            <p className="text-xs mt-6" style={{ color: T.textMuted }}>Demo product — all market data and balances are simulated.</p>
          </div>
          <div className="rounded-2xl p-6 border" style={{ background: T.surface, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs" style={{ color: T.textMuted }}>Portfolio value</div>
                <div className="vf-serif text-2xl">$12,482.30</div>
              </div>
              <div className="text-sm px-2 py-1 rounded-full" style={{ background: T.accentSoft, color: T.pos }}>+1.50% today</div>
            </div>
            <svg viewBox="0 0 560 160" className="w-full h-32">
              <path d={pathD} fill="none" stroke={T.accent} strokeWidth="2.5" className="vf-hero-path" />
            </svg>
            <div className="text-xs mt-1" style={{ color: T.textMuted }}>Simulated performance, 1M view</div>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-10 py-14 border-t" style={{ borderColor: T.border, background: T.surface }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-sm uppercase tracking-wide mb-8" style={{ color: T.textMuted }}>Why MODIBBO</div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[
              ["Simple investing", "A clean, guided flow from account to first trade."],
              ["Powerful portfolio tools", "Track performance, allocation, and returns at a glance."],
              ["Stocks and crypto", "One account for equities and digital assets."],
              ["Secure account management", "Session controls, login history, and account settings."],
              ["Transparent experience", "Every trade, fee, and credit is recorded and visible."],
              ["Built to grow", "Architected to connect real market data when you're ready."],
            ].map(([t, d]) => (
              <div key={t} className="p-5 rounded-xl border" style={{ background: T.bg, borderColor: T.border }}>
                <div className="font-medium mb-1.5">{t}</div>
                <div className="text-sm" style={{ color: T.textMuted }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 md:px-10 py-14 max-w-6xl mx-auto">
        <div className="text-sm uppercase tracking-wide mb-8" style={{ color: T.textMuted }}>How it works</div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {["Create your account", "Fund your account", "Choose your investments", "Track your portfolio"].map((s, i) => (
            <div key={s}>
              <div className="vf-serif text-2xl mb-2" style={{ color: T.accent }}>{i + 1}</div>
              <div className="text-sm">{s}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-10 py-14 border-t" style={{ borderColor: T.border, background: T.surface }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3"><ShieldCheck size={18} style={{ color: T.accent }} /><div className="font-medium">Security</div></div>
          <p className="text-sm" style={{ color: T.textMuted }}>
            Passwords are never stored in plain text, financial actions are validated server-side in the production
            architecture, and every balance change is recorded as an auditable transaction. MODIBBO is a demo
            product — it is not a licensed or regulated financial institution, and no real funds are moved.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-10 py-16 text-center">
        <h2 className="vf-serif text-3xl mb-5">Your portfolio starts here.</h2>
        <button onClick={onStart} className="px-6 py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Start investing</button>
      </section>

      <footer className="px-5 md:px-10 py-8 border-t text-xs flex flex-wrap gap-x-6 gap-y-2" style={{ borderColor: T.border, color: T.textMuted }}>
        <span>About</span><span>Security</span><span>Help center</span><span>Terms</span><span>Privacy</span><span>Risk disclosure</span><span>Contact</span>
      </footer>
    </div>
  );
}

/* -------------------------------- auth ------------------------------------- */
function AuthScreen({ mode, setMode, onSignup, onLogin, onBack }) {
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", password: "", confirm: "", country: "", dob: "", promo: "" });
  const [loginF, setLoginF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submitSignup = (e) => {
    e.preventDefault();
    if (!f.firstName || !f.lastName || !f.email || !f.password) return setErr("Please fill in all required fields.");
    if (f.password !== f.confirm) return setErr("Passwords don't match.");
    setErr("");
    onSignup(f);
  };
  const submitLogin = (e) => {
    e.preventDefault();
    onLogin(loginF.email, loginF.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-sm mb-6" style={{ color: T.textMuted }}>← Back</button>
        <div className="vf-serif text-2xl mb-1">{mode === "signup" ? "Create your account" : "Welcome back"}</div>
        <p className="text-sm mb-6" style={{ color: T.textMuted }}>
          {mode === "signup" ? "Start investing in minutes." : "Sign in to your MODIBBO account."}
        </p>

        {mode === "signup" ? (
          <form onSubmit={submitSignup} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={f.firstName} onChange={set("firstName")} />
              <Input label="Last name" value={f.lastName} onChange={set("lastName")} />
            </div>
            <Input label="Email" type="email" value={f.email} onChange={set("email")} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Password" type="password" value={f.password} onChange={set("password")} />
              <Input label="Confirm password" type="password" value={f.confirm} onChange={set("confirm")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Country" value={f.country} onChange={set("country")} />
              <Input label="Date of birth" type="date" value={f.dob} onChange={set("dob")} />
            </div>
            <div>
              <Input label="Promo code (optional)" value={f.promo} onChange={set("promo")} placeholder="Have a promotional code? Enter it here." />
            </div>
            {err && <div className="text-sm" style={{ color: T.neg }}>{err}</div>}
            <button className="w-full py-3 rounded-full text-white text-sm font-medium mt-2" style={{ background: T.accent }}>Create account</button>
            <p className="text-xs text-center" style={{ color: T.textMuted }}>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")} className="underline" style={{ color: T.text }}>Sign in</button>
            </p>
          </form>
        ) : (
          <form onSubmit={submitLogin} className="space-y-3">
            <Input label="Email" type="email" value={loginF.email} onChange={(e) => setLoginF({ ...loginF, email: e.target.value })} />
            <Input label="Password" type="password" value={loginF.password} onChange={(e) => setLoginF({ ...loginF, password: e.target.value })} />
            <button className="w-full py-3 rounded-full text-white text-sm font-medium mt-2" style={{ background: T.accent }}>Sign in</button>
            <p className="text-xs text-center" style={{ color: T.textMuted }}>
              New here?{" "}
              <button type="button" onClick={() => setMode("signup")} className="underline" style={{ color: T.text }}>Create an account</button>
            </p>
            <p className="text-xs text-center pt-2" style={{ color: T.textMuted }}>
              Demo account: demo@modibbo.com / demo1234 · Admin: admin@modibbo.com / admin1234
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1" style={{ color: T.textMuted }}>{label}</span>
      <input {...props} className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm"
        style={{ borderColor: T.border, background: T.bg }} />
    </label>
  );
}

/* ------------------------------- app shell --------------------------------- */
const NAV_ITEMS = [
  { key: "dashboard", label: "Overview", icon: Home },
  { key: "markets", label: "Markets", icon: TrendingUp },
  { key: "portfolio", label: "Portfolio", icon: Wallet },
  { key: "wallet", label: "Wallet", icon: CreditCard },
  { key: "watchlist", label: "Watchlist", icon: Star },
  { key: "transactions", label: "Transactions", icon: List },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

function AppShell({ user, screen, setScreen, onLogout, children, navOpen, setNavOpen }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex flex-col w-56 border-r shrink-0" style={{ borderColor: T.border }}>
        <div className="vf-serif text-xl px-5 py-6">MODIBBO</div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setScreen(key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left"
              style={{ background: screen === key ? T.accentSoft : "transparent", color: screen === key ? T.accent : T.text }}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5 space-y-1">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ color: T.textMuted }}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex md:hidden items-center justify-between px-4 py-4 border-b" style={{ borderColor: T.border }}>
          <div className="vf-serif text-lg">MODIBBO</div>
          <button onClick={() => setNavOpen((v) => !v)}><Menu size={20} /></button>
        </header>
        {navOpen && (
          <div className="md:hidden px-4 py-3 border-b space-y-1" style={{ borderColor: T.border }}>
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => { setScreen(key); setNavOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left"
                style={{ background: screen === key ? T.accentSoft : "transparent", color: screen === key ? T.accent : T.text }}>
                <Icon size={16} /> {label}
              </button>
            ))}
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ color: T.textMuted }}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        )}
        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-5xl w-full mx-auto vf-fade">{children}</main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t flex items-center justify-around py-2 bg-white z-20" style={{ borderColor: T.border }}>
          {NAV_ITEMS.slice(0, 5).map(({ key, icon: Icon }) => (
            <button key={key} onClick={() => setScreen(key)} className="p-2 rounded-lg" style={{ color: screen === key ? T.accent : T.textMuted }}>
              <Icon size={20} />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ------------------------------- dashboard ---------------------------------- */
function portfolioValue(user, assetMap) {
  const holdingsValue = user.holdings.reduce((s, h) => s + h.qty * (assetMap[h.symbol]?.price || 0), 0);
  return holdingsValue + user.cashBalance + user.promoCredit;
}
function costBasis(user) {
  return user.holdings.reduce((s, h) => s + h.qty * h.avgPrice, 0);
}

function Dashboard({ user, assetMap, goAsset, goMarkets }) {
  const value = portfolioValue(user, assetMap);
  const basis = costBasis(user);
  const holdingsValue = value - user.cashBalance - user.promoCredit;
  const totalReturn = holdingsValue - basis;
  const totalReturnPct = basis > 0 ? (totalReturn / basis) * 100 : 0;
  const todayChangePct = 1.5;
  const todayChange = value * (todayChangePct / 100);

  const movers = Object.values(assetMap).slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm" style={{ color: T.textMuted }}>Good to see you,</div>
        <div className="vf-serif text-2xl">{user.firstName}</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border" style={{ background: T.surface, borderColor: T.border }}>
          <div className="text-xs mb-1" style={{ color: T.textMuted }}>Portfolio</div>
          <div className="vf-serif text-3xl mb-2">{money(value)}</div>
          <div className="text-sm flex items-center gap-1" style={{ color: T.pos }}>
            <ArrowUpRight size={14} /> {money(todayChange)} ({todayChangePct.toFixed(2)}%) today
          </div>
        </div>
        <div className="p-5 rounded-xl border" style={{ background: T.surface, borderColor: T.border }}>
          <div className="text-xs mb-1" style={{ color: T.textMuted }}>Total return</div>
          <div className="vf-serif text-3xl mb-2" style={{ color: totalReturn >= 0 ? T.pos : T.neg }}>
            {totalReturn >= 0 ? "+" : ""}{money(totalReturn)}
          </div>
          <div className="text-sm" style={{ color: T.textMuted }}>{totalReturnPct.toFixed(2)}% all time</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Available cash" value={money(user.cashBalance)} />
        <StatCard label="Promo credit" value={money(user.promoCredit)} promo />
        <StatCard label="Buying power" value={money(user.cashBalance + user.promoCredit)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Markets</div>
          <button onClick={goMarkets} className="text-sm flex items-center gap-0.5" style={{ color: T.accent }}>View all <ChevronRight size={14} /></button>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {movers.map((a) => <MiniAssetCard key={a.symbol} asset={a} onClick={() => goAsset(a.symbol)} />)}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, promo }) {
  return (
    <div className="p-4 rounded-xl border" style={{ background: promo ? T.promoSoft : T.surface, borderColor: T.border }}>
      <div className="text-xs mb-1" style={{ color: T.textMuted }}>{label}</div>
      <div className="text-lg font-medium" style={{ color: promo ? T.promo : T.text }}>{value}</div>
    </div>
  );
}

function MiniAssetCard({ asset, onClick }) {
  const up = asset.change24h >= 0;
  return (
    <button onClick={onClick} className="p-4 rounded-xl border text-left" style={{ borderColor: T.border }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium">{asset.symbol}</div>
          <div className="text-xs" style={{ color: T.textMuted }}>{asset.name}</div>
        </div>
        <div className="text-right">
          <div className="text-sm">{money(asset.price)}</div>
          <div className="text-xs flex items-center gap-0.5 justify-end" style={{ color: up ? T.pos : T.neg }}>
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(asset.change24h).toFixed(2)}%
          </div>
        </div>
      </div>
      <Sparkline data={asset.series["1D"]} up={up} />
    </button>
  );
}

function Sparkline({ data, up }) {
  return (
    <div style={{ height: 36 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="price" stroke={up ? T.pos : T.neg} strokeWidth={1.75} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------- markets ----------------------------------- */
function Markets({ assetMap, watchlist, toggleWatch, onOpen, onTrade }) {
  const [tab, setTab] = useState("stock");
  const list = Object.values(assetMap).filter((a) => a.type === tab);
  return (
    <div>
      <div className="vf-serif text-2xl mb-4">Markets</div>
      <div className="flex gap-2 mb-4">
        {[["stock", "Stocks"], ["crypto", "Crypto"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-1.5 rounded-full text-sm border"
            style={{ background: tab === k ? T.text : "transparent", color: tab === k ? "#fff" : T.text, borderColor: T.border }}>{l}</button>
        ))}
      </div>
      <div className="text-xs mb-3 px-1" style={{ color: T.textMuted }}>Simulated market data</div>
      <div className="space-y-2">
        {list.map((a) => (
          <AssetRow key={a.symbol} asset={a} isWatch={watchlist.includes(a.symbol)}
            onOpen={() => onOpen(a.symbol)} onWatch={() => toggleWatch(a.symbol)} onBuy={() => onTrade(a.symbol, "BUY")} />
        ))}
      </div>
    </div>
  );
}

function AssetRow({ asset, isWatch, onOpen, onWatch, onBuy }) {
  const up = asset.change24h >= 0;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: T.border }}>
      <button onClick={onWatch} className="shrink-0"><Star size={16} fill={isWatch ? T.promo : "none"} color={isWatch ? T.promo : T.textMuted} /></button>
      <button onClick={onOpen} className="flex-1 flex items-center gap-3 text-left min-w-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ background: T.accentSoft, color: T.accent }}>
          {asset.symbol.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{asset.symbol}</div>
          <div className="text-xs truncate" style={{ color: T.textMuted }}>{asset.name}</div>
        </div>
      </button>
      <div className="w-20 hidden sm:block"><Sparkline data={asset.series["1D"]} up={up} /></div>
      <div className="text-right w-24 shrink-0">
        <div className="text-sm">{money(asset.price)}</div>
        <div className="text-xs" style={{ color: up ? T.pos : T.neg }}>{up ? "+" : ""}{asset.change24h.toFixed(2)}%</div>
      </div>
      <button onClick={onBuy} className="text-xs px-3 py-1.5 rounded-full text-white shrink-0" style={{ background: T.accent }}>Buy</button>
    </div>
  );
}

/* ------------------------------ asset detail --------------------------------- */
function AssetDetail({ asset, user, onBack, onTrade, onWatch, isWatch }) {
  const [range, setRange] = useState("1M");
  const up = asset.change24h >= 0;
  const holding = user.holdings.find((h) => h.symbol === asset.symbol);
  const data = asset.series[range];
  const high = Math.max(...data.map((d) => d.price));
  const low = Math.min(...data.map((d) => d.price));

  return (
    <div>
      <button onClick={onBack} className="text-sm mb-4" style={{ color: T.textMuted }}>← Markets</button>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="vf-serif text-2xl">{asset.name}</div>
          <div className="text-sm" style={{ color: T.textMuted }}>{asset.symbol}</div>
        </div>
        <button onClick={onWatch}><Star size={20} fill={isWatch ? T.promo : "none"} color={isWatch ? T.promo : T.textMuted} /></button>
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <div className="vf-serif text-3xl">{money(asset.price)}</div>
        <div className="text-sm" style={{ color: up ? T.pos : T.neg }}>{up ? "+" : ""}{asset.change24h.toFixed(2)}%</div>
      </div>

      <div style={{ height: 220 }} className="mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke={T.border} vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip formatter={(v) => money(v)} labelFormatter={() => ""} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${T.border}` }} />
            <Line type="monotone" dataKey="price" stroke={up ? T.pos : T.neg} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-2 mb-6">
        {Object.keys(TIME_FILTERS).map((r) => (
          <button key={r} onClick={() => setRange(r)} className="px-2.5 py-1 rounded-full text-xs"
            style={{ background: range === r ? T.text : "transparent", color: range === r ? "#fff" : T.textMuted }}>{r}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <InfoCell label="24h high" value={money(high)} />
        <InfoCell label="24h low" value={money(low)} />
        <InfoCell label="Market cap" value={`$${(asset.base * 1e6 / 1e6 * 4.2e9).toExponential(2)}`} />
        <InfoCell label="Volume" value={`$${Math.round(asset.base * 3.1e6).toLocaleString()}`} />
      </div>

      <div className="p-4 rounded-xl border mb-6" style={{ borderColor: T.border, background: T.surface }}>
        <div className="text-sm font-medium mb-2">Your position</div>
        {holding ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <InfoCell label="Quantity" value={fmt(holding.qty, 4)} />
            <InfoCell label="Avg buy price" value={money(holding.avgPrice)} />
            <InfoCell label="Market value" value={money(holding.qty * asset.price)} />
            <InfoCell label="Unrealized P/L" value={money(holding.qty * (asset.price - holding.avgPrice))} pl={holding.qty * (asset.price - holding.avgPrice)} />
          </div>
        ) : (
          <div className="text-sm" style={{ color: T.textMuted }}>You don't hold any {asset.symbol}.</div>
        )}
      </div>

      <div className="flex gap-3 sticky bottom-4">
        <button onClick={() => onTrade("BUY")} className="flex-1 py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Buy</button>
        <button onClick={() => onTrade("SELL")} disabled={!holding} className="flex-1 py-3 rounded-full text-sm font-medium border disabled:opacity-40" style={{ borderColor: T.border }}>Sell</button>
      </div>
    </div>
  );
}

function InfoCell({ label, value, pl }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: T.textMuted }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: pl !== undefined ? (pl >= 0 ? T.pos : T.neg) : T.text }}>{value}</div>
    </div>
  );
}

/* -------------------------------- trade modal --------------------------------- */
function TradeModal({ asset, side, user, onClose, onConfirm, setSide }) {
  const [qty, setQty] = useState("");
  const [funding, setFunding] = useState(user.promoCredit > 0 ? "promo" : "cash");
  const [step, setStep] = useState("form");
  const holding = user.holdings.find((h) => h.symbol === asset.symbol);
  const q = parseFloat(qty) || 0;
  const orderValue = q * asset.price;
  const fee = orderValue * 0.0025;
  const total = orderValue + fee;
  const available = funding === "promo" ? user.promoCredit : user.cashBalance;
  const insufficientFunds = side === "BUY" && total > available;
  const insufficientQty = side === "SELL" && (!holding || q > holding.qty);
  const canReview = q > 0 && !insufficientFunds && !insufficientQty;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 vf-fade" style={{ background: T.bg }}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium">{side === "BUY" ? "Buy" : "Sell"} {asset.name}</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {step === "form" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {["BUY", "SELL"].map((s) => (
                <button key={s} onClick={() => setSide(s)} className="flex-1 py-2 rounded-full text-sm"
                  style={{ background: side === s ? T.text : T.surface, color: side === s ? "#fff" : T.text }}>{s === "BUY" ? "Buy" : "Sell"}</button>
              ))}
            </div>
            <Input label={`Quantity (${asset.symbol})`} type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00" />
            {side === "BUY" && (
              <div>
                <span className="block mb-1 text-sm" style={{ color: T.textMuted }}>Funding source</span>
                <div className="flex gap-2">
                  <button onClick={() => setFunding("promo")} disabled={user.promoCredit <= 0} className="flex-1 py-2 rounded-lg text-xs border disabled:opacity-40"
                    style={{ borderColor: T.border, background: funding === "promo" ? T.promoSoft : "transparent" }}>Promo credit ({money(user.promoCredit)})</button>
                  <button onClick={() => setFunding("cash")} className="flex-1 py-2 rounded-lg text-xs border"
                    style={{ borderColor: T.border, background: funding === "cash" ? T.accentSoft : "transparent" }}>Cash ({money(user.cashBalance)})</button>
                </div>
              </div>
            )}
            <div className="text-sm space-y-1.5 pt-2 border-t" style={{ borderColor: T.border }}>
              <Row label="Estimated price" value={money(asset.price)} />
              <Row label="Order value" value={money(orderValue)} />
              <Row label="Estimated fees" value={money(fee)} />
              <Row label="Total" value={money(total)} bold />
            </div>
            {insufficientFunds && <div className="text-xs" style={{ color: T.neg }}>Your order couldn't be completed because you don't have enough available funds.</div>}
            {insufficientQty && <div className="text-xs" style={{ color: T.neg }}>You don't have enough {asset.symbol} to sell that amount.</div>}
            <button disabled={!canReview} onClick={() => setStep("confirm")} className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40" style={{ background: T.accent }}>Review order</button>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="text-sm">{side === "BUY" ? "Buy" : "Sell"} {q} {asset.symbol}</div>
            <div className="text-sm space-y-1.5">
              <Row label="Estimated price" value={money(asset.price)} />
              <Row label="Order value" value={money(orderValue)} />
              {side === "BUY" && <Row label="Funding source" value={funding === "promo" ? "Promotional credit" : "Cash balance"} />}
              <Row label="Total" value={money(total)} bold />
            </div>
            <button onClick={() => onConfirm({ symbol: asset.symbol, side, qty: q, fundingSource: funding })}
              className="w-full py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>
              Confirm {side === "BUY" ? "purchase" : "sale"}
            </button>
            <button onClick={() => setStep("form")} className="w-full text-sm" style={{ color: T.textMuted }}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: T.textMuted }}>{label}</span>
      <span style={{ fontWeight: bold ? 600 : 400 }}>{value}</span>
    </div>
  );
}

/* -------------------------------- portfolio ----------------------------------- */
function Portfolio({ user, assetMap, onOpen }) {
  const value = portfolioValue(user, assetMap);
  const stocksVal = user.holdings.filter((h) => assetMap[h.symbol]?.type === "stock").reduce((s, h) => s + h.qty * assetMap[h.symbol].price, 0);
  const cryptoVal = user.holdings.filter((h) => assetMap[h.symbol]?.type === "crypto").reduce((s, h) => s + h.qty * assetMap[h.symbol].price, 0);
  const cashVal = user.cashBalance + user.promoCredit;

  if (user.holdings.length === 0) {
    return (
      <div>
        <div className="vf-serif text-2xl mb-4">Portfolio</div>
        <EmptyState title="Your portfolio is waiting." cta="Explore markets" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs" style={{ color: T.textMuted }}>Total portfolio value</div>
        <div className="vf-serif text-3xl">{money(value)}</div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Allocation</div>
        <AllocBar label="Stocks" value={stocksVal} total={value} color={T.accent} />
        <AllocBar label="Crypto" value={cryptoVal} total={value} color="#7A5CFF" />
        <AllocBar label="Cash & credit" value={cashVal} total={value} color={T.promo} />
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Holdings</div>
        <div className="space-y-2">
          {user.holdings.map((h) => {
            const a = assetMap[h.symbol];
            const mv = h.qty * a.price;
            const pl = mv - h.qty * h.avgPrice;
            const plPct = (pl / (h.qty * h.avgPrice)) * 100;
            return (
              <button key={h.symbol} onClick={() => onOpen(h.symbol)} className="w-full flex items-center justify-between p-3 rounded-xl border text-left" style={{ borderColor: T.border }}>
                <div>
                  <div className="text-sm font-medium">{h.symbol}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>{fmt(h.qty, 4)} · avg {money(h.avgPrice)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{money(mv)}</div>
                  <div className="text-xs" style={{ color: pl >= 0 ? T.pos : T.neg }}>{pl >= 0 ? "+" : ""}{money(pl)} ({plPct.toFixed(1)}%)</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AllocBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1"><span style={{ color: T.textMuted }}>{label}</span><span>{pct.toFixed(1)}%</span></div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: T.surfaceAlt }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ------------------------------ transactions ----------------------------------- */
function Transactions({ user }) {
  if (user.transactions.length === 0) return <div><div className="vf-serif text-2xl mb-4">Transactions</div><EmptyState title="No transactions yet." /></div>;
  return (
    <div>
      <div className="vf-serif text-2xl mb-4">Transactions</div>
      <div className="space-y-2">
        {user.transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: T.border }}>
            <div>
              <div className="text-sm font-medium">{t.type.replace("_", " ")}{t.symbol ? ` · ${t.symbol}` : ""}</div>
              <div className="text-xs" style={{ color: T.textMuted }}>{t.date}{t.qty ? ` · ${fmt(t.qty, 4)} units` : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-sm">{money(t.amount)}</div>
              <div className="text-xs" style={{ color: T.pos }}>{t.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- wallet -------------------------------------- */
function WalletScreen({ user, assetMap, onDeposit, onWithdraw }) {
  const cryptoVal = user.holdings.filter((h) => assetMap[h.symbol]?.type === "crypto").reduce((s, h) => s + h.qty * assetMap[h.symbol].price, 0);
  const total = user.cashBalance + user.promoCredit + cryptoVal;
  const activity = user.transactions.filter((t) => t.type.startsWith("DEPOSIT") || t.type.startsWith("WITHDRAWAL"));

  return (
    <div className="space-y-6">
      <div className="vf-serif text-2xl">Wallet</div>

      <div className="p-5 rounded-xl border" style={{ background: T.surface, borderColor: T.border }}>
        <div className="text-xs mb-1" style={{ color: T.textMuted }}>Total portfolio</div>
        <div className="vf-serif text-3xl mb-4">{money(total)}</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Cash balance" value={money(user.cashBalance)} />
          <Row label="Crypto holdings" value={money(cryptoVal)} />
          <Row label="Promo trading credit" value={money(user.promoCredit)} />
          <Row label="Withdrawable" value={money(user.cashBalance)} bold />
        </div>
        <div className="text-xs mt-3" style={{ color: T.textMuted }}>
          Promotional credit can only be used for trading — it can't be withdrawn or transferred.
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onDeposit} className="flex-1 py-3 rounded-full text-white text-sm font-medium flex items-center justify-center gap-2" style={{ background: T.accent }}>
          <ArrowDownToLine size={16} /> Add funds
        </button>
        <button onClick={onWithdraw} className="flex-1 py-3 rounded-full text-sm font-medium border flex items-center justify-center gap-2" style={{ borderColor: T.border }}>
          <ArrowUpFromLine size={16} /> Withdraw
        </button>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Recent activity</div>
        {activity.length === 0 ? (
          <EmptyState title="No deposits or withdrawals yet." />
        ) : (
          <div className="space-y-2">
            {activity.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: T.border }}>
                <div>
                  <div className="text-sm font-medium">{t.type.replace("_", " ")}{t.symbol ? ` · ${t.symbol}` : ""}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>{t.date}</div>
                </div>
                <div className="text-sm">{money(t.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- deposit --------------------------------------- */
function DepositScreen({ user, assetMap, onBack, onCardDeposit, onCryptoDeposit }) {
  const [method, setMethod] = useState(null); // 'card' | 'crypto'
  const [step, setStep] = useState("amount");
  const [amount, setAmount] = useState("");
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [asset, setAsset] = useState("BTC");
  const [simAmount, setSimAmount] = useState("");

  const amt = parseFloat(amount) || 0;
  const fee = Math.max(amt * 0.029, amt > 0 ? 0.3 : 0);

  const back = () => {
    if (step === "amount" && method) { setMethod(null); return; }
    if (step === "amount" && !method) { onBack(); return; }
    if (step === "details") { setStep("amount"); return; }
    if (step === "review") { setStep("details"); return; }
    onBack();
  };

  if (!method) {
    return (
      <div className="max-w-md">
        <button onClick={onBack} className="text-sm mb-4" style={{ color: T.textMuted }}>← Wallet</button>
        <div className="vf-serif text-2xl mb-1">Add funds</div>
        <p className="text-sm mb-6" style={{ color: T.textMuted }}>Choose how you'd like to fund your MODIBBO account.</p>
        <div className="space-y-3">
          <MethodCard icon={CreditCard} title="Bank Card" desc="Deposit using Visa or Mastercard." onClick={() => { setMethod("card"); setStep("amount"); }} />
          <MethodCard icon={Bitcoin} title="Crypto" desc="Deposit using a supported cryptocurrency." onClick={() => { setMethod("crypto"); setStep("select"); }} />
        </div>
      </div>
    );
  }

  if (method === "card") {
    return (
      <div className="max-w-md">
        <button onClick={back} className="text-sm mb-4" style={{ color: T.textMuted }}>← Back</button>
        <div className="vf-serif text-2xl mb-4">Deposit with card</div>
        {step === "amount" && (
          <div className="space-y-4">
            <Input label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            <div className="text-sm space-y-1.5 p-3 rounded-lg" style={{ background: T.surface }}>
              <Row label="Minimum deposit" value="$10.00" />
              <Row label="Processing fee" value={money(fee)} />
              <Row label="Amount received" value={money(amt)} bold />
            </div>
            <button disabled={amt < 10} onClick={() => setStep("details")} className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40" style={{ background: T.accent }}>Continue</button>
          </div>
        )}
        {step === "details" && (
          <div className="space-y-3">
            <Input label="Cardholder name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
            <Input label="Card number" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="4242 4242 4242 4242" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Expiry" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} placeholder="MM/YY" />
              <Input label="CVV" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} placeholder="123" />
            </div>
            <p className="text-xs" style={{ color: T.textMuted }}>Simulated payment only — card details are never stored.</p>
            <button onClick={() => setStep("review")} className="w-full py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Continue</button>
          </div>
        )}
        {step === "review" && (
          <div className="space-y-4">
            <div className="text-sm space-y-1.5 p-3 rounded-lg" style={{ background: T.surface }}>
              <Row label="Amount" value={money(amt)} />
              <Row label="Payment method" value={`Card •••• ${card.number.slice(-4) || "4242"}`} />
              <Row label="Processing fee" value={money(fee)} />
              <Row label="Total charged" value={money(amt + fee)} bold />
              <Row label="Amount credited" value={money(amt)} bold />
            </div>
            <button onClick={() => { onCardDeposit(amt); setStep("success"); }} className="w-full py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Confirm deposit</button>
          </div>
        )}
        {step === "success" && (
          <DepositSuccess text={`${money(amt)} has been added to your MODIBBO cash balance.`} onDone={onBack} />
        )}
      </div>
    );
  }

  // crypto
  const price = assetMap[asset].price;
  const fakeAddress = "bc1q" + hashStr(asset + user.email).toString(16).padStart(12, "0");

  return (
    <div className="max-w-md">
      <button onClick={back} className="text-sm mb-4" style={{ color: T.textMuted }}>← Back</button>
      {step === "select" && (
        <div>
          <div className="vf-serif text-2xl mb-4">Deposit crypto</div>
          <div className="space-y-2">
            {["BTC", "ETH", "USDT", "BNB", "SOL"].map((s) => (
              <button key={s} onClick={() => { setAsset(s); setStep("address"); }} className="w-full flex items-center justify-between p-3 rounded-xl border text-sm" style={{ borderColor: T.border }}>
                <span>{assetMap[s].name} ({s})</span><ChevronRight size={16} style={{ color: T.textMuted }} />
              </button>
            ))}
          </div>
        </div>
      )}
      {step === "address" && (
        <div className="space-y-4">
          <div className="vf-serif text-2xl mb-1">Deposit {assetMap[asset].name}</div>
          <div className="p-4 rounded-xl border text-center" style={{ borderColor: T.border, background: T.surface }}>
            <div className="w-32 h-32 mx-auto mb-3 rounded-lg flex items-center justify-center text-xs" style={{ background: T.surfaceAlt, color: T.textMuted }}>QR code placeholder</div>
            <div className="text-xs mb-1" style={{ color: T.textMuted }}>Simulated deposit address</div>
            <div className="flex items-center justify-center gap-2">
              <code className="text-xs break-all">{fakeAddress}</code>
              <Copy size={14} style={{ color: T.textMuted }} />
            </div>
          </div>
          <div className="text-xs p-3 rounded-lg" style={{ background: T.promoSoft, color: T.promo }}>
            Only send {asset} to this address on its native network. Sending another asset or using the wrong network may result in permanent loss. This is a simulated address — no real funds should be sent.
          </div>
          <div className="pt-2 border-t" style={{ borderColor: T.border }}>
            <div className="text-sm font-medium mb-2">Simulate deposit received</div>
            <Input label={`Amount (${asset})`} type="number" min="0" step="any" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} placeholder="0.00" />
            <div className="text-xs my-2" style={{ color: T.textMuted }}>≈ {money((parseFloat(simAmount) || 0) * price)}</div>
            <button disabled={!(parseFloat(simAmount) > 0)} onClick={() => { onCryptoDeposit(asset, (parseFloat(simAmount) || 0) * price); setStep("success"); }}
              className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40" style={{ background: T.accent }}>Simulate deposit received</button>
          </div>
        </div>
      )}
      {step === "success" && (
        <DepositSuccess text={`Your simulated ${asset} deposit has been confirmed and added to your wallet.`} onDone={onBack} />
      )}
    </div>
  );
}

function DepositSuccess({ text, onDone }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: T.accentSoft }}>
        <Check size={22} style={{ color: T.accent }} />
      </div>
      <div className="font-medium mb-1">Simulated deposit successful</div>
      <p className="text-sm mb-6" style={{ color: T.textMuted }}>{text}</p>
      <button onClick={onDone} className="w-full py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Back to wallet</button>
    </div>
  );
}

function MethodCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-xl border text-left" style={{ borderColor: T.border }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: T.accentSoft, color: T.accent }}><Icon size={20} /></div>
      <div className="flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs" style={{ color: T.textMuted }}>{desc}</div>
      </div>
      <ChevronRight size={16} style={{ color: T.textMuted }} />
    </button>
  );
}

/* --------------------------------- withdraw --------------------------------------- */
function WithdrawScreen({ user, assetMap, onBack, onCardWithdraw, onCryptoWithdraw }) {
  const [method, setMethod] = useState(null);
  const [step, setStep] = useState("amount");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState(user.holdings.find((h) => assetMap[h.symbol]?.type === "crypto")?.symbol || "BTC");
  const [address, setAddress] = useState("");

  const amt = parseFloat(amount) || 0;
  const fee = Math.max(amt * 0.015, amt > 0 ? 1 : 0);
  const holding = user.holdings.find((h) => h.symbol === asset);
  const cryptoAvailable = holding ? holding.qty : 0;
  const cryptoFee = amt * 0.001;

  const back = () => {
    if (method && step === "amount") { setMethod(null); return; }
    if (step === "review") { setStep("amount"); return; }
    onBack();
  };

  if (!method) {
    return (
      <div className="max-w-md">
        <button onClick={onBack} className="text-sm mb-4" style={{ color: T.textMuted }}>← Wallet</button>
        <div className="vf-serif text-2xl mb-1">Withdraw funds</div>
        <p className="text-sm mb-6" style={{ color: T.textMuted }}>Choose where you'd like to send your funds.</p>
        <div className="space-y-3">
          <MethodCard icon={CreditCard} title="Bank Card" desc="Withdraw eligible cash to your linked payment method." onClick={() => { setMethod("card"); setStep("amount"); }} />
          <MethodCard icon={Bitcoin} title="Crypto" desc="Withdraw cryptocurrency to an external wallet." onClick={() => { setMethod("crypto"); setStep("amount"); }} />
        </div>
        <p className="text-xs mt-4" style={{ color: T.textMuted }}>Promotional trading credit can't be withdrawn.</p>
      </div>
    );
  }

  if (method === "card") {
    return (
      <div className="max-w-md">
        <button onClick={back} className="text-sm mb-4" style={{ color: T.textMuted }}>← Back</button>
        <div className="vf-serif text-2xl mb-1">Withdraw to card</div>
        <p className="text-sm mb-4" style={{ color: T.textMuted }}>Available to withdraw: {money(user.cashBalance)}</p>
        {step === "amount" && (
          <div className="space-y-4">
            <Input label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            {amt > user.cashBalance && <div className="text-xs" style={{ color: T.neg }}>That exceeds your withdrawable cash balance.</div>}
            <button disabled={!(amt >= 10) || amt > user.cashBalance} onClick={() => setStep("review")} className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40" style={{ background: T.accent }}>Review</button>
          </div>
        )}
        {step === "review" && (
          <div className="space-y-4">
            <div className="text-sm space-y-1.5 p-3 rounded-lg" style={{ background: T.surface }}>
              <Row label="Requested amount" value={money(amt)} />
              <Row label="Processing fee" value={money(fee)} />
              <Row label="Estimated received" value={money(amt - fee)} bold />
              <Row label="Estimated processing time" value="1–3 business days" />
            </div>
            <button onClick={() => { onCardWithdraw(amt); setStep("success"); }} className="w-full py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Confirm withdrawal</button>
          </div>
        )}
        {step === "success" && <DepositSuccess text={`Your ${money(amt)} withdrawal request has been submitted.`} onDone={onBack} />}
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <button onClick={back} className="text-sm mb-4" style={{ color: T.textMuted }}>← Back</button>
      <div className="vf-serif text-2xl mb-4">Withdraw crypto</div>
      {step === "amount" && (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="block mb-1" style={{ color: T.textMuted }}>Asset</span>
            <select value={asset} onChange={(e) => setAsset(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: T.border }}>
              {user.holdings.filter((h) => assetMap[h.symbol]?.type === "crypto").map((h) => <option key={h.symbol} value={h.symbol}>{h.symbol}</option>)}
              {user.holdings.filter((h) => assetMap[h.symbol]?.type === "crypto").length === 0 && <option value={asset}>{asset}</option>}
            </select>
          </label>
          <p className="text-xs" style={{ color: T.textMuted }}>Available balance: {fmt(cryptoAvailable, 4)} {asset}</p>
          <Input label="Wallet address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Destination wallet address" />
          <Input label={`Amount (${asset})`} type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          {amt > cryptoAvailable && <div className="text-xs" style={{ color: T.neg }}>You don't have enough {asset} to withdraw that amount.</div>}
          <div className="text-xs p-3 rounded-lg" style={{ background: T.promoSoft, color: T.promo }}>
            Crypto transactions cannot normally be reversed. Verify the wallet address and network before confirming.
          </div>
          <button disabled={!(amt > 0) || amt > cryptoAvailable || address.trim().length < 6} onClick={() => setStep("review")}
            className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40" style={{ background: T.accent }}>Review</button>
        </div>
      )}
      {step === "review" && (
        <div className="space-y-4">
          <div className="text-sm space-y-1.5 p-3 rounded-lg" style={{ background: T.surface }}>
            <Row label="Amount" value={`${fmt(amt, 6)} ${asset}`} />
            <Row label="Destination" value={address.slice(0, 10) + "…"} />
            <Row label="Network fee (est.)" value={`${fmt(cryptoFee, 6)} ${asset}`} />
            <Row label="Estimated received" value={`${fmt(amt - cryptoFee, 6)} ${asset}`} bold />
          </div>
          <button onClick={() => { onCryptoWithdraw(asset, amt); setStep("success"); }} className="w-full py-3 rounded-full text-white text-sm font-medium" style={{ background: T.accent }}>Confirm withdrawal</button>
        </div>
      )}
      {step === "success" && <DepositSuccess text={`Your ${asset} withdrawal is now processing.`} onDone={onBack} />}
    </div>
  );
}

/* -------------------------------- watchlist ------------------------------------ */
function WatchlistScreen({ user, assetMap, toggleWatch, onOpen, onTrade }) {
  const items = user.watchlist.map((s) => assetMap[s]).filter(Boolean);
  if (items.length === 0) return <div><div className="vf-serif text-2xl mb-4">Watchlist</div><EmptyState title="Nothing on your watchlist yet." /></div>;
  return (
    <div>
      <div className="vf-serif text-2xl mb-4">Watchlist</div>
      <div className="space-y-2">
        {items.map((a) => (
          <AssetRow key={a.symbol} asset={a} isWatch onOpen={() => onOpen(a.symbol)} onWatch={() => toggleWatch(a.symbol)} onBuy={() => onTrade(a.symbol, "BUY")} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- settings -------------------------------------- */
function SettingsScreen({ user, onLogout }) {
  return (
    <div className="space-y-6 max-w-md">
      <div className="vf-serif text-2xl">Settings</div>
      <div>
        <div className="text-sm font-medium mb-2">Personal information</div>
        <div className="rounded-xl border divide-y" style={{ borderColor: T.border }}>
          <SettingRow label="Name" value={`${user.firstName} ${user.lastName}`} />
          <SettingRow label="Email" value={user.email} />
          <SettingRow label="Country" value={user.country || "—"} />
          <SettingRow label="Date of birth" value={user.dob || "—"} />
        </div>
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Verification</div>
        <div className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: T.border }}>
          <span className="text-sm">Identity verification (KYC)</span>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: T.surfaceAlt, color: T.textMuted }}>Not started</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium mb-2">Security</div>
        <div className="rounded-xl border divide-y" style={{ borderColor: T.border }}>
          <SettingRow label="Password" value="••••••••" />
          <SettingRow label="Two-factor authentication" value="Off" />
        </div>
      </div>
      <button onClick={onLogout} className="w-full py-3 rounded-full text-sm font-medium border" style={{ borderColor: T.border }}>Log out</button>
    </div>
  );
}
function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between p-3 text-sm">
      <span style={{ color: T.textMuted }}>{label}</span><span>{value}</span>
    </div>
  );
}

/* --------------------------------- empty state ----------------------------------- */
function EmptyState({ title, cta }) {
  return (
    <div className="text-center py-16 rounded-xl border" style={{ borderColor: T.border, background: T.surface }}>
      <div className="text-sm mb-1" style={{ color: T.textMuted }}>{title}</div>
    </div>
  );
}

/* --------------------------------- admin ------------------------------------------ */
function AdminScreen({ users, onLogout }) {
  const list = Object.values(users).filter((u) => !u.isAdmin);
  const totalUsers = list.length;
  const totalPromo = list.filter((u) => u.promoRedeemed).length;
  const promoIssued = list.reduce((s, u) => s + (u.promoRedeemed ? 100 : 0), 0);
  const allTx = list.flatMap((u) => u.transactions);
  const trades = allTx.filter((t) => t.type === "BUY" || t.type === "SELL");
  const volume = trades.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: T.border }}>
        <div className="vf-serif text-xl">MODIBBO Admin</div>
        <button onClick={onLogout} className="text-sm flex items-center gap-2" style={{ color: T.textMuted }}><LogOut size={15} /> Log out</button>
      </div>
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AdminStat label="Total users" value={totalUsers} />
          <AdminStat label="Promo codes redeemed" value={totalPromo} />
          <AdminStat label="Promo credit issued" value={money(promoIssued)} />
          <AdminStat label="Trading volume" value={money(volume)} />
        </div>

        <div>
          <div className="font-medium mb-3">Deposits &amp; withdrawals</div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <AdminStat label="Total simulated deposits" value={money(allTx.filter((t) => t.type.startsWith("DEPOSIT")).reduce((s, t) => s + t.amount, 0))} />
            <AdminStat label="Total simulated withdrawals" value={money(allTx.filter((t) => t.type.startsWith("WITHDRAWAL")).reduce((s, t) => s + t.amount, 0))} />
          </div>
          <div className="space-y-2">
            {allTx.filter((t) => t.type.startsWith("DEPOSIT") || t.type.startsWith("WITHDRAWAL")).slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border text-sm" style={{ borderColor: T.border }}>
                <span>{t.type.replace("_", " ")}{t.symbol ? ` · ${t.symbol}` : ""}</span>
                <span style={{ color: T.textMuted }}>{money(t.amount)} · {t.status} · {t.date}</span>
              </div>
            ))}
            {allTx.filter((t) => t.type.startsWith("DEPOSIT") || t.type.startsWith("WITHDRAWAL")).length === 0 && (
              <div className="text-xs" style={{ color: T.textMuted }}>No deposit or withdrawal activity yet.</div>
            )}
          </div>
        </div>

        <div>
          <div className="font-medium mb-3">Promotional codes</div>
          <div className="rounded-xl border p-4" style={{ borderColor: T.border }}>
            <div className="flex items-center justify-between text-sm mb-1"><span className="font-medium">MODIBBO100</span><span className="px-2 py-0.5 rounded-full text-xs" style={{ background: T.accentSoft, color: T.accent }}>Active</span></div>
            <div className="text-xs" style={{ color: T.textMuted }}>Bonus $100 · Max redemptions 10,000 · Redeemed {totalPromo} times</div>
          </div>
        </div>

        <div>
          <div className="font-medium mb-3">Users</div>
          <div className="space-y-2">
            {list.map((u) => (
              <div key={u.email} className="flex items-center justify-between p-3 rounded-xl border text-sm" style={{ borderColor: T.border }}>
                <div>
                  <div className="font-medium">{u.firstName} {u.lastName}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>{u.email}</div>
                </div>
                <div className="text-right text-xs" style={{ color: T.textMuted }}>
                  Cash {money(u.cashBalance)} · Promo {money(u.promoCredit)} · {u.transactions.length} txns
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs" style={{ color: T.textMuted }}>
          Full admin tooling (KYC review, audit logs, per-user balance adjustments) is scoped out of this prototype — see the accompanying notes.
        </div>
      </div>
    </div>
  );
}
function AdminStat({ label, value }) {
  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: T.border, background: T.surface }}>
      <div className="text-xs mb-1" style={{ color: T.textMuted }}>{label}</div>
      <div className="text-xl font-medium">{value}</div>
    </div>
  );
}
