"use strict";

const path = require("path");
const userHome = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
const priKeyPath = path.join(userHome, '.ssh/id_rsa');

const sshConfig = {
	target: {
		host: "192.168.0.3",
		username: 'vm',
		privateKey: priKeyPath
	},
	host1: {
		host: '192.168.0.4',
		username: 'host1',
		privateKey: priKeyPath,
		readyTimeout: 5000
	},
	host2: {
		host: '192.168.0.5',
		username: 'host2',
		privateKey: priKeyPath,
		readyTimeout: 5000
	}
};

module.exports = sshConfig;