<template>
  <div class="publish-record-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="record-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-input size="default" v-model="state.tableData.param.projectName" placeholder="请输入项目名称" clearable />
          </el-col>
          <el-col :span="5">
            <el-select v-model="state.tableData.param.environment" placeholder="请选择环境" size="default" clearable>
              <el-option label="Dev" :value="1" />
              <el-option label="Uat" :value="2" />
              <el-option label="Pro" :value="3" />
              <el-option label="Other" :value="4" />
            </el-select>
          </el-col>
          <el-col :span="5">
            <el-select v-model="state.tableData.param.result" placeholder="请选择结果" size="default" clearable>
              <el-option v-for="option in resultOptions" :key="option.value" :label="option.label"
                :value="option.value" />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-button size="default" type="primary" class="ml10" @click="onSearch">
              <el-icon>
                <ele-Search />
              </el-icon>
              查询
            </el-button>
            <el-button size="default" class="ml10" @click="onReset">
              <el-icon>
                <ele-RefreshLeft />
              </el-icon>
              重置
            </el-button>
          </el-col>
        </el-row>
      </div>
    </el-card>

    <el-card shadow="hover" class="layout-padding-auto">
      <template #header>
        <div class="record-table-header">
          <el-button
            size="default"
            type="danger"
            :disabled="selectedRows.length === 0"
            :loading="batchDeleting"
            @click="onBatchDelete"
          >
            <el-icon>
              <ele-Delete />
            </el-icon>
            批量删除
          </el-button>
        </div>
      </template>
      <el-table ref="tableRef" :data="state.tableData.data" v-loading="state.tableData.loading" style="width: 100%"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" fixed />
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="projectName" label="项目名称" width="180" show-overflow-tooltip />
        <el-table-column label="环境" width="90">
          <template #default="scope">
            {{ displayEnvironment(Number(scope.row.environment)) }}
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="175">
          <template #default="scope">
            {{ formatDateTime(scope.row.startDate) }}
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="110">
          <template #default="scope">
            {{ formatDuration(scope.row.durationMs) }}
          </template>
        </el-table-column>
        <el-table-column label="结果" width="100">
          <template #default="scope">
            <el-tag :type="resultTagType(scope.row.result)" effect="dark" size="small">
              {{ resultText(scope.row.result) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="续跑次数" width="90" align="center">
          <template #default="scope">{{ scope.row.resumeCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="程序集数" width="90" align="center">
          <template #default="scope">{{ scope.row.dllItems.length }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="scope">
            <el-button size="small" text type="primary" @click="onOpenDetail(scope.row)">详情</el-button>
            <el-button size="small" text type="warning" :disabled="!scope.row.backupId"
              @click="onRollback(scope.row)">回滚</el-button>
            <el-button size="small" text type="danger" @click="onDelete(scope.row)">删除</el-button>
            <el-button size="small" text type="info" @click="onOpenNote(scope.row)">发布说明</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination @size-change="onHandleSizeChange" @current-change="onHandleCurrentChange" class="mt15"
        v-model:current-page="state.tableData.currentPage" background
        v-model:page-size="state.tableData.param.maxResultCount" layout="total, sizes, prev, pager, next, jumper"
        :total="state.tableData.total" />
    </el-card>

    <!-- 发布详情 -->
    <el-drawer v-model="detail.visible" title="发布详情" size="640px" destroy-on-close>
      <template v-if="detail.record">
        <div class="detail-container">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="项目名称">{{ detail.record.projectName }}</el-descriptions-item>
            <el-descriptions-item label="环境">
              {{ displayEnvironment(Number(detail.record.environment)) }}
            </el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ formatDateTime(detail.record.startDate) }}</el-descriptions-item>
            <el-descriptions-item label="结束时间">{{ formatDateTime(detail.record.endDate) }}</el-descriptions-item>
            <el-descriptions-item label="耗时">{{ formatDuration(detail.record.durationMs) }}</el-descriptions-item>
            <el-descriptions-item label="结果">
              <el-tag :type="resultTagType(detail.record.result)" effect="dark" size="small">
                {{ resultText(detail.record.result) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="续跑次数">{{ detail.record.resumeCount ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="关联备份">{{ detail.record.backupId ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="发布范围" :span="2">{{ scopeText(detail.record) }}</el-descriptions-item>
          </el-descriptions>

          <div class="record-block-title">服务发布结果</div>
          <el-table :data="detail.record.serviceResults" size="small" border>
            <el-table-column prop="serviceType" label="服务" width="140" />
            <el-table-column label="结果" width="90">
              <template #default="scope">
                <el-tag :type="scope.row.success ? 'success' : 'danger'" size="small">
                  {{ scope.row.success ? "成功" : "失败" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="错误信息" min-width="240" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.errors.join("；") || "-" }}</template>
            </el-table-column>
          </el-table>

          <div class="record-block-title">
            程序集清单
            <span class="record-block-count">共 {{ detail.record.dllItems.length }} 个</span>
          </div>
          <el-collapse v-if="dllGroups.length > 0" v-model="detail.openGroups" class="record-dll-collapse">
            <el-collapse-item v-for="group in dllGroups" :key="group.service" :name="group.service">
              <template #title>
                <div class="record-group-title">
                  <span class="record-group-name">{{ group.service }}</span>
                  <el-tag size="small" type="info" effect="plain" class="ml10">{{ group.files.length }}</el-tag>
                </div>
              </template>
              <div class="record-dll-list">
                <el-tag v-for="file in group.files" :key="file" size="small" effect="plain"
                  class="record-dll-tag">{{ file }}</el-tag>
              </div>
            </el-collapse-item>
          </el-collapse>
          <span v-else class="record-empty">暂无程序集记录</span>
        </div>
      </template>
    </el-drawer>

    <!-- 发布说明 -->
    <el-drawer v-model="note.visible" title="发布说明" size="600px" destroy-on-close>
      <div class="note-container">
        <pre class="note-text">{{ note.text }}</pre>
      </div>
      <template #footer>
        <div class="note-btn-container">
          <el-button size="default" @click="note.visible = false">关闭</el-button>
          <el-button size="default" type="primary" @click="onExportNote">导出</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 复用备份还原弹窗完成一键回滚 -->
    <restore-dialog ref="restoreDialogRef" @refresh="getTableData()" />
  </div>
</template>

<script setup lang="ts" name="publishRecord">
import { onBeforeMount, reactive, ref, computed, defineAsyncComponent } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { save } from "@tauri-apps/plugin-dialog";
import { usePublishRecordDb } from "@/database/publishRecord";
import { useBackupDb } from "@/database/backups/index";
import { displayEnvironment } from "@/utils/other";
import { formatDate } from "@/utils/formatTime";
import { cmdInvoke } from "@/utils/command";

const publishRecordDb = usePublishRecordDb();
const backupDb = useBackupDb();

const restoreDialogRef = ref();
const RestoreDialog = defineAsyncComponent(
  () => import("@/views/backups/components/restoreDialog.vue")
);

// 表格实例（批量删除后清空勾选）
const tableRef = ref<{ clearSelection: () => void } | null>(null);
// 选中的发布记录
const selectedRows = ref<RowPublishRecordType[]>([]);
// 批量删除中
const batchDeleting = ref(false);

// 表格多选
const handleSelectionChange = (rows: RowPublishRecordType[]) => {
  selectedRows.value = rows;
};

const state = reactive<PublishRecordState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      projectName: null,
      environment: null,
      result: null,
      sorting: "start_date desc",
      skipCount: 0,
      maxResultCount: 10,
    },
  },
});

const detail = reactive<{
  visible: boolean;
  record: RowPublishRecordType | null;
  openGroups: string[];
}>({
  visible: false,
  record: null,
  openGroups: [],
});

const note = reactive<{ visible: boolean; text: string; record: RowPublishRecordType | null }>({
  visible: false,
  text: "",
  record: null,
});

// 结果筛选项
const resultOptions = [
  { value: 0, label: "未完成" },
  { value: 1, label: "成功" },
  { value: 2, label: "失败" },
  { value: 3, label: "已中止" },
];

// 结果文案
const resultText = (result: PublishResultType | null): string => {
  if (result === 1) return "成功";
  if (result === 2) return "失败";
  if (result === 3) return "已中止";
  return "未完成";
};

// 发布范围文案（发布前被「移除」的服务不在其中）
const scopeText = (record: RowPublishRecordType): string => {
  const services = record.stage?.enabledServices ?? [];
  return services.length > 0 ? services.join("、") : "-";
};

// 结果标签颜色
const resultTagType = (
  result: PublishResultType | null
): "success" | "danger" | "warning" | "info" => {
  if (result === 1) return "success";
  if (result === 2) return "danger";
  if (result === 3) return "info";
  return "warning";
};

// 日期时间格式化
const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  return formatDate(new Date(value), "YYYY-mm-dd HH:MM:SS");
};

// 耗时格式化
const formatDuration = (durationMs: number | null): string => {
  if (!durationMs || durationMs < 0) return "-";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

// 程序集分组顺序（与发布页服务顺序保持一致）
const SERVICE_ORDER = ["WebApiHost", "ScheduleServer", "WebClient", "WpfClient", "SpcMonitor"];

// 程序集分组
type DllGroup = { service: string; files: string[] };

/**
 * 按服务类型对程序集清单分组
 * @param items 程序集清单（形如 `WebApiHost/SIE.WebApiHost.dll`）
 */
const groupDllItems = (items: string[]): DllGroup[] => {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const separatorIndex = item.indexOf("/");
    const service = separatorIndex > 0 ? item.slice(0, separatorIndex) : "";
    const file = separatorIndex > 0 ? item.slice(separatorIndex + 1) : item;
    const key = service || "其他";
    const files = groups.get(key) ?? [];
    files.push(file);
    groups.set(key, files);
  }
  const result: DllGroup[] = Array.from(groups.entries()).map(([service, files]) => ({
    service,
    files,
  }));
  result.sort((a, b) => {
    const aIndex = SERVICE_ORDER.indexOf(a.service);
    const bIndex = SERVICE_ORDER.indexOf(b.service);
    return (
      (aIndex < 0 ? SERVICE_ORDER.length : aIndex) -
      (bIndex < 0 ? SERVICE_ORDER.length : bIndex)
    );
  });
  return result;
};

// 当前详情记录按服务类型分组后的程序集
const dllGroups = computed<DllGroup[]>(() => groupDllItems(detail.record?.dllItems ?? []));

// 查询
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;
  const dataResult = await publishRecordDb.getPublishRecordList(state.tableData.param);
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    state.tableData.loading = false;
    return;
  }
  state.tableData.data = dataResult.data.data;
  state.tableData.total = dataResult.data.total;
  state.tableData.loading = false;
};

