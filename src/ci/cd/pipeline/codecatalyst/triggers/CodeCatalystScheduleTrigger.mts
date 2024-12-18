export type Enumerate<
	N extends number,
	Acc extends number[] = [],
> = Acc["length"] extends N
	? Acc[number]
	: Enumerate<N, [...Acc, Acc["length"]]>;

export type IntRange<F extends number, T extends number> = Exclude<
	Enumerate<T>,
	Enumerate<F>
>;

export type StarWildcard = "*";
export type QuestionWildcard = "?";
export type SlashWildcard<
	Every extends number | string,
	Th extends ValueType,
	ValueType extends number | string = number | string,
> = `${Every}/${Th}`;
export type CommaWildcard<
	Values extends ValueType,
	Max extends 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
	ValueType extends number | string = number | string,
> = Values | Max extends 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
	? `${Values},${Values}`
	: never | Max extends 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
		? `${Values},${Values},${Values}`
		: never | Max extends 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
			? `${Values},${Values},${Values},${Values}`
			: never | Max extends 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
				? `${Values},${Values},${Values},${Values},${Values}`
				: never | Max extends 6 | 7 | 8 | 9 | 10 | 11 | 12
					? `${Values},${Values},${Values},${Values},${Values},${Values}`
					: never | Max extends 7 | 8 | 9 | 10 | 11 | 12
						? `${Values},${Values},${Values},${Values},${Values},${Values},${Values}`
						: never | Max extends 8 | 9 | 10 | 11 | 12
							? `${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values}`
							: never | Max extends 9 | 10 | 11 | 12
								? `${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values}`
								: never | Max extends 10 | 11 | 12
									? `${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values}`
									: never | Max extends 11 | 12
										? `${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values}`
										: never | Max extends 12
											? `${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values},${Values}`
											: never;

export type DashWildcard<
	From extends InputType,
	To extends InputType,
	InputType extends number | string = number | string,
> = `${From}-${To}`;
export type LastWildcard = "L";
export type WeekdayWildcard = `${number}W`;
export type HashWildcard = `${IntRange<1, 8>}#${IntRange<1, 6>}`;

export type MinuteRange<Min extends number> = IntRange<Min, 60>;
export type Minutes =
	| MinuteRange<0>
	| StarWildcard
	| DashWildcard<MinuteRange<0>, MinuteRange<59>, number>
	| SlashWildcard<MinuteRange<1>, MinuteRange<59>, number>;

export type HourRange<Min extends number> = IntRange<Min, 24>;
export type Hours =
	| HourRange<0>
	| StarWildcard
	| CommaWildcard<HourRange<0>, 12>
	| DashWildcard<HourRange<0>, HourRange<23>>
	| SlashWildcard<HourRange<1>, HourRange<23>>;

export type DayOfMonthRange<Min extends number> = IntRange<Min, 31>;
export type DayOfMonth =
	| DayOfMonthRange<1>
	| StarWildcard
	| CommaWildcard<DayOfMonthRange<1>, 12>
	| DashWildcard<DayOfMonthRange<1>, DayOfMonthRange<31>>
	| SlashWildcard<DayOfMonthRange<1>, DayOfMonthRange<31>>
	| LastWildcard
	| WeekdayWildcard
	| QuestionWildcard;

export type MonthStrings =
	| "JAN"
	| "FEB"
	| "MAR"
	| "APR"
	| "MAY"
	| "JUN"
	| "JUL"
	| "AUG"
	| "SEP"
	| "OCT"
	| "NOV"
	| "DEC";
export type MonthRange<Min extends number> = IntRange<Min, 12> | MonthStrings;
export type Month =
	| StarWildcard
	| CommaWildcard<MonthRange<1>, 12>
	| DashWildcard<MonthRange<1>, MonthRange<12>>
	| SlashWildcard<MonthRange<1>, MonthRange<12>>;

export type DaysOfWeekStrings =
	| "SUN"
	| "MON"
	| "TUE"
	| "WED"
	| "THU"
	| "FRI"
	| "SAT";
export type DaysOfWeekRange<Min extends number> =
	| IntRange<Min, 7>
	| DaysOfWeekStrings;
export type DaysOfWeek =
	| StarWildcard
	| CommaWildcard<DaysOfWeekRange<1>, 7>
	| DashWildcard<DaysOfWeekRange<1>, DaysOfWeekRange<7>>
	| SlashWildcard<DaysOfWeekRange<1>, DaysOfWeekRange<7>>
	| LastWildcard
	| HashWildcard
	| QuestionWildcard;

export type YearRange = number;
export type Year =
	| StarWildcard
	| CommaWildcard<YearRange, 4>
	| DashWildcard<YearRange, YearRange>
	| SlashWildcard<YearRange, YearRange>;

export const ScheduleExpression = (props: {
	minutes: Minutes;
	hours: Hours;
	dayOfMonth: DayOfMonth;
	month: Month;
	daysOfWeek: DaysOfWeek;
	year: Year;
}) => {
	const { minutes, hours, dayOfMonth, month, daysOfWeek, year } = props;
	return `${minutes} ${hours} ${dayOfMonth} ${month} ${daysOfWeek} ${year}`;
};

export type CodeCatalystScheduleTriggerSpec = {
	Type: "SCHEDULE";
	Expression: string;
	Branches: string[];
};
