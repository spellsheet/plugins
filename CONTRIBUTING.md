# 載せ方 / How to list a custom node

English below.

## 1. 自分のリポジトリで作ってリリースする

1. カスタム ノードの作り方は [docs/extensions.md](https://github.com/spellsheet/spellsheet/blob/main/docs/ja/extensions.md) を見てください
2. `spellsheet plugin check <フォルダー>` が通ることを確かめます
3. フォルダーを zip にして、GitHub のリリースに添付します（名前の例 `azureocr-0.2.0.zip`）。リリースは後から差し替えないでください。直すときは版を上げて新しいリリースにします
4. zip の SHA-256 を取ります：`Get-FileHash .\azureocr-0.2.0.zip`（PowerShell）または `sha256sum azureocr-0.2.0.zip`

## 2. `index.json` に 1 行足す Pull Request を送る

```json
{
  "name": "azureocr",
  "label": "Azure AI-OCR",
  "description": "Azure AI Document Intelligence で画像・PDF を読み取ります",
  "version": "0.2.0",
  "publisher": "あなたの名前か会社名",
  "homepage": "https://github.com/<owner>/<repo>",
  "source": "https://github.com/<owner>/<repo>",
  "url": "https://github.com/<owner>/<repo>/releases/download/v0.2.0/azureocr-0.2.0.zip",
  "sha256": "<64 文字>"
}
```

| 項目 | 決まり |
|---|---|
| `name` | manifest の `name` と同じ。英小文字で始まる英小文字・数字、32 文字まで。一覧で先に載ったものが使います |
| `version` / `url` / `sha256` | 必須。zip の中の manifest の `version` と一致すること |
| `label` / `publisher` | 必須 |
| `description` / `homepage` / `source` | あると一覧で探しやすくなります |

更新は同じ行の `version`・`url`・`sha256` を書き換える Pull Request です。

## 3. 検査と確認

- 自動の検査（GitHub Actions）：項目、zip の取得と SHA-256、中の名前と版、`spellsheet plugin check`
- 人の確認：初めて載せるときと、外へ送る先・起動するプログラム・使うシークレットが変わる更新。検査の結果（ジョブの Summary）に、ノード・外へ送るデータ・起動するプログラムが並びます
- 外へデータを送るノードは manifest の `external` に、送り先を設定で受けるなら `targets` に書いてください。書いていない送信が見つかったものは載せません

## 取り下げ

問題が見つかったときは、行を消さずに `"withdrawn": "理由"` を足します。インストール・更新はできなくなり、入っている PC の Writer に理由が出ます。

---

## English

1. Build your custom node in your own repository ([docs/extensions.md](https://github.com/spellsheet/spellsheet/blob/main/docs/extensions.md)), make sure `spellsheet plugin check <dir>` passes, zip the folder and attach it to a GitHub release. Never replace a release's zip; publish a new version instead.
2. Send a pull request adding one entry to `index.json` (fields above): `name` as in the manifest, and the required `version`, `url` (the release zip) and `sha256` (`Get-FileHash` / `sha256sum`), `label`, `publisher`. An update changes `version`, `url` and `sha256` of the same entry.
3. GitHub Actions checks the fields, downloads the zip, compares the SHA-256, the name and the version, and runs `spellsheet plugin check`; its job summary lists the nodes, the data they send outside and the program started. A person reviews new entries and updates that change what is sent outside, the program or the secrets. Undeclared sending outside is not listed.

Entries with problems are never removed: `"withdrawn": "reason"` stops installs and updates and tells PCs that have it.
