"use strict";

const CMD = {
	//Common CMD
	REBOOT: () => { return "sudo reboot"; },
	SHUTDOWN: () => { return "sudo shutdown now"; },
	GET_MEMORY: () => { return " awk '{ printf \" % .2f\", $2/1024/1024 ; exit}' /proc/meminfo"; },
	GET_CPUNUM: () => { return "fgrep 'processor' /proc/cpuinfo | wc -l"; },
	GET_UNIXTIME: () => { return "date +'%s'"; },
	GET_UPTIME: () => { return "uptime"; }
};

module.exports = CMD;