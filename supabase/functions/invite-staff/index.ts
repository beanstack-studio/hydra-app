import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // ── Parse body ───────────────────────────────────────────────────────────────
  const body = await req.json() as { email?: string; full_name?: string; redirect_to?: string }
  const { email, full_name, redirect_to } = body

  if (!email || !redirect_to) {
    return new Response(
      JSON.stringify({ error: 'email and redirect_to are required' }),
      { status: 400, headers: JSON_HEADERS },
    )
  }

  // ── Verify caller is an owner ────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!,
  )

  const { data: { user: caller }, error: userErr } = await adminClient.auth.getUser(token)
  if (userErr || !caller) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  const stationId = caller.app_metadata?.station_id as string | undefined
  const role      = caller.app_metadata?.role as string | undefined

  if (!stationId || role !== 'owner') {
    return new Response(
      JSON.stringify({ error: 'Only station owners can invite staff' }),
      { status: 403, headers: JSON_HEADERS },
    )
  }

  // ── Upsert invitation record ─────────────────────────────────────────────────
  // Use upsert so re-sending to the same email just refreshes invited_at
  const { error: invErr } = await adminClient
    .from('invitations')
    .upsert(
      { station_id: stationId, email, full_name: full_name ?? null, status: 'pending' },
      { onConflict: 'station_id,email', ignoreDuplicates: false },
    )

  if (invErr) {
    return new Response(JSON.stringify({ error: invErr.message }), {
      status: 500, headers: JSON_HEADERS,
    })
  }

  // ── Send invite email via admin API ──────────────────────────────────────────
  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? null },
    redirectTo: redirect_to,
  })

  if (inviteErr) {
    return new Response(JSON.stringify({ error: inviteErr.message }), {
      status: 500, headers: JSON_HEADERS,
    })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS })
})
