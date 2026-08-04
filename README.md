# Ping Pong Lesson Planner

一个给家庭使用的乒乓球课程记录和结算网站。

## 功能

- 默认配置 Kyson、田教练 `$130/hr`、Eric 教练 `$90/hr`
- 记录每节课的日期、孩子、教练、时长、备注
- 按不同教练的每小时或每节课收费自动计算费用
- Calendar 查看每天课程、当月花费、结算周期花费
- 设置上次/下次结算日，统计周期节数、时长、金额
- 可选 Supabase 云同步，保留本机离线保存
- 导出 JSON 备份、导入 JSON 备份、导出月度 CSV

## Supabase 云同步

云同步是可选功能。未配置时，网站仍然只用浏览器 `localStorage` 保存。云端数据会先用同步码在浏览器里 AES-GCM 加密，Supabase 表里保存的是密文。

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

2. 把 `index.html` 里的配置填上：

```html
<script>
  window.PINGPONG_SUPABASE = {
    url: "https://YOUR_PROJECT.supabase.co",
    anonKey: "YOUR_ANON_KEY",
  };
</script>
```

3. 打开网站，在“云同步”里输入一个足够长、难猜的同步码。每台设备用同一个同步码，就会同步同一份数据。

同步码不要用孩子名字、生日、手机号这类短内容。建议用密码管理器生成 16 位以上随机字符串。

## 本地运行

```bash
python3 -m http.server 5173
```

然后打开 `http://localhost:5173`。

## GitHub Pages 部署

这个项目是纯静态网站。GitHub Pages 从 `main` 分支根目录发布 `index.html`、`styles.css`、`app.js`。

数据默认保存在浏览器 `localStorage`。配置 Supabase 后，会继续本机保存，并自动把同一份数据同步到云端。
