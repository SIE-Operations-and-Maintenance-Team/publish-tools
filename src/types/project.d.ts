// projectTableParam
declare type GetProjectTableParams = {
	skipCount: number;
	maxResultCount: number;
	code: string | null;
	name: string | null;
	sorting: string | null;
}

// project
declare type RowProjectType = {
	id: number | null;
	code: string | null;
	name: string | null;
	description: string | null;
	isDefault: number | null;
	assemblyOutPath: string | null;
	backupBasePath: string | null;
};

interface ProjectTableType extends TableType<GetProjectTableParams> {
	data: RowProjectType[];
}

declare interface ProjectState {
	tableData: ProjectTableType;
}
