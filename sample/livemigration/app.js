"use strict";

const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require("path");
const { execSync } = require('child_process');
const moment = require('moment');
const CMD = require("./config/cmd.js");
const sshConfig = require("./config/sshconfig.js");

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
	let PREFIX = path.join(ROOT_FILEPATH, (FileNameTimePrefix + "_" + param.MEMORYSIZE));
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
		param: param,
		date: new Date()
	};

	//--- Set WDT ---
	//一定時間動きがない場合には強制終了
	let WDT = setTimeout(exit, 20 * 60 * 1000);

	//--- Init SSH Instance ---
	sshInst.target = new NodeSSH();
	sshInst.host1 = new NodeSSH();
	sshInst.host2 = new NodeSSH();

	//--- Connect ---
	console.log("Connecting...");
	//targetは後で接続する
	//await sshInst.target.connect(sshConfig.target).catch((err) => { console.error("Err connect target", err); process.exit(-1); });
	await sshInst.host1.connect(sshConfig.host1).catch((err) => { console.error("Err connect host1", err); process.exit(-1); });
	await sshInst.host2.connect(sshConfig.host2).catch((err) => { console.error("Err connect host2", err); process.exit(-1); });
	console.log("Connected");

	//--- Start Test or Automation Process ---

	/*	自動化処理シナリオ例
		前提. ホスト1とホスト2間でターゲットVMをライブ移送する処理を行う
		1. 結果を確実にするためにホストを再起動
		2. ターゲットVMのメモリサイズを指定してからホスト1で起動
		3. ターゲットVMの情報を取得する
		4. ライブ移送時の情報を取得するためにログを取得
		5. ライブ移送開始
		6. ライブ移送終了後後処理
		ext. ログの加工処理
	*/

	//1.
	if (param.REBOOT) {
		//Reboot
		await sshInst.host1.execCommand(CMD.REBOOT()).catch((err) => { console.log("host1 reboot err"); throw err; });
		await sshInst.host2.execCommand(CMD.REBOOT()).catch((err) => { console.log("host2 reboot err"); throw err; });
		console.log("Reboot");
		//wait
		await sleep(30 * 1000);
		console.log("Connecting...");

		await WaitConnected("host1");
		console.log('Connected host1');

		await WaitConnected("host2");
		console.log('Connected host2');
	}

	//2.

	//VM1が起動済みか確認
	if (await sshInst.target.connect(sshConfig.target).then(() => { return 1; }).catch(() => { return 0; }) === 0) {
		//VM1のメモリサイズを指定(既に起動していると後から修正はできない)
		await sshInst.host1.execCommand(CMD.VM_SETMEM(param.TARGET_VM, param.MEMORYSIZE));

		console.log(`Wakeup VM ${param.TARGET_VM}`);
		await sshInst.host1.execCommand(CMD.VM_START(param.TARGET_VM));
		//起動待ち
		await sleep(30 * 1000);
		let startupcnt = 0;
		while (await sshInst.target.connect(sshConfig.target).then(() => { return 1; }).catch(() => { return 0; }) === 0) {
			startupcnt++;
			//一定時間以上起動できなければ終了
			if (startupcnt > 10) {
				console.log(`Couldn't wakeup ${param.TARGET_VM}`);
				await sshInst.host1.dispose();
				await sshInst.host2.dispose();
				process.exit(-1);
			}
			await sleep(10 * 1000);
		}
	}

	//起動まで問題なくできたのでWDTを消去
	clearTimeout(WDT);

	//3.
	RESULT.TARGET_VMMEM = await sshInst.target.execCommand(CMD.GET_MEMORY()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; });
	RESULT.TARGET_CPU = await sshInst.target.execCommand(CMD.GET_CPUNUM()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; });
	//時刻が同じかどうかを後で確認できるように
	RESULT.time = {
		host1: await sshInst.host1.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; }),
		host2: await sshInst.host1.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; }),
		target: await sshInst.target.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; }),
	};

	WDT = setTimeout(exit, 60 * 60 * 1000);

	//4.
	//ログを取得するが継続して取得するためにawaitによる終了待ちは入れない
	//QEMUログ
	sshInst.host1.execCommand(CMD.LOG_QEMU(param.TARGET_VM)).then(function (result) {
		fs.writeFileSync((PREFIX + '/host1.txt'), result.stdout);
	}).catch(err => console.log('Log host1 err', err));
	sshInst.host2.execCommand(CMD.LOG_QEMU(param.TARGET_VM)).then(function (result) {
		fs.writeFileSync(PREFIX + '/host2.txt', result.stdout);
	}).catch(err => console.log('Log host2 err', err));
	//CPU使用率
	sshInst.host1.execCommand(CMD.LOG_CPU()).then(function (result) {
		console.log("done CPU src");
		fs.writeFileSync(PREFIX + '/cpu_src.txt', result.stdout);
	});
	sshInst.host2.execCommand(CMD.LOG_CPU()).then(function (result) {
		console.log("done CPU dst");
		fs.writeFileSync(PREFIX + '/cpu_dst.txt', result.stdout);
	});


	await sleep(10 * 1000);
	//5.
	console.log('Start Mig');

	//ライブ移送開始時の時刻取得
	RESULT.time.mig_start = await sshInst.target.execCommand(CMD.GET_UNIXTIME()).then((e) => { return e.stdout * 1; }).catch(() => { return 0; });
	//ライブ移送開始
	let migObj = sshInst.host1.execCommand(CMD.MIG_EXP(param.TARGET_VM));

	await migObj;
	console.log("Finish Mig");

	await sleep(2 * 1000);
	//ログ取得終了
	console.log("Finish Log");

	//ログを取得していたプロセスをkillし終了する
	await remoteKill(sshInst.host1, CMD.LOG_QEMU(param.TARGET_VM));
	await remoteKill(sshInst.host2, CMD.LOG_QEMU(param.TARGET_VM));


	//--- Disconnect ---
	await sshInst.host1.dispose();
	await sshInst.host2.dispose();
	await sshInst.target.dispose();

	//--- End Process ---
	console.log("End Process");
	clearTimeout(WDT);


	//ext.
	//ログファイルの処理
	await sleep(5 * 1000);

	//例としてユーザのCPU使用率の最大を取る
	//ファイルはスペース区切りで"time user system idle wait steal"のような構成
	RESULT.maxcpuusage = fs.readFileSync(PREFIX + '/cpu_dst.txt', "utf-8")
		//改行ごとに分割
		.split("\n")
		//1行の中でもスペースで区切る
		.map(e => e.split(" "))
		//ユーザのCPU使用率だけ抜き出し数値化
		.map(e => parseInt(e[1]))
		//配列を走査し最大値を探す
		.reduce((pv, cv) => pv > cv ? pv : cv);
	
	//外部プログラムを呼び出す
	execSync(`gnuplot -e "file='${PREFIX}/cpu_src.txt';outfile='${PREFIX}/cpu'" plotter/cpu.plot`);
	

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
	MEMORYSIZE: paramconv(param_raw.memorysize, parseInt(param_raw.memorysize), 32),
	REBOOT: paramconv(param_raw.reboot, parseInt(param_raw.reboot) > 0 ? 1 : 0, 0),
	TARGET_VM: paramconv(param_raw.target, param_raw.target, "TESTVM")
};

console.log(param);

main(param);