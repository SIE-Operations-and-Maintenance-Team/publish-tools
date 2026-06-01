// tfsTableParam
declare type GetTfsTableParams = {
	skipCount: number;
	maxResultCount: number;
	tfsName: string | null;
	tfsSourcePath: string | null;
	sorting: string | null;
}

// selectTfs
declare type tfsSelectValueType = {
	placeholder: string;
	value: string;
};
declare type SelectTfsType = {
	id: number | null;
	tfsName: string | null;
	selectModel: "日期" | "变更集",
	selectValue: tfsSelectValueType[];
};

// tfs
declare type RowTfsType = {
	id: number | null;
	tfsName: string | null;
	tfsServerUrl: string | null;
	tfsSourcePath: string | null;
	tfsLocalPath: string | null;
	tfvcPath: string | null;
	remark: string | null;
};

interface TfsTableType extends TableType<GetTfsTableParams> {
	data: RowTfsType[];
}

declare interface TfsState {
	tableData: TfsTableType;
}
