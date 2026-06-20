import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 landscape-optimizations relative overflow-hidden">
      {/* Ocean Background mapping */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/60 via-slate-950 to-slate-950 pointer-events-none" />

      <main className="z-10 flex flex-col items-center">
        <header className="text-center mb-16">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight text-yellow-400 mb-6 drop-shadow-lg">
            CATAN CLONE
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-lg mx-auto leading-relaxed">
            A multiplayer web version of your favorite trading and building game.
          </p>
        </header>

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
          <Link href="/host" className="flex-1 bg-slate-800 hover:bg-slate-700 border-2 border-indigo-500 rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl transition transform hover:-translate-y-2 group">
            <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <span className="text-4xl">📺</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Host a Game</h2>
            <p className="text-slate-400">Open the game board on a large screen or TV for everyone to see.</p>
          </Link>

          <Link href="/play" className="flex-1 bg-slate-800 hover:bg-slate-700 border-2 border-green-500 rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl transition transform hover:-translate-y-2 group">
            <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <span className="text-4xl">📱</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Join a Game</h2>
            <p className="text-slate-400">Join as a player using your phone to manage resources and trade.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
