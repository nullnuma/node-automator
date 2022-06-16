"use strict";

const CMD = {
	//Common CMD
	REBOOT: () => { return "sudo reboot"; },
	SHUTDOWN: () => { return "sudo shutdown now"; },
	GET_MEMORY: () => { return " awk '{ printf \" % .2f\", $2/1024/1024 ; exit}' /proc/meminfo"; },
	GET_CPUNUM: () => { return "fgrep 'processor' /proc/cpuinfo | wc -l"; },
	GET_UNIXTIME: () => { return "date +'%s'"; },
	GET_UPTIME: () => { return "uptime"; },
	//VM
	VM_START: (TARGET) => { return `sudo virsh start ${TARGET}`; },
	VM_SETMEM: (TARGET, SIZEGB) => { return `sudo virsh setmaxmem ${TARGET} ${SIZEGB}G;sudo virsh setmem ${TARGET} ${SIZEGB}G --config;`; },
	MIG_EXP: (TARGET) => { return `sudo virsh migrate --live ${TARGET} --verbose qemu+ssh://rack2.localdomain/system`; },
	//LOG
	LOG_QEMU: (TARGET) => { return `sudo tail -F -n 0 /var/log/libvirt/qemu/${TARGET}.log`; },
	LOG_CPU: () => { return "vmstat 1 -n | awk '{ print strftime(\"%m%d%H%M%S\"), $13,$14,$15,$16,$17; fflush(); }' | sed -u '1,2d'" }
};

module.exports = CMD;