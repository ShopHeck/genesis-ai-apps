import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detects Supabase email-confirmation redirects (hash contains access_token)
 * and navigates the user to /generator once the session is established.
 * Must be rendered inside BrowserRouter.
 */
export function AuthHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.location.hash.includes("access_token")) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        navigate("/generator", { replace: true });
        subscription.unsubscribe();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
}
