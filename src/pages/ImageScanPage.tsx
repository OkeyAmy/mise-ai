import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImagePlus, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ImageScanPage = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Scan Image | Mise AI";
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const sendToChat = () => {
    localStorage.setItem('pendingAIMessage', 'I uploaded an image. Please analyze it.');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Scan Image For AI</h1>
        <Card className="rounded-3xl p-6 border border-primary/20 bg-background/60 backdrop-blur-xl">
          <div className="space-y-4">
            <label className="block">
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              <div className="w-full h-48 grid place-items-center rounded-2xl border border-dashed border-primary/30 cursor-pointer bg-muted/20">
                {preview ? (
                  <img src={preview} alt="preview" className="max-h-44 object-contain" />
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground"><ImagePlus className="w-5 h-5"/> Upload Image</div>
                )}
              </div>
            </label>
            <div className="flex gap-2">
              <Button onClick={sendToChat} disabled={!preview}>Send To Chat</Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ImageScanPage;