// 搜索
const onSearch = () => {
  state.tableData.currentPage = 1;
  getTableData();
};

// 重置
const onReset = () => {
  state.tableData.param.projectName = null;
  state.tableData.param.environment = null;
  state.tableData.param.result = null;
  onSearch();
};

// 分页大小改变
const onHandleSizeChange = (val: number) => {
  state.tableData.param.maxResultCount = val;
  getTableData();
};

// 页码改变
const onHandleCurrentChange = (val: number) => {
  state.tableData.currentPage = val;
  getTableData();
};

// 查看详情
const onOpenDetail = (row: RowPublishRecordType) => {
  detail.record = row;
  // 默认展开所有服务分组，便于一眼看完
  detail.openGroups = groupDllItems(row.dllItems).map((group) => group.service);
  detail.visible = true;
};

// 查看发布说明
const onOpenNote = (row: RowPublishRecordType) => {
  note.record = row;
  note.text = row.changeLog?.text || "暂无发布说明";
  note.visible = true;
};

// 导出发布说明
const onExportNote = async () => {
  if (!note.record) return;
  const projectName = note.record.projectName ?? "publish";
  const filePath = await save({
    filters: [{ name: "Markdown", extensions: ["md"] }],
    defaultPath: `${projectName}_release_${note.record.id ?? ""}.md`,
  });
  if (!filePath) return;
  const saveResult = await cmdInvoke("save_content_to_file", {
    content: note.text,
    filePath,
  });
  if (saveResult.code !== 0) {
    ElMessage.error("发布说明导出失败！");
    return;
  }
  ElMessage.success("发布说明导出成功！");
};

