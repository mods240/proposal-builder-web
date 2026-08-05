# 企画書ビルダー（Web版）

対話で企画書の骨子を作るツール。Claude / OpenAI / Gemini を順番に試し、
上限やエラーが出ても自動で別のAIにフォールバックします。

## 構成

- `pages/index.js` — メインUI（企画一覧 → 対話・骨子・企画書の3タブ）
- `pages/api/ai.js` — サーバー側のAPIルート。ここでAPIキーを扱い、プロバイダを切り替える
- 永続化は `localStorage`（ブラウザ内保存。サーバーには送信されません）

## 主な機能

- **複数プロジェクトの保存**: トップ画面が企画の一覧になっており、「＋ 新しい企画を始める」で何個でも作れる。途中で離脱しても、一覧から続きを開ける
- **トーン選択**: きっちり／フラット／励まし／ラフ相談 の4種類。プロジェクトごとに設定でき、途中で切り替えても良い。AIの質問文の口調とUIのアクセントカラーが連動して変わる
- **企画書生成の文体**: 対話中のトーンに関わらず、最終的な企画書は常にビジネス文書として適切な丁寧な文体で生成される

## ローカルで動かす

```bash
npm install
cp .env.example .env.local
# .env.local に各AIのAPIキーを記入
npm run dev
```

`http://localhost:3000` で確認できます。

## GitHubに公開する

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<your-account>/<repo-name>.git
git push -u origin main
```

## Vercelにデプロイする

1. https://vercel.com にログインし、「New Project」→ 上記のGitHubリポジトリを選択
2. Framework Preset は自動で「Next.js」になります
3. 「Environment Variables」に `.env.example` と同じキー名で値を設定
   - `AI_PROVIDER_ORDER`（例: `anthropic,openai,gemini`）
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - （必要ならモデル名の環境変数も）
4. 「Deploy」をクリック。以後は `git push` するたびに自動で再デプロイされます

## フォールバックの仕組み

`pages/api/ai.js` が `AI_PROVIDER_ORDER` の順にプロバイダを呼び出し、
APIキー未設定・エラー・レート制限などで失敗したら次のプロバイダに進みます。
すべて失敗した場合のみエラーを返します。

## 注意点

- APIキーは必ずVercelの環境変数に設定し、フロントエンドのコードには書かないこと
- 各プロバイダの利用料金は、それぞれの契約（Anthropic Console / OpenAI / Google AI Studio）に応じて発生します
- 使う人ごとの利用制限ではなく、このアプリを動かしているAPIキーの契約に対して課金される点が、Claude.aiアーティファクト版との一番の違いです
