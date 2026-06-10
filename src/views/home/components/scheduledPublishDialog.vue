<template>
	<div class="scheduled-publish-container">
		<el-dialog v-model="state.dialog.show" :title="state.dialog.title" :close-on-click-modal="false" :show-close="false"
			modal-class="scheduled-publish-dialog" draggable width="720px">
			<el-form ref="scheduleFormRef" size="default" label-width="110px" :model="state.ruleForm" :rules="formRules">
				<el-row :gutter="10">
					<el-col :span="24" style="margin-bottom: 15px">
						<el-form-item label="发布类型" prop="publishType">
							<el-radio-group v-model="state.ruleForm.publishType" size="default">
								<el-radio value="一键发布" border>一键发布</el-radio>
								<el-radio value="手动发布" border>手动发布</el-radio>
							</el-radio-group>
						</el-form-item>
					</el-col>
					<el-col :span="24">
						<el-form-item label="计划时间" prop="scheduledTime">
							<el-date-picker v-model="state.ruleForm.scheduledTime" type="datetime"
								placeholder="选择计划执行时间" value-format="YYYY-MM-DD HH:mm:ss"
								:disabled-date="disabledDate" style="width: 100%" />
						</el-form-item>
					</el-col>
				</el-row>
			</el-form>
			<template #footer>
				<span class="dialog-footer">
					<el-button @click="onCancle" :disabled="state.dialog.submitTxt === '保存中'">取 消</el-button>
					<el-button type="primary" :loading="state.dialog.submitTxt === '保存中'"
						@click="onSaveSchedule">{{ state.dialog.submitTxt }}</el-button>
				</span>
			</template>

			<el-divider />
			<div class="schedule-list-box">
				<div class="schedule-list-title">定时任务列表</div>
				<el-table :data="scheduleList" style="width: 100%" max-height="320" size="small" v-loading="listLoading">
					<el-table-column prop="projectName" label="项目名称" min-width="110" show-overflow-tooltip />
					<el-table-column prop="publishType" label="类型" width="80" />
					<el-table-column label="计划时间" width="150">
						<template #default="{ row }">
							<template v-if="editingId === row.id">
								<el-date-picker v-model="editTimeValue" type="datetime" placeholder="选择新时间"
									value-format="YYYY-MM-DD HH:mm:ss" :disabled-date="disabledDate"
									size="small" style="width: 130px" />
							</template>
							<template v-else>
								{{ row.scheduledTime }}
							</template>
						</template>
					</el-table-column>
					<el-table-column label="状态" width="80">
						<template #default="{ row }">
							<el-tag :type="statusTagType(row.status)" size="small">
								{{ statusText(row.status) }}
							</el-tag>
						</template>
					</el-table-column>
					<el-table-column label="操作" width="180" fixed="right">
						<template #default="{ row }">
							<template v-if="row.status === 'pending'">
								<template v-if="editingId === row.id">
									<el-button size="small" type="primary" link @click="onSaveEditTime(row)">确定</el-button>
									<el-button size="small" link @click="onCancelEditTime">取消</el-button>
								</template>
								<template v-else>
									<el-button size="small" type="primary" plain @click="onStartEditTime(row)">修改时间</el-button>
									<el-button size="small" type="warning" @click="onCancelSchedule(row)">取消</el-button>
								</template>
							</template>
							<template v-else-if="row.status === 'failed'">
								<el-button size="small" type="primary" plain @click="onViewFailReason(row)">查看原因</el-button>
								<el-button size="small" type="danger" @click="onDeleteSchedule(row)">删除</el-button>
							</template>
							<template v-else>
								<el-button size="small" type="danger" @click="onDeleteSchedule(row)">删除</el-button>
							</template>
						</template>
					</el-table-column>
				</el-table>
				<el-empty description="暂无定时任务" :image-size="80" v-if="!listLoading && scheduleList.length < 1" />
			</div>
		</el-dialog>

		<!-- 失败原因对话框 -->
		<el-dialog v-model="failDialog.show" title="失败原因" :close-on-click-modal="false" modal-class="fail-reason-dialog"
			width="560px">
			<div class="fail-reason-content">
				<el-descriptions :column="1" border size="small">
					<el-descriptions-item label="项目名称">{{ failDialog.projectName }}</el-descriptions-item>
					<el-descriptions-item label="发布类型">{{ failDialog.publishType }}</el-descriptions-item>
					<el-descriptions-item label="计划时间">{{ failDialog.scheduledTime }}</el-descriptions-item>
					<el-descriptions-item label="执行时间">{{ failDialog.executeTime || '-' }}</el-descriptions-item>
				</el-descriptions>
				<div class="fail-reason-detail">
					<div class="fail-reason-label">失败详情：</div>
					<el-input type="textarea" :model-value="failDialog.reason" readonly :rows="6"
						placeholder="暂无详细信息" />
				</div>
			</div>
			<template #footer>
				<el-button type="primary" @click="failDialog.show = false">关 闭</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts" name="scheduledPublishDialog">
import { reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePublishScheduleDb } from "@/database/publishSchedule/index";

const emit = defineEmits<{
	refresh: [];
}>();

const publishScheduleDb = usePublishScheduleDb();

const scheduleFormRef = ref();
const scheduleList = ref<RowPublishScheduleType[]>([]);
const listLoading = ref(false);

// 编辑时间状态
const editingId = ref<number | null>(null);
const editTimeValue = ref<string | null>(null);

const state = reactive({
	dialog: {
		show: false,
		title: "定时发布",
		submitTxt: "保 存",
	},
	ruleForm: {
		publishType: "一键发布" as PublishScheduleType,
		scheduledTime: "" as string | null,
	},
});

// 失败原因对话框
const failDialog = reactive({
	show: false,
	projectName: "",
	publishType: "",
	scheduledTime: "",
	executeTime: "",
	reason: "",
});

const formRules = {
	publishType: [{ required: true, message: "请选择发布类型", trigger: "change" }],
	scheduledTime: [{ required: true, message: "请选择计划时间", trigger: "change" }],
};

// 禁用过去的日期时间
const disabledDate = (time: Date) => {
	return time.getTime() < Date.now() - 8.64e7;
};

// 状态标签类型
const statusTagType = (status: PublishScheduleStatus) => {
	switch (status) {
		case 'pending': return 'warning';
		case 'executing': return 'primary';
		case 'completed': return 'success';
		case 'cancelled': return 'info';
		case 'failed': return 'danger';
		default: return 'info';
	}
};

// 状态文字
const statusText = (status: PublishScheduleStatus) => {
	switch (status) {
		case 'pending': return '待执行';
		case 'executing': return '执行中';
		case 'completed': return '已完成';
		case 'cancelled': return '已取消';
		case 'failed': return '失败';
		default: return '未知';
	}
};

// 加载定时任务列表
const loadScheduleList = async () => {
	listLoading.value = true;
	try {
		let dataResult = await publishScheduleDb.getScheduleList({
			skipCount: 0,
			maxResultCount: 100,
		});
		if (dataResult.code === 0) {
			scheduleList.value = dataResult.data.data;
		}
	} catch (error) {
		console.error("加载定时任务列表失败:", error);
	} finally {
		listLoading.value = false;
	}
};

// 保存定时任务
const onSaveSchedule = async () => {
	if (!scheduleFormRef.value) return;
	await scheduleFormRef.value.validate(async (valid: boolean) => {
		if (!valid) return;

		state.dialog.submitTxt = "保存中";
		try {
			if (!currentProjectData.value) {
				ElMessage.warning("未获取到项目信息，请先选择项目和配置！");
				state.dialog.submitTxt = "保 存";
				return;
			}

			const insertResult = await publishScheduleDb.insertSchedule({
				id: 0,
				projectId: currentProjectData.value.projectId,
				projectName: currentProjectData.value.projectName,
				environment: currentProjectData.value.environment,
				appconfigId: currentProjectData.value.appconfigId,
				publishType: state.ruleForm.publishType,
				scheduledTime: state.ruleForm.scheduledTime || "",
				status: 'pending',
				createTime: "",
			});

			if (insertResult.code === 0) {
				ElMessage.success("定时发布任务创建成功！");
				await loadScheduleList();
				emit("refresh");
				// 重置表单
				state.ruleForm.publishType = "一键发布";
				state.ruleForm.scheduledTime = null;
			} else {
				ElMessage.error(insertResult.msg);
			}
		} catch (error) {
			ElMessage.error("保存定时任务失败：" + JSON.stringify(error));
		} finally {
			state.dialog.submitTxt = "保 存";
		}
	});
};

