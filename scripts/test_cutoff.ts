import { addMonths, subMonths, setDate, isWithinInterval, format } from 'date-fns';

const currentDate = new Date('2026-03-16T15:00:00'); // Note: time might matter!
const isPast15th = currentDate.getDate() >= 16;
const baseTargetDate = isPast15th ? addMonths(currentDate, 1) : currentDate;
const otMonthOffset = 0;

const targetDate = subMonths(baseTargetDate, otMonthOffset);
const startOfCutoff = setDate(subMonths(targetDate, 1), 16);
const endOfCutoff = setDate(targetDate, 15);

console.log("Current:", format(currentDate, 'yyyy-MM-dd HH:mm:ss'));
console.log("Start:", format(startOfCutoff, 'yyyy-MM-dd HH:mm:ss'));
console.log("End:", format(endOfCutoff, 'yyyy-MM-dd HH:mm:ss'));

const logDate1 = new Date('2026-03-16');
console.log("Log 2026-03-16 within?", isWithinInterval(logDate1, { start: startOfCutoff, end: endOfCutoff }));

const logDate2 = new Date('2026-03-16T00:00:00Z');
console.log("Log 2026-03-16T00:00:00Z within?", isWithinInterval(logDate2, { start: startOfCutoff, end: endOfCutoff }));
