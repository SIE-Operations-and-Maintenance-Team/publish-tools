// 申明外部 npm 插件模块
declare module 'vue-grid-layout';
declare module 'js-cookie';
declare module 'lodash';

// 声明一个模块，防止引入文件时报错
declare module '*.json';
declare module '*.png';
declare module '*.jpg';
declare module '*.scss';
declare module '*.ts';
declare module '*.js';

// 声明文件，*.vue 后缀的文件交给 vue 模块来处理
declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<{}, {}, any>;
	export default component;
}

// 声明文件，定义全局变量
/* eslint-disable */
declare interface Window {
	nextLoading: boolean;
	BMAP_SATELLITE_MAP: any;
	BMap: any;
}

// vite define 注入的全局常量（来源：package.json，见 vite.config.ts）
declare const __NEXT_VERSION__: string;
declare const __NEXT_NAME__: string;

// 声明路由当前项类型
declare type RouteItem<T = any> = {
	path: string;
	name?: string | symbol | undefined | null;
	redirect?: string;
	k?: T;
	meta?: {
		title?: string;
		isLink?: string;
		isHide?: boolean;
		isKeepAlive?: boolean;
		isAffix?: boolean;
		isIframe?: boolean;
		roles?: string[];
		icon?: string;
		isDynamic?: boolean;
		isDynamicPath?: string;
		isIframeOpen?: string;
		loading?: boolean;
	};
	children: T[];
	query?: { [key: string]: T };
	params?: { [key: string]: T };
	contextMenuClickId?: string | number;
	commonUrl?: string;
	isFnClick?: boolean;
	url?: string;
	transUrl?: string;
	title?: string;
	id?: string | number;
};

// 声明路由 to from
declare interface RouteToFrom<T = any> extends RouteItem {
	path?: string;
	children?: T[];
}

// 声明路由当前项类型集合
declare type RouteItems<T extends RouteItem = any> = T[];

// 声明 ref
declare type RefType<T = any> = T | null;

// 声明 HTMLElement
declare type HtmlType = HTMLElement | string | undefined | null;

// 申明 children 可选
declare type ChilType<T = any> = {
	children?: T[];
};

// 申明 数组
declare type EmptyArrayType<T = any> = T[];

// 申明 对象
declare type EmptyObjectType<T = any> = {
	[key: string]: T;
};

// 对话框表单
declare type FormDialogType<T = any> = {
	ruleForm: T;
	dialog: {
		show: boolean;
		type: "add" | "edit" | "viewer";
		editId?: number | null;
		title: string;
		submitTxt: string;
	};
}

// 声明 select option
declare type SelectOptionType = {
	value: string | number;
	label: string | number;
};

declare type ServerPublishType = {
	identity: string | null;
	path: string | null;
};

// 声明 server option
declare type ServerOptionType = {
	value: ServerPublishType[] | null;
	label: string | null;
};

// 鼠标滚轮滚动类型
declare interface WheelEventType extends WheelEvent {
	wheelDelta: number;
}

// table 数据格式公共类型
declare interface TableType<T = any> {
	total: number;
	loading: boolean;
	currentPage: number;
	param: T;
}

// table 表格分页响应结果
declare interface TableResultType<T = any> {
	total: number;
	data: T;
}

// 请求数据响应结果
declare interface DataResultType<T = any> {
	code: 0 | 1 | -1; // 0：成功、1：失败、-1：出错
	msg: string,
	data: T;
}

// 上传文件数量
declare type LogPrintType = {
	content: LogContentType;
	type: "log-info" | "log-warning" | "log-error" | "log-success";
};

// 日志内容
declare type LogContentType = {
	value: string;
	uploadFile: UploadFileNumberType;
};

// 上传文件数量
declare type UploadFileNumberType = {
	currNumber: number;
	totalNumber: number;
	prefix?: string;
};

// 发布信息类型
declare type PublishInfoType = {
	id: number;
	user: string;
	date: string;
	dateTime: string;
	commentText: string;
	comments: string[];
	items: string[];
}

// 显示发布内容类型
declare type DisplayPublishFieldType = {
	isChangeSet: boolean;
	isUser: boolean;
	isDateTime: boolean;
	isDll: boolean;
}