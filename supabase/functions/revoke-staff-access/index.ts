import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const body = await req.json() as { staff_id?: string }
    const { staff_id } = body

    if (!staff_id) {
      return new Response(
        JSON.stringify({ error: 'staff_id is required' }),
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
        JSON.stringify({ error: 'Only station owners can revoke access' }),
        { status: 403, headers: JSON_HEADERS },
      )
    }

    // ── Get staff email, verify ownership ──────────────────────────────────────
    const { data: staffRow } = await adminClient
      .from('staff')
      .select('email, station_id')
      .eq('id', staff_id)
      .maybeSingle()

    if (!staffRow?.email) {
      return new Response(
        JSON.stringify({ error: 'Staff member not found or has no email' }),
        { status: 400, headers: JSON_HEADERS },
      )
    }

    if (staffRow.station_id !== stationId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // ── Find the auth/users row for this staff email ───────────────────────────
    const { data: usersRow } = await adminClient
      .from('users')
      .select('id')
      .eq('email', staffRow.email)
      .eq('station_id', stationId)
      .eq('role', 'staff')
      .maybeSingle()

    if (!usersRow?.id) {
      return new Response(
        JSON.stringify({ error: 'No active login found for this staff member' }),
        { status: 400, headers: JSON_HEADERS },
      )
    }

    // ── Delete auth user (revokes all sessions) ────────────────────────────────
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(usersRow.id)
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), {
        status: 500, headers: JSON_HEADERS,
      })
    }

    // ── Remove the public.users row ────────────────────────────────────────────
    // auth.users cascade may not reach public.users depending on FK config
    await adminClient.from('users').delete().eq('id', usersRow.id)

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    console.error('revoke-staff-access unhandled error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
})
