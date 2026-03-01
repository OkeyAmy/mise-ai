import { useCallback, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Message, ThoughtStep } from "@/data/schema";

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string | null;
  messages: Message[];
  thought_steps: ThoughtStep[];
  created_at: string;
  updated_at: string;
}

// RESTful-style helpers for chat_conversations
export function useChatConversations(session: Session | null) {
  const [isLoading, setIsLoading] = useState(false);

  const getConversations = useCallback(async (): Promise<Pick<ChatConversation, "id" | "title" | "created_at" | "updated_at">[]> => {
    if (!session?.user?.id) return [];
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("getConversations error:", error);
      return [];
    }
    return data as any;
  }, [session]);

  const getConversation = useCallback(async (id: string): Promise<ChatConversation | null> => {
    if (!session?.user?.id) return null;
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id, user_id, title, messages, thought_steps, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("getConversation error:", error);
      return null;
    }
    return (data as any) || null;
  }, [session]);

  // POST
  const createConversation = useCallback(
    async ({ title, messages = [], thought_steps = [] as ThoughtStep[] }:
      { title?: string; messages?: Message[]; thought_steps?: ThoughtStep[]; }): Promise<string | null> => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: session.user.id,
          title: title ?? null,
          messages: messages as any,
          thought_steps: thought_steps as any,
        })
        .select("id")
        .single();

      if (error) {
        console.error("createConversation error:", error);
        return null;
      }
      return (data as any)?.id ?? null;
    },
    [session]
  );

  // PUT - replace entire entity
  const replaceConversation = useCallback(
    async (id: string, { title, messages, thought_steps }:
      { title?: string | null; messages: Message[]; thought_steps: ThoughtStep[] }) => {
      if (!session?.user?.id) return false;
      const { error } = await supabase
        .from("chat_conversations")
        .update({
          title: title ?? null,
          messages: messages as any,
          thought_steps: thought_steps as any,
        })
        .eq("id", id)
        .eq("user_id", session.user.id);

      if (error) {
        console.error("replaceConversation error:", error);
        return false;
      }
      return true;
    },
    [session]
  );

  // PATCH - partial update
  const updateConversationPartial = useCallback(
    async (id: string, updates: Partial<Pick<ChatConversation, "title" | "messages" | "thought_steps">>) => {
      if (!session?.user?.id) return false;
      const { error } = await supabase
        .from("chat_conversations")
        .update(updates as any)
        .eq("id", id)
        .eq("user_id", session.user.id);

      if (error) {
        console.error("updateConversationPartial error:", error);
        return false;
      }
      return true;
    },
    [session]
  );

  // DELETE
  const deleteConversation = useCallback(async (id: string) => {
    if (!session?.user?.id) return false;
    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      console.error("deleteConversation error:", error);
      return false;
    }
    return true;
  }, [session]);

  return {
    isLoading,
    setIsLoading,
    getConversations, // GET list
    getConversation,  // GET by id
    createConversation, // POST
    replaceConversation, // PUT
    updateConversationPartial, // PATCH
    deleteConversation, // DELETE
  };
}
