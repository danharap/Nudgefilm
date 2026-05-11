-- ---------------------------------------------------------------------------
-- Blend Party feature
-- ---------------------------------------------------------------------------
-- blend_parties: a shareable group session where up to 5 users blend tastes
-- blend_party_members: participants in a party
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. blend_parties
-- ---------------------------------------------------------------------------
create table if not exists public.blend_parties (
  id               uuid        primary key default gen_random_uuid(),
  creator_id       uuid        not null references public.profiles(id) on delete cascade,
  token            text        not null unique default encode(gen_random_bytes(16), 'hex'),
  title            text        check (char_length(title) <= 60),
  status           text        not null default 'active'
                               check (status in ('active', 'completed', 'expired')),
  max_participants smallint    not null default 5
                               check (max_participants between 2 and 5),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '48 hours',
  generated_at     timestamptz
);

create index if not exists blend_parties_token_idx   on public.blend_parties (token);
create index if not exists blend_parties_creator_idx on public.blend_parties (creator_id);
create index if not exists blend_parties_status_idx  on public.blend_parties (status);

alter table public.blend_parties enable row level security;

-- Any authenticated user can view any party.
-- The token in the URL acts as the invite gate; party IDs are UUIDs (unguessable).
-- Parties expire in 48 hours — data is ephemeral.
create policy "blend_parties_select"
  on public.blend_parties for select to authenticated
  using (true);

create policy "blend_parties_insert"
  on public.blend_parties for insert to authenticated
  with check (creator_id = auth.uid());

-- Creator can mark status / set generated_at
create policy "blend_parties_update"
  on public.blend_parties for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "blend_parties_delete"
  on public.blend_parties for delete to authenticated
  using (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. blend_party_members
-- ---------------------------------------------------------------------------
create table if not exists public.blend_party_members (
  party_id  uuid        not null references public.blend_parties(id) on delete cascade,
  user_id   uuid        not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  role      text        not null default 'participant'
                        check (role in ('creator', 'participant')),
  primary key (party_id, user_id)
);

create index if not exists blend_party_members_user_idx  on public.blend_party_members (user_id);
create index if not exists blend_party_members_party_idx on public.blend_party_members (party_id);

alter table public.blend_party_members enable row level security;

-- Any authenticated user can view members (needed for party preview before joining)
create policy "blend_party_members_select"
  on public.blend_party_members for select to authenticated
  using (true);

-- Users can join (insert themselves) — business-logic guards live in server actions
create policy "blend_party_members_insert"
  on public.blend_party_members for insert to authenticated
  with check (user_id = auth.uid());

-- Users can remove themselves; creator can remove any member
create policy "blend_party_members_delete"
  on public.blend_party_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.blend_parties bp
      where bp.id = party_id
        and bp.creator_id = auth.uid()
    )
  );
