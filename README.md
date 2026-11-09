# SpellSheet 公式の一覧（カスタム ノード）

[SpellSheet](https://github.com/spellsheet/spellsheet) Writer の「カスタム ノード」→「一覧」に出るカスタム ノードの一覧です。中身は [`index.json`](index.json) 1 つで、`https://spellsheet.github.io/plugins/index.json` として配っています。

English below.

## 一覧に載っているということ

- 載せる前に、自動の検査（`spellsheet plugin check`、zip の SHA-256、名前の重複）と人の確認を通しています
- 各行は版と zip の SHA-256 で固定しています。Writer は一覧どおりの zip しか入れないので、作者があとからリリースを差し替えても、この一覧を直すまで届きません
- 問題が見つかったものは消さずに `withdrawn`（取り下げ）にします。インストール・更新できなくなり、入っている PC の Writer に知らせます

「安全を保証する」ではなく、「名前と中身が載せたときのままで、外へ送る先が書いてある」という意味です。カスタム ノードはその PC でプログラムとして動きます。

## 載せる・更新する

[CONTRIBUTING.md](CONTRIBUTING.md) を見てください。カスタム ノードは自分のリポジトリで作ってリリースし、ここには `index.json` に 1 行足す Pull Request を送ります。

---

# Official SpellSheet registry (custom nodes)

The list of custom nodes shown in SpellSheet Writer (Custom nodes → Catalog). It is one file, [`index.json`](index.json), served at `https://spellsheet.github.io/plugins/index.json`.

Being listed means the entry passed automatic checks (`spellsheet plugin check`, the zip's SHA-256, name clashes) and a person's review; each entry is pinned to a version and the SHA-256 of its zip, so a release replaced later reaches no one until this index changes; entries with problems are marked `withdrawn`, never removed. It does not mean "guaranteed safe": custom nodes run as programs on the PC.

To list yours, build and release it in your own repository and send a pull request adding one entry to `index.json` ([CONTRIBUTING.md](CONTRIBUTING.md)).
