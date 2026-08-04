# Ping Pong Lesson Planner

一个给家庭使用的乒乓球课程记录和结算网站。

## 功能

- 默认配置 Kyson、田教练 `$130/hr`、Eric 教练 `$90/hr`
- 记录每节课的日期、孩子、教练、时长、备注
- 按不同教练的每小时或每节课收费自动计算费用
- Calendar 查看每天课程、当月花费、结算周期花费
- 设置上次/下次结算日，统计周期节数、时长、金额
- Supabase 后端持久化，保留本机缓存作为加载失败时的兜底
- 导出 JSON 备份、导入 JSON 备份、导出月度 CSV

## Supabase 后端持久化

网站启动时会自动从 Supabase 读取数据；新增、编辑、删除会继续写回 Supabase。浏览器 `localStorage` 只作为本机缓存和离线兜底。云端数据会先用配置里的同步码在浏览器里 AES-GCM 加密，Supabase 表里保存的是密文。

1. 在 Supabase 免费项目里创建表和匿名策略：

```sql
create table if not exists public.lesson_planner_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.lesson_planner_state enable row level security;

create policy "anon can read lesson planner state"
on public.lesson_planner_state
for select
to anon
using (true);

create policy "anon can insert lesson planner state"
on public.lesson_planner_state
for insert
to anon
with check (true);

create policy "anon can update lesson planner state"
on public.lesson_planner_state
for update
to anon
using (true)
with check (true);
```

2. 把 `index.html` 里的配置填上。Supabase 新项目使用 publishable key；旧项目的 anon key 也兼容，但优先用 `sb_publishable_...`：

```html
<script>
  window.PINGPONG_SUPABASE = {
    url: "https://YOUR_PROJECT.supabase.co",
    publishableKey: "YOUR_PUBLISHABLE_KEY",
    defaultSyncKey: "YOUR_SYNC_KEY",
  };
</script>
```

3. 打开网站即可自动读取同一份后端数据。每台设备使用同一个 `defaultSyncKey`，就会读写同一份加密数据。

## 本地运行

```bash
python3 -m http.server 5173
```

然后打开 `http://localhost:5173`。

## GitHub Pages 部署

这个项目是纯静态网站。GitHub Pages 从 `main` 分支根目录发布 `index.html`、`styles.css`、`app.js`。

数据默认从 Supabase 读取和保存；浏览器 `localStorage` 保留最近一次状态，用于加载失败时兜底。
