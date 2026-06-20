import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // ── Parse body ─────────────────────────────────────────────────────────────
    const body = await req.json() as { email?: string; full_name?: string; redirect_to?: string }
    const { email, full_name, redirect_to } = body

    if (!email || !redirect_to) {
      return new Response(
        JSON.stringify({ error: 'email and redirect_to are required' }),
        { status: 400, headers: JSON_HEADERS },
      )
    }

    // ── Verify caller is an owner ───────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: { user: caller }, error: userErr } = await adminClient.auth.getUser(token)
    if (userErr || !caller) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // Primary: JWT custom claims. Fallback: users table (mirrors useAuth.ts)
    let stationId = caller.app_metadata?.station_id as string | undefined
    let role      = caller.app_metadata?.role as string | undefined

    if (!stationId || !role) {
      const { data: userRow } = await adminClient
        .from('users')
        .select('station_id, role')
        .eq('id', caller.id)
        .maybeSingle()
      stationId = (userRow?.station_id as string | undefined) ?? stationId
      role      = (userRow?.role      as string | undefined) ?? role
    }

    if (!stationId || role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only station owners can invite staff' }),
        { status: 403, headers: JSON_HEADERS },
      )
    }

    // ── Delete any existing auth user for this email ────────────────────────────
    // inviteUserByEmail fails with 422 if the user already exists. We proactively
    // find and delete them (they're from a previous failed or test invite) so the
    // fresh invite always succeeds.
    const findRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    )
    if (findRes.ok) {
      const findData = await findRes.json() as { users?: Array<{ id: string; email?: string }> }
      const existing = findData.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      )
      if (existing) {
        await adminClient.auth.admin.deleteUser(existing.id)
      }
    }

    // ── Refresh invitation record ───────────────────────────────────────────────
    await adminClient.from('invitations').delete().eq('station_id', stationId).eq('email', email)

    const { error: invErr } = await adminClient
      .from('invitations')
      .insert({ station_id: stationId, email, full_name: full_name ?? null, status: 'pending' })

    if (invErr) {
      return new Response(JSON.stringify({ error: `Invitation insert: ${invErr.message}` }), {
        status: 500, headers: JSON_HEADERS,
      })
    }

    // ── Send invite email ───────────────────────────────────────────────────────
    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? null },
      redirectTo: redirect_to,
    })

    if (inviteErr) {
      return new Response(JSON.stringify({ error: `Invite email: ${inviteErr.message}` }), {
        status: 500, headers: JSON_HEADERS,
      })
    }

    // ── Clean up orphan station created by handle_new_user trigger ──────────────
    // The trigger auto-creates a station for every new auth user. Invited staff
    // don't need their own station — accept_invitation() links them to the
    // owner's station after they set a password.
    const { data: autoRow } = await adminClient
      .from('users')
      .select('station_id')
      .eq('email', email)
      .maybeSingle()

    if (autoRow?.station_id && autoRow.station_id !== stationId) {
      await adminClient.from('users').delete().eq('email', email)
      await adminClient.from('stations').delete().eq('id', autoRow.station_id)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS })

  } catch (err) {
    // Catch any unhandled exception so we always return a readable error
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    console.error('invite-staff unhandled error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
})
