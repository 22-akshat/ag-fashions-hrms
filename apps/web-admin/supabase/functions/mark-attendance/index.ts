import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const INVOCATION_HEADER = "x-attendance-edge-invocation-key";

const BLOCK = (reason: string, code: string, status = 403) =>
  new Response(
    JSON.stringify({
      ok: false,
      error: code,
      message: reason,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );

const OK = (data: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

function requireInvocationKey(req: Request): Response | null {
  const expected = String(Deno.env.get("ATTENDANCE_EDGE_INVOCATION_KEY") ?? "").trim();
  if (!expected) {
    return BLOCK(
      "Server misconfigured: ATTENDANCE_EDGE_INVOCATION_KEY missing",
      "EDGE_MISCONFIGURED",
      500,
    );
  }
  const got = String(req.headers.get(INVOCATION_HEADER) ?? "").trim();
  if (got !== expected) {
    return BLOCK("Unauthorized", "INVOCATION_KEY_INVALID", 401);
  }
  return null;
}

serve(async (req) => {
  try {
    const invErr = requireInvocationKey(req);
    if (invErr) return invErr;

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return BLOCK("Invalid request payload", "INVALID_REQUEST", 400);
    }

    const {
      employee_id,
      device_id,
      face_session_token,
      latitude,
      longitude,
      timestamp,
      embedding_version,
      offline_id,
      shop_id,
      idempotency_key,
    } = body as Record<string, unknown>;

    const shopId =
      typeof shop_id === "string" ? shop_id.trim() : String(shop_id ?? "").trim();
    const idem =
      typeof idempotency_key === "string"
        ? idempotency_key.trim()
        : String(idempotency_key ?? "").trim();

    const punchTypeRaw = (body as { punch_type?: string }).punch_type;
    const punchType =
      typeof punchTypeRaw === "string" && punchTypeRaw.trim().toLowerCase() === "out"
        ? "out"
        : "in";

    const attestationValid =
      (body as { attestation?: { valid?: boolean } }).attestation?.valid ??
      (body as { attestation_valid?: boolean }).attestation_valid ??
      false;
    const deviceSignature =
      (body as { device_signature?: string }).device_signature ??
      (body as { deviceSignature?: string }).deviceSignature ??
      null;

    const { data: flagRow } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("flag_name", "strict_attendance_mode")
      .maybeSingle();
    const strictMode = Boolean(flagRow?.enabled);

    if (!employee_id || typeof employee_id !== "string") {
      return BLOCK("Missing identity", "INVALID_REQUEST");
    }
    if (!device_id || typeof device_id !== "string") {
      return BLOCK("Missing identity", "INVALID_REQUEST");
    }
    if (!face_session_token || typeof face_session_token !== "string") {
      return BLOCK("Missing face session", "FACE_SESSION_MISSING");
    }
    if (!shopId) {
      return BLOCK("Missing shop", "SHOP_ID_REQUIRED");
    }

    if (strictMode && !attestationValid) {
      return BLOCK("Attestation failed", "ATTESTATION_INVALID");
    }
    if (strictMode && !String(deviceSignature ?? "").trim()) {
      return BLOCK("Device signature missing", "DEVICE_SIGNATURE_INVALID");
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return BLOCK("GPS coordinates invalid", "GEOFENCE_INVALID", 400);
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return BLOCK("GPS coordinates out of range", "GEOFENCE_INVALID", 400);
    }

    const { data: anomaly } = await supabase
      .from("employee_risk_profiles")
      .select("last_risk_score")
      .eq("employee_id", employee_id)
      .maybeSingle();

    const risk = Number(anomaly?.last_risk_score ?? 0);
    const normalizedRisk = risk > 1 ? risk : risk * 100;
    if (strictMode && normalizedRisk >= 70) {
      return BLOCK("High anomaly risk", "HIGH_RISK_BLOCKED");
    }

    const ts =
      typeof timestamp === "string" && timestamp.trim()
        ? timestamp
        : new Date().toISOString();
    const emb = Number.isFinite(Number(embedding_version))
      ? Number(embedding_version)
      : 1;

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "mark_attendance_atomic",
      {
        p_employee_id: employee_id,
        p_device_id: device_id.trim(),
        p_face_session_token: face_session_token.trim(),
        p_shop_id: shopId,
        p_latitude: lat,
        p_longitude: lng,
        p_embedding_version: emb,
        p_idempotency_key: idem || null,
        p_offline_id:
          typeof offline_id === "string" && offline_id.trim()
            ? offline_id.trim()
            : null,
        p_timestamp: ts,
        p_punch_type: punchType,
      },
    );

    if (rpcError) {
      return BLOCK(rpcError.message ?? "RPC failed", "ATTENDANCE_RPC_FAILED", 500);
    }

    const row = rpcResult as Record<string, unknown> | null;
    if (!row || row.ok !== true) {
      const code = String(row?.code ?? "ATTENDANCE_REJECTED");
      const msg = String(row?.message ?? "Attendance rejected");
      const st = code === "GEOFENCE_INVALID" || code === "SHOP_ID_REQUIRED" ? 400 : 403;
      return BLOCK(msg, code, st);
    }

    return OK({
      attendance_id: row.attendance_id,
      status: row.status ?? "accepted",
      duplicate: Boolean(row.duplicate),
      punch_type: row.punch_type ?? punchType,
      attendance_status: row.attendance_status ?? null,
    });
  } catch (_e) {
    return BLOCK("Server error", "EDGE_FUNCTION_ERROR", 500);
  }
});
