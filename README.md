# node-automator

テストや同じ処理を繰り返すのは面倒.  
シェルスクリプトで自動化する事はできるがなかなかとっつきづらいところもあるのでNodejsで自動化するためのテンプレートを作成した.  

## 想定している場面
ssh によって一つないしは複数のマシンを操作して処理を実行しログを取り結果をまとめる状況.  
sshではなくtelnetなど他の場面にも使用できるとは思う.  

サンプルではライブ移送の例を載せている.  
2つのホストマシン上でログを取りつつライブ移送処理を実行, 得られたログを後処理して出力する.  

## インストール

```bash
git clone https://github.com/nullnuma/node-automator
cd node-automator
npm install
```

## 実行
適切にsshconfig.jsを書き換えた後
```bash
node app.js param1="testtest"
```

## ファイル構成
重要なファイルは以下の3種類
* app.js
* config/sshconfig.js
* config/cmd.js

### app.js

実際に自動化する処理を記述するファイル.  

### config/sshconfig.js
ssh 接続を想定しており, 接続対象のコンピュータの設定を記述してある.  
設定内容は[Node-SSH - SSH2 with Promises](https://www.npmjs.com/package/node-ssh)に準じる.  

### config/cmd.js

自動化時に使うコマンドを一元的に管理する.  
app.jsに実行するコマンドをベタ書きしてもよいが, 修正時に大変になるため別ファイルにまとめてある.  
コマンドごとに分かれており, 種類によっては引数により一部変更できるようにしてある.  

## 変数について

|変数|概要|
|:--|:--|
|sshConfig|sshconfig.jsの情報が含まれている.|
|sshInst|ssh接続時のsshインスタンスを保存する.  sshConfigと同じキーを指定することを推奨する.|
|PREFIX|ログを保存するための作成したディレクトリまでのパス名が保存されている.  ログファイルを保存するためのファイル名指定時に使うとよい.|
|RESULT|最後にJSON形式でログとして保存する.  結果として保存しておきたい数値や文字列をここに追加で保存するとよい.|

## 自動化する処理を記述する

### ssh接続の準備
ssh接続を行う場合にはsshconfig.jsに接続対象のコンピュータの内容を記述する.  
telnetであれば[telnet-client](https://www.npmjs.com/package/telnet-client)を用いて書き換えれば使えると思われる(未検証).  

### 使用するコマンドの準備
接続後に使用するコマンドを記述する.  
sshconfig.jsに記述したユーザアカウントにより実行されるためroot権限でないと実行できない命令の場合には`sudo command`のようにsudoにより実行しパスワードを省略できるようにsudoersに対象ユーザを記述すると便利(セキュリティは下がるが…).  

以下はCPUの数を取得するためにコマンドを組み合わせた例である.  
最終的に出力されるのは数字のみであるためそのまま使用しやすい.  
```javascript
GET_CPUNUM: () => { return "fgrep 'processor' /proc/cpuinfo | wc -l"; },
```

目的の値だけを出力するようにコマンドの組み合わせで行うのでも良いし出力された結果をJavaScriptでパースするのでもよい.  

### 自動化する処理の記述

実際に自動化する処理を記述する.  

#### 実行時の引数
自動化するとしても色々とパラメタを変化させたい事はあると思うので実行時に指定する事が可能である.  
以下のように=でつないだキーと値により内部で取得可能である.  
```bash
node app.js param1=hello param2=test
```

また指定されなくても初期値を指定したい場合もあるのでそれも含めて記述する.  
`//--- Param Init ---`以下の変数宣言部分で設定する.  
```
let param = {
	PARAM1: paramconv(param_raw.param1, param_raw.param1, "hoge"),
	PARAM2: paramconv(param_raw.param1, param_raw.param1, "fuga"),
	MEMORYSIZE : paramconv(param_raw.param1, parseInt(param_raw.param1), 32),
};
```
paramconv関数により指定して出力するとよい.  
実行時に指定したキーはparam_rawの連想配列として保存されているのでparam_raw.param1のように取得可能である.  
第一引数に指定される値, 第二引数に指定されていれば格納した値, 第三引数に指定されていなければ格納する初期値を指定する.  
格納する値が数値である場合にはparseInt, 小数であればparseFloatなどを使うことで数値として変換できる.  

#### ssh接続
`//--- Init SSH Instance ---`と`//--- Connect ---`で接続対象のコンピュータに接続する.  
必要に応じて増減させる.  

#### 自動化処理
app.jsの`//--- Start Test or Automation Process ---`から`//--- End Process ---`の中に記述すると良い(わかるなら好きにどうぞ).  
基本的にはPromiseなどを用いて同期的な書き方をしていく. 
待つ必要がある場合にはawaitを用いて待つ必要がある.  
さもないと実行結果を得るまえに処理が次へ進んでしまう.  


以下の例ではCMD.GET_MEMORY()によりコマンドの文字列を取得してhost1で実行している.  
問題なく処理が実行されるとthenが, エラーが発生するとcatch が呼ばれる.  
コマンドの実行結果は数値であるがそのままでは文字列としてJavaScriptでは認識されるので * 1をして数値に変換している.  
```
let memsize = await sshInst.host1.execCommand(CMD.GET_MEMORY()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; });
```

関数として一部用意した.  
どれもawaitによる待ちが必要.  

|関数名|概要|
|:--|:--|
|sleep|ミリ秒単位でスリープする|
|WaitConnected|sshConfig及びsshInstで使用している対象のコンピュータのキー(ex. host1) が疎通するまで待機する|
|remoteKill|継続的に実行しているログ取得などのプログラムをkillする|

またローカルでコマンドを実行したい場合にはexecSyncにコマンドを渡すことで実行される.  
例ではgnuplotを呼び出す際に使用している.  

途中で処理が何かしらの要因で停止してしまった場合には強制終了する手段としてWatch Dog Timerを導入している.  
指定した時間経過した場合には強制終了する.  
不要であれば記述を削除すれば問題ない.  
```JavaScript
//Set
WDT = setTimeout(exit, 20 * 60 * 1000);
//Stop
clearTimeout(WDT);
```