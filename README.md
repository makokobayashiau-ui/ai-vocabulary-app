# Context Words - 第1段階

英語表現を、使われていた文脈と一緒に素早く保存する Next.js 16 + Supabase 製のWebアプリです。第1段階では認証とメモのCRUDのみを実装し、OpenAI APIは接続していません。

## 必要環境

- Node.js 20.9以上
- npm
- Supabaseプロジェクト

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShellでは `Copy-Item .env.example .env.local` を使用できます。

`.env.local` に次を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`service_role` キーは使用せず、ブラウザや環境変数へ設定しないでください。

## Supabaseデータベース

このリポジトリから本番環境へマイグレーションを自動適用する処理はありません。Supabase Dashboardの SQL Editor を開き、次のファイルの内容を確認してから手動で実行してください。

```text
supabase/migrations/001_create_expressions.sql
supabase/migrations/002_create_passages.sql
```

SQL Editorでの適用時は、次の点を守ってください。

- このSQLは新規環境へ一度だけ実行する前提です。
- エラーが発生した場合は、同じSQLをそのまま再実行しないでください。
- トランザクションにより、通常は途中までの変更がコミットされません。
- 既存の同名テーブル、型、関数がある場合は、適用前に内容を確認してください。

Supabase CLIを既に設定している開発環境では、対象プロジェクトを十分に確認したうえでCLIのマイグレーション機能を利用できます。本番適用前には必ずSQLと対象プロジェクトを確認してください。

## 認証設定

Supabase Dashboardで以下を設定します。

1. Authentication -> Providers -> Emailを有効化
2. Confirm emailを有効化
3. Authentication -> URL ConfigurationのSite URLをアプリのURLに設定
4. Redirect URLsへ `http://localhost:3000/auth/callback` と本番URLの `/auth/callback` を追加
5. Vercelでは `NEXT_PUBLIC_SITE_URL` を本番URLに設定

登録後は確認メールの案内画面へ移動します。メールの確認リンクを開いた後、ログインして利用できます。

## 主な仕様

- 必須入力は「分からなかった単語・表現」のみ
- 同じ正規化表現がある場合は警告するが保存可能
- 表現・英文の検索、カテゴリ・状態の絞り込み
- 1ページ20件のページネーション
- 削除は `deleted_at` を使う論理削除
- 一覧、詳細、検索、件数、重複判定は未削除データのみ
- RLSにより認証ユーザー本人の行だけを操作可能
- 長文を登録し、その長文に紐づく表現を保存可能
- 登録回数は同じ正規化表現の未削除データから都度計算

## 検証

```bash
npm run lint
npm run build
npm audit
```

## 第1段階の対象外

AI説明、日本語訳、クイズ、Generated Reading Test、学習履歴、削除済みメモの復元画面は後続段階で実装します。
