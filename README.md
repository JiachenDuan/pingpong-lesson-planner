# Ping Pong Lesson Planner

一个给家庭使用的乒乓球课程记录和预算规划网站。

## 功能

- 默认配置 Kyson、田教练 `$130/hr`、Eric 教练 `$90/hr`、月预算 `$2,000`
- 记录每节课的日期、孩子、教练、时长、备注
- 按不同教练的每小时或每节课收费自动计算费用
- 查看每月节数、总时长、总花费、预算余额
- 在月预算和目标节数下生成排课建议
- 导出 JSON 备份、导入 JSON 备份、导出月度 CSV

## 本地运行

```bash
python3 -m http.server 5173
```

然后打开 `http://localhost:5173`。

## GitHub Pages 部署

这个项目是纯静态网站。GitHub Pages 从 `main` 分支根目录发布 `index.html`、`styles.css`、`app.js`。

数据保存在浏览器 `localStorage`。如果换设备使用，需要先导出 JSON，再在另一台设备导入。后续如果需要真正的多设备同步，可以接 Supabase、Firebase 或 GitHub Gist。
