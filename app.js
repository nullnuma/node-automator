"use strict";

const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require("path");
const { execSync } = require('child_process');
const moment = require('moment');
const CMD = require("./config/cmd.js");
const sshConfig = require("./config/sshconfig.js");
const { GET_CPUNUM } = require('./config/cmd.js');

//--- Config
const ROOT_FILEPATH = "./logs";

//--- Global Var
const sshInst = {};

//--- Function
// ミリ秒単位のスリープ
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

// TARGET_SSHCONFIGNAME のコンピュータに接続されるまで待つ
async function WaitConnected (TARGET_SSHCONFIGNAME) {
	while (!(await sshInst[TARGET_SSHCONFIGNAME].execCommand(CMD.GET_UPTIME()).catch(() => { }))) {
		await sshInst[TARGET_SSHCONFIGNAME].connect(sshConfig[TARGET_SSHCONFIGNAME]).catch(() => { });
	}
}

async function remoteKill (ssh, cmd) {
	const result = await ssh.execCommand(`ps aux | grep -E "${cmd}" | awk '{ print $2 }'`);
	if (!result) {
		return;
	}
	const PIDs = result.stdout.split('\n');
	console.log("killPIDs", PIDs);
	if (PIDs) {
		await ssh.execCommand(`kill ${PIDs.join(' ')}`).catch((err) => console.log("killerr", err));
	}
}

// Watch Dog Timer
const exit = () => {
	console.log("Time Up Wdt Invoke");
	process.exit();
};

//--- Main
async function main (param) {
	//--- Prepare Logfile ---
	//時刻をログファイルの名前にする
	let FileNameTimePrefix = moment().format("YYYYMMDD-HHmmss");
	//ディレクトリ名を作成する(ex 時刻とパラメタのメモリサイズで構成)
	let PREFIX = path.join(ROOT_FILEPATH, (FileNameTimePrefix + "_" + param.PARAM1));
	console.log("Save Log Dir", PREFIX);

	//ログを保存するためのルートディレクトリを作成する
	try {
		fs.mkdirSync(ROOT_FILEPATH);
	} catch (e) {
	}
	//今回取得したログを保存するログファイル
	try {
		fs.mkdirSync(PREFIX);
	} catch (e) {
		console.error("Exist log dir?", e);
		process.exit(-1);
	}

	//--- Prepare Result Var ---
	const RESULT = {
		param: param
	};

	//--- Set WDT ---
	//一定時間動きがない場合には強制終了
	let WDT;
	WDT = setTimeout(exit, 20 * 60 * 1000);

	//--- Init SSH Instance ---
	sshInst.host1 = new NodeSSH();
	sshInst.host2 = new NodeSSH();

	//--- Connect ---
	console.log("Connecting...");
	await sshInst.host1.connect(sshConfig.host1).catch((err) => { console.error("Err connect host1", err); process.exit(-1); });
	await sshInst.host2.connect(sshConfig.host2).catch((err) => { console.error("Err connect host2", err); process.exit(-1); });
	console.log("Connected");


	//--- Start Test or Automation Process ---
	console.log("Start Process");

	RESULT.HOST1_MEM = await sshInst.host1.execCommand(CMD.GET_MEMORY()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; });
	RESULT.HOST2_MEM = await sshInst.host2.execCommand(CMD.GET_MEMORY()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; });

	RESULT.time = {
		host1: await sshInst.host1.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; }),
		host2: await sshInst.host1.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; })
	};
	let getunixtime = await sshInst.host1.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout; }).catch(() => { return 0; })
	console.log("getunixtime", getunixtime);

	//5[s]待つ
	await sleep(5 * 1000);
	console.log("argument param1", param.PARAM1);
	getunixtime = await sshInst.host1.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout; }).catch(() => { return 0; })
	console.log("getunixtime", getunixtime);


	//10[s]待つ
	await sleep(10 * 1000);
	getunixtime = await sshInst.host1.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout; }).catch(() => { return 0; })
	console.log("getunixtime", getunixtime);

	//--- Disconnect ---
	await sshInst.host1.dispose();
	await sshInst.host2.dispose();

	//--- End Process ---
	console.log("End Process");
	clearTimeout(WDT);

	//--- Log Process ---


	//--- Save Result ---
	fs.writeFileSync(`${PREFIX}/result.json`, JSON.stringify(RESULT, null, "\t"));
}

// 引数に指定された値をパースしパラメタとして設定する
let i;
let param_raw = {};
let param_list = process.argv.slice(2);
for (i = 0; i < param_list.length; i++) {
	let e = param_list[i].split("=");
	param_raw[e[0]] = e.slice(1).join("=");
}

//obj=定義されているかをチェックするオブジェクト, value=定義されていれば格納したい値, defaultvalue=定義されていなければ格納したい初期値
const paramconv = (obj, value, defaultvalue) => { return obj !== undefined ? value : defaultvalue; };

//--- Param Init ---
let param = {
	PARAM1: paramconv(param_raw.param1, param_raw.param1, "hoge"),
	PARAM2: paramconv(param_raw.param2, param_raw.param2, "fuga"),
	WDTTIME: paramconv(param_raw.wdt, parseInt(param_raw.wdt), 10)
};

console.log("param", param);

main(param);