// 一键回滚（复用备份还原弹窗，回滚到该次发布前的备份）
const onRollback = async (row: RowPublishRecordType) => {
  if (!row.backupId) {
    ElMessage.warning("该次发布未关联备份，无法一键回滚。");
    return;
  }
  const backupResult = await backupDb.getBackupById(row.backupId);
  if (backupResult.code !== 0 || !backupResult.data) {
    ElMessage.error(backupResult.msg || "关联的备份记录不存在，可能已被删除。");
    return;
  }
  const backupRow = backupResult.data;
  backupRow.backupItems = JSON.parse(backupRow.backupItemsJson ?? "{}") as BackupItemsType;
  try {
    await ElMessageBox.confirm(
      `确认回滚项目“${row.projectName ?? ""}”到 ${formatDateTime(row.startDate)} 发布前的备份吗？`,
      "一键回滚",
      {
        type: "warning",
        confirmButtonText: "确定",
        cancelButtonText: "取消",
      }
    );
  } catch {
    return;
  }
  restoreDialogRef.value.openDialog(backupRow);
};

// 删除记录
const onDelete = async (row: RowPublishRecordType) => {
  try {
    await ElMessageBox.confirm(`确认删除发布记录 #${row.id ?? ""} 吗？`, "删除发布记录", {
      type: "warning",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  const deleteResult = await publishRecordDb.deletePublishRecord(Number(row.id));
  if (deleteResult.code !== 0) {
    ElMessage.error(deleteResult.msg);
    return;
  }
  ElMessage.success("删除成功！");
  selectedRows.value = [];
  tableRef.value?.clearSelection();
  await getTableData();
};

// 批量删除
const onBatchDelete = async () => {
  if (selectedRows.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `此操作将永久删除选中的 ${selectedRows.value.length} 条发布记录，是否确认？`,
      "批量删除发布记录",
      {
        type: "warning",
        confirmButtonText: "确定",
        cancelButtonText: "取消",
      }
    );
  } catch {
    return;
  }
  const ids = selectedRows.value.map((row) => Number(row.id));
  batchDeleting.value = true;
  try {
    const deleteResult = await publishRecordDb.deletePublishRecords(ids);
    if (deleteResult.code !== 0) {
      ElMessage.error(deleteResult.msg);
      return;
    }
    ElMessage.success(`已删除 ${ids.length} 条发布记录！`);
    selectedRows.value = [];
    tableRef.value?.clearSelection();
    await getTableData();
  } finally {
    batchDeleting.value = false;
  }
};

onBeforeMount(async () => {
  await getTableData();
});
</script>

<style scoped lang="scss">
.publish-record-container {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;

    .el-table {
      flex: 1;
    }
  }

  .record-table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .record-block-title {
    margin: 16px 0 8px;
    font-weight: 600;
    font-size: 14px;
  }

  .record-block-count {
    margin-left: 8px;
    font-weight: 400;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .record-dll-collapse {
    border-top: none;

    :deep(.el-collapse-item__header) {
      height: 36px;
      line-height: 36px;
    }

    .record-group-title {
      display: flex;
      align-items: center;
      font-size: 13px;
      font-weight: 600;

      .record-group-name {
        color: var(--el-text-color-primary);
      }
    }
  }

  .record-dll-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .record-dll-tag {
      margin-bottom: 4px;
      font-family: var(--el-font-family-mono, monospace);
    }

    .record-empty {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }

  .detail-container {
    padding: 15px;
  }

  .note-container {
    padding: 15px;
  }

  .note-btn-container {
    text-align: center;
    padding: 10px;
  }
}
</style>
