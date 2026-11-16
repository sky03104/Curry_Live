-- 萌戰三國・直播亂鬥 雲端存放區（Supabase）
-- 在 Supabase 後台的 SQL Editor 貼上整份執行一次即可（2026-11-16 已在「凹子底專案」執行過）。
-- 一張通用表：(雲端代號, 槽位) -> JSON 資料。存檔、設定同步、主播按鈕指令都用同一張。

create table if not exists public.live_docs (
  code        text        not null,
  slot        text        not null,
  data        jsonb       not null default '{}'::jsonb,
  version     bigint      not null default 1,
  updated_at  timestamptz not null default now(),
  primary key (code, slot),
  constraint live_docs_code_len check (char_length(code) between 16 and 64),
  constraint live_docs_slot_len check (char_length(slot) between 1 and 64),
  constraint live_docs_size     check (pg_column_size(data) <= 307200)
);

-- 鎖死：公開金鑰不能直接讀寫這張表（不能列出清單、不能刪除）。
-- 只能透過下面兩個函式，而且必須知道完整的雲端代號。
alter table public.live_docs enable row level security;
revoke all on public.live_docs from anon, authenticated;

create or replace function public.live_get(p_code text, p_slot text)
returns table (data jsonb, version bigint, updated_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select d.data, d.version, d.updated_at
  from public.live_docs d
  where d.code = p_code and d.slot = p_slot
    and char_length(p_code) between 16 and 64;
$$;

-- p_expected 不給 = 直接覆蓋；給了就必須跟目前版本一樣，不一樣回 conflict。
create or replace function public.live_put(
  p_code text, p_slot text, p_data jsonb, p_expected bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur bigint;
  nv  bigint;
begin
  if p_code is null or char_length(p_code) not between 16 and 64
     or p_slot is null or char_length(p_slot) not between 1 and 64
     or p_data is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if pg_column_size(p_data) > 307200 then
    return jsonb_build_object('ok', false, 'reason', 'too_big');
  end if;

  select version into cur
  from public.live_docs
  where code = p_code and slot = p_slot
  for update;

  if not found then
    if p_expected is not null and p_expected <> 0 then
      return jsonb_build_object('ok', false, 'reason', 'conflict', 'version', 0);
    end if;
    insert into public.live_docs (code, slot, data)
    values (p_code, p_slot, p_data)
    on conflict (code, slot) do nothing
    returning version into nv;
    if nv is null then
      return jsonb_build_object('ok', false, 'reason', 'conflict');
    end if;
    return jsonb_build_object('ok', true, 'version', nv);
  end if;

  if p_expected is not null and p_expected <> cur then
    return jsonb_build_object('ok', false, 'reason', 'conflict', 'version', cur);
  end if;

  nv := cur + 1;
  update public.live_docs
     set data = p_data, version = nv, updated_at = now()
   where code = p_code and slot = p_slot;
  return jsonb_build_object('ok', true, 'version', nv);
end;
$$;

revoke all on function public.live_get(text, text) from public;
revoke all on function public.live_put(text, text, jsonb, bigint) from public;
grant execute on function public.live_get(text, text) to anon, authenticated;
grant execute on function public.live_put(text, text, jsonb, bigint) to anon, authenticated;
