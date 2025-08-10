import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const authed = !!data.session;
      setIsAuthed(authed);
      setLoading(false);
      if (!authed) navigate("/auth");
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session);
      if (!session) navigate("/auth");
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) return null;
  if (!isAuthed) return null;
  return <>{children}</>;
};

export default ProtectedRoute;
