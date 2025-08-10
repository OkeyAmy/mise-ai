import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

interface Props {
  session: Session | null;
}

export function DataImportExport({ session }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const handleExport = async () => {
    if (!session?.user?.id) {
      toast({ title: "Not signed in", description: "Please sign in to export your data." });
      return;
    }
    setIsWorking(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("messages, thought_steps, updated_at")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const exportPayload = {
        exported_at: new Date().toISOString(),
        user_id: session.user.id,
        chat: {
          messages: data?.messages ?? [],
          thought_steps: data?.thought_steps ?? [],
          updated_at: data?.updated_at ?? null,
        },
        app: {
          version: 1,
        },
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mise-backup-${new Date().toISOString().slice(0, 19)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Export complete", description: "Your chat data has been downloaded." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Export failed", description: e?.message ?? "Unknown error" });
    } finally {
      setIsWorking(false);
    }
  };

  const handleImportClick = () => inputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!session?.user?.id) {
      toast({ title: "Not signed in", description: "Please sign in to import your data." });
      return;
    }
    setIsWorking(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const messages = json?.chat?.messages ?? [];
      const thought_steps = json?.chat?.thought_steps ?? [];

      const { error } = await supabase
        .from("chat_sessions")
        .upsert({ user_id: session.user.id, messages, thought_steps });

      if (error) throw error;
      toast({ title: "Import successful", description: "Your chat data has been restored." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Import failed", description: e?.message ?? "Invalid file" });
    } finally {
      setIsWorking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card className="p-4 bg-background/60 border border-primary/20 rounded-2xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Backup & Restore</h3>
          <p className="text-sm text-muted-foreground">Export or import your chat history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={isWorking} onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button disabled={isWorking} onClick={handleImportClick}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>
    </Card>
  );
}
