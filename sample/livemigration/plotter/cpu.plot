set terminal eps enhanced

set datafile separator " "

set title outfile

set xlabel "time[s]"
set ylabel "cpu usage[%]"

set autoscale

set key outside

set output outfile.".eps"
plot \
	file using 2 every ::1 with lines lt 1 lw 3 lc rgb "red" title "user", \
	file using 3 every ::1 with lines lt 1 lw 3 lc rgb "green" title "sys", \
	file using 4 every ::1 with lines lt 1 lw 3 lc rgb "brown" title "idle" , \
	file using 5 every ::1 with lines lt 1 lw 3 lc rgb "purple" title "wait", \
	file using 6 every ::1 with lines lt 1 lw 3 lc rgb "blue" title "steal"
