import React from "react";
import { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BoringAvatar from "boring-avatars";

interface UserAvatarProps {
  session: Session | null;
  size?: number; // pixel size for the avatar circle
  className?: string;
  alt?: string;
}

// UserAvatar - shows provider photo when available, falls back to an identicon
export function UserAvatar({ session, size = 48, className = "", alt = "User profile avatar" }: UserAvatarProps) {
  const meta = (session?.user?.user_metadata as Record<string, any>) || {};
  const googlePic = meta.picture || meta.avatar_url || meta.image_url;

  // Local fallback (if user set a custom avatar in app previously)
  let localFallback: string | null = null;
  try {
    localFallback = localStorage.getItem("profile_avatar");
  } catch (_) {}

  const src = googlePic || localFallback || undefined;

  return (
    <Avatar className={`border border-primary/30 shadow-md`} style={{ width: size, height: size }}>
      <AvatarImage
        src={src}
        alt={alt}
        loading="lazy"
        className="object-cover"
      />
      <AvatarFallback className="p-0">
        <BoringAvatar
          size={size}
          name={(session?.user?.email as string) || (meta.full_name as string) || "user"}
          variant="beam"
          square={false}
          colors={["#0EA5E9", "#22D3EE", "#A78BFA", "#F472B6", "#F59E0B"]}
        />
      </AvatarFallback>
    </Avatar>
  );
}
