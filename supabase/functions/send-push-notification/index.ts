import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;

    if (payload.type !== "INSERT" || !record) {
      return new Response("Ignored", { status: 200 });
    }

    const { user_id, title, body, type, data } = record;

    if (!user_id || !title) {
      return new Response("Missing required fields", { status: 200 });
    }

    // Fetch push token using service role (bypasses RLS)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", user_id)
      .single();

    if (error || !profile?.push_token) {
      console.log(`No push token for user ${user_id}`);
      return new Response("No push token", { status: 200 });
    }

    const token = profile.push_token;
    if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
      console.warn(`Invalid token format for user ${user_id}`);
      return new Response("Invalid token format", { status: 200 });
    }

    // Send push — matches the exact payload format the client used
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body: body || "",
        sound: "default",
        priority: "high",
        channelId: "social",
        data: { type, notifType: type, ...(data || {}) },
      }),
    });

    const result = await response.json();

    if (result?.data?.status === "error") {
      console.warn(`Push failed for user ${user_id}:`, result.data.message);
      if (result.data.details?.error === "DeviceNotRegistered") {
        await supabase
          .from("profiles")
          .update({ push_token: null })
          .eq("id", user_id);
        console.log(`Cleared invalid token for user ${user_id}`);
      }
    } else {
      console.log(`Push sent to user ${user_id}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
