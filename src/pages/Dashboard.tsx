import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, Bell, Camera, MessageSquare, Mic, PlusSquare, User, Video } from "lucide-react";
import { useChatHistory } from "@/hooks/useChatHistory";
import { DataImportExport } from "@/components/DataImportExport";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { UserAvatar } from "@/components/UserAvatar";

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const navigate = useNavigate();
  const { loadChatSession } = useChatHistory(session);
  const { isOnline } = useOfflineSync();

  useEffect(() => {
    document.title = "Dashboard | Mise AI";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Mise AI Dashboard - Smart Chat, Image Scan, and Video Search on AI.");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const display = (data.session?.user?.user_metadata?.full_name as string) ||
        (data.session?.user?.email?.split("@")[0] as string) ||
        "Friend";
      setName(display);
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      const saved = await loadChatSession();
      if (saved?.messages) {
        const titles = saved.messages
          .filter((m) => m.sender === "user" && m.text.trim().length > 0)
          .slice(-5)
          .reverse()
          .map((m) => m.text.length > 60 ? m.text.slice(0, 57) + "…" : m.text);
        setHistory(titles);
      } else {
        try {
          const stored = localStorage.getItem("chat_history");
          if (stored) {
            const msgs = JSON.parse(stored) as { sender: string; text: string }[];
            const titles = msgs
              .filter((m) => m.sender === "user" && m.text.trim().length > 0)
              .slice(-5)
              .reverse()
              .map((m) => m.text.length > 60 ? m.text.slice(0, 57) + "…" : m.text);
            setHistory(titles);
          }
        } catch {}
      }
    };
    init();
  }, [loadChatSession]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 text-foreground">
      <header className="relative overflow-hidden p-6 sm:p-8 md:p-10">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="flex items-start justify-between relative">
          <button onClick={() => navigate("/profile")} className="flex items-center gap-3 hover-scale">
            <UserAvatar session={session} size={48} />
          </button>
          <button onClick={() => navigate("/notifications")} className="relative p-3 rounded-full border border-primary/30 bg-background/40 backdrop-blur-md hover:bg-primary/10 transition-colors">
            <Bell className="w-5 h-5 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-background text-[10px] grid place-items-center border-2 border-background">2</span>
          </button>
        </div>

        <div className="mt-6 sm:mt-8">
          <p className="text-sm text-muted-foreground">Hi, {name}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            What Would You Love To Have <span className="text-primary">Today</span>
          </h1>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => navigate("/")} className="rounded-full">
            Smart Chat
          </Button>
          <Button variant="outline" size="icon" className="rounded-full !w-12 !h-12">
            <Mic className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full !w-12 !h-12">
            <PlusSquare className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full !w-12 !h-12" onClick={() => navigate("/gemini-live")}>
            <Video className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="px-6 sm:px-8 md:px-10 pb-10">
        {/* Feature tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[
            { title: "Begin Smart Chat", icon: <MessageSquare className="w-6 h-6" />, to: "/" },
            { title: "Scan Image For AI", icon: <Camera className="w-6 h-6" />, to: "/image-scan" },
            { title: "Video Search On AI", icon: <Video className="w-6 h-6" />, to: "/gemini-live" },
          ].map((item) => (
            <Card key={item.title} className="relative rounded-3xl p-5 md:p-6 bg-background/60 border border-primary/20 hover:border-primary/40 transition-all backdrop-blur-xl hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-foreground/80">
                  <div className="w-10 h-10 grid place-items-center rounded-full bg-muted/40 border border-border/50 text-foreground/80">
                    {item.icon}
                  </div>
                </div>
                <button onClick={() => navigate(item.to)} className="w-9 h-9 rounded-full grid place-items-center border border-primary/50 text-primary hover:bg-primary/10 transition-colors">
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-10 text-lg font-medium">{item.title}</div>
            </Card>
          ))}
        </div>

        {/* Chat History */}
        <section className="mt-8 md:mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Chat History</h2>
            <Link to="/" className="story-link text-sm text-primary">See All</Link>
          </div>
          <div className="space-y-3">
            {history.length === 0 && (
              <div className="text-muted-foreground text-sm">No history yet. Start a conversation!</div>
            )}
            {history.map((h, idx) => (
              <button key={idx} onClick={() => navigate("/")} className="w-full flex items-center justify-between px-4 py-4 rounded-3xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full grid place-items-center bg-primary/20 text-primary border border-primary/30">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className="font-medium">{h}</span>
                </div>
                <ArrowUpRight className="w-5 h-5 text-primary" />
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <DataImportExport session={session} />
          {!isOnline && (
            <p className="text-sm text-muted-foreground mt-2">
              Offline mode: changes will sync when you're back online.
            </p>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
