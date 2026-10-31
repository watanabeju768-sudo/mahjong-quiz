/* 出題と採点をローカルサーバー（webapp/server.py）に問い合わせる実装。
   答えはサーバーだけが持ち、採点結果だけが返ってくる。
   静的サイト版ではこのファイルの代わりに api-static.js が読み込まれる
   （差し替えは build_static.py が行う）。 */

'use strict';

const QuizApi = {
  /* サーバー版は問題をメモリに一時保存するだけなので、復習モードは使えない
     （公開版＝静的サイトでは使える）。 */
  supportsReview: false,

  async problemById() {
    return null;
  },

  /** 出題データを 1 問取得する。 */
  async nextProblem({ difficulty, preset }) {
    const params = new URLSearchParams({
      difficulty: difficulty,
      preset: preset ? '1' : '0',
    });
    const response = await fetch(`api/problem?${params}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  /** 回答を送って採点結果を受け取る。 */
  async judge({ problem, han, fu, points }) {
    const response = await fetch('api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: problem.id, han: han, fu: fu, points: points }),
    });
    return response.json();
  },
};