// ===== 修改下次执行时间 =====

// 开始编辑时间
const onStartEditTime = (row: RowPublishScheduleType) => {
	editingId.value = row.id;
	editTimeValue.value = row.scheduledTime;
};

// 取消编辑时间
const onCancelEditTime = () => {
	editingId.value = null;
	editTimeValue.value = null;
};

// 保存编辑时间
const onSaveEditTime = async (row: RowPublishScheduleType) => {
	if (!editTimeValue.value) {
		ElMessage.warning("请选择新的计划时间");
		return;
	}
	try {
		const result = await publishScheduleDb.updateScheduleTime(row.id, editTimeValue.value);
		if (result.code === 0) {
			ElMessage.success("修改执行时间成功");
			editingId.value = null;
			editTimeValue.value = null;
			await loadScheduleList();
		} else {
			ElMessage.error(result.msg);
		}
	} catch (error) {
		ElMessage.error("修改执行时间失败：" + JSON.stringify(error));
	}
};

// 取消定时任务
const onCancelSchedule = async (row: RowPublishScheduleType) => {
	try {
		await ElMessageBox.confirm(`确定要取消计划于 ${row.scheduledTime} 的定时发布任务吗？`, "提示", {
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "warning",
		});
		const result = await publishScheduleDb.updateScheduleStatus(row.id, 'cancelled', '用户取消');
		if (result.code === 0) {
			ElMessage.success("定时任务已取消");
			await loadScheduleList();
			emit("refresh");
		} else {
			ElMessage.error(result.msg);
		}
	} catch {
		// 取消确认框不做操作
	}
};

// 查看失败原因
const onViewFailReason = (row: RowPublishScheduleType) => {
	failDialog.show = true;
	failDialog.projectName = row.projectName;
	failDialog.publishType = row.publishType;
	failDialog.scheduledTime = row.scheduledTime;
	failDialog.executeTime = row.executeTime || '-';
	failDialog.reason = row.resultLog || '未知错误';
};

// 删除定时任务
const onDeleteSchedule = async (row: RowPublishScheduleType) => {
	try {
		await ElMessageBox.confirm(`确定要删除该定时发布任务吗？`, "提示", {
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "warning",
		});
		const result = await publishScheduleDb.deleteSchedule(row.id);
		if (result.code === 0) {
			ElMessage.success("定时任务已删除");
			await loadScheduleList();
		} else {
			ElMessage.error(result.msg);
		}
	} catch {
		// 取消确认框不做操作
	}
};

// 当前项目数据（由外部传入）
const currentProjectData = ref<{
	projectId: number;
	projectName: string;
	environment: number;
	appconfigId: number;
} | null>(null);

// 打开弹窗
const openDialog = (projectData?: {
	projectId: number;
	projectName: string;
	environment: number;
	appconfigId: number;
}) => {
	currentProjectData.value = projectData || null;
	state.ruleForm.publishType = "一键发布";
	state.ruleForm.scheduledTime = null;
	state.dialog.submitTxt = "保 存";
	state.dialog.show = true;
	editingId.value = null;
	editTimeValue.value = null;
	loadScheduleList();
};

// 取消弹窗
const onCancle = () => {
	state.dialog.show = false;
};

defineExpose({
	openDialog,
});
</script>

<style scoped lang="scss">
.scheduled-publish-container {
	.schedule-list-box {
		.schedule-list-title {
			font-size: 15px;
			font-weight: 600;
			margin-bottom: 10px;
			color: var(--el-text-color-primary);
		}
	}
}

.fail-reason-content {
	.fail-reason-detail {
		margin-top: 15px;

		.fail-reason-label {
			font-weight: 600;
			margin-bottom: 8px;
			font-size: 14px;
			color: var(--el-text-color-primary);
		}
	}
}
</style>
