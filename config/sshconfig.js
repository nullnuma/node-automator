"use strict";

const path = require("path");
const userHome = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
const priKeyPath = path.join(userHome, '.ssh/id_rsa');

const sshConfig = {
	host1: {
		host: '192.168.0.95',
		username: 'rack1',
		//password : 'hogehoge',
		privateKey: priKeyPath,
		readyTimeout: 5000
	},
	host2: {
		host: '192.168.0.96',
		username: 'rack2',
		privateKey: priKeyPath,
		readyTimeout: 5000
	}
};

module.exports = sshConfig;