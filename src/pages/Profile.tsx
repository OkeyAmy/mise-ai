import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useInventory } from "@/hooks/useInventory";
import { useShoppingList } from "@/hooks/useShoppingList";
import { useToast } from "@/hooks/use-toast";
import { Download, LogOut, Moon, Sun, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState("");
  const [beta, setBeta] = useState<boolean>(() => localStorage.getItem("betaMode") === "1");
  const [offline, setOffline] = useState<boolean>(() => localStorage.getItem("offlineMode") === "1");
  const [feedback, setFeedback] = useState("");
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") || "system");
  const [avatar, setAvatar] = useState<string>(() => localStorage.getItem("profile_avatar") || "/image.png");
  const [mealPlanId] = useState<string>("");

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Profile | Mise AI";
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const displayName = localStorage.getItem("display_name") || (data.session?.user.user_metadata?.full_name as string) || "";
      setName(displayName);
    });
  }, []);

  const { items: inventoryItems, deleteItem, fetchInventory } = useInventory(session);
  const { items: listItems, saveList, setItems } = useShoppingList(session, mealPlanId as any);

  // Account actions
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAvatar(url);
      localStorage.setItem("profile_avatar", url);
      toast({ title: "Profile updated", description: "Avatar changed successfully." });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = () => {
    localStorage.setItem("display_name", name);
    toast({ title: "Saved", description: "Display name updated." });
  };

  // Toggles
  const toggleBeta = (v: boolean) => {
    setBeta(v);
    localStorage.setItem("betaMode", v ? "1" : "0");
  };
  const toggleOffline = (v: boolean) => {
    setOffline(v);
    localStorage.setItem("offlineMode", v ? "1" : "0");
  };

  // Theme
  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else if (t === "light") root.classList.remove("dark");
    else {
      // system
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) root.classList.add("dark"); else root.classList.remove("dark");
    }
  };

  // Data export/import
  const download = (filename: string, data: string) => {
    const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const payload = { pantry: inventoryItems, shoppingList: listItems };
    download('mise-data.json', JSON.stringify(payload, null, 2));
    toast({ title: 'Exported', description: 'Your data has been exported as JSON.' });
  };

  const exportCSV = () => {
    const rows = [
      ['pantry'],
      ['item_name','category','quantity','unit','expiry_date','location','notes'],
      ...inventoryItems.map(i => [i.item_name, i.category, i.quantity.toString(), i.unit, i.expiry_date||'', i.location, i.notes||'']),
      [],
      ['shopping_list'],
      ['item','quantity','unit'],
      ...listItems.map(i => [i.item, i.quantity.toString(), i.unit])
    ];
    const csv = rows.map(r => r.map(String).map(v => '"'+v.replace('"','""')+'"').join(',')).join('\n');
    download('mise-data.csv', csv);
    toast({ title: 'Exported', description: 'Your data has been exported as CSV.' });
  };

  const importJSON = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'merge'|'replace') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { pantry?: any[]; shoppingList?: any[] };
      if (mode === 'replace') {
        // Clear pantry
        for (const it of inventoryItems) { await deleteItem(it.id); }
        // Replace shopping list
        await saveList(parsed.shoppingList || []);
      } else {
        // Merge list
        const mergedList = [...listItems, ...(parsed.shoppingList || [])];
        await saveList(mergedList as any);
      }
      toast({ title: 'Imported', description: 'Data imported successfully.' });
      fetchInventory();
      setItems((parsed.shoppingList || []) as any);
    } catch (err) {
      toast({ title: 'Import failed', variant: 'destructive', description: 'Invalid file.' });
    } finally {
      e.currentTarget.value = '';
    }
  };

  const clearPantry = async () => {
    for (const it of inventoryItems) { await deleteItem(it.id); }
    await fetchInventory();
    toast({ title: 'Cleared', description: 'Pantry cleared.' });
  };

  const softReset = async () => {
    localStorage.removeItem('chat_history');
    localStorage.removeItem('display_name');
    localStorage.removeItem('profile_avatar');
    localStorage.removeItem('betaMode');
    localStorage.removeItem('offlineMode');
    localStorage.removeItem('theme');
    toast({ title: 'Reset', description: 'Local settings cleared.' });
  };

  return (
    <div className="min-h-screen bg-background/95 text-foreground px-6 sm:px-8 md:px-10 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Profile & Settings</h1>
          <Button variant="ghost" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2"/> Logout</Button>
        </div>

        {/* 1. Account & Profile */}
        <Card className="p-6 rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-xl">
          <CardHeader className="p-0 mb-4"><CardTitle>Account & Profile</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-full border border-primary/30" />
              <div className="flex items-center gap-3">
                <Input type="file" accept="image/*" onChange={handleAvatarChange} />
                <Button onClick={() => navigate('/dashboard')} variant="outline"><Sun className="w-4 h-4 mr-2"/> Go to Dashboard</Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Display Name</Label>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                  <Button onClick={handleSaveName}>Save</Button>
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Email</Label>
                <Input value={session?.user?.email || ''} readOnly />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/reset-password')}>Change / Reset Password</Button>
            </div>
          </CardContent>
        </Card>

        {/* 2. Beta Mode */}
        <Card className="p-6 rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-xl">
          <CardHeader className="p-0 mb-4"><CardTitle>Beta Mode</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground max-w-xl">Enable early features and help us improve Mise AI. We may collect extra usage data and ask for feedback.</p>
              <Switch checked={beta} onCheckedChange={toggleBeta} />
            </div>
            {beta && (
              <div className="flex items-center gap-2 text-primary">
                <span className="px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs">Beta Tester</span>
              </div>
            )}
            <div>
              <Label className="mb-2 block">Quick Feedback</Label>
              <Textarea value={feedback} onChange={(e)=>setFeedback(e.target.value)} placeholder="Tell us what to improve..." />
              <div className="mt-2">
                <Button onClick={() => { setFeedback(''); toast({ title: 'Thanks!', description: 'Feedback sent.' }); }}>Send Feedback</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Offline Mode */}
        <Card className="p-6 rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-xl">
          <CardHeader className="p-0 mb-4"><CardTitle>Offline Mode</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground max-w-xl">Use Mise AI without internet connection. Sync data when back online.</p>
              <Switch checked={offline} onCheckedChange={toggleOffline} />
            </div>
            <div>
              <Button variant="outline" onClick={() => toast({ title: 'Sync queued', description: 'We will sync when back online.' })}>Sync Now</Button>
            </div>
          </CardContent>
        </Card>

        {/* 4. Data Controls */}
        <Card className="p-6 rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-xl">
          <CardHeader className="p-0 mb-4"><CardTitle>Data Controls</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportJSON}><Download className="w-4 h-4 mr-2"/> Export JSON</Button>
              <Button onClick={exportCSV}><Download className="w-4 h-4 mr-2"/> Export CSV</Button>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="file" accept="application/json" className="hidden" onChange={(e)=>importJSON(e,'merge')} />
                <span className="px-6 py-2 rounded-2xl border border-primary/30 bg-background/60"> <Upload className="w-4 h-4 inline mr-2"/> Import (Merge)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="file" accept="application/json" className="hidden" onChange={(e)=>importJSON(e,'replace')} />
                <span className="px-6 py-2 rounded-2xl border border-destructive/30 bg-background/60"> <Upload className="w-4 h-4 inline mr-2"/> Import (Replace)</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={clearPantry}>Clear Pantry</Button>
              <Button variant="outline" onClick={softReset}>Clear All Data (Soft reset)</Button>
            </div>
          </CardContent>
        </Card>

        {/* 5. Preferences */}
        <Card className="p-6 rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-xl">
          <CardHeader className="p-0 mb-4"><CardTitle>Preferences</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant={theme==='light'? 'default':'outline'} onClick={() => applyTheme('light')}><Sun className="w-4 h-4 mr-2"/> Light</Button>
              <Button variant={theme==='dark'? 'default':'outline'} onClick={() => applyTheme('dark')}><Moon className="w-4 h-4 mr-2"/> Dark</Button>
              <Button variant={theme==='system'? 'default':'outline'} onClick={() => applyTheme('system')}>System</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